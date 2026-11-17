# Bridge Model Compare

A single-page **Model Comparison Playground** powered by [Bridge (Wekoya)](https://bridge.wekoya.tech).

Enter a prompt → select up to 4 models → see responses side by side with **latency**, **cost in ₦**, and **token counts**.

---

## Stack

| Layer    | Tech                              |
|----------|-----------------------------------|
| Backend  | Node.js + Express (key proxy)     |
| Frontend | Vanilla HTML / CSS / JS (no framework) |
| API      | Bridge by Wekoya (OpenAI-compatible) |

---

## Setup

### 1. Clone & install
```bash
cd bridge-model-compare
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
```
Edit `.env` and set your Bridge API key:
```
WEKOYA_API_KEY=wk_live_your_key_here
```
Get a key at https://bridge.wekoya.tech/console/keys

### 3. Run
```bash
npm run dev      # development (auto-restarts)
npm start        # production
```

Open http://localhost:3000

---

## How it works

```
Browser → POST /api/compare → Node proxy → Bridge API (parallel) → results
```

- The API key **never leaves the server** — the browser only talks to your local Express endpoint.
- All models are fetched live from Bridge's `/models` catalogue on page load.
- Requests fire in **parallel** (`Promise.all`), so total wait time ≈ slowest model.

---

## Features

- **Up to 4 models** compared simultaneously
- **Beige / Dark** theme toggle (persisted in localStorage)
- **Provider filter** pills + search box
- Per-card metrics: latency, total cost in ₦, token count
- **⚡ Fastest** and **💰 Cheapest** badges across the comparison set
- **Details modal**: full metric table + raw API response JSON
- **Random** model selector for quick exploration
- Fully responsive (stacks to 1 column on mobile)

---

## Project structure

```
├── src/
│   └── server.js          # Express backend + Bridge proxy
├── public/
│   ├── index.html         # Single page
│   ├── style.css          # Beige + dark themes
│   └── app.js             # All frontend logic
├── .env.example
├── package.json
└── README.md
```

---

## Embedding in an existing site

The backend exposes two clean endpoints:

| Endpoint           | Method | Purpose                        |
|--------------------|--------|--------------------------------|
| `/api/models`      | GET    | Fetch Bridge model catalogue   |
| `/api/compare`     | POST   | Run prompt against N models    |

Mount the Express router or replicate those two routes in any existing Node.js app. The frontend is plain HTML/CSS/JS — no build step required.
