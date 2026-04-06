/**
 * Vercel / local: build branded .pptx from { slides }.
 * Requires assets/magnit-template.pptx in the deployment (commit it).
 */

import { buildMagnitPptx } from "../lib/buildMagnitPptx.mjs";

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

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST, OPTIONS");
    return res.status(405).json({ error: "Method not allowed" });
  }

  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    return res.status(400).json({ error: "Invalid JSON body" });
  }

  const slides = body?.slides;
  if (!Array.isArray(slides) || slides.length === 0) {
    return res.status(400).json({ error: "Body must include { slides: [{ title, bullets }] }" });
  }

  try {
    const buf = await buildMagnitPptx(slides);
    const name = (body?.filename || "Magnit-Deck").replace(/[^\w\-]+/g, "-").slice(0, 80);
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    );
    res.setHeader("Content-Disposition", `attachment; filename="${name}.pptx"`);
    return res.status(200).send(Buffer.from(buf));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Export failed";
    return res.status(500).json({ error: msg });
  }
}
