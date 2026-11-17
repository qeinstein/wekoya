require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "../public")));

// Read Bridge config from env — doc: WEKOYA_API_KEY required, WEKOYA_BASE_URL optional
const BASE_URL = (process.env.WEKOYA_BASE_URL ?? "https://wekoya-api.wekoya.tech/v1").replace(/\/+$/, "");
const API_KEY  = process.env.WEKOYA_API_KEY;

if (!API_KEY) {
  console.error("\nWEKOYA_API_KEY is not set. Add it to .env (see .env.example).\n");
  process.exit(1);
}

// Doc: join URL as a string — never use new URL("/path", base) which drops /v1
const bridgeUrl = (path) => `${BASE_URL}${path}`;

// ── GET /api/models ──────────────────────────────────────────────────────────
// Fetches the public model catalogue from Bridge and forwards it to the client.
// Doc: GET /models needs no key, but we send it anyway (no harm, helps if key-scoped).
app.get("/api/models", async (_req, res) => {
  try {
    const r = await fetch(bridgeUrl("/models"), {
      headers: { Authorization: `Bearer ${API_KEY}` },
    });
    if (!r.ok) {
      const err = await r.text();
      return res.status(r.status).json({ error: err });
    }
    const data = await r.json();
    // Keep only chat-capable models (exclude auto, and models with no cost — e.g. embedding-only)
    const models = (data.data || []).filter(
      (m) => m.id !== "auto" && m.wekoya?.cost_per_million !== null
    );
    res.json({ models, currency: data.currency || "NGN" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/compare ─────────────────────────────────────────────────────────
// Runs the same prompt against all requested models in parallel.
// Body: { prompt: string, models: string[] }
// Returns: { results: CompareResult[] }
app.post("/api/compare", async (req, res) => {
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
      // Doc: use string join — bridgeUrl() does BASE_URL + "/chat/completions"
      const r = await fetch(bridgeUrl("/chat/completions"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({
          model: modelId,
          messages: [{ role: "user", content: prompt.trim() }],
          stream: false,
        }),
      });
      const latencyMs = Date.now() - start;

      // Doc: always check for an error field — slow replies can answer 200 with error in body
      const body = await r.json();
      if (body.error) {
        return {
          modelId, ok: false, latencyMs,
          error: body.error?.message || String(body.error),
        };
      }
      if (!r.ok) {
        return {
          modelId, ok: false, latencyMs,
          error: `HTTP ${r.status}`,
        };
      }

      const choice = body.choices?.[0];
      const usage  = body.usage || {};

      // Doc: Bridge returns NGN costs in body.usage fields (prompt_cost, completion_cost, total_cost)
      // These are top-level on usage when present, alongside standard token counts.
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
          // Cached tokens for display (prompt caching is automatic on Bridge)
          cachedTokens:     usage.prompt_tokens_details?.cached_tokens ?? 0,
        },
        cost: {
          // Bridge returns total NGN cost in body.wekoya.cost (confirmed from live API)
          // No per-token split is returned; compute estimates from pricing if needed
          totalNGN:  body.wekoya?.cost ?? null,
          currency:  body.wekoya?.currency ?? "NGN",
        },
        // Raw response — shown in the detail modal
        raw: body,
      };
    } catch (e) {
      // Doc: on non-2xx, log status and error.type server-side, show friendly message
      console.error(`[compare] ${modelId} failed:`, e.message);
      return {
        modelId, ok: false,
        error: e.message,
        latencyMs: Date.now() - start,
      };
    }
  };

  // Doc: fire all models in parallel
  const results = await Promise.all(models.map(callModel));
  res.json({ results });
});

// ── Fallback: serve index.html ────────────────────────────────────────────────
app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\nBridge Model Compare running at http://localhost:${PORT}\n`);
});
