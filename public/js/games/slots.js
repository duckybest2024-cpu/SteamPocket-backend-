const SlotsGame = (() => {
  // ── Symbol maps ─────────────────────────────────────────────────
  const SYMBOL_GLYPHS = {
    wild: "⭐", scatter: "💫", crown: "👑", gem: "💎", bell: "🔔",
    clover: "🍀", horseshoe: "🧲", ace: "🅰️", king: "👑", queen: "♛",
    seven: "7️⃣", bar: "🎰", cherry: "🍒", lemon: "🍋", orange: "🍊",
    grape: "🍇", dragon: "🐉",
  };

  // Default symbol pool (Vegas / full)
  const VEGAS_SYMBOLS    = ["wild","scatter","crown","gem","bell","clover","horseshoe","ace","king","queen"];
  const CLASSIC_SYMBOLS  = ["seven","bar","cherry","lemon","orange","grape","bell"];
  const LUCKY7_SYMBOLS   = ["seven","bar","cherry"];
  const DRAGON_SYMBOLS   = ["dragon","gem","crown","scatter","wild","bell","clover"];
  const MEGA_SYMBOLS     = ["wild","scatter","crown","gem","bell","clover","horseshoe","ace","king","queen","dragon"];

  // ── Paylines (mirrors server) ────────────────────────────────
  const PAYLINES = [
    [1,1,1,1,1],[0,0,0,0,0],[2,2,2,2,2],[0,1,2,1,0],[2,1,0,1,2],
    [1,0,0,0,1],[1,2,2,2,1],[0,0,1,2,2],[2,2,1,0,0],[1,0,1,0,1],
    [1,2,1,2,1],[0,1,1,1,0],[2,1,1,1,2],[0,1,0,1,0],[2,1,2,1,2],
    [1,1,0,1,1],[1,1,2,1,1],[0,2,0,2,0],[2,0,2,0,2],[0,2,2,2,0],
    [2,0,0,0,2],[1,0,2,0,1],[1,2,0,2,1],[0,0,2,0,0],[2,2,0,2,2],
  ];

  // ── Slot type definitions ──────────────────────────────────
  const SLOT_TYPES = {
    vegas:   { label: "VEGAS SLOTS",    reels: 5, rows: 3, maxLines: 25, symbols: VEGAS_SYMBOLS,   bonus: null },
    classic: { label: "CLASSIC SLOTS",  reels: 3, rows: 3, maxLines: 5,  symbols: CLASSIC_SYMBOLS, bonus: null },
    lucky7:  { label: "LUCKY 7s",       reels: 3, rows: 3, maxLines: 5,  symbols: LUCKY7_SYMBOLS,  bonus: "High Payout Mode" },
    mega:    { label: "MEGA SPIN",       reels: 5, rows: 4, maxLines: 30, symbols: MEGA_SYMBOLS,    bonus: null },
    dragon:  { label: "FORTUNE DRAGON",  reels: 5, rows: 3, maxLines: 25, symbols: DRAGON_SYMBOLS,  bonus: "Dragon Bonus Feature" },
  };

  // ── Styles (injected once) ────────────────────────────────
  const STYLE_ID = "slots-machine-styles";
  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
/* ── Slot type selector ────────────────────── */
.slot-type-btns {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.slot-type-btn {
  flex: 1;
  min-width: 0;
  padding: 5px 4px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text-dim);
  font-size: 0.72rem;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: color 0.15s, border-color 0.15s, background 0.15s;
}
.slot-type-btn:hover { border-color: var(--accent); color: var(--text); }
.slot-type-btn.active {
  border-color: var(--accent);
  color: var(--accent);
  background: rgba(0,231,1,0.10);
}

/* ── Machine frame ────────────────────────────── */
.slots-machine {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0;
  background: linear-gradient(160deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
  border: 2px solid transparent;
  border-radius: 16px;
  box-shadow:
    0 0 0 2px #b8860b,
    0 0 0 4px #ffd700,
    0 0 0 6px #b8860b,
    0 0 24px rgba(255,215,0,0.25),
    inset 0 1px 0 rgba(255,255,255,0.08);
  padding: 12px 12px 14px;
  width: 100%;
  position: relative;
}

.slots-header {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  position: relative;
  padding-bottom: 10px;
}
.slots-type-name {
  font-size: 0.85rem;
  font-weight: 900;
  letter-spacing: 0.15em;
  color: var(--gold);
  text-shadow: 0 0 8px rgba(255,215,0,0.7), 0 0 18px rgba(255,165,0,0.4);
  text-transform: uppercase;
  text-align: center;
}
.slots-lights {
  display: flex;
  gap: 6px;
  position: absolute;
  right: 0;
  top: 0;
}
.slots-light {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  animation: slots-light-blink 1.4s ease-in-out infinite;
}
.slots-light:nth-child(1) { background: #ff4444; animation-delay: 0s; }
.slots-light:nth-child(2) { background: #ffaa00; animation-delay: 0.28s; }
.slots-light:nth-child(3) { background: #00e701; animation-delay: 0.56s; }
.slots-light:nth-child(4) { background: #4d9fec; animation-delay: 0.84s; }
.slots-light:nth-child(5) { background: #ff4444; animation-delay: 1.12s; }
@keyframes slots-light-blink {
  0%, 100% { opacity: 1; box-shadow: 0 0 4px currentColor; }
  50%       { opacity: 0.25; box-shadow: none; }
}

/* ── Viewport + reels ──────────────────────── */
.slots-viewport {
  position: relative;
  background: #050e1a;
  border: 2px solid #2d4a5a;
  border-radius: 10px;
  box-shadow: inset 0 4px 20px rgba(0,0,0,0.8), inset 0 0 0 1px rgba(255,255,255,0.04);
  padding: 6px;
  width: 100%;
}

.slots-reels-container {
  display: flex;
  gap: 4px;
  justify-content: center;
}

/* Each column */
.slot-reel {
  flex: 1;
  overflow: hidden;
  border-radius: 6px;
  background: #0a1628;
  border: 1px solid #1d3450;
  box-shadow: inset 0 2px 8px rgba(0,0,0,0.5);
  position: relative;
}

/* The scrolling strip inside each reel */
.reel-strip {
  display: flex;
  flex-direction: column;
  transition: none;
}

/* Win glow on reel */
.slot-reel.reel-bounce {
  animation: reel-land-bounce 0.2s ease-out;
}
@keyframes reel-land-bounce {
  0%   { transform: scaleY(1.06) translateY(-2px); }
  60%  { transform: scaleY(0.97) translateY(1px); }
  100% { transform: scaleY(1) translateY(0); }
}

/* Individual symbols */
.slot-symbol {
  width: 100%;
  height: 70px;
  flex-shrink: 0;
  font-size: 1.9rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-elev);
  border-bottom: 1px solid rgba(45,74,90,0.7);
  user-select: none;
  transition: background 0.2s;
}
.slot-symbol:last-child { border-bottom: none; }

/* Winning cells */
.slot-symbol.win-cell {
  background: rgba(52,211,153,0.22);
  border-color: rgba(52,211,153,0.55);
  box-shadow: 0 0 12px rgba(52,211,153,0.55), inset 0 0 8px rgba(52,211,153,0.15);
  animation: win-cell-pulse 0.7s ease-in-out infinite alternate;
}
@keyframes win-cell-pulse {
  from { box-shadow: 0 0 10px rgba(52,211,153,0.45), inset 0 0 6px rgba(52,211,153,0.1); }
  to   { box-shadow: 0 0 22px rgba(52,211,153,0.75), inset 0 0 14px rgba(52,211,153,0.25); }
}

/* Win line overlay */
.slots-overlay {
  position: absolute;
  inset: 6px;
  pointer-events: none;
  border-radius: 8px;
}

/* Machine footer */
.slots-footer {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding-top: 10px;
}
.win-display {
  font-size: 1rem;
  font-weight: 800;
  color: var(--gold);
  text-shadow: 0 0 10px rgba(255,215,0,0.5);
  letter-spacing: 0.05em;
  min-width: 140px;
  text-align: center;
  transition: color 0.3s, text-shadow 0.3s;
}
.win-display.is-win {
  color: #34d399;
  text-shadow: 0 0 14px rgba(52,211,153,0.9), 0 0 28px rgba(52,211,153,0.4);
  animation: win-display-pop 0.5s ease-out;
}
@keyframes win-display-pop {
  0%   { transform: scale(1); }
  40%  { transform: scale(1.18); }
  70%  { transform: scale(0.95); }
  100% { transform: scale(1); }
}

/* Bonus badge */
.slots-bonus-badge {
  display: inline-block;
  font-size: 0.68rem;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(77,159,236,0.15);
  border: 1px solid var(--accent-2);
  color: var(--accent-2);
  margin-left: 8px;
  vertical-align: middle;
  letter-spacing: 0.06em;
}

/* Scanline shimmer across viewport */
.slots-viewport::after {
  content: "";
  pointer-events: none;
  position: absolute;
  inset: 0;
  border-radius: 10px;
  background: repeating-linear-gradient(
    to bottom,
    transparent 0px,
    transparent 3px,
    rgba(0,0,0,0.08) 3px,
    rgba(0,0,0,0.08) 4px
  );
  z-index: 2;
}

/* Spinning shimmer */
@keyframes reel-shimmer {
  0%   { opacity: 0.06; }
  50%  { opacity: 0.22; }
  100% { opacity: 0.06; }
}
.slot-reel.is-spinning::before {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(to bottom, rgba(77,159,236,0.15), transparent 50%, rgba(77,159,236,0.15));
  animation: reel-shimmer 0.16s linear infinite;
  z-index: 3;
  pointer-events: none;
  border-radius: 6px;
}
    `;
    document.head.appendChild(style);
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  function render(container, accountState) {
    injectStyles();

    let busy = false;
    let currentType = "vegas";

    container.innerHTML = `
      <div class="game-panel"><div class="game-layout">

        <div class="bet-panel">
          <div class="bp-tabs">
            <button class="bp-tab active" id="slots-tab-manual">Manual</button>
            <button class="bp-tab" id="slots-tab-auto">Auto</button>
          </div>

          <div class="bp-field">
            <div class="bp-label">Slot Type</div>
            <div class="slot-type-btns">
              <button class="slot-type-btn active" data-type="vegas">🎰 Vegas</button>
              <button class="slot-type-btn" data-type="classic">🍒 Classic</button>
              <button class="slot-type-btn" data-type="lucky7">7️⃣ Lucky 7s</button>
              <button class="slot-type-btn" data-type="mega">💫 Mega</button>
              <button class="slot-type-btn" data-type="dragon">🐉 Dragon</button>
            </div>
          </div>

          <div class="bp-field">
            <div class="bp-label">Bet Per Line ($)</div>
            <div class="bp-input-row">
              <input type="number" id="slots-linebet" value="0.20" min="0.01" step="0.01" />
              <button class="quick-btn" id="slots-half">½</button>
              <button class="quick-btn" id="slots-dbl">2×</button>
            </div>
          </div>

          <div class="bp-field">
            <div class="bp-label">Lines (1–<span id="slots-max-lines">25</span>)</div>
            <input type="number" id="slots-lines" value="10" min="1" max="25" step="1" />
          </div>

          <div class="bp-field">
            <div class="bp-label">Total Bet</div>
            <div id="slots-total" style="font-size:1.1rem; font-weight:800; color:var(--gold);">0 🪙</div>
          </div>

          <hr class="bp-divider" />

          <button id="slots-spin" class="play-btn">Spin</button>
        </div>

        <div class="game-canvas">

          <div class="slots-machine">
            <div class="slots-header">
              <div class="slots-type-name" id="slots-type-name">VEGAS SLOTS</div>
              <div class="slots-lights">
                <span class="slots-light"></span>
                <span class="slots-light"></span>
                <span class="slots-light"></span>
                <span class="slots-light"></span>
                <span class="slots-light"></span>
              </div>
            </div>
            <div class="slots-viewport">
              <div class="slots-reels-container" id="slots-reels"></div>
              <div class="slots-overlay" id="slots-overlay"></div>
            </div>
            <div class="slots-footer">
              <div class="win-display" id="slots-win-display">WIN: 0 🪙</div>
            </div>
          </div>

          <div id="slots-result" class="result-banner"></div>
          <div id="slots-fairness" class="fairness-line"></div>
        </div>

      </div></div>
    `;

    const els = {
      reels:      container.querySelector("#slots-reels"),
      lineBet:    container.querySelector("#slots-linebet"),
      half:       container.querySelector("#slots-half"),
      dbl:        container.querySelector("#slots-dbl"),
      lines:      container.querySelector("#slots-lines"),
      maxLines:   container.querySelector("#slots-max-lines"),
      total:      container.querySelector("#slots-total"),
      spin:       container.querySelector("#slots-spin"),
      result:     container.querySelector("#slots-result"),
      fairness:   container.querySelector("#slots-fairness"),
      typeName:   container.querySelector("#slots-type-name"),
      winDisplay: container.querySelector("#slots-win-display"),
    };

    // ── Type selector ────────────────────────────────────────────
    container.querySelectorAll(".slot-type-btn").forEach(btn => {
      btn.addEventListener("click", function () {
        if (busy) return;
        container.querySelectorAll(".slot-type-btn").forEach(b => b.classList.remove("active"));
        this.classList.add("active");
        currentType = this.dataset.type;
        applyType(currentType);
        buildGrid(null);
      });
    });

    function applyType(type) {
      const cfg = SLOT_TYPES[type];
      els.typeName.textContent = cfg.label;
      els.maxLines.textContent = cfg.maxLines;
      const linesInput = els.lines;
      linesInput.max = cfg.maxLines;
      if (Number(linesInput.value) > cfg.maxLines) linesInput.value = cfg.maxLines;
      refreshTotal();
    }

    // ── Quick bet buttons ───────────────────────────────────────
    els.half.addEventListener("click", () => {
      els.lineBet.value = Math.max(0.01, Math.floor(Number(els.lineBet.value) * 0.5 * 100) / 100);
      refreshTotal();
    });
    els.dbl.addEventListener("click", () => {
      els.lineBet.value = Math.floor(Number(els.lineBet.value) * 2 * 100) / 100;
      refreshTotal();
    });

    // ── Manual/Auto tabs (visual only) ────────────────────────────
    container.querySelectorAll(".bp-tab").forEach(t => t.addEventListener("click", function () {
      container.querySelectorAll(".bp-tab").forEach(x => x.classList.remove("active"));
      this.classList.add("active");
    }));

    // ── Grid builder ────────────────────────────────────────────
    // Returns: { reelEls, symbolEls }
    // reelEls[r] = the .slot-reel div for reel r
    // symbolEls[r][row] = the .slot-symbol span for that cell
    function buildGrid(grid) {
      const cfg = SLOT_TYPES[currentType];
      els.reels.innerHTML = "";

      const reelEls   = [];
      const symbolEls = [];

      for (let reel = 0; reel < cfg.reels; reel++) {
        const reelDiv = document.createElement("div");
        reelDiv.className = "slot-reel";
        reelDiv.dataset.reel = reel;

        // height = rows * 70px
        reelDiv.style.height = `${cfg.rows * 70}px`;

        const strip = document.createElement("div");
        strip.className = "reel-strip";
        reelDiv.appendChild(strip);

        const rowEls = [];
        for (let row = 0; row < cfg.rows; row++) {
          const sym = grid ? grid[reel][row] : cfg.symbols[Math.floor(Math.random() * cfg.symbols.length)];
          const cell = document.createElement("div");
          cell.className = "slot-symbol";
          cell.dataset.reel = reel;
          cell.dataset.row  = row;
          cell.textContent  = SYMBOL_GLYPHS[sym] || "❓";
          strip.appendChild(cell);
          rowEls.push(cell);
        }

        els.reels.appendChild(reelDiv);
        reelEls.push(reelDiv);
        symbolEls.push(rowEls);
      }

      return { reelEls, symbolEls };
    }

    // ── Reel animation ─────────────────────────────────────────────
    function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

    function animateReel(reelEl, rowEls, finalSymbols, stopDelay) {
      return new Promise(resolve => {
        const cfg = SLOT_TYPES[currentType];
        reelEl.classList.add("is-spinning");

        let count = 0;
        const threshold = 10 + stopDelay * 3;
        const interval = setInterval(() => {
          rowEls.forEach(el => {
            const sym = cfg.symbols[Math.floor(Math.random() * cfg.symbols.length)];
            el.textContent = SYMBOL_GLYPHS[sym] || "❓";
          });
          count++;
          if (count >= threshold) {
            clearInterval(interval);
            reelEl.classList.remove("is-spinning");
            finalSymbols.forEach((sym, i) => {
              if (rowEls[i]) rowEls[i].textContent = SYMBOL_GLYPHS[sym] || sym;
            });
            reelEl.classList.add("reel-bounce");
            setTimeout(() => {
              reelEl.classList.remove("reel-bounce");
              resolve();
            }, 200);
          }
        }, 80);
      });
    }

    async function animateReels(finalGrid) {
      const { reelEls, symbolEls } = buildGrid(null);
      const cfg = SLOT_TYPES[currentType];

      // Fire each reel with stagger; we start them quickly but they stop in sequence
      const promises = [];
      for (let r = 0; r < cfg.reels; r++) {
        promises.push(animateReel(reelEls[r], symbolEls[r], finalGrid[r], r));
        await sleep(180);
      }
      await Promise.all(promises);

      return { reelEls, symbolEls };
    }

    // ── Total display ───────────────────────────────────────────
    function refreshTotal() {
      const cfg = SLOT_TYPES[currentType];
      const lines = Math.max(1, Math.min(cfg.maxLines, Math.round(Number(els.lines.value) || 1)));
      const lineBetCents = Math.round((Number(els.lineBet.value) || 0) * 100);
      els.total.textContent = UI.money(lineBetCents * lines);
    }
    els.lineBet.addEventListener("input", refreshTotal);
    els.lines.addEventListener("input", refreshTotal);

    // ── Spin handler ──────────────────────────────────────────────
    els.spin.addEventListener("click", async () => {
      if (busy) return;
      const cfg = SLOT_TYPES[currentType];

      const lineBet = Math.round((Number(els.lineBet.value) || 0) * 100);
      const rawLines = Math.max(1, Math.min(cfg.maxLines, Math.round(Number(els.lines.value) || 1)));
      // For types with fewer than 25 lines, cap at the type's max
      const lines = Math.min(rawLines, cfg.maxLines);
      if (lineBet <= 0) return UI.toast("Enter a bet per line.", "loss");

      busy = true;
      els.spin.disabled = true;
      els.result.className = "result-banner";
      els.winDisplay.className = "win-display";
      els.winDisplay.textContent = "WIN: 0 🪙";

      const spinSalt = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

      try {
        const res = await Api.post("/games/slots/spin", { lineBet, lines, spinSalt });
        const { grid, lineWins, scatterCount, scatterPayout, freeSpinsAwarded } = res.result.state;

        // Animate reels — server grid may have fewer reels than the visual layout for
        // classic/lucky7 (3 reels), so pad if needed.
        const paddedGrid = [];
        for (let r = 0; r < cfg.reels; r++) {
          paddedGrid.push(grid[r] || grid[r % grid.length]);
        }

        const { reelEls, symbolEls } = await animateReels(paddedGrid);

        // Highlight winning cells
        for (const win of lineWins) {
          const positions = PAYLINES[win.line];
          if (!positions) continue;
          const count = Math.min(win.count, cfg.reels);
          for (let r = 0; r < count; r++) {
            const row = positions[r] ?? 1;
            const clampedRow = Math.min(row, cfg.rows - 1);
            const cell = symbolEls[r]?.[clampedRow];
            cell?.classList.add("win-cell");
          }
        }

        const isWin = res.result.result === "win";
        els.result.className = `result-banner show ${isWin ? "win" : "loss"}`;
        const bits = [];
        if (lineWins.length) bits.push(`${lineWins.length} winning line${lineWins.length > 1 ? "s" : ""}`);
        if (scatterCount >= 3) bits.push(`${scatterCount} scatters (+${scatterPayout}x bet)`);
        if (freeSpinsAwarded) bits.push(`${freeSpinsAwarded} free spins! 🎁`);
        if (cfg.bonus && isWin) bits.push(cfg.bonus);

        els.result.textContent = isWin
          ? `🎉 ${bits.join(" · ") || "You won!"} — paid ${UI.money(res.result.payout)}.`
          : `No win this spin — paid ${UI.money(res.result.payout)} on a ${UI.money(lineBet * lines)} bet.`;

        // Win display panel
        if (isWin) {
          els.winDisplay.textContent = `WIN: ${UI.money(res.result.payout)}`;
          els.winDisplay.classList.add("is-win");
        } else {
          els.winDisplay.textContent = "WIN: 0 🪙";
        }

        els.fairness.innerHTML = UI.fairnessLine({
          serverSeedHash: accountState.fairness?.activeServerSeedHash,
          clientSeed: accountState.fairness?.clientSeed,
        });

        UI.applyAccountUpdate(accountState, res);
        UI.toast(isWin ? `Won ${UI.money(res.result.payout)} on Slots!` : "No win this spin.", isWin ? "win" : "info");
      } catch (err) {
        UI.toast(err.message, "loss");
      } finally {
        busy = false;
        els.spin.disabled = false;
      }
    });

    // Initial build
    applyType(currentType);
    buildGrid(null);
    refreshTotal();
  }

  return { render };
})();
