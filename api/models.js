// api/models.js — Vercel serverless function
// Fetches Bridge's model catalogue and forwards it to the client.
// The API key stays on the server; the browser never sees it.

const BASE_URL = (process.env.WEKOYA_BASE_URL ?? "https://wekoya-api.wekoya.tech/v1").replace(/\/+$/, "");

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.WEKOYA_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "WEKOYA_API_KEY is not set on the server." });
  }

  try {
    const r = await fetch(`${BASE_URL}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!r.ok) {
      const err = await r.text();
      return res.status(r.status).json({ error: err });
    }

    const data = await r.json();
    // Keep only chat-capable models (exclude auto, embedding-only, etc.)
    const models = (data.data || []).filter(
      (m) => m.id !== "auto" && m.wekoya?.cost_per_million !== null
    );

    res.status(200).json({ models, currency: data.currency || "NGN" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
