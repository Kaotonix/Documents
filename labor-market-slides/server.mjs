import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { buildMagnitPptx } from "./lib/buildMagnitPptx.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = __dirname;
const isProd = process.env.NODE_ENV === "production";
const PORT = Number(process.env.PORT) || (isProd ? 3001 : 5173);

const app = express();
app.use(express.json({ limit: "2mb" }));

function getApiKey(req) {
  const envKey = process.env.OPENAI_API_KEY;
  const auth = req.headers.authorization || "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  return envKey || bearer || "";
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

app.post("/api/plan-deck", async (req, res) => {
  const apiKey = getApiKey(req);
  if (!apiKey) {
    return res.status(401).json({
      error:
        "Set OPENAI_API_KEY in the environment, or send Authorization: Bearer <key> from the app.",
    });
  }
  const prompt = req.body?.prompt;
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
    return res.json(deck);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Request failed";
    return res.status(502).json({ error: msg });
  }
});

app.post("/api/export-pptx", async (req, res) => {
  try {
    const slides = req.body?.slides;
    if (!Array.isArray(slides) || slides.length === 0) {
      return res.status(400).json({ error: "Body must include { slides: [{ title, bullets }] }" });
    }
    const buf = await buildMagnitPptx(slides);
    const name = (req.body?.filename || "Magnit-Deck").replace(/[^\w\-]+/g, "-").slice(0, 80);
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    );
    res.setHeader("Content-Disposition", `attachment; filename="${name}.pptx"`);
    return res.send(Buffer.from(buf));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Export failed";
    return res.status(500).json({ error: msg });
  }
});

async function start() {
  if (isProd) {
    const dist = path.join(root, "dist");
    app.use(express.static(dist));
    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api")) return next();
      res.sendFile(path.join(dist, "index.html"));
    });
  } else {
    const { createServer } = await import("vite");
    const vite = await createServer({
      root,
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, () => {
    console.log(`Open http://localhost:${PORT}`);
    if (isProd) console.log("Serving static dist/");
    else console.log("Dev: UI + /api on one port (no separate Vite process).");
  });
}

start().catch((e) => {
  console.error(e);
  process.exit(1);
});
