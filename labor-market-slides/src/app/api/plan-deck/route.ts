import OpenAI from "openai";
import type { DeckPlan } from "@/lib/deck-types";

export const runtime = "nodejs";
export const maxDuration = 120;

const SYSTEM = `You are an expert labor market research analyst preparing executive slide decks.
Each slide must be factual, concise, and suitable for workforce / staffing leadership.
Use clear business language. Prefer metrics and trends when the user implies data; otherwise use qualitative insights and labeled assumptions.
Do not invent specific statistics or employer names unless the user supplied them—use ranges or "typical patterns" instead.

Return JSON only, matching the schema. Include 8–14 slides unless the user asks for a different length.
First slide should be a title slide: title = deck title, bullets = optional subtitle lines (1–2 short lines) or empty array.
Content slides: 3–5 bullets each, parallel structure where possible.`;

export async function POST(req: Request) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    return Response.json(
      { error: "Missing OPENAI_API_KEY on the server." },
      { status: 500 },
    );
  }

  let body: { prompt?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt || prompt.length > 32000) {
    return Response.json(
      { error: "Provide a non-empty prompt (max 32000 characters)." },
      { status: 400 },
    );
  }

  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

  const openai = new OpenAI({ apiKey: key });

  try {
    const completion = await openai.chat.completions.create({
      model,
      temperature: 0.5,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "labor_market_deck",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["deckTitle", "slides"],
            properties: {
              deckTitle: { type: "string" },
              slides: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["title", "bullets"],
                  properties: {
                    title: { type: "string" },
                    bullets: {
                      type: "array",
                      items: { type: "string" },
                    },
                  },
                },
              },
            },
          },
        },
      },
      messages: [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: `Labor market research brief:\n\n${prompt}`,
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) {
      return Response.json(
        { error: "No content from the model." },
        { status: 502 },
      );
    }

    const plan = JSON.parse(raw) as DeckPlan;
    if (!plan.deckTitle || !Array.isArray(plan.slides) || plan.slides.length === 0) {
      return Response.json(
        { error: "Model returned an invalid deck structure." },
        { status: 502 },
      );
    }

    const maxSlides = 24;
    if (plan.slides.length > maxSlides) {
      plan.slides = plan.slides.slice(0, maxSlides);
    }

    return Response.json(plan);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Plan generation failed.";
    return Response.json({ error: message }, { status: 502 });
  }
}
