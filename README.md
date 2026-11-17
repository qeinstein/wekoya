# Bridge Model Compare — Built for Wekoya

When developers visit Bridge, the biggest decision they face isn't *whether* to use an LLM—it's *which* model fits their budget and latency requirements. Most developers don't want to spin up a scratch script just to benchmark 3 or 4 candidates.

Rather than building another generic chatbot or wrapper that hides what Bridge actually does, I built a **Model Comparison Playground**.

### Why this matters for Bridge:
- **Directly demonstrates the core value proposition:** Accessing models across OpenAI, Anthropic, Google, and open-source providers through one unified endpoint without juggling separate API accounts.
- **Real-world unit economics:** Displays exact latency and token costs directly in Naira (₦), so developers can make immediate trade-off decisions between speed, quality, and price.
- **Ready for integration:** It’s a self-contained, lightweight interface with serverless proxying to protect API keys. It can be embedded directly into Wekoya's landing page or developer console as an interactive product demo (with preset prompts or rate limits for public visitors).

It’s a focused tool designed to improve developer conversion and retention by solving an immediate onboarding problem.
