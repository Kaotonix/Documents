/**
 * Vercel / local: plan deck JSON from user prompt (OpenAI).
 * Set OPENAI_API_KEY in Vercel → Environment Variables.
 */

async function readJsonBody(req) {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === "string") {
      try {
        return JSON.parse(req.body);
      } catch {
        return {};
      }
    }
    if (Buffer.isBuffer(req.body)) {
      try {
        return JSON.parse(req.body.toString("utf8"));
      } catch {
        return {};
      }
    }
    if (typeof req.body === "object") return req.body;
  }
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  return JSON.parse(raw);
}

const DECK_SCHEMA = `Return ONLY valid JSON (no markdown) with this shape:
{
  "deckTitle": "short overall title",
  "slides": [
    {
      "title": "slide title",
      "bullets": ["insight or point 1", "point 2", "up to 6 bullets"]
    }
  ]
}
Rules: 4–8 slides. Bullets must be concise (max ~120 chars each). Use Montserrat-friendly plain text. If the user asks for data you cannot verify, say so in bullets and suggest checking the primary source.`;

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST, OPTIONS");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const envKey = process.env.OPENAI_API_KEY;
  const auth = req.headers.authorization || "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const apiKey = envKey || bearer;

  if (!apiKey) {
    return res.status(401).json({
      error:
        "No API key. In Vercel, set OPENAI_API_KEY for the project, or send Authorization: Bearer <key>.",
    });
  }

  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    return res.status(400).json({ error: "Invalid JSON body" });
  }

  const prompt = body?.prompt;
  if (!prompt || typeof prompt !== "string") {
    return res.status(400).json({ error: "JSON body must include { prompt: string }" });
  }

  try {
    const upstream = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        temperature: 0.5,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `You help build executive PowerPoint decks for Magnit Global. ${DECK_SCHEMA}`,
          },
          { role: "user", content: prompt.trim().slice(0, 12000) },
        ],
      }),
    });

    const text = await upstream.text();
    if (!upstream.ok) {
      return res.status(upstream.status).type("application/json").send(text);
    }

    const data = JSON.parse(text);
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      return res.status(502).json({ error: "Empty model response" });
    }

    let deck;
    try {
      deck = JSON.parse(content);
    } catch {
      return res.status(502).json({ error: "Model did not return valid JSON", raw: content.slice(0, 500) });
    }

    if (!deck.slides || !Array.isArray(deck.slides)) {
      return res.status(502).json({ error: "Invalid deck shape", deck });
    }

    deck.slides = deck.slides.map((s) => ({
      title: String(s.title || "Slide"),
      bullets: Array.isArray(s.bullets) ? s.bullets.map(String).slice(0, 8) : [],
    }));

    return res.status(200).json(deck);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Request failed";
    return res.status(502).json({ error: msg });
  }
}
