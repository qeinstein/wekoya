// api/compare.js — Vercel serverless function
// Runs the same prompt against all requested models in parallel through Bridge.
// Body: { prompt: string, models: string[] }
// Returns: { results: CompareResult[] }

const BASE_URL = (process.env.WEKOYA_BASE_URL ?? "https://wekoya-api.wekoya.tech/v1").replace(/\/+$/, "");

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.WEKOYA_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "WEKOYA_API_KEY is not set on the server." });
  }

  const { prompt, models } = req.body;

  if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
    return res.status(400).json({ error: "prompt is required" });
  }
  if (!Array.isArray(models) || models.length < 1 || models.length > 4) {
    return res.status(400).json({ error: "Select between 1 and 4 models" });
  }

  const callModel = async (modelId) => {
    const start = Date.now();
    try {
      // Doc: build URL as a string — never new URL("/path", base) which drops /v1
      const r = await fetch(`${BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: modelId,
          messages: [{ role: "user", content: prompt.trim() }],
          stream: false,
        }),
      });
      const latencyMs = Date.now() - start;

      // Doc: always check body.error — slow replies can 200 with an error in the body
      const body = await r.json();
      if (body.error) {
        return {
          modelId, ok: false, latencyMs,
          error: body.error?.message || String(body.error),
        };
      }
      if (!r.ok) {
        return { modelId, ok: false, latencyMs, error: `HTTP ${r.status}` };
      }

      const choice = body.choices?.[0];
      const usage  = body.usage || {};

      return {
        modelId,
        ok: true,
        content:      choice?.message?.content || "",
        finishReason: choice?.finish_reason || null,
        latencyMs,
        usage: {
          promptTokens:     usage.prompt_tokens     || 0,
          completionTokens: usage.completion_tokens || 0,
          totalTokens:      usage.total_tokens      || 0,
          // Prompt caching is automatic on Bridge — cached_tokens shows savings
          cachedTokens:     usage.prompt_tokens_details?.cached_tokens ?? 0,
        },
        cost: {
          // Bridge returns NGN cost in body.wekoya.cost (confirmed from live API)
          totalNGN: body.wekoya?.cost ?? null,
          currency: body.wekoya?.currency ?? "NGN",
        },
        raw: body,
      };
    } catch (e) {
      console.error(`[compare] ${modelId} failed:`, e.message);
      return {
        modelId, ok: false,
        error: e.message,
        latencyMs: Date.now() - start,
      };
    }
  };

  // Fire all models in parallel
  const results = await Promise.all(models.map(callModel));
  res.status(200).json({ results });
}
