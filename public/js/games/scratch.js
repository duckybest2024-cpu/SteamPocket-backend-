/* ════════════════════════════════════════════════════════════════════════════
   Scratch Cards — GrilledCoin
   ════════════════════════════════════════════════════════════════════════════ */
const ScratchGame = (() => {

  /* ── state ──────────────────────────────────────────── */
  let allTickets   = [];
  let activeTheme  = "All";
  let selectedTicket = null;   // ScratchTicket object
  let activeBetId  = null;     // betId from /scratch/buy
  let revealedCells = [];      // indices 0-8 that have been scratched
  let gridPrizes   = null;     // 9-element array from server (full grid, known after buy)
  let wonPrize     = null;
  let isRevealing  = false;
  let latestRevealData = null; // full reveal response stored after buy

  const THEMES = ["All", "Lucky Gems", "Casino Classic", "Fortune Dragons", "Space Jackpot", "Golden Gods"];

  /* ── render entry-point ────────────────────────────── */
  function render(container, accountState) {
    allTickets      = [];
    activeTheme     = "All";
    selectedTicket  = null;
    activeBetId     = null;
    revealedCells   = [];
    gridPrizes      = null;
    wonPrize        = null;
    isRevealing     = false;
    latestRevealData = null;

    container.innerHTML = buildShell();
    addStyles();
    HowToPlay.addButton(container, "scratch");
    loadTickets(container);

    return () => { /* cleanup */ };
  }

  /* ── HTML shell ─────────────────────────────────── */
  function buildShell() {
    return `
<div class="sc-wrap">
  <!-- LEFT: ticket browser -->
  <div class="sc-browser">
    <div class="sc-theme-bar">
      ${THEMES.map(t => `<button class="sc-theme-btn${t === "All" ? " active" : ""}" data-theme="${t}">${t}</button>`).join("")}
    </div>
    <div class="sc-ticket-grid" id="sc-ticket-grid">
      <div class="sc-loading">Loading tickets…</div>
    </div>
  </div>

  <!-- RIGHT: scratch panel -->
  <div class="sc-panel" id="sc-panel">
    <div class="sc-empty-hint" id="sc-hint">
      <div class="sc-empty-icon">🎟️</div>
      <div>Select a ticket to start scratching!</div>
    </div>
    <div class="sc-ticket-detail hidden" id="sc-detail">
      <div class="sc-ticket-header">
        <span class="sc-ticket-emoji" id="sc-tick-emoji"></span>
        <div>
          <div class="sc-ticket-title" id="sc-tick-name"></div>
          <div class="sc-ticket-desc" id="sc-tick-desc"></div>
        </div>
      </div>
      <div class="sc-ticket-meta">
        <span class="sc-meta-item">💰 Price: <strong id="sc-tick-price"></strong></span>
        <span class="sc-meta-item">🏆 Max Prize: <strong id="sc-tick-maxprize"></strong></span>
        <span class="sc-meta-item sc-theme-badge" id="sc-tick-theme"></span>
      </div>

      <!-- scratch grid -->
      <div class="sc-grid" id="sc-grid">
        ${Array.from({length:9}, (_,i) => `
          <div class="sc-cell" data-idx="${i}">
            <div class="sc-cell-cover">?</div>
            <div class="sc-cell-prize"></div>
          </div>`).join("")}
      </div>

      <!-- controls -->
      <div class="sc-controls" id="sc-controls">
        <button class="sc-btn-buy" id="sc-btn-buy">🎟️ Buy Ticket</button>
        <button class="sc-btn-reveal hidden" id="sc-btn-reveal-all">✨ Scratch All</button>
        <button class="sc-btn-new hidden" id="sc-btn-new">🔄 Buy Another</button>
      </div>

      <!-- result banner -->
      <div class="sc-result hidden" id="sc-result"></div>
    </div>
  </div>
</div>`;
  }

  /* ── load tickets from API ───────────────────────────── */
  async function loadTickets(container) {
    try {
      const data = await Api.get("/scratch/tickets");
      allTickets = data.tickets || [];
      renderTicketGrid(activeTheme);
      wireThemeButtons(container);
    } catch (err) {
      const grid = container.querySelector("#sc-ticket-grid");
      if (grid) grid.innerHTML =
        `<div class="sc-loading" style="color:var(--loss)">Failed to load tickets: ${err.message}</div>`;
    }
  }

  /* ── ticket grid ───────────────────────────────────── */
  function renderTicketGrid(theme) {
    const grid = document.getElementById("sc-ticket-grid");
    if (!grid) return;
    const filtered = theme === "All" ? allTickets : allTickets.filter(t => t.theme === theme);

    if (!filtered.length) {
      grid.innerHTML = `<div class="sc-loading">No tickets found.</div>`;
      return;
    }

    grid.innerHTML = filtered.map(ticket => `
      <div class="sc-ticket-card${selectedTicket && selectedTicket.id === ticket.id ? " selected" : ""}"
           data-id="${ticket.id}">
        <div class="sc-card-emoji">${ticket.emoji}</div>
        <div class="sc-card-name">${ticket.name}</div>
        <div class="sc-card-theme">${ticket.theme}</div>
        <div class="sc-card-price">💰 ${ticket.priceChips.toLocaleString()} chips</div>
        <div class="sc-card-max">🏆 up to ${ticket.maxPrize.toLocaleString()}</div>
      </div>`).join("");

    grid.querySelectorAll(".sc-ticket-card").forEach(card => {
      card.addEventListener("click", () => selectTicket(card.dataset.id));
    });
  }

  /* ── theme filter buttons ─────────────────────────── */
  function wireThemeButtons(container) {
    container.querySelectorAll(".sc-theme-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        container.querySelectorAll(".sc-theme-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        activeTheme = btn.dataset.theme;
        renderTicketGrid(activeTheme);
      });
    });
  }

  /* ── select a ticket ──────────────────────────────── */
  function selectTicket(id) {
    selectedTicket = allTickets.find(t => t.id === id) || null;
    if (!selectedTicket) return;

    // Highlight card
    document.querySelectorAll(".sc-ticket-card").forEach(c =>
      c.classList.toggle("selected", c.dataset.id === id));

    // Show detail panel
    document.getElementById("sc-hint").classList.add("hidden");
    document.getElementById("sc-detail").classList.remove("hidden");

    // Fill info
    document.getElementById("sc-tick-emoji").textContent   = selectedTicket.emoji;
    document.getElementById("sc-tick-name").textContent    = selectedTicket.name;
    document.getElementById("sc-tick-desc").textContent    = selectedTicket.description;
    document.getElementById("sc-tick-price").textContent   = selectedTicket.priceChips.toLocaleString() + " chips";
    document.getElementById("sc-tick-maxprize").textContent = selectedTicket.maxPrize.toLocaleString() + " chips";
    document.getElementById("sc-tick-theme").textContent   = selectedTicket.theme;

    // Reset scratch state
    resetScratchState();

    // Wire buy button
    document.getElementById("sc-btn-buy").onclick = () => buyTicket();
  }

  /* ── reset grid for a new ticket ─────────────────── */
  function resetScratchState() {
    activeBetId      = null;
    revealedCells    = [];
    gridPrizes       = null;
    wonPrize         = null;
    isRevealing      = false;
    latestRevealData = null;

    document.getElementById("sc-grid").querySelectorAll(".sc-cell").forEach(cell => {
      cell.classList.remove("scratched", "win-cell");
      const cover = cell.querySelector(".sc-cell-cover");
      const prize = cell.querySelector(".sc-cell-prize");
      cover.textContent = "?";
      cover.style.opacity = "1";
      cover.style.transform = "";
      prize.textContent = "";
    });

    document.getElementById("sc-btn-buy").classList.remove("hidden");
    document.getElementById("sc-btn-buy").disabled = false;
    document.getElementById("sc-btn-buy").textContent = "🎟️ Buy Ticket";
    document.getElementById("sc-btn-reveal-all").classList.add("hidden");
    document.getElementById("sc-btn-new").classList.add("hidden");
    document.getElementById("sc-result").classList.add("hidden");
    document.getElementById("sc-result").textContent = "";

    // Disable cell clicks
    document.getElementById("sc-grid").querySelectorAll(".sc-cell").forEach(cell => {
      cell.onclick = null;
    });
  }

  /* ── buy ticket ─────────────────────────────────── */
  async function buyTicket() {
    if (!selectedTicket) return;

    const buyBtn = document.getElementById("sc-btn-buy");
    buyBtn.disabled = true;
    buyBtn.textContent = "Buying…";

    try {
      const buyData = await Api.post(`/scratch/buy/${selectedTicket.id}`, {});
      activeBetId = buyData.betId;

      // Update balance shown in header
      updateBalanceUI(buyData.balance);

      // Immediately fully reveal (this also triggers payout on backend)
      const revealData = await Api.post(`/scratch/reveal/${activeBetId}`, {});
      latestRevealData = revealData;
      gridPrizes = revealData.grid;
      wonPrize   = revealData.wonPrize;

      // Update balance after payout
      updateBalanceUI(revealData.balance);

      // Enable cell scratching (grid data is now known)
      populateGridSilent();

    } catch (err) {
      buyBtn.disabled = false;
      buyBtn.textContent = "🎟️ Buy Ticket";
      if (typeof UI !== "undefined") UI.toast(err.message || "Failed to buy ticket", "loss");
    }
  }

  /* ── silent pre-populate (after buy, before user scratches) ─ */
  function populateGridSilent() {
    // Hide buy, show reveal-all
    document.getElementById("sc-btn-buy").classList.add("hidden");
    document.getElementById("sc-btn-reveal-all").classList.remove("hidden");
    document.getElementById("sc-btn-reveal-all").onclick = () => animateRevealAll();

    // Wire individual cell scratching
    document.getElementById("sc-grid").querySelectorAll(".sc-cell").forEach(cell => {
      const idx = parseInt(cell.dataset.idx, 10);
      cell.onclick = () => scratchCell(idx);
    });
  }

  /* ── scratch a single cell ─────────────────────── */
  function scratchCell(idx) {
    if (revealedCells.includes(idx)) return;
    revealedCells.push(idx);

    const cell = document.querySelector(`.sc-cell[data-idx="${idx}"]`);
    const cover = cell.querySelector(".sc-cell-cover");
    const prizeEl = cell.querySelector(".sc-cell-prize");
    const prize = gridPrizes[idx];

    prizeEl.textContent = prize.chips > 0 ? prize.chips.toLocaleString() : "✗";
    prizeEl.style.color = prize.chips > 0 ? "var(--win, #39c163)" : "var(--text-dim)";

    // Animate cover away
    cover.style.transition = "opacity 0.3s, transform 0.3s";
    cover.style.opacity    = "0";
    cover.style.transform  = "scale(0.6)";
    cell.classList.add("scratched");

    // All 9 scratched → finalize
    if (revealedCells.length === 9) {
      setTimeout(() => finalizeResult(), 200);
    }
  }

  /* ── animated full reveal ─────────────────────────── */
  async function animateRevealAll() {
    document.getElementById("sc-btn-reveal-all").classList.add("hidden");

    for (let i = 0; i < 9; i++) {
      if (!revealedCells.includes(i)) {
        await delay(70);
        scratchCell(i);
      }
    }
  }

  /* ── finalize result (show banner) ──────────────── */
  function finalizeResult() {
    const data      = latestRevealData || {};
    const payout    = data.payout || 0;
    const payChips  = data.payoutChips || 0;
    const leveledUp = data.leveledUp || false;

    // Disable further clicks
    document.getElementById("sc-grid").querySelectorAll(".sc-cell").forEach(c => { c.onclick = null; });
    document.getElementById("sc-btn-reveal-all").classList.add("hidden");

    // Highlight win line
    if (wonPrize && wonPrize.chips > 0) {
      const LINES = [
        [0,1,2],[3,4,5],[6,7,8],
        [0,3,6],[1,4,7],[2,5,8],
        [0,4,8],[2,4,6],
      ];
      for (const line of LINES) {
        if (line.every(i => gridPrizes[i].chips === wonPrize.chips)) {
          line.forEach(i => {
            document.querySelector(`.sc-cell[data-idx="${i}"]`).classList.add("win-cell");
          });
        }
      }
    }

    // Result banner
    const resultEl = document.getElementById("sc-result");
    resultEl.classList.remove("hidden");

    if (payChips > 0) {
      resultEl.innerHTML = `
        <div class="sc-win-banner">
          <div class="sc-win-title">🎉 ${wonPrize ? wonPrize.label : "Winner!"}</div>
          <div class="sc-win-amount">+${payChips.toLocaleString()} chips</div>
          ${leveledUp ? `<div class="sc-level-up">⬆️ Level Up!</div>` : ""}
        </div>`;
      resultEl.className = "sc-result sc-result-win";
    } else {
      resultEl.innerHTML = `<div class="sc-lose-banner">No win this time — try again!</div>`;
      resultEl.className = "sc-result sc-result-lose";
    }

    // Show "buy another" button
    document.getElementById("sc-btn-new").classList.remove("hidden");
    document.getElementById("sc-btn-new").onclick = () => selectTicket(selectedTicket.id);
  }

  /* ── update balance in app header ──────────────── */
  function updateBalanceUI(balance) {
    const tbEl = document.getElementById("topbar-balance");
    if (tbEl) tbEl.textContent = Math.floor(balance / 100).toLocaleString();
    const balEl = document.getElementById("balance-amount");
    if (balEl) balEl.textContent = Math.floor(balance / 100).toLocaleString() + " 🪙";
  }

  /* ── helper ───────────────────────────────────────── */
  function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

  /* ── inline styles ─────────────────────────────── */
  function addStyles() {
    if (document.getElementById("sc-styles")) return;
    const style = document.createElement("style");
    style.id = "sc-styles";
    style.textContent = `
/* ── Scratch Cards Layout ── */
.sc-wrap {
  display: flex;
  gap: 16px;
  padding: 16px;
  min-height: calc(100vh - 64px);
  box-sizing: border-box;
}

/* LEFT: Browser */
.sc-browser {
  width: 320px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.sc-theme-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.sc-theme-btn {
  padding: 5px 12px;
  border-radius: 20px;
  border: 1px solid var(--border);
  background: var(--panel);
  color: var(--text-dim);
  cursor: pointer;
  font-size: 0.78rem;
  transition: background 0.15s, color 0.15s;
}
.sc-theme-btn.active,
.sc-theme-btn:hover {
  background: var(--accent);
  color: #071c10;
  border-color: var(--accent);
}
.sc-ticket-grid {
  flex: 1;
  overflow-y: auto;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  align-content: start;
  max-height: calc(100vh - 140px);
}
.sc-loading { color: var(--text-dim); font-size: 0.85rem; padding: 12px; }
.sc-ticket-card {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 10px;
  cursor: pointer;
  transition: border-color 0.15s, transform 0.1s;
  text-align: center;
}
.sc-ticket-card:hover { border-color: var(--accent); transform: translateY(-2px); }
.sc-ticket-card.selected { border-color: var(--accent); background: rgba(57,193,99,0.08); }
.sc-card-emoji { font-size: 1.8rem; margin-bottom: 4px; }
.sc-card-name  { font-weight: 700; font-size: 0.8rem; color: var(--text); margin-bottom: 2px; }
.sc-card-theme { font-size: 0.7rem; color: var(--text-dim); margin-bottom: 4px; }
.sc-card-price { font-size: 0.75rem; color: var(--accent); font-weight: 600; }
.sc-card-max   { font-size: 0.7rem; color: var(--text-dim); }

/* RIGHT: Scratch panel */
.sc-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 20px;
  gap: 16px;
}
.sc-empty-hint {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--text-dim);
  font-size: 1rem;
}
.sc-empty-icon { font-size: 3rem; }
.sc-ticket-detail { display: flex; flex-direction: column; gap: 14px; }
.sc-ticket-header {
  display: flex;
  gap: 12px;
  align-items: center;
}
.sc-ticket-emoji { font-size: 2.5rem; }
.sc-ticket-title { font-size: 1.3rem; font-weight: 800; color: var(--text); }
.sc-ticket-desc  { font-size: 0.85rem; color: var(--text-dim); }
.sc-ticket-meta  { display: flex; gap: 12px; flex-wrap: wrap; }
.sc-meta-item    { font-size: 0.82rem; color: var(--text-dim); }
.sc-meta-item strong { color: var(--text); }
.sc-theme-badge  {
  padding: 3px 10px;
  background: rgba(57,193,99,0.12);
  border-radius: 20px;
  color: var(--accent);
  font-size: 0.75rem;
  font-weight: 600;
}

/* 3x3 Scratch grid */
.sc-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  max-width: 360px;
  align-self: center;
}
.sc-cell {
  position: relative;
  aspect-ratio: 1;
  border-radius: 10px;
  overflow: hidden;
  background: var(--bg);
  border: 1px solid var(--border);
  cursor: pointer;
  min-height: 90px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.sc-cell:hover .sc-cell-cover { opacity: 0.88; }
.sc-cell-cover {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #2a3a4a 0%, #1a2535 100%);
  color: #7a8a9a;
  font-size: 1.5rem;
  font-weight: 700;
  border-radius: 10px;
  transition: opacity 0.3s, transform 0.3s;
  z-index: 2;
}
.sc-cell-prize {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.05rem;
  font-weight: 800;
  z-index: 1;
  text-align: center;
  padding: 4px;
}
.sc-cell.scratched .sc-cell-cover { pointer-events: none; }
.sc-cell.win-cell {
  border-color: var(--accent);
  box-shadow: 0 0 12px rgba(57,193,99,0.5);
  animation: sc-pulse 1s infinite alternate;
}
@keyframes sc-pulse {
  from { box-shadow: 0 0 8px rgba(57,193,99,0.4); }
  to   { box-shadow: 0 0 20px rgba(57,193,99,0.9); }
}

/* Controls */
.sc-controls { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
.sc-btn-buy, .sc-btn-reveal, .sc-btn-new {
  padding: 10px 22px;
  border-radius: 8px;
  border: none;
  font-weight: 700;
  font-size: 0.95rem;
  cursor: pointer;
  transition: opacity 0.2s;
}
.sc-btn-buy    { background: var(--accent); color: #071c10; }
.sc-btn-reveal { background: #2563eb; color: #fff; }
.sc-btn-new    { background: var(--panel); color: var(--text); border: 1px solid var(--border); }
.sc-btn-buy:disabled { opacity: 0.5; cursor: not-allowed; }

/* Result banner */
.sc-result { border-radius: 10px; padding: 14px 18px; text-align: center; }
.sc-result-win  { background: rgba(57,193,99,0.15); border: 1px solid var(--accent); }
.sc-result-lose { background: rgba(255,80,80,0.10); border: 1px solid var(--loss, #ff5050); }
.sc-win-title   { font-size: 1.2rem; font-weight: 800; color: var(--accent); }
.sc-win-amount  { font-size: 1.6rem; font-weight: 900; color: var(--accent); }
.sc-level-up    { font-size: 0.9rem; color: gold; margin-top: 4px; }
.sc-lose-banner { color: var(--text-dim); font-size: 0.95rem; }

@media (max-width: 700px) {
  .sc-wrap { flex-direction: column; }
  .sc-browser { width: 100%; }
  .sc-ticket-grid { max-height: 280px; }
}
    `;
    document.head.appendChild(style);
  }

  return { render };
})();
