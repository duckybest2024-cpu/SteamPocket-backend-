const SlotsGame = (() => {
  // ── Slot machine catalog ─────────────────────────────────────
  // The server always deals a fixed 5-reel × 3-row grid using ten symbol
  // keys (wild, scatter, crown, gem, bell, clover, horseshoe, ace, king,
  // queen) with one fixed paytable — every "machine" below is the same
  // provably-fair engine wearing a different skin. `icons` supplies four
  // themed glyphs that are cycled across the eight paying tiers so the
  // landed result (not just the spin animation) matches the theme.
  const SLOT_TYPES = {
    vegas:          { label: "Vegas Slots",          icon: "🎰", reels: 5, maxLines: 25, wild: "⭐", scatter: "💫", icons: ["👑","💎","🔔","🍀"], bonus: null },
    classic:        { label: "Classic Fruits",       icon: "🍒", reels: 3, maxLines: 5,  wild: "🃏", scatter: "💥", icons: ["7️⃣","🎰","🍋","🍊"], bonus: null },
    lucky7:         { label: "Lucky 7s",             icon: "7️⃣", reels: 3, maxLines: 5,  wild: "🍀", scatter: "✨", icons: ["7️⃣","🎰","🍇","🍓"], bonus: "High Payout Mode" },
    mega:           { label: "Mega Spin",            icon: "💫", reels: 5, maxLines: 25, wild: "🌠", scatter: "💥", icons: ["👑","💎","🧲","🅰️"], bonus: null },
    dragon:         { label: "Fortune Dragon",       icon: "🐉", reels: 5, maxLines: 25, wild: "🐲", scatter: "💫", icons: ["👑","🏮","🐍","🎏"], bonus: "Dragon Bonus Feature" },
    egypt:          { label: "Golden Pharaoh",       icon: "🔺", reels: 5, maxLines: 25, wild: "👁️", scatter: "📜", icons: ["🔺","🪲","🐍","💰"], bonus: "Pharaoh's Free Spins" },
    pirate:         { label: "Pirate's Treasure",    icon: "🗝️", reels: 5, maxLines: 25, wild: "💀", scatter: "🗝️", icons: ["⚓","🚢","🦜","💰"], bonus: "Treasure Chest Bonus" },
    space:          { label: "Space Odyssey",        icon: "🚀", reels: 5, maxLines: 25, wild: "👽", scatter: "☄️", icons: ["🚀","🪐","🛸","⭐"], bonus: "Warp Free Spins" },
    safari:         { label: "Wild Safari",          icon: "🦁", reels: 5, maxLines: 25, wild: "🦁", scatter: "🌴", icons: ["🐘","🦒","🦓","🐒"], bonus: "Stampede Bonus" },
    diamondstrike:  { label: "Diamond Strike",       icon: "💎", reels: 5, maxLines: 25, wild: "💎", scatter: "✨", icons: ["💍","👑","🔔","🍀"], bonus: "Diamond Respin" },
    leprechaun:     { label: "Leprechaun's Luck",    icon: "🍀", reels: 3, maxLines: 5,  wild: "🌈", scatter: "💰", icons: ["🎩","🍀","🧲","💍"], bonus: "Pot of Gold Bonus" },
    mystic:         { label: "Mystic Fortune",       icon: "🔮", reels: 5, maxLines: 25, wild: "🧙", scatter: "✨", icons: ["🔮","🌙","💎","👑"], bonus: "Mystic Free Spins" },
    candy:          { label: "Candy Carnival",       icon: "🍬", reels: 3, maxLines: 5,  wild: "🍭", scatter: "🧁", icons: ["🍬","🍩","🍒","🍓"], bonus: null },
    chicken:        { label: "Chicken Run",          icon: "🐔", reels: 5, maxLines: 25, wild: "🐔", scatter: "🥚", icons: ["🌽","🍀","🔔","👑"], bonus: "Egg Multiplier Bonus" },
    piggies:        { label: "Piggy Bank Riches",    icon: "🐷", reels: 5, maxLines: 25, wild: "🐷", scatter: "🪙", icons: ["🏦","💎","🔔","👑"], bonus: "Piggy Smash Bonus" },
    moonwolf:       { label: "Wolf Moon",            icon: "🐺", reels: 5, maxLines: 25, wild: "🐺", scatter: "🌙", icons: ["🧲","👑","💎","🔔"], bonus: "Howling Wilds" },
    olympusgold:    { label: "Mount Olympus Gold",   icon: "⚡", reels: 5, maxLines: 25, wild: "⚡", scatter: "🏔️", icons: ["👑","💎","🔔","🍀"], bonus: "Zeus Multiplier" },
    doghouse:       { label: "Doghouse Bones",       icon: "🐶", reels: 5, maxLines: 25, wild: "🐶", scatter: "🦴", icons: ["🐾","🔔","🍀","👑"], bonus: "Bone Collector Free Spins" },
    skullfortune:   { label: "Skull Fortune",        icon: "💀", reels: 5, maxLines: 25, wild: "💀", scatter: "🕯️", icons: ["👑","💎","🔔","🍀"], bonus: "Skull Multiplier" },
    pyramidriches:  { label: "Pyramid Riches",       icon: "🔺", reels: 5, maxLines: 25, wild: "🔺", scatter: "🪲", icons: ["💰","💎","👑","🔔"], bonus: "Pyramid Free Spins" },
    firerays:       { label: "Fire Rays Blaze",      icon: "🔥", reels: 5, maxLines: 25, wild: "🔥", scatter: "☀️", icons: ["⚡","👑","💎","🔔"], bonus: "Blaze Multiplier" },
    wildcrown:      { label: "Wild Crown Double",    icon: "👑", reels: 5, maxLines: 25, wild: "👑", scatter: "💫", icons: ["💎","🔔","🍀","🧲"], bonus: "Double Wild Feature" },
    fishfrenzy:     { label: "Fish Frenzy Fortune",  icon: "🐟", reels: 5, maxLines: 25, wild: "🐟", scatter: "🐚", icons: ["⚓","💎","🔔","👑"], bonus: "Frenzy Free Spins" },
    berlinnights:   { label: "Berlin Nights",        icon: "🏙️", reels: 5, maxLines: 25, wild: "🏙️", scatter: "🕰️", icons: ["💎","👑","🔔","🍀"], bonus: "Night Multiplier" },
    coinstrike:     { label: "Coin Strike Vault",    icon: "🪙", reels: 5, maxLines: 25, wild: "🪙", scatter: "🔒", icons: ["🏦","💎","👑","🔔"], bonus: "Hold & Win Bonus" },
    footballdiamond:{ label: "Football Diamond",     icon: "⚽", reels: 5, maxLines: 25, wild: "⚽", scatter: "🏆", icons: ["👟","💎","👑","🔔"], bonus: "Champions Free Spins" },
    slothstash:     { label: "Sloth's Stash",        icon: "🦥", reels: 3, maxLines: 5,  wild: "🦥", scatter: "🍃", icons: ["🌴","🔔","🍀","👑"], bonus: null },
    neonnights:     { label: "Neon Nights",          icon: "🪩", reels: 5, maxLines: 25, wild: "🪩", scatter: "✨", icons: ["💎","👑","🔔","🍀"], bonus: "Neon Multiplier" },
    jungledrums:    { label: "Jungle Drums",         icon: "🥁", reels: 5, maxLines: 25, wild: "🥁", scatter: "🦜", icons: ["🌿","💎","👑","🔔"], bonus: "Drum Beat Free Spins" },
    royaljewels:    { label: "Royal Jewels",         icon: "💍", reels: 3, maxLines: 5,  wild: "💍", scatter: "✨", icons: ["👑","💎","🔔","🍀"], bonus: null },
  };

  const ROWS = 3; // server always deals 3 rows — keep every machine in sync with that

  // Eight paying tiers in the server's payout order (highest → lowest);
  // cycled across each theme's four icons so the landed grid stays on-theme.
  const TIER_ORDER = ["crown","gem","bell","clover","horseshoe","ace","king","queen"];

  function themedGlyph(cfg, key) {
    if (key === "wild") return cfg.wild;
    if (key === "scatter") return cfg.scatter;
    const idx = TIER_ORDER.indexOf(key);
    return cfg.icons[idx >= 0 ? idx % cfg.icons.length : 0] || "❓";
  }
  function randomGlyph(cfg) {
    const pool = [cfg.wild, cfg.scatter, ...cfg.icons];
    return pool[Math.floor(Math.random() * pool.length)];
  }

  // ── Paylines (mirrors server) ────────────────────────────────
  const PAYLINES = [
    [1,1,1,1,1],[0,0,0,0,0],[2,2,2,2,2],[0,1,2,1,0],[2,1,0,1,2],
    [1,0,0,0,1],[1,2,2,2,1],[0,0,1,2,2],[2,2,1,0,0],[1,0,1,0,1],
    [1,2,1,2,1],[0,1,1,1,0],[2,1,1,1,2],[0,1,0,1,0],[2,1,2,1,2],
    [1,1,0,1,1],[1,1,2,1,1],[0,2,0,2,0],[2,0,2,0,2],[0,2,2,2,0],
    [2,0,0,0,2],[1,0,2,0,1],[1,2,0,2,1],[0,0,2,0,0],[2,2,0,2,2],
  ];

  // ── Styles (injected once) ────────────────────────────────
  const STYLE_ID = "slots-machine-styles";
  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
/* ── Slots lobby (machine picker) ────────────── */
.slots-lobby { padding: 20px; }
.slots-lobby-header h2 { margin: 0 0 4px; font-size: 1.3rem; font-weight: 800; }
.slots-lobby-header p { margin: 0 0 18px; color: var(--text-dim); font-size: 0.85rem; }
.slots-lobby-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 12px;
}
.slot-tile {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 18px 10px;
  background: linear-gradient(160deg, #1a1a2e 0%, #16213e 60%, #0f3460 100%);
  border: 1px solid var(--border);
  border-radius: 12px;
  cursor: pointer;
  transition: transform 0.15s, border-color 0.15s;
}
.slot-tile:hover { transform: translateY(-3px); border-color: var(--gold); }
.slot-tile-icon { font-size: 2.2rem; }
.slot-tile-name { font-size: 0.82rem; font-weight: 700; color: var(--text); text-align: center; line-height: 1.25; }
.slot-tile-lines { font-size: 0.7rem; color: var(--text-dim); }

/* ── Back-to-lobby button ─────────────────────── */
.slots-back-btn {
  align-self: flex-start;
  background: none;
  border: 1px solid var(--border);
  color: var(--text-dim);
  border-radius: 8px;
  padding: 6px 12px;
  font-size: 0.78rem;
  cursor: pointer;
}
.slots-back-btn:hover { color: var(--text); border-color: var(--accent); }

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

    // ── Lobby: pick a machine ──────────────────────────────────
    function renderLobby() {
      container.innerHTML = `
        <div class="game-panel">
          <div class="slots-lobby">
            <div class="slots-lobby-header">
              <h2>🎰 Slots</h2>
              <p>${Object.keys(SLOT_TYPES).length} machines, one provably-fair engine — pick one to play.</p>
            </div>
            <div class="slots-lobby-grid">
              ${Object.entries(SLOT_TYPES).map(([key, cfg]) => `
                <button class="slot-tile" data-type="${key}">
                  <div class="slot-tile-icon">${cfg.icon}</div>
                  <div class="slot-tile-name">${cfg.label}</div>
                  <div class="slot-tile-lines">${cfg.maxLines} lines</div>
                </button>
              `).join("")}
            </div>
          </div>
        </div>
      `;

      container.querySelectorAll(".slot-tile").forEach(btn => {
        btn.addEventListener("click", () => {
          currentType = btn.dataset.type;
          renderMachine();
        });
      });
    }

    // ── Machine: bet panel + reels for the selected type ───────
    function renderMachine() {
      const cfg = SLOT_TYPES[currentType];

      container.innerHTML = `
        <div class="game-panel"><div class="game-layout">

          <aside class="bet-panel">
            ${GameThemes.renderPicker("slots", GameThemes.getSaved("slots"))}

            <button class="slots-back-btn" id="slots-back">← All Slots</button>

            <div class="bp-tabs">
              <button class="bp-tab active" id="slots-tab-manual">Manual</button>
              <button class="bp-tab" id="slots-tab-auto">Auto</button>
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
              <div class="bp-label">Lines (1–${cfg.maxLines})</div>
              <input type="number" id="slots-lines" value="${Math.min(10, cfg.maxLines)}" min="1" max="${cfg.maxLines}" step="1" />
            </div>

            <div class="bp-field">
              <div class="bp-label">Total Bet</div>
              <div id="slots-total" style="font-size:1.1rem; font-weight:800; color:var(--gold);">0 🪙</div>
            </div>

            <hr class="bp-divider" />

            <button id="slots-spin" class="play-btn">Spin</button>
          </aside>

          <div class="game-canvas">

            <div class="slots-machine">
              <div class="slots-header">
                <div class="slots-type-name" id="slots-type-name">${cfg.icon} ${cfg.label}</div>
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
        total:      container.querySelector("#slots-total"),
        spin:       container.querySelector("#slots-spin"),
        result:     container.querySelector("#slots-result"),
        fairness:   container.querySelector("#slots-fairness"),
        winDisplay: container.querySelector("#slots-win-display"),
        back:       container.querySelector("#slots-back"),
      };

      els.back.addEventListener("click", () => {
        if (busy) return;
        renderLobby();
      });

      // ── Quick bet buttons ───────────────────────────────────────
      els.half.addEventListener("click", () => {
        els.lineBet.value = Math.max(0.01, Math.floor(Number(els.lineBet.value) * 0.5 * 100) / 100);
        refreshTotal();
      });
      els.dbl.addEventListener("click", () => {
        els.lineBet.value = Math.floor(Number(els.lineBet.value) * 2 * 100) / 100;
        refreshTotal();
      });

      // ── Grid builder ────────────────────────────────────────────
      // Returns: { reelEls, symbolEls }
      function buildGrid() {
        els.reels.innerHTML = "";

        const reelEls   = [];
        const symbolEls = [];

        for (let reel = 0; reel < cfg.reels; reel++) {
          const reelDiv = document.createElement("div");
          reelDiv.className = "slot-reel";
          reelDiv.dataset.reel = reel;
          reelDiv.style.height = `${ROWS * 70}px`;

          const strip = document.createElement("div");
          strip.className = "reel-strip";
          reelDiv.appendChild(strip);

          const rowEls = [];
          for (let row = 0; row < ROWS; row++) {
            const cell = document.createElement("div");
            cell.className = "slot-symbol";
            cell.dataset.reel = reel;
            cell.dataset.row  = row;
            cell.textContent  = randomGlyph(cfg);
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
          reelEl.classList.add("is-spinning");

          let count = 0;
          const threshold = 10 + stopDelay * 3;
          const interval = setInterval(() => {
            rowEls.forEach(el => { el.textContent = randomGlyph(cfg); });
            count++;
            if (count >= threshold) {
              clearInterval(interval);
              reelEl.classList.remove("is-spinning");
              finalSymbols.forEach((sym, i) => {
                if (rowEls[i]) rowEls[i].textContent = themedGlyph(cfg, sym);
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
        const { reelEls, symbolEls } = buildGrid();

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
        const lines = Math.max(1, Math.min(cfg.maxLines, Math.round(Number(els.lines.value) || 1)));
        const lineBetCents = Math.round((Number(els.lineBet.value) || 0) * 100);
        els.total.textContent = UI.money(lineBetCents * lines);
      }
      els.lineBet.addEventListener("input", refreshTotal);
      els.lines.addEventListener("input", refreshTotal);

      // ── Spin handler ──────────────────────────────────────────────
      async function play() {
        const lineBet = Math.round((Number(els.lineBet.value) || 0) * 100);
        const lines = Math.max(1, Math.min(cfg.maxLines, Math.round(Number(els.lines.value) || 1)));
        if (lineBet <= 0) { UI.toast("Enter a bet per line.", "loss"); throw new Error("bad bet"); }

        busy = true;
        els.spin.disabled = true;
        els.back.disabled = true;
        els.result.className = "result-banner";
        els.winDisplay.className = "win-display";
        els.winDisplay.textContent = "WIN: 0 🪙";

        const spinSalt = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

        try {
          const res = await Api.post("/games/slots/spin", { lineBet, lines, spinSalt });
          const { grid, lineWins, scatterCount, scatterPayout, freeSpinsAwarded } = res.result.state;

          // The server always deals 5 reels — pad/trim down to this machine's reel count.
          const paddedGrid = [];
          for (let r = 0; r < cfg.reels; r++) paddedGrid.push(grid[r] || grid[r % grid.length]);

          const { symbolEls } = await animateReels(paddedGrid);

          // Highlight winning cells
          for (const win of lineWins) {
            const positions = PAYLINES[win.line];
            if (!positions) continue;
            const count = Math.min(win.count, cfg.reels);
            for (let r = 0; r < count; r++) {
              const row = positions[r] ?? 1;
              const cell = symbolEls[r]?.[row];
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
          UI.toast(isWin ? `Won ${UI.money(res.result.payout)} on ${cfg.label}!` : "No win this spin.", isWin ? "win" : "info");
        } catch (err) {
          UI.toast(err.message, "loss");
          throw err;
        } finally {
          busy = false;
          els.spin.disabled = false;
          els.back.disabled = false;
        }
      }

      GameAuto.setup(container, { playBtn: els.spin, play });

      // Initial build
      buildGrid();
      refreshTotal();

      GameThemes.init(container, "slots");
    }

    renderLobby();

    HowToPlay.addButton(container, "slots");
  }

  return { render };
})();
