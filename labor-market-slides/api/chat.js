/**
 * Vercel serverless: proxies OpenAI chat completions (avoids browser CORS).
 *
 * Production: set OPENAI_API_KEY in Vercel → Project → Environment Variables.
 * Local / fallback: send Authorization: Bearer <key> from the app Settings.
 *
 * If OPENAI_API_KEY is set, it is always used (client-sent key is ignored).
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

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const envKey = process.env.OPENAI_API_KEY;
  const auth = req.headers.authorization || "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const apiKey = envKey || bearer;

  if (!apiKey) {
    return res.status(401).json({
      error:
        "No API key. In Vercel, set OPENAI_API_KEY for the project, or add a key in Settings when running locally.",
    });
  }

  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    return res.status(400).json({ error: "Expected JSON body (OpenAI chat/completions shape)." });
  }

  if (!body || typeof body !== "object") {
    return res.status(400).json({ error: "Expected JSON body (OpenAI chat/completions shape)." });
  }

  try {
    const upstream = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    const text = await upstream.text();
    const ct = upstream.headers.get("content-type") || "application/json";
    res.status(upstream.status);
    res.setHeader("Content-Type", ct);
    return res.send(text);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Upstream request failed";
    return res.status(502).json({ error: msg });
  }
}
