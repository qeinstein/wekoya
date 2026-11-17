/* ══════════════════════════════════════════════════════════════════════════
   Bridge Model Compare · app.js
   ══════════════════════════════════════════════════════════════════════════ */

// ── State ─────────────────────────────────────────────────────────────────
let allModels = [];        // full catalogue from /api/models
let selectedModels = [];   // array of model ids (max 4)
let activeProvider = null; // currently filtered provider
let lastResults = [];      // last set of compare results

// ── Provider colour map ───────────────────────────────────────────────────
const PROVIDER_COLORS = {
  openai:    "var(--provider-openai)",
  anthropic: "var(--provider-anthropic)",
  google:    "var(--provider-google)",
  meta:      "var(--provider-meta)",
  deepseek:  "var(--provider-deepseek)",
  mistral:   "var(--provider-mistral)",
  xai:       "var(--provider-xai)",
};
function providerColor(p) { return PROVIDER_COLORS[p] || "var(--provider-other)"; }

// ── DOM refs ──────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const themeToggle     = $("themeToggle");
const promptInput     = $("promptInput");
const charCount       = $("charCount");
const modelGrid       = $("modelGrid");
const providerFilters = $("providerFilters");
const selectedBadges  = $("selectedBadges");
const runBtn          = $("runBtn");
const runHint         = $("runHint");
const resultsSection  = $("resultsSection");
const resultsGrid     = $("resultsGrid");
const modalOverlay    = $("modalOverlay");
const modalTitle      = $("modalTitle");
const modalBody       = $("modalBody");
const modelSearch     = $("modelSearch");

// ── Theme ─────────────────────────────────────────────────────────────────
themeToggle.addEventListener("change", () => {
  document.body.className = themeToggle.checked ? "theme-dark" : "theme-beige";
  localStorage.setItem("bridge-theme", themeToggle.checked ? "dark" : "beige");
});
// Restore saved theme
(function () {
  const saved = localStorage.getItem("bridge-theme");
  if (saved === "dark") {
    document.body.className = "theme-dark";
    themeToggle.checked = true;
  }
})();

// ── Char count ────────────────────────────────────────────────────────────
promptInput.addEventListener("input", () => {
  charCount.textContent = promptInput.value.length;
  updateRunBtn();
});

// ── Load models ───────────────────────────────────────────────────────────
async function loadModels() {
  try {
    const res = await fetch("/api/models");
    if (!res.ok) throw new Error(await res.text());
    const { models } = await res.json();
    allModels = models;
    buildProviderFilters();
    renderModelGrid();
  } catch (e) {
    modelGrid.innerHTML = `<div class="no-results" style="color:var(--error)">Failed to load models: ${e.message}</div>`;
  }
}

function buildProviderFilters() {
  const providers = [...new Set(allModels.map(m => m.owned_by))].sort();
  providerFilters.innerHTML = "";
  providers.forEach(p => {
    const btn = document.createElement("button");
    btn.className = "provider-pill";
    btn.textContent = p;
    btn.dataset.provider = p;
    btn.addEventListener("click", () => {
      if (activeProvider === p) {
        activeProvider = null;
        btn.classList.remove("active");
      } else {
        document.querySelectorAll(".provider-pill").forEach(b => b.classList.remove("active"));
        activeProvider = p;
        btn.classList.add("active");
      }
      renderModelGrid();
    });
    providerFilters.appendChild(btn);
  });
}

function renderModelGrid() {
  const query = modelSearch.value.toLowerCase().trim();
  let filtered = allModels;
  if (activeProvider) filtered = filtered.filter(m => m.owned_by === activeProvider);
  if (query) {
    filtered = filtered.filter(m =>
      m.display_name.toLowerCase().includes(query) ||
      m.id.toLowerCase().includes(query) ||
      m.owned_by.toLowerCase().includes(query)
    );
  }

  if (filtered.length === 0) {
    modelGrid.innerHTML = `<div class="no-results">No models match your search.</div>`;
    return;
  }

  modelGrid.innerHTML = "";
  filtered.forEach(m => {
    const isSelected = selectedModels.includes(m.id);
    const isDisabled = !isSelected && selectedModels.length >= 4;

    const card = document.createElement("div");
    card.className = ["model-card", isSelected && "selected", isDisabled && "disabled"].filter(Boolean).join(" ");
    card.dataset.id = m.id;

    const inputNgn = m.wekoya?.cost_per_million?.input;
    const priceStr = inputNgn != null ? `₦${Number(inputNgn).toLocaleString()}/M in` : "";

    card.innerHTML = `
      <div class="model-check">
        <svg viewBox="0 0 12 10" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 5 4.5 9 11 1"/></svg>
      </div>
      <div class="model-name">${escHtml(m.display_name)}</div>
      <div class="model-meta">
        <span class="provider-dot" style="background:${providerColor(m.owned_by)}"></span>
        <span class="model-provider-label">${escHtml(m.owned_by)}</span>
        ${priceStr ? `<span class="model-price">${priceStr}</span>` : ""}
      </div>
    `;

    card.addEventListener("click", () => toggleModel(m.id));
    modelGrid.appendChild(card);
  });
}

// ── Model selection ───────────────────────────────────────────────────────
function toggleModel(id) {
  if (selectedModels.includes(id)) {
    selectedModels = selectedModels.filter(x => x !== id);
  } else {
    if (selectedModels.length >= 4) return;
    selectedModels.push(id);
  }
  renderModelGrid();
  renderBadges();
  updateRunBtn();
}

function renderBadges() {
  selectedBadges.innerHTML = "";
  selectedModels.forEach(id => {
    const m = allModels.find(x => x.id === id);
    const name = m ? m.display_name : id;
    const span = document.createElement("div");
    span.className = "selected-badge";
    span.innerHTML = `
      <span class="provider-dot" style="background:${providerColor(m?.owned_by || "")}"></span>
      ${escHtml(name)}
      <span class="badge-remove" data-id="${id}" title="Remove">✕</span>
    `;
    span.querySelector(".badge-remove").addEventListener("click", () => toggleModel(id));
    selectedBadges.appendChild(span);
  });
}

function updateRunBtn() {
  const hasPrompt  = promptInput.value.trim().length > 0;
  const hasModels  = selectedModels.length >= 1;
  runBtn.disabled  = !(hasPrompt && hasModels);
  if (!hasPrompt && !hasModels) runHint.textContent = "Enter a prompt and select at least 1 model";
  else if (!hasPrompt)          runHint.textContent = "Enter a prompt to run";
  else if (!hasModels)          runHint.textContent = "Select at least 1 model to run";
  else                          runHint.textContent = `Compare ${selectedModels.length} model${selectedModels.length > 1 ? "s" : ""}`;
}

// Search
modelSearch.addEventListener("input", renderModelGrid);

// Clear / random buttons
$("clearModels").addEventListener("click", () => {
  selectedModels = [];
  renderModelGrid();
  renderBadges();
  updateRunBtn();
});

$("randomModels").addEventListener("click", () => {
  const pool = [...allModels];
  const count = Math.min(4, pool.length);
  selectedModels = [];
  while (selectedModels.length < count) {
    const idx = Math.floor(Math.random() * pool.length);
    const id = pool.splice(idx, 1)[0].id;
    selectedModels.push(id);
  }
  renderModelGrid();
  renderBadges();
  updateRunBtn();
});

// ── Run ───────────────────────────────────────────────────────────────────
runBtn.addEventListener("click", runCompare);

async function runCompare() {
  const prompt = promptInput.value.trim();
  if (!prompt || selectedModels.length === 0) return;

  // Show results section with loading skeletons
  resultsSection.hidden = false;
  resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });

  renderLoadingCards(selectedModels);

  runBtn.disabled = true;
  runBtn.classList.add("loading");
  runBtn.innerHTML = `<span class="spinner"></span> Running…`;

  try {
    const res = await fetch("/api/compare", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, models: selectedModels }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Compare failed");

    lastResults = data.results;
    renderResults(data.results);
  } catch (e) {
    resultsGrid.innerHTML = `<div style="color:var(--error);padding:16px;">Error: ${escHtml(e.message)}</div>`;
  } finally {
    runBtn.disabled = false;
    runBtn.classList.remove("loading");
    runBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg> Compare`;
    updateRunBtn();
  }
}

// ── Loading skeletons ─────────────────────────────────────────────────────
function renderLoadingCards(modelIds) {
  resultsGrid.className = `results-grid count-${modelIds.length}`;
  resultsGrid.innerHTML = "";
  modelIds.forEach(id => {
    const m = allModels.find(x => x.id === id);
    const card = document.createElement("div");
    card.className = "result-card";
    card.innerHTML = `
      <div class="result-card-header">
        <div class="result-model-info">
          <div class="result-model-name">${escHtml(m ? m.display_name : id)}</div>
          <div class="result-model-provider">
            <span class="provider-dot" style="background:${providerColor(m?.owned_by || "")}"></span>
            ${escHtml(m?.owned_by || "")}
          </div>
        </div>
      </div>
      <div class="result-body loading"><span class="spinner"></span> Generating…</div>
    `;
    resultsGrid.appendChild(card);
  });
}

// ── Render results ────────────────────────────────────────────────────────
function renderResults(results) {
  resultsGrid.className = `results-grid count-${results.length}`;
  resultsGrid.innerHTML = "";

  // Determine fastest (lowest latency) and cheapest (lowest cost) among successes
  const successes = results.filter(r => r.ok);
  const minLatency = successes.length ? Math.min(...successes.map(r => r.latencyMs)) : null;
  const costs = successes.filter(r => r.cost?.totalNGN != null).map(r => r.cost.totalNGN);
  const minCost = costs.length ? Math.min(...costs) : null;

  results.forEach((r, idx) => {
    const m = allModels.find(x => x.id === r.modelId);
    const card = document.createElement("div");
    card.className = "result-card";
    card.dataset.idx = idx;

    // Rank badges
    const isFastest  = r.ok && r.latencyMs === minLatency && successes.length > 1;
    const isCheapest = r.ok && r.cost?.totalNGN != null && r.cost.totalNGN === minCost && costs.length > 1 && !isFastest;

    // Latency colouring
    let latencyClass = "";
    if (r.latencyMs < 2000)       latencyClass = "fast";
    else if (r.latencyMs > 8000)  latencyClass = "slow";

    const latencyStr = r.latencyMs != null ? `${(r.latencyMs / 1000).toFixed(2)}s` : "—";
    const costStr    = r.cost?.totalNGN != null ? `₦${Number(r.cost.totalNGN).toFixed(4)}` : "—";
    const tokensStr  = r.usage?.totalTokens != null ? `${r.usage.totalTokens.toLocaleString()} tok` : "—";

    card.innerHTML = `
      ${isFastest  ? `<span class="rank-badge fastest">Fastest</span>` : ""}
      ${isCheapest ? `<span class="rank-badge cheapest">Cheapest</span>` : ""}

      <div class="result-card-header">
        <div class="result-model-info">
          <div class="result-model-name">${escHtml(m ? m.display_name : r.modelId)}</div>
          <div class="result-model-provider">
            <span class="provider-dot" style="background:${providerColor(m?.owned_by || "")}"></span>
            ${escHtml(m?.owned_by || r.modelId)}
          </div>
        </div>
      </div>

      <div class="result-metrics">
        <div class="metric-pill">
          <span class="metric-label">Latency</span>
          <span class="metric-value ${latencyClass}">${latencyStr}</span>
        </div>
        <div class="metric-pill">
          <span class="metric-label">Cost</span>
          <span class="metric-value">${costStr}</span>
        </div>
        <div class="metric-pill">
          <span class="metric-label">Tokens</span>
          <span class="metric-value">${tokensStr}</span>
        </div>
      </div>

      <div class="result-body ${r.ok ? "" : "error"}">
        ${r.ok
          ? escHtml(r.content)
          : `<svg class="error-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>${escHtml(r.error || "Unknown error")}`
        }
      </div>

      <div class="result-card-footer">
        <span class="finish-reason">${r.finishReason ? `finish: ${r.finishReason}` : ""}</span>
        <button class="btn-detail" data-idx="${idx}">Details</button>
      </div>
    `;
    resultsGrid.appendChild(card);
  });

  // Wire up detail buttons
  resultsGrid.querySelectorAll(".btn-detail").forEach(btn => {
    btn.addEventListener("click", () => openModal(lastResults[+btn.dataset.idx]));
  });
}

// ── Detail modal ──────────────────────────────────────────────────────────
function openModal(result) {
  const m = allModels.find(x => x.id === result.modelId);
  modalTitle.textContent = `${m ? m.display_name : result.modelId} — Metrics`;

  const rows = [
    ["Model ID",         result.modelId],
    ["Provider",         m?.owned_by || "—"],
    ["Status",           result.ok ? "Success" : "Error"],
    ["Latency",          result.latencyMs != null ? `${result.latencyMs} ms (${(result.latencyMs/1000).toFixed(3)}s)` : "—"],
    ["Finish Reason",    result.finishReason || "—"],
    ["Prompt Tokens",    result.usage?.promptTokens?.toLocaleString() ?? "—"],
    ["Completion Tokens",result.usage?.completionTokens?.toLocaleString() ?? "—"],
    ["Total Tokens",     result.usage?.totalTokens?.toLocaleString() ?? "—"],
    ["Total Cost (₦)",   result.cost?.totalNGN != null ? `₦${Number(result.cost.totalNGN).toFixed(6)}` : "—"],
    ["Cached Tokens",    result.usage?.cachedTokens?.toLocaleString() ?? "—"],
    ["Context Window",   m?.context_window ? m.context_window.toLocaleString() + " tokens" : "—"],
    ["Max Output",       m?.wekoya?.max_output ? m.wekoya.max_output.toLocaleString() + " tokens" : "—"],
    ["Vision",           m?.wekoya?.vision ? "Yes" : "No"],
    ["Reasoning",        m?.wekoya?.reasoning ? "Yes" : "No"],
  ];

  const tableRows = rows.map(([label, val]) =>
    `<tr><td style="color:var(--text-muted);font-weight:500">${escHtml(label)}</td><td>${escHtml(String(val))}</td></tr>`
  ).join("");

  const rawJson = JSON.stringify(result.raw || {}, null, 2);

  modalBody.innerHTML = `
    <table class="metrics-table">
      <thead><tr><th>Metric</th><th>Value</th></tr></thead>
      <tbody>${tableRows}</tbody>
    </table>
    <div class="raw-json-toggle">
      <button id="toggleRaw">Show raw API response ↓</button>
    </div>
    <div class="raw-json" id="rawJson" style="display:none">${escHtml(rawJson)}</div>
  `;

  $("toggleRaw").addEventListener("click", () => {
    const el = $("rawJson");
    if (el.style.display === "none") {
      el.style.display = "block";
      $("toggleRaw").textContent = "Hide raw API response ↑";
    } else {
      el.style.display = "none";
      $("toggleRaw").textContent = "Show raw API response ↓";
    }
  });

  modalOverlay.hidden = false;
  document.body.style.overflow = "hidden";
}

function closeModal() {
  modalOverlay.hidden = true;
  document.body.style.overflow = "";
}

$("modalClose").addEventListener("click", closeModal);
modalOverlay.addEventListener("click", e => { if (e.target === modalOverlay) closeModal(); });
document.addEventListener("keydown", e => { if (e.key === "Escape") closeModal(); });

// Clear results
$("clearResults").addEventListener("click", () => {
  resultsSection.hidden = true;
  resultsGrid.innerHTML = "";
  lastResults = [];
});

// ── Helpers ───────────────────────────────────────────────────────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── Boot ──────────────────────────────────────────────────────────────────
loadModels();
updateRunBtn();
