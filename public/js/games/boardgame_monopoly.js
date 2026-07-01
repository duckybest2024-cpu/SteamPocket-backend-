const MonopolyGame = (() => {

  // ── Board square definitions ──────────────────────────────────
  // 40 squares, indexed 0-39. Groups use CSS class names for color bands.
  const SQUARE_DEFS = [
    { index:0,  name:"Go",              type:"go" },
    { index:1,  name:"Mediterranean",   type:"property", group:"brown" },
    { index:2,  name:"Community Chest", type:"community" },
    { index:3,  name:"Baltic Ave",      type:"property", group:"brown" },
    { index:4,  name:"Income Tax",      type:"tax" },
    { index:5,  name:"Reading RR",      type:"railroad" },
    { index:6,  name:"Oriental Ave",    type:"property", group:"lightblue" },
    { index:7,  name:"Chance",          type:"chance" },
    { index:8,  name:"Vermont Ave",     type:"property", group:"lightblue" },
    { index:9,  name:"Connecticut Ave", type:"property", group:"lightblue" },
    { index:10, name:"Jail / Just Visiting", type:"jail" },
    { index:11, name:"St. Charles Pl", type:"property", group:"pink" },
    { index:12, name:"Electric Co",    type:"utility" },
    { index:13, name:"States Ave",     type:"property", group:"pink" },
    { index:14, name:"Virginia Ave",   type:"property", group:"pink" },
    { index:15, name:"Pennsylvania RR",type:"railroad" },
    { index:16, name:"St. James Pl",   type:"property", group:"orange" },
    { index:17, name:"Community Chest",type:"community" },
    { index:18, name:"Tennessee Ave",  type:"property", group:"orange" },
    { index:19, name:"New York Ave",   type:"property", group:"orange" },
    { index:20, name:"Free Parking",   type:"freeparking" },
    { index:21, name:"Kentucky Ave",   type:"property", group:"red" },
    { index:22, name:"Chance",         type:"chance" },
    { index:23, name:"Indiana Ave",    type:"property", group:"red" },
    { index:24, name:"Illinois Ave",   type:"property", group:"red" },
    { index:25, name:"B&O Railroad",   type:"railroad" },
    { index:26, name:"Atlantic Ave",   type:"property", group:"yellow" },
    { index:27, name:"Ventnor Ave",    type:"property", group:"yellow" },
    { index:28, name:"Water Works",    type:"utility" },
    { index:29, name:"Marvin Gardens", type:"property", group:"yellow" },
    { index:30, name:"Go To Jail",     type:"gotojail" },
    { index:31, name:"Pacific Ave",    type:"property", group:"green" },
    { index:32, name:"North Carolina", type:"property", group:"green" },
    { index:33, name:"Community Chest",type:"community" },
    { index:34, name:"Pennsylvania Ave",type:"property", group:"green" },
    { index:35, name:"Short Line RR",  type:"railroad" },
    { index:36, name:"Chance",         type:"chance" },
    { index:37, name:"Park Place",     type:"property", group:"darkblue" },
    { index:38, name:"Luxury Tax",     type:"tax" },
    { index:39, name:"Boardwalk",      type:"property", group:"darkblue" },
  ];

  const GROUP_COLORS = {
    brown:    "#92400e",
    lightblue:"#0ea5e9",
    pink:     "#db2777",
    orange:   "#ea580c",
    red:      "#dc2626",
    yellow:   "#ca8a04",
    green:    "#16a34a",
    darkblue: "#1e40af",
    railroad: "#374151",
    utility:  "#6b7280",
  };

  const TYPE_ICONS = {
    go:         "GO",
    jail:       "🚔",
    freeparking:"🅿",
    gotojail:   "➡🚔",
    tax:        "💸",
    community:  "📦",
    chance:     "?",
    railroad:   "🚂",
    utility:    "⚡",
  };

  const PLAYER_COLORS = ["#ef4444","#3b82f6","#22c55e","#f59e0b","#a855f7","#ec4899"];

  // ── 40-square perimeter layout ────────────────────────────────
  // Bottom row: 10 squares right→left (index 0..10), indices 0-10
  // Left column: 9 squares bottom→top (index 10..20), indices 11-19 (+20 corner)
  // Top row: 9 squares left→right (index 20..30), indices 21-29 (+30 corner)
  // Right column: 9 squares top→bottom (index 30..40), indices 31-39

  function squarePositions() {
    // Returns array of { sq, gridRow, gridCol } for 11x11 grid (0-indexed)
    const pos = [];
    const GRID = 10; // 11x11 but cells 1..9 are inner
    // Bottom row (row 10), cols 10..0, squares 0..10
    for (let i = 0; i <= 10; i++) {
      pos[i] = { gridRow: 10, gridCol: 10 - i };
    }
    // Left col (col 0), rows 9..1, squares 11..19
    for (let i = 1; i <= 9; i++) {
      pos[10 + i] = { gridRow: 10 - i, gridCol: 0 };
    }
    // Top row (row 0), cols 0..10, squares 20..30
    for (let i = 0; i <= 10; i++) {
      pos[20 + i] = { gridRow: 0, gridCol: i };
    }
    // Right col (col 10), rows 1..9, squares 31..39
    for (let i = 1; i <= 9; i++) {
      pos[30 + i] = { gridRow: i, gridCol: 10 };
    }
    return pos;
  }

  // ── Dice dot patterns ─────────────────────────────────────────
  function diceDotHTML(n) {
    // 9 dot positions in a 3x3 grid, true = dot shown
    const patterns = {
      1: [0,0,0, 0,1,0, 0,0,0],
      2: [1,0,0, 0,0,0, 0,0,1],
      3: [1,0,0, 0,1,0, 0,0,1],
      4: [1,0,1, 0,0,0, 1,0,1],
      5: [1,0,1, 0,1,0, 1,0,1],
      6: [1,0,1, 1,0,1, 1,0,1],
    };
    const dots = patterns[n] || patterns[1];
    return `<div style="
      display:grid;grid-template-columns:repeat(3,10px);
      grid-template-rows:repeat(3,10px);gap:2px;padding:6px;
      background:white;border-radius:8px;width:42px;height:42px;
      box-shadow:0 2px 6px rgba(0,0,0,0.4);
    ">
      ${dots.map(d => `<div style="
        width:10px;height:10px;border-radius:50%;
        background:${d ? "#1a1a2e" : "transparent"};
      "></div>`).join("")}
    </div>`;
  }

  // ── Main renderBoard ──────────────────────────────────────────
  function renderBoard(container, socket, room, myUserId) {

    // Inject styles once
    if (!document.getElementById("monopoly-styles")) {
      const style = document.createElement("style");
      style.id = "monopoly-styles";
      style.textContent = `
        .mono-wrap {
          display:grid;
          grid-template-columns:1fr 260px;
          gap:12px;
          max-width:1000px;
          margin:0 auto;
          padding:12px;
        }
        @media(max-width:720px) {
          .mono-wrap { grid-template-columns:1fr; }
        }

        .mono-board-outer {
          background:var(--bg-card);border:1px solid var(--border);border-radius:12px;
          padding:8px;overflow:auto;
        }
        .mono-board-grid {
          display:grid;
          grid-template-columns:repeat(11, 1fr);
          grid-template-rows:repeat(11, 1fr);
          width:100%;
          aspect-ratio:1/1;
          min-width:340px;
          gap:1px;
          background:var(--border);
          border-radius:8px;
          overflow:hidden;
        }
        .mono-sq {
          background:var(--bg-elev);
          display:flex;flex-direction:column;align-items:center;justify-content:flex-end;
          position:relative;overflow:hidden;cursor:default;
          font-size:0.52rem;color:var(--text-dim);text-align:center;
          padding:2px;line-height:1.2;
          transition:background 0.15s;
        }
        .mono-sq:hover { background:var(--bg-hover); }
        .mono-sq.corner { background:var(--bg-card); }
        .mono-sq .sq-band {
          position:absolute;top:0;left:0;right:0;
          height:28%;
          border-radius:0;
        }
        /* Squares on left/right columns have band on appropriate side */
        .mono-sq.left-col .sq-band  { top:0;left:0;right:auto;bottom:0;height:auto;width:28%; }
        .mono-sq.right-col .sq-band { top:0;right:0;left:auto;bottom:0;height:auto;width:28%; }
        .mono-sq.top-row .sq-band   { top:auto;bottom:0;height:28%; }

        .mono-sq .sq-name {
          font-size:0.5rem;line-height:1.15;
          color:var(--text);word-break:break-word;
          max-width:100%;text-align:center;padding:0 1px;
          margin-top:auto;
        }
        .mono-sq .sq-price {
          font-size:0.48rem;color:var(--text-dim);margin-top:1px;
        }
        .mono-sq .sq-icon {
          font-size:1rem;margin-bottom:1px;
        }
        .mono-sq .sq-tokens {
          display:flex;flex-wrap:wrap;gap:1px;justify-content:center;
          position:absolute;bottom:2px;left:2px;right:2px;
        }
        .mono-token {
          width:10px;height:10px;border-radius:50%;
          border:1px solid rgba(255,255,255,0.5);
          flex-shrink:0;
        }
        .mono-sq .sq-house-row {
          display:flex;gap:1px;justify-content:center;
          position:absolute;top:30%;left:0;right:0;
        }
        .mono-house {
          width:7px;height:7px;background:#22c55e;border-radius:1px;
        }
        .mono-hotel {
          width:12px;height:8px;background:#dc2626;border-radius:1px;
        }
        .mono-sq.mortgaged { opacity:0.45;filter:grayscale(0.7); }
        .mono-sq.active-player { box-shadow:inset 0 0 0 2px var(--accent); }

        /* Center */
        .mono-board-center {
          grid-column:2/11;grid-row:2/11;
          display:flex;flex-direction:column;align-items:center;justify-content:center;
          background:#0a1a10;gap:6px;padding:8px;
        }
        .mono-center-logo {
          font-size:1.4rem;font-weight:900;color:var(--accent);letter-spacing:.08em;
          text-shadow:0 0 16px rgba(0,231,1,0.6);
        }
        .mono-center-dice {
          display:flex;gap:8px;align-items:center;justify-content:center;min-height:50px;
        }
        .mono-center-msg {
          font-size:0.72rem;color:var(--text-dim);text-align:center;max-width:120px;
        }

        /* Sidebar */
        .mono-sidebar {
          display:flex;flex-direction:column;gap:10px;
        }
        .mono-action-panel {
          background:var(--bg-card);border:1px solid var(--border);border-radius:12px;padding:12px;
        }
        .mono-action-panel h3 {
          font-size:0.8rem;text-transform:uppercase;letter-spacing:.07em;
          color:var(--text-dim);margin:0 0 10px;
        }
        .mono-action-btns { display:flex;flex-direction:column;gap:6px; }
        .mono-action-btns button { width:100%; }

        .mono-player-list { display:flex;flex-direction:column;gap:6px; }
        .mono-player-card {
          background:var(--bg-elev);border:1px solid var(--border);border-radius:10px;
          padding:8px 10px;transition:border-color 0.2s;
        }
        .mono-player-card.current-player { border-color:var(--accent);box-shadow:0 0 0 1px rgba(0,231,1,0.2); }
        .mono-player-card.bankrupt { opacity:0.45;filter:grayscale(0.7); }
        .mono-player-header { display:flex;align-items:center;gap:8px;margin-bottom:5px; }
        .mono-player-token { width:18px;height:18px;border-radius:50%;border:2px solid rgba(255,255,255,0.35);flex-shrink:0; }
        .mono-player-name { font-size:0.85rem;font-weight:700;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap; }
        .mono-player-money { font-size:0.88rem;font-weight:800;color:var(--gold); }
        .mono-prop-badges { display:flex;flex-wrap:wrap;gap:3px; }
        .mono-prop-badge {
          width:12px;height:12px;border-radius:3px;
          display:inline-block;border:1px solid rgba(255,255,255,0.2);
        }

        .mono-notification {
          background:rgba(229,70,61,0.12);border:1px solid rgba(229,70,61,0.35);
          border-radius:8px;padding:8px 12px;font-size:0.82rem;color:var(--loss);
          font-weight:700;text-align:center;display:none;
        }
        .mono-notification.show { display:block; }
        .mono-notification.info {
          background:rgba(0,231,1,0.08);border-color:rgba(0,231,1,0.3);color:var(--win);
        }

        .mono-build-modal {
          background:var(--bg-card);border:1px solid var(--border);border-radius:12px;
          padding:12px;display:none;
        }
        .mono-build-modal.show { display:block; }
        .mono-build-modal h3 { font-size:0.8rem;text-transform:uppercase;letter-spacing:.07em;color:var(--text-dim);margin:0 0 8px; }
        .mono-prop-action-list { display:flex;flex-direction:column;gap:5px; }
        .mono-prop-action-row {
          display:flex;align-items:center;justify-content:space-between;gap:6px;
          padding:5px 8px;background:var(--bg-elev);border-radius:7px;font-size:0.8rem;
        }
      `;
      document.head.appendChild(style);
    }

    const state = room.gameState || room.state || {};

    // ── HTML skeleton ─────────────────────────────────────────────
    container.innerHTML = `
    <div class="mono-wrap" id="mono-root">

      <!-- Board -->
      <div class="mono-board-outer">
        <div class="mono-board-grid" id="mono-grid"></div>
      </div>

      <!-- Sidebar -->
      <div class="mono-sidebar">

        <!-- Notification area -->
        <div class="mono-notification" id="mono-notif"></div>

        <!-- Action panel -->
        <div class="mono-action-panel">
          <h3>Actions</h3>
          <div style="display:flex;gap:8px;justify-content:center;align-items:center;min-height:50px;margin-bottom:10px" id="mono-dice-display">
            <span style="color:var(--text-dim);font-size:0.82rem">Roll to start your turn</span>
          </div>
          <div class="mono-action-btns">
            <button class="primary-btn" id="mono-roll-btn" disabled>Roll Dice</button>
            <button class="secondary-btn" id="mono-buy-btn" style="display:none">Buy Property</button>
            <button class="secondary-btn" id="mono-end-btn" style="display:none">End Turn</button>
          </div>
        </div>

        <!-- Build/Mortgage panel -->
        <div class="mono-build-modal" id="mono-build-panel">
          <h3>Manage Properties</h3>
          <div class="mono-prop-action-list" id="mono-prop-action-list"></div>
        </div>

        <!-- Player list -->
        <div class="mono-action-panel">
          <h3>Players</h3>
          <div class="mono-player-list" id="mono-player-list"></div>
        </div>

      </div>
    </div>`;

    const gridEl           = document.getElementById("mono-grid");
    const notifEl          = document.getElementById("mono-notif");
    const rollBtn          = document.getElementById("mono-roll-btn");
    const buyBtn           = document.getElementById("mono-buy-btn");
    const endBtn           = document.getElementById("mono-end-btn");
    const diceDisplay      = document.getElementById("mono-dice-display");
    const playerListEl     = document.getElementById("mono-player-list");
    const buildPanel       = document.getElementById("mono-build-panel");
    const propActionList   = document.getElementById("mono-prop-action-list");

    // ── Build the board grid ──────────────────────────────────────
    function buildBoardGrid(boardSquares) {
      const positions = squarePositions();
      // Create 11x11 = 121 cells; center cells will be merged-like via center div
      const cells = Array(121).fill(null).map((_, idx) => {
        const r = Math.floor(idx / 11);
        const c = idx % 11;
        return { r, c, sqIndex: null };
      });

      // Assign squares to cells
      for (let i = 0; i < 40; i++) {
        const p = positions[i];
        if (p) cells[p.gridRow * 11 + p.gridCol].sqIndex = i;
      }

      let html = "";

      for (let r = 0; r < 11; r++) {
        for (let c = 0; c < 11; c++) {
          const cell = cells[r * 11 + c];

          // Center area (rows 1-9, cols 1-9)
          if (r >= 1 && r <= 9 && c >= 1 && c <= 9) {
            if (r === 1 && c === 1) {
              html += `<div class="mono-board-center" style="grid-column:2/11;grid-row:2/11">
                <div class="mono-center-logo">MONOPOLY</div>
                <div class="mono-center-dice" id="mono-center-dice">
                  <span style="font-size:0.72rem;color:var(--text-dim)">Roll dice to play</span>
                </div>
                <div class="mono-center-msg" id="mono-center-msg"></div>
              </div>`;
            }
            continue;
          }

          const sqIdx = cell.sqIndex;
          if (sqIdx === null) { html += `<div></div>`; continue; }

          const sq = (boardSquares && boardSquares[sqIdx]) ? boardSquares[sqIdx] : SQUARE_DEFS[sqIdx];
          html += squareCellHTML(sq, sqIdx, r, c, boardSquares);
        }
      }

      gridEl.innerHTML = html;
    }

    function squareCellHTML(sq, sqIdx, r, c, boardSquares) {
      const isCorner = (r === 0 && c === 0) || (r === 0 && c === 10) || (r === 10 && c === 0) || (r === 10 && c === 10);
      const isLeftCol  = (c === 0  && r > 0 && r < 10);
      const isRightCol = (c === 10 && r > 0 && r < 10);
      const isTopRow   = (r === 0  && c > 0 && c < 10);
      // Bottom row: no suffix needed (default band at top, which is actually the bottom visually but we keep band consistent)

      let classes = "mono-sq";
      if (isCorner)   classes += " corner";
      if (isLeftCol)  classes += " left-col";
      if (isRightCol) classes += " right-col";
      if (isTopRow)   classes += " top-row";
      if (sq.mortgaged) classes += " mortgaged";

      // Color band
      let bandHTML = "";
      if (sq.group && GROUP_COLORS[sq.group]) {
        bandHTML = `<div class="sq-band" style="background:${GROUP_COLORS[sq.group]}"></div>`;
      } else if (sq.type === "railroad") {
        bandHTML = `<div class="sq-band" style="background:${GROUP_COLORS.railroad}"></div>`;
      } else if (sq.type === "utility") {
        bandHTML = `<div class="sq-band" style="background:${GROUP_COLORS.utility}"></div>`;
      }

      // Icon or name label
      let contentHTML = "";
      if (sq.type !== "property" && sq.type !== "railroad" && sq.type !== "utility") {
        contentHTML = `<div class="sq-icon">${TYPE_ICONS[sq.type] || "★"}</div>`;
      }

      const shortName = sq.name.length > 12 ? sq.name.slice(0, 11) + "…" : sq.name;
      contentHTML += `<div class="sq-name">${shortName}</div>`;
      if (sq.price) {
        contentHTML += `<div class="sq-price">$${sq.price}</div>`;
      }

      // Owner indicator
      let ownerBand = "";
      if (sq.owner !== undefined && sq.owner !== null && boardSquares) {
        // Show a colored owner indicator
        const ownerPlayer = ((room.gameState || room.state)?.players || []).find(p => p.userId === sq.owner);
        if (ownerPlayer) {
          const col = ownerPlayer.color || PLAYER_COLORS[0];
          ownerBand = `<div style="position:absolute;bottom:14px;left:0;right:0;height:3px;background:${col};opacity:0.85"></div>`;
        }
      }

      // Houses/hotels
      let housesHTML = "";
      if (sq.houses && sq.houses > 0) {
        const isHotel = sq.houses === 5;
        housesHTML = `<div class="sq-house-row">`;
        if (isHotel) {
          housesHTML += `<div class="mono-hotel"></div>`;
        } else {
          for (let h = 0; h < sq.houses; h++) {
            housesHTML += `<div class="mono-house"></div>`;
          }
        }
        housesHTML += `</div>`;
      }

      // Player tokens on this square — rendered last
      const tokensHTML = `<div class="sq-tokens" id="sq-tokens-${sqIdx}"></div>`;

      return `<div class="${classes}" data-sq="${sqIdx}" style="grid-row:${r+1};grid-column:${c+1}">
        ${bandHTML}
        ${housesHTML}
        ${ownerBand}
        ${contentHTML}
        ${tokensHTML}
      </div>`;
    }

    // ── Place player tokens on board ──────────────────────────────
    function renderTokens(players) {
      // Clear all token slots
      document.querySelectorAll(".sq-tokens").forEach(el => { el.innerHTML = ""; });
      for (const p of players) {
        if (p.bankrupt) continue;
        const pos = p.position ?? 0;
        const slot = document.getElementById(`sq-tokens-${pos}`);
        if (!slot) continue;
        const col = p.color || PLAYER_COLORS[0];
        const title = p.username || "Player";
        slot.insertAdjacentHTML("beforeend",
          `<div class="mono-token" title="${title}" style="background:${col}"></div>`
        );
      }
    }

    // ── Render player sidebar ─────────────────────────────────────
    function renderPlayers(players, currentTurnUserId) {
      playerListEl.innerHTML = players.map((p, i) => {
        const isMe = p.userId === myUserId;
        const isCurrent = p.userId === currentTurnUserId;
        const col = p.color || PLAYER_COLORS[i % PLAYER_COLORS.length];
        const props = p.properties || [];

        const propBadges = props.map(pIdx => {
          const sq = SQUARE_DEFS[pIdx] || {};
          const bg = (sq.group && GROUP_COLORS[sq.group]) ||
                     (sq.type === "railroad" ? GROUP_COLORS.railroad : GROUP_COLORS.utility) ||
                     "var(--text-dim)";
          return `<div class="mono-prop-badge" style="background:${bg}" title="${sq.name || ""}"></div>`;
        }).join("");

        return `<div class="mono-player-card${isCurrent ? " current-player" : ""}${p.bankrupt ? " bankrupt" : ""}">
          <div class="mono-player-header">
            <div class="mono-player-token" style="background:${col}"></div>
            <div class="mono-player-name">${p.username || "Player"}${isMe ? " (you)" : ""}${p.bankrupt ? " 💀" : ""}</div>
            <div class="mono-player-money">$${(p.money ?? 0).toLocaleString()}</div>
          </div>
          ${props.length > 0 ? `<div class="mono-prop-badges">${propBadges}</div>` : `<div style="font-size:0.72rem;color:var(--text-dim)">No properties</div>`}
        </div>`;
      }).join("");
    }

    // ── Render build/mortgage panel ───────────────────────────────
    function renderBuildPanel(players) {
      const me = players.find(p => p.userId === myUserId);
      if (!me || !me.properties || me.properties.length === 0) {
        buildPanel.classList.remove("show");
        return;
      }

      const board = (room.gameState || room.state)?.board || SQUARE_DEFS;
      const myProps = me.properties.map(i => board[i] || SQUARE_DEFS[i]);

      // Show only properties, not railroads/utilities for build
      const buildable = myProps.filter(sq => sq.type === "property");
      const mortgageable = myProps.filter(sq => !sq.mortgaged);

      if (buildable.length === 0 && mortgageable.length === 0) {
        buildPanel.classList.remove("show");
        return;
      }

      buildPanel.classList.add("show");

      propActionList.innerHTML = buildable.map(sq => {
        const grpColor = GROUP_COLORS[sq.group] || "#666";
        return `<div class="mono-prop-action-row">
          <div style="width:10px;height:10px;border-radius:2px;background:${grpColor};flex-shrink:0"></div>
          <div style="flex:1;font-size:0.78rem">${sq.name}</div>
          <div style="font-size:0.72rem;color:var(--text-dim)">🏠×${sq.houses || 0}</div>
          <button class="secondary-btn" style="font-size:0.72rem;padding:4px 8px"
            data-action="buildHouse" data-prop="${sq.index}">Build</button>
          <button class="secondary-btn" style="font-size:0.72rem;padding:4px 8px"
            data-action="mortgage" data-prop="${sq.index}" ${sq.mortgaged ? "disabled" : ""}>
            ${sq.mortgaged ? "Mortgaged" : "Mortgage"}
          </button>
        </div>`;
      }).join("");

      propActionList.querySelectorAll("[data-action]").forEach(btn => {
        btn.addEventListener("click", () => {
          const action = btn.dataset.action;
          const prop = parseInt(btn.dataset.prop, 10);
          socket.emit("bg:move", { roomId: room.id, move: { type: action, property: prop } });
        });
      });
    }

    // ── Notification helper ───────────────────────────────────────
    function showNotif(msg, type = "error") {
      notifEl.textContent = msg;
      notifEl.className = "mono-notification show" + (type === "info" ? " info" : "");
      clearTimeout(notifEl._to);
      notifEl._to = setTimeout(() => notifEl.classList.remove("show"), 5000);
    }

    // ── Button state update ───────────────────────────────────────
    function updateButtons(st) {
      const isMyTurn = st.turn === myUserId || st.currentPlayer === myUserId;
      const phase = st.phase || "waiting";

      rollBtn.disabled = !(isMyTurn && (phase === "waiting" || phase === "end"));
      buyBtn.style.display = (isMyTurn && phase === "buying") ? "" : "none";
      endBtn.style.display = (isMyTurn && (phase === "rolled" || phase === "buying")) ? "" : "none";
    }

    // ── Full render ───────────────────────────────────────────────
    function fullRender(st) {
      if (!st) return;

      const players = st.players || [];
      const board   = st.board   || SQUARE_DEFS;

      buildBoardGrid(board);
      renderTokens(players);
      renderPlayers(players, st.turn || st.currentPlayer);
      updateButtons(st);
      renderBuildPanel(players);

      // Dice display in center
      const centerDice = document.getElementById("mono-center-dice");
      const centerMsg  = document.getElementById("mono-center-msg");
      if (centerDice) {
        if (st.diceResult && st.diceResult.length === 2) {
          centerDice.innerHTML = diceDotHTML(st.diceResult[0]) + diceDotHTML(st.diceResult[1]);
          if (centerMsg) {
            centerMsg.textContent = `Rolled: ${st.diceResult[0] + st.diceResult[1]}${st.diceResult[0] === st.diceResult[1] ? " (Doubles!)" : ""}`;
          }
        } else {
          centerDice.innerHTML = `<span style="font-size:0.72rem;color:var(--text-dim)">Waiting for roll</span>`;
          if (centerMsg) centerMsg.textContent = "";
        }
      }

      // Also update sidebar dice display
      if (st.diceResult && st.diceResult.length === 2) {
        diceDisplay.innerHTML = `
          <div style="display:flex;gap:8px;align-items:center">
            ${diceDotHTML(st.diceResult[0])}
            ${diceDotHTML(st.diceResult[1])}
          </div>
          <div style="font-size:0.78rem;color:var(--text-dim);margin-top:4px;text-align:center">
            Total: <strong style="color:var(--text)">${st.diceResult[0] + st.diceResult[1]}</strong>
            ${st.diceResult[0] === st.diceResult[1] ? `<span style="color:var(--gold)"> Doubles!</span>` : ""}
          </div>`;
      } else {
        diceDisplay.innerHTML = `<span style="color:var(--text-dim);font-size:0.82rem">Roll to start your turn</span>`;
      }

      // Show rent notification
      if (st.phase === "rent") {
        const me = players.find(p => p.userId === myUserId);
        if (me) showNotif("You landed on owned property! Pay rent.", "error");
      } else if (st.phase === "buying") {
        const currentPl = players.find(p => p.userId === (st.turn || st.currentPlayer));
        if (currentPl && currentPl.userId === myUserId) {
          showNotif("You can buy this property!", "info");
        }
      }
    }

    // ── Socket listeners ──────────────────────────────────────────
    socket.on("bg:room-update", (updatedRoom) => {
      const newState = updatedRoom.gameState;
      if (!newState) return;
      refreshMonopolyUI(newState, updatedRoom.players);
    });

    socket.on("bg:error", ({ message }) => {
      UI.toast(message || "An error occurred", "loss");
    });

    // ── Adapt backend state to UI state and re-render ────────────
    // Backend state shape:
    //   players: { [userId]: { money, position, inJail, jailTurns, properties: number[], bankrupt } }
    //   playerOrder: string[]   (userId array)
    //   currentTurn: string     (userId)
    //   phase: "roll" | "buy" | "end"
    //   dice: [number, number] | null
    //   properties: { [squareIdx]: { owner: string|null, houses: number } }
    //   round: number
    //   status: "playing" | "finished"
    //   winner: string | null
    function refreshMonopolyUI(backendState, roomPlayers) {
      // Build a lookup from userId → username/color using roomPlayers array
      const playerInfoMap = {};
      if (Array.isArray(roomPlayers)) {
        roomPlayers.forEach((rp, i) => {
          playerInfoMap[rp.id || rp.userId] = {
            username: rp.username || rp.name || `Player ${i+1}`,
            color:    PLAYER_COLORS[i % PLAYER_COLORS.length],
          };
        });
      }

      // Convert backend players object → array sorted by playerOrder
      const backPlayers = backendState.players || {};
      const playerOrder = backendState.playerOrder || Object.keys(backPlayers);
      const uiPlayers = playerOrder.map((uid, i) => {
        const bp = backPlayers[uid] || {};
        const info = playerInfoMap[uid] || {};
        return {
          userId:     uid,
          username:   info.username || `Player ${i+1}`,
          color:      info.color || PLAYER_COLORS[i % PLAYER_COLORS.length],
          money:      bp.money ?? 1500,
          position:   bp.position ?? 0,
          inJail:     bp.inJail || false,
          jailTurns:  bp.jailTurns || 0,
          properties: bp.properties || [],
          bankrupt:   bp.bankrupt || false,
        };
      });

      // Build a board array: enrich SQUARE_DEFS with ownership/house data
      const backProps = backendState.properties || {};
      const uiBoard = SQUARE_DEFS.map((sq, idx) => {
        const propData = backProps[idx] || backProps[String(idx)];
        if (!propData) return { ...sq };
        return {
          ...sq,
          owner:     propData.owner || null,
          houses:    propData.houses || 0,
          mortgaged: propData.mortgaged || false,
        };
      });

      // Map backend phase: "roll"→"waiting", "buy"→"buying", "end"→"rolled"
      const phaseMap = { roll: "waiting", buy: "buying", end: "rolled" };
      const uiPhase = phaseMap[backendState.phase] || backendState.phase || "waiting";

      const uiState = {
        players:       uiPlayers,
        board:         uiBoard,
        turn:          backendState.currentTurn || "",
        currentPlayer: backendState.currentTurn || "",
        phase:         uiPhase,
        diceResult:    backendState.dice || null,
        round:         backendState.round || 1,
        status:        backendState.status,
        winner:        backendState.winner,
      };

      fullRender(uiState);
    }

    // ── Button wiring ─────────────────────────────────────────────
    rollBtn.addEventListener("click", () => {
      rollBtn.disabled = true;
      socket.emit("bg:move", { roomId: room.id, move: { type: "roll" } });
    });

    buyBtn.addEventListener("click", () => {
      buyBtn.style.display = "none";
      socket.emit("bg:move", { roomId: room.id, move: { type: "buy" } });
    });

    endBtn.addEventListener("click", () => {
      endBtn.style.display = "none";
      socket.emit("bg:move", { roomId: room.id, move: { type: "end_turn" } });
    });

    // ── Initial render ────────────────────────────────────────────
    if (room.gameState) {
      refreshMonopolyUI(room.gameState, room.players);
    } else {
      fullRender(state);
    }
  }

  return { renderBoard };
})();
