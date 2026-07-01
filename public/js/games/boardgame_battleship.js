/* ═══════════════════════════════════════════════════════════════
   Battleship Board Game — GrilledCoin
   Exported global: BattleshipGame
   Entry point:     BattleshipGame.renderBoard(container, socket, room, myUserId)
   ═══════════════════════════════════════════════════════════════ */

const BattleshipGame = (() => {

  // ── Constants ─────────────────────────────────────────────────
  const SHIPS = [
    { name: "Carrier",    size: 5 },
    { name: "Battleship", size: 4 },
    { name: "Cruiser",    size: 3 },
    { name: "Submarine",  size: 3 },
    { name: "Destroyer",  size: 2 },
  ];

  const SHIP_COLORS = {
    "Carrier":    "#6366f1",
    "Battleship": "#8b5cf6",
    "Cruiser":    "#0ea5e9",
    "Submarine":  "#06b6d4",
    "Destroyer":  "#14b8a6",
  };

  const ROWS = 10;
  const COLS = 10;

  // ── CSS injected once per page ─────────────────────────────────
  function injectStyles() {
    if (document.getElementById("bs-styles")) return;
    const style = document.createElement("style");
    style.id = "bs-styles";
    style.textContent = `
      .bs-wrap {
        max-width: 900px;
        padding: 16px;
        font-family: inherit;
      }
      .bs-title {
        font-size: 1.4rem;
        font-weight: 800;
        margin: 0 0 4px;
        color: var(--text);
      }
      .bs-subtitle {
        font-size: 0.85rem;
        color: var(--text-dim);
        margin: 0 0 18px;
      }
      .bs-status-bar {
        background: var(--bg-elev);
        border: 1px solid var(--border);
        border-radius: 10px;
        padding: 10px 16px;
        margin-bottom: 16px;
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
      }
      .bs-status-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: var(--accent);
        flex-shrink: 0;
      }
      .bs-status-dot.waiting { background: var(--gold); }
      .bs-status-dot.my-turn { background: var(--accent); animation: bs-pulse 1s ease-in-out infinite; }
      .bs-status-dot.opp-turn { background: var(--loss); }
      @keyframes bs-pulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.6; transform: scale(1.3); }
      }
      .bs-status-text {
        font-size: 0.9rem;
        font-weight: 600;
        color: var(--text);
      }
      /* ── Ship list (placement phase) ── */
      .bs-ship-list {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        margin-bottom: 14px;
      }
      .bs-ship-pill {
        display: flex;
        align-items: center;
        gap: 6px;
        background: var(--bg-elev);
        border: 2px solid var(--border);
        border-radius: 8px;
        padding: 6px 10px;
        font-size: 0.8rem;
        color: var(--text-dim);
        transition: border-color 0.2s, color 0.2s;
        user-select: none;
      }
      .bs-ship-pill.active {
        border-color: var(--accent);
        color: var(--text);
      }
      .bs-ship-pill.placed {
        border-color: var(--win);
        color: var(--win);
        opacity: 0.7;
      }
      .bs-ship-pill-dot {
        width: 10px;
        height: 10px;
        border-radius: 2px;
        flex-shrink: 0;
      }
      /* ── Orientation toggle ── */
      .bs-orientation-btn {
        background: var(--bg-elev);
        border: 1px solid var(--border);
        color: var(--text);
        border-radius: 8px;
        padding: 8px 14px;
        font-size: 0.82rem;
        font-weight: 600;
        cursor: pointer;
        transition: border-color 0.15s, background 0.15s;
        user-select: none;
      }
      .bs-orientation-btn:hover {
        border-color: var(--accent);
        background: var(--bg-hover);
      }
      .bs-orientation-btn.horizontal { color: var(--accent); border-color: var(--accent); }
      /* ── Grid layout ── */
      .bs-grids-row {
        display: flex;
        gap: 28px;
        flex-wrap: wrap;
        justify-content: center;
        margin-bottom: 16px;
      }
      .bs-grid-section {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
      }
      .bs-grid-label {
        font-size: 0.78rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.07em;
        color: var(--text-dim);
      }
      /* ── The 10×10 grid ── */
      .bs-grid {
        display: grid;
        grid-template-columns: repeat(10, 1fr);
        gap: 2px;
        padding: 2px;
        background: var(--bg-elev);
        border: 2px solid var(--border);
        border-radius: 8px;
        user-select: none;
      }
      .bs-grid.interactive { cursor: crosshair; }
      .bs-cell {
        width: 32px;
        height: 32px;
        border-radius: 4px;
        background: var(--bg-card);
        border: 1px solid var(--border);
        transition: background 0.15s, border-color 0.15s, transform 0.1s;
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 0.75rem;
        font-weight: 700;
      }
      .bs-cell.ship {
        border-color: transparent;
      }
      .bs-cell.preview {
        background: rgba(0, 231, 1, 0.3) !important;
        border-color: var(--accent) !important;
      }
      .bs-cell.preview-invalid {
        background: rgba(229, 70, 61, 0.3) !important;
        border-color: var(--loss) !important;
      }
      .bs-cell.hit {
        background: rgba(229, 70, 61, 0.25) !important;
      }
      .bs-cell.miss {
        background: rgba(77, 159, 236, 0.18) !important;
      }
      .bs-cell.clickable:hover {
        transform: scale(1.12);
        z-index: 2;
        border-color: var(--accent);
      }
      .bs-cell.already-fired {
        cursor: not-allowed;
        opacity: 0.7;
      }
      /* ── Hit/miss markers ── */
      .bs-marker-hit {
        position: absolute;
        inset: 2px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1rem;
        color: var(--loss);
        font-weight: 900;
        line-height: 1;
      }
      .bs-marker-miss {
        position: absolute;
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--accent-2, #4d9fec);
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
      }
      /* ── Action bar ── */
      .bs-action-bar {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
        margin-bottom: 16px;
      }
      .bs-btn-primary {
        background: var(--accent);
        color: #071c10;
        font-weight: 700;
        padding: 10px 20px;
        border-radius: 8px;
        font-size: 0.88rem;
        border: none;
        cursor: pointer;
        transition: filter 0.15s, transform 0.1s;
      }
      .bs-btn-primary:hover:not(:disabled) { filter: brightness(1.12); transform: translateY(-1px); }
      .bs-btn-primary:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }
      .bs-btn-secondary {
        background: var(--bg-elev);
        color: var(--text-dim);
        font-weight: 600;
        padding: 10px 16px;
        border-radius: 8px;
        font-size: 0.88rem;
        border: 1px solid var(--border);
        cursor: pointer;
        transition: border-color 0.15s, color 0.15s;
      }
      .bs-btn-secondary:hover:not(:disabled) { border-color: var(--accent); color: var(--text); }
      .bs-btn-secondary:disabled { opacity: 0.4; cursor: not-allowed; }
      /* ── Result banner ── */
      .bs-result {
        border-radius: 10px;
        padding: 14px 18px;
        font-size: 1rem;
        font-weight: 700;
        text-align: center;
        display: none;
        margin-top: 4px;
      }
      .bs-result.win {
        display: block;
        background: rgba(0, 231, 1, 0.15);
        border: 1.5px solid var(--win);
        color: var(--win);
      }
      .bs-result.loss {
        display: block;
        background: rgba(229, 70, 61, 0.13);
        border: 1.5px solid var(--loss);
        color: var(--loss);
      }
      /* ── Waiting overlay ── */
      .bs-waiting-badge {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        background: var(--bg-elev);
        border: 1px solid var(--border);
        border-radius: 20px;
        padding: 6px 14px;
        font-size: 0.83rem;
        color: var(--text-dim);
      }
      .bs-spinner {
        width: 14px;
        height: 14px;
        border: 2px solid var(--border);
        border-top-color: var(--accent);
        border-radius: 50%;
        animation: bs-spin 0.7s linear infinite;
      }
      @keyframes bs-spin { to { transform: rotate(360deg); } }
      /* ── Responsive ── */
      @media (max-width: 640px) {
        .bs-cell { width: 26px; height: 26px; font-size: 0.65rem; }
        .bs-grids-row { gap: 16px; }
      }
      @media (max-width: 420px) {
        .bs-cell { width: 22px; height: 22px; }
      }
    `;
    document.head.appendChild(style);
  }

  // ── Helpers ───────────────────────────────────────────────────
  function cellKey(r, c) { return `${r},${c}`; }

  function getShipCells(r, c, size, isHorizontal) {
    const cells = [];
    for (let i = 0; i < size; i++) {
      cells.push(isHorizontal ? [r, c + i] : [r + i, c]);
    }
    return cells;
  }

  function isValidPlacement(cells, placed) {
    const existing = new Set();
    placed.forEach(ship => ship.cells.forEach(([r, c]) => {
      // Also mark surrounding cells as occupied
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          existing.add(cellKey(r + dr, c + dc));
        }
      }
    }));
    for (const [r, c] of cells) {
      if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return false;
      if (existing.has(cellKey(r, c))) return false;
    }
    return true;
  }

  // ── Build empty grid matrix ────────────────────────────────────
  function emptyGrid() {
    return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  }

  // ── Render grid DOM ────────────────────────────────────────────
  function buildGridEl(id, interactive) {
    const grid = document.createElement("div");
    grid.className = "bs-grid" + (interactive ? " interactive" : "");
    grid.id = id;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = document.createElement("div");
        cell.className = "bs-cell";
        cell.dataset.r = r;
        cell.dataset.c = c;
        grid.appendChild(cell);
      }
    }
    return grid;
  }

  function getCellEl(gridEl, r, c) {
    return gridEl.querySelector(`.bs-cell[data-r="${r}"][data-c="${c}"]`);
  }

  // ── Paint a grid from state data ───────────────────────────────
  function paintMyGrid(gridEl, ships, myGridState) {
    // Clear all
    gridEl.querySelectorAll(".bs-cell").forEach(el => {
      el.className = "bs-cell";
      el.style.background = "";
      el.innerHTML = "";
    });

    // Paint ships
    if (ships) {
      ships.forEach(ship => {
        (ship.cells || []).forEach(([r, c]) => {
          const el = getCellEl(gridEl, r, c);
          if (el) {
            el.className = "bs-cell ship";
            el.style.background = SHIP_COLORS[ship.name] || "#6366f1";
          }
        });
      });
    }

    // Paint hits/misses from opponent's shots on my grid
    if (myGridState) {
      (myGridState.hits || []).forEach(([r, c]) => {
        const el = getCellEl(gridEl, r, c);
        if (el) {
          el.classList.add("hit");
          el.innerHTML = `<span class="bs-marker-hit">✕</span>`;
        }
      });
      (myGridState.misses || []).forEach(([r, c]) => {
        const el = getCellEl(gridEl, r, c);
        if (el) {
          el.classList.add("miss");
          el.innerHTML = `<span class="bs-marker-miss"></span>`;
        }
      });
    }
  }

  function paintOpponentGrid(gridEl, opponentGrid, isMyTurn, firedCells) {
    gridEl.querySelectorAll(".bs-cell").forEach(el => {
      const r = parseInt(el.dataset.r, 10);
      const c = parseInt(el.dataset.c, 10);
      el.className = "bs-cell";
      el.style.background = "";
      el.innerHTML = "";

      const key = cellKey(r, c);
      const alreadyFired = firedCells.has(key);

      if (alreadyFired) {
        el.classList.add("already-fired");
      } else if (isMyTurn) {
        el.classList.add("clickable");
      }
    });

    if (opponentGrid) {
      (opponentGrid.hits || []).forEach(([r, c]) => {
        const el = getCellEl(gridEl, r, c);
        if (el) {
          el.classList.add("hit");
          el.innerHTML = `<span class="bs-marker-hit">✕</span>`;
        }
      });
      (opponentGrid.misses || []).forEach(([r, c]) => {
        const el = getCellEl(gridEl, r, c);
        if (el) {
          el.classList.add("miss");
          el.innerHTML = `<span class="bs-marker-miss"></span>`;
        }
      });
    }
  }

  // ── Main renderBoard ──────────────────────────────────────────
  function renderBoard(container, socket, room, myUserId) {
    injectStyles();

    // Mutable state for placement phase
    let placedShips = [];
    let currentShipIdx = 0;
    let isHorizontal = true;
    let hoverR = -1;
    let hoverC = -1;

    // Track fired cells for opponent grid
    const firedCells = new Set();

    // ── Build HTML shell ──
    container.innerHTML = `
      <div class="bs-wrap">
        <h2 class="bs-title">⚓ Battleship</h2>
        <p class="bs-subtitle">Place your fleet, then hunt down your opponent's ships. First to sink all 5 wins!</p>

        <div class="bs-status-bar" id="bs-status-bar">
          <div class="bs-status-dot waiting" id="bs-status-dot"></div>
          <span class="bs-status-text" id="bs-status-text">Loading…</span>
        </div>

        <!-- PLACEMENT PHASE -->
        <div id="bs-placement-phase">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;flex-wrap:wrap">
            <span style="font-size:0.82rem;font-weight:700;color:var(--text-dim);text-transform:uppercase;letter-spacing:.06em">Ships:</span>
            <div class="bs-ship-list" id="bs-ship-list"></div>
            <button class="bs-orientation-btn horizontal" id="bs-orient-btn">↔ Horizontal</button>
          </div>
          <div class="bs-grids-row">
            <div class="bs-grid-section">
              <div class="bs-grid-label">Your Board</div>
              <div id="bs-place-grid"></div>
            </div>
          </div>
          <div class="bs-action-bar" id="bs-place-actions">
            <button class="bs-btn-primary" id="bs-submit-btn" disabled>Submit Placement</button>
            <button class="bs-btn-secondary" id="bs-clear-btn">Clear All</button>
          </div>
          <div id="bs-place-waiting" style="display:none;margin-top:8px">
            <div class="bs-waiting-badge">
              <div class="bs-spinner"></div>
              <span>Waiting for opponent to place their ships…</span>
            </div>
          </div>
        </div>

        <!-- BATTLE PHASE -->
        <div id="bs-battle-phase" style="display:none">
          <div class="bs-grids-row">
            <div class="bs-grid-section">
              <div class="bs-grid-label">Your Fleet</div>
              <div id="bs-my-grid"></div>
            </div>
            <div class="bs-grid-section">
              <div class="bs-grid-label">Enemy Waters</div>
              <div id="bs-opp-grid"></div>
            </div>
          </div>
        </div>

        <div class="bs-result" id="bs-result"></div>
      </div>
    `;

    // ── Element refs ──
    const statusDot  = document.getElementById("bs-status-dot");
    const statusText = document.getElementById("bs-status-text");
    const placementPhase = document.getElementById("bs-placement-phase");
    const battlePhase    = document.getElementById("bs-battle-phase");
    const shipListEl     = document.getElementById("bs-ship-list");
    const orientBtn      = document.getElementById("bs-orient-btn");
    const submitBtn      = document.getElementById("bs-submit-btn");
    const clearBtn       = document.getElementById("bs-clear-btn");
    const placeWaiting   = document.getElementById("bs-place-waiting");
    const placeActions   = document.getElementById("bs-place-actions");
    const resultEl       = document.getElementById("bs-result");

    // ── Build grids ──
    const placeGridEl = buildGridEl("bs-place-grid-inner", true);
    document.getElementById("bs-place-grid").appendChild(placeGridEl);

    const myGridEl  = buildGridEl("bs-my-grid-inner", false);
    const oppGridEl = buildGridEl("bs-opp-grid-inner", false);
    document.getElementById("bs-my-grid").appendChild(myGridEl);
    document.getElementById("bs-opp-grid").appendChild(oppGridEl);

    // ── Ship pill list ──
    function renderShipList() {
      shipListEl.innerHTML = SHIPS.map((ship, i) => {
        const placed = i < placedShips.length;
        const active = i === placedShips.length && i === currentShipIdx;
        return `<div class="bs-ship-pill ${placed ? "placed" : active ? "active" : ""}" data-ship-idx="${i}">
          <div class="bs-ship-pill-dot" style="background:${SHIP_COLORS[ship.name]}"></div>
          ${ship.name} (${ship.size})
        </div>`;
      }).join("");
    }

    // ── Preview helpers ──
    function clearPreview() {
      placeGridEl.querySelectorAll(".bs-cell").forEach(el => {
        el.classList.remove("preview", "preview-invalid");
      });
    }

    function showPreview(r, c) {
      clearPreview();
      if (placedShips.length >= SHIPS.length) return;
      const ship = SHIPS[placedShips.length];
      const cells = getShipCells(r, c, ship.size, isHorizontal);
      const valid = isValidPlacement(cells, placedShips);
      cells.forEach(([cr, cc]) => {
        if (cr >= 0 && cr < ROWS && cc >= 0 && cc < COLS) {
          const el = getCellEl(placeGridEl, cr, cc);
          if (el) el.classList.add(valid ? "preview" : "preview-invalid");
        }
      });
    }

    function repaintPlaceGrid() {
      // Clear
      placeGridEl.querySelectorAll(".bs-cell").forEach(el => {
        el.className = "bs-cell";
        el.style.background = "";
      });
      // Paint placed ships
      placedShips.forEach(ship => {
        ship.cells.forEach(([r, c]) => {
          const el = getCellEl(placeGridEl, r, c);
          if (el) {
            el.className = "bs-cell ship";
            el.style.background = SHIP_COLORS[ship.name] || "#6366f1";
          }
        });
      });
      // Re-apply hover preview
      if (hoverR >= 0 && hoverC >= 0) showPreview(hoverR, hoverC);
    }

    // ── Placement grid events ──
    placeGridEl.addEventListener("mouseover", e => {
      const cell = e.target.closest(".bs-cell");
      if (!cell) return;
      hoverR = parseInt(cell.dataset.r, 10);
      hoverC = parseInt(cell.dataset.c, 10);
      showPreview(hoverR, hoverC);
    });

    placeGridEl.addEventListener("mouseleave", () => {
      hoverR = -1;
      hoverC = -1;
      clearPreview();
    });

    placeGridEl.addEventListener("click", e => {
      const cell = e.target.closest(".bs-cell");
      if (!cell) return;
      if (placedShips.length >= SHIPS.length) return;

      const r = parseInt(cell.dataset.r, 10);
      const c = parseInt(cell.dataset.c, 10);
      const ship = SHIPS[placedShips.length];
      const cells = getShipCells(r, c, ship.size, isHorizontal);

      if (!isValidPlacement(cells, placedShips)) {
        UI.toast("Can't place ship there — overlapping or out of bounds", "loss");
        return;
      }

      placedShips.push({ name: ship.name, size: ship.size, cells });
      currentShipIdx = placedShips.length;
      repaintPlaceGrid();
      renderShipList();

      if (placedShips.length === SHIPS.length) {
        submitBtn.disabled = false;
        clearPreview();
      }
    });

    // ── Orientation toggle ──
    orientBtn.addEventListener("click", () => {
      isHorizontal = !isHorizontal;
      orientBtn.textContent = isHorizontal ? "↔ Horizontal" : "↕ Vertical";
      orientBtn.className = "bs-orientation-btn" + (isHorizontal ? " horizontal" : "");
      clearPreview();
      if (hoverR >= 0 && hoverC >= 0) showPreview(hoverR, hoverC);
    });

    // ── Clear button ──
    clearBtn.addEventListener("click", () => {
      placedShips = [];
      currentShipIdx = 0;
      submitBtn.disabled = true;
      repaintPlaceGrid();
      renderShipList();
    });

    // ── Submit placement ──
    submitBtn.addEventListener("click", () => {
      if (placedShips.length < SHIPS.length) return;
      submitBtn.disabled = true;
      socket.emit("bg:move", {
        roomId: room.id,
        move: { ships: placedShips.map(s => ({ cells: s.cells })) },
      });
      placeActions.style.display = "none";
      placeWaiting.style.display = "";
      setStatus("waiting", "Ships placed — waiting for opponent…");
    });

    // ── Opponent grid click (fire) ──
    oppGridEl.addEventListener("click", e => {
      const cell = e.target.closest(".bs-cell");
      if (!cell) return;
      if (!cell.classList.contains("clickable")) return;

      const r = parseInt(cell.dataset.r, 10);
      const c = parseInt(cell.dataset.c, 10);
      const key = cellKey(r, c);
      if (firedCells.has(key)) return;

      firedCells.add(key);
      // Temporarily mark as fired
      cell.classList.remove("clickable");
      cell.classList.add("already-fired");

      socket.emit("bg:move", {
        roomId: room.id,
        move: { row: r, col: c },
      });
    });

    // ── Status helpers ──
    function setStatus(type, msg) {
      statusDot.className = "bs-status-dot " + type;
      statusText.textContent = msg;
    }

    // ── Phase transition helpers ──
    function showBattlePhase(state) {
      placementPhase.style.display = "none";
      battlePhase.style.display = "";

      const isMyTurn = state.turn === myUserId;
      if (isMyTurn) {
        setStatus("my-turn", "Your turn — click a cell on the enemy grid to fire!");
      } else {
        setStatus("opp-turn", "Opponent's turn — hang tight…");
      }

      paintMyGrid(myGridEl, state.myShips, state.myGrid);
      paintOpponentGrid(oppGridEl, state.opponentGrid, isMyTurn, firedCells);
    }

    function showPlacementPhase(state) {
      placementPhase.style.display = "";
      battlePhase.style.display = "none";

      const alreadyPlaced = state.placedPlayers && state.placedPlayers.includes(myUserId);
      if (alreadyPlaced) {
        placeActions.style.display = "none";
        placeWaiting.style.display = "";
        setStatus("waiting", "Ships placed — waiting for opponent…");
        // Repaint our placed ships if state has them
        if (state.myShips && state.myShips.length > 0) {
          paintMyGrid(placeGridEl, state.myShips, null);
        }
      } else {
        placeActions.style.display = "";
        placeWaiting.style.display = "none";
        setStatus("waiting", "Place your ships to begin!");
        renderShipList();
        repaintPlaceGrid();
      }
    }

    // ── Translate backend gameState → UI state ──
    // Backend: state.players[userId].grid (0=empty,1=ship,2=hit on ship,3=miss)
    //          state.players[userId].shipsPlaced
    //          state.turn (userId)
    //          state.phase "placement"|"battle"
    //          state.playerOrder [userId, ...]
    function translateState(gs) {
      if (!gs || !gs.players) return null;
      const opponentId = (gs.playerOrder || []).find(uid => uid !== myUserId);
      const myPlayer  = gs.players[myUserId]  || {};
      const oppPlayer = gs.players[opponentId] || {};

      // Extract my ships from my grid (cells with value 1 originally).
      // After placement the backend stores ship cells as grid[r][c] === 1.
      // We rebuild a single "all-cells" ship list for painting.
      const myGrid = myPlayer.grid || [];
      const myShipCells = [];
      for (let r = 0; r < myGrid.length; r++) {
        for (let c = 0; c < (myGrid[r] || []).length; c++) {
          if (myGrid[r][c] === 1) myShipCells.push([r, c]);
        }
      }
      // Synthetic ship list (one ship, all cells) — just for painting positions
      const myShips = myShipCells.length > 0 ? [{ name: "Ship", cells: myShipCells }] : [];

      // Hits and misses on MY grid (opponent fired at me):
      // grid[r][c] === 2 = hit on ship (opponent hit me)
      // grid[r][c] === 3 = miss (opponent missed)
      const myGridHits   = [];
      const myGridMisses = [];
      for (let r = 0; r < myGrid.length; r++) {
        for (let c = 0; c < (myGrid[r] || []).length; c++) {
          if (myGrid[r][c] === 2) myGridHits.push([r, c]);
          else if (myGrid[r][c] === 3) myGridMisses.push([r, c]);
        }
      }

      // Hits/misses on OPPONENT's grid (I fired at opponent):
      const oppGrid = oppPlayer.grid || [];
      const oppGridHits   = [];
      const oppGridMisses = [];
      for (let r = 0; r < oppGrid.length; r++) {
        for (let c = 0; c < (oppGrid[r] || []).length; c++) {
          if (oppGrid[r][c] === 2) oppGridHits.push([r, c]);
          else if (oppGrid[r][c] === 3) oppGridMisses.push([r, c]);
        }
      }

      // placedPlayers list (who has submitted ships)
      const placedPlayers = (gs.playerOrder || []).filter(uid => gs.players[uid] && gs.players[uid].shipsPlaced);

      return {
        phase:         gs.phase || "placement",
        turn:          gs.turn,
        status:        gs.status,
        winner:        gs.winner,
        myShips,
        myGrid:        { hits: myGridHits, misses: myGridMisses },
        opponentGrid:  { hits: oppGridHits, misses: oppGridMisses },
        placedPlayers,
      };
    }

    // ── Initialize from current room state ──
    const rawInitialState = room.gameState || room.state || null;
    const st = rawInitialState ? (translateState(rawInitialState) || {}) : {};

    // Seed firedCells from initial state
    if (st.opponentGrid) {
      (st.opponentGrid.hits || []).forEach(([r, c]) => firedCells.add(cellKey(r, c)));
      (st.opponentGrid.misses || []).forEach(([r, c]) => firedCells.add(cellKey(r, c)));
    }

    if (st.phase === "battle") {
      showBattlePhase(st);
    } else {
      showPlacementPhase(st);
    }

    // ── Socket event: room update from server ──
    socket.on("bg:room-update", (updatedRoom) => {
      const rawState = updatedRoom.gameState;
      if (!rawState) return;
      const newState = translateState(rawState);
      if (!newState) return;

      // Update firedCells from latest opponentGrid
      if (newState.opponentGrid) {
        (newState.opponentGrid.hits || []).forEach(([r, c]) => firedCells.add(cellKey(r, c)));
        (newState.opponentGrid.misses || []).forEach(([r, c]) => firedCells.add(cellKey(r, c)));
      }

      if (newState.phase === "battle") {
        showBattlePhase(newState);
      } else if (newState.phase === "placement") {
        showPlacementPhase(newState);
      }
    });

    // ── Socket event: error ──
    socket.on("bg:error", ({ message }) => {
      UI.toast(message || "An error occurred", "loss");
      submitBtn.disabled = false;
    });
  }

  return { renderBoard };
})();
