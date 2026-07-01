const BridgeGame = (() => {
  const SUITS = ["♣", "♦", "♥", "♠"];
  const RANKS = ["2","3","4","5","6","7","8","9","10","J","Q","K","A"];
  const SEAT_LABELS = { N: "North", S: "South", E: "East", W: "West" };
  const SEAT_ORDER  = ["N", "E", "S", "W"];   // clockwise for display layout

  function suitColor(suit) {
    return (suit === "♥" || suit === "♦") ? "#ef4444" : "#1a1a2e";
  }
  function suitColorVar(suit) {
    return (suit === "♥" || suit === "♦") ? "#ef4444" : "var(--text)";
  }

  // ── Card element ──────────────────────────────────────────────
  function cardEl(card, opts = {}) {
    const { faceDown = false, small = false, clickable = false, selected = false, dim = false } = opts;
    const w = small ? "38px" : "54px";
    const h = small ? "54px" : "78px";
    const fs = small ? "0.75rem" : "1rem";
    const rk = small ? "6px" : "8px";

    if (faceDown) {
      return `<div style="
        width:${w};height:${h};border-radius:${rk};
        background:linear-gradient(135deg,#1e3a5f 25%,#2563eb 100%);
        border:2px solid #3b82f6;
        box-shadow:0 2px 4px rgba(0,0,0,0.4);
        flex-shrink:0;
      "></div>`;
    }

    const s = card.suit, r = card.rank;
    const col = suitColor(s);
    const outline = selected ? "3px solid var(--accent)" : "2px solid #ccc";
    const tf = selected ? "translateY(-10px)" : dim ? "none" : "none";
    const filter = dim ? "opacity(0.5)" : "none";
    const cursor = clickable ? "pointer" : "default";

    return `<div
      data-suit="${s}" data-rank="${r}"
      style="
        width:${w};height:${h};border-radius:${rk};
        background:white;border:${outline};
        box-shadow:0 2px 6px rgba(0,0,0,0.35);
        display:flex;flex-direction:column;align-items:flex-start;justify-content:flex-start;
        padding:3px 4px;gap:1px;cursor:${cursor};user-select:none;
        transition:transform 0.15s,border 0.15s,filter 0.15s;
        transform:${tf};filter:${filter};flex-shrink:0;
        position:relative;
      ">
      <div style="font-size:${fs};font-weight:800;color:${col};line-height:1">${r}</div>
      <div style="font-size:${fs};color:${col};line-height:1">${s}</div>
    </div>`;
  }

  // ── Render a hand strip ────────────────────────────────────────
  function handStripHTML(cards, opts = {}) {
    const { faceDown = false, small = false, selectedSet = null, playable = false, dim = false } = opts;
    if (!cards || cards.length === 0) return `<span style="color:var(--text-dim);font-size:0.8rem">—</span>`;

    // Group by suit for display
    const bySuit = {};
    for (const c of cards) {
      if (!bySuit[c.suit]) bySuit[c.suit] = [];
      bySuit[c.suit].push(c);
    }

    if (faceDown) {
      return cards.map(() => cardEl({}, { faceDown: true, small })).join("");
    }

    // Sort each suit by rank desc
    const rankIdx = Object.fromEntries(RANKS.map((r, i) => [r, i]));
    let html = "";
    for (const suit of ["♠","♥","♦","♣"]) {
      if (!bySuit[suit]) continue;
      const sorted = [...bySuit[suit]].sort((a, b) => rankIdx[b.rank] - rankIdx[a.rank]);
      for (const c of sorted) {
        const key = c.suit + c.rank;
        const sel = selectedSet ? selectedSet.has(key) : false;
        html += `<div data-suit="${c.suit}" data-rank="${c.rank}" class="${playable ? "bridge-card-play" : ""}" style="display:inline-block">`
               + cardEl(c, { small, selected: sel, clickable: playable, dim })
               + `</div>`;
      }
    }
    return html;
  }

  // ── Main renderBoard ──────────────────────────────────────────
  function renderBoard(container, socket, room, myUserId) {
    // Inject styles once
    if (!document.getElementById("bridge-styles")) {
      const style = document.createElement("style");
      style.id = "bridge-styles";
      style.textContent = `
        .bridge-wrap {
          display:flex;flex-direction:column;gap:12px;
          max-width:860px;margin:0 auto;padding:12px;
        }
        .bridge-header {
          display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;
        }
        .bridge-phase-badge {
          display:inline-flex;align-items:center;gap:6px;
          background:var(--bg-elev);border:1px solid var(--border);
          border-radius:20px;padding:4px 14px;font-size:0.82rem;font-weight:700;
        }
        .bridge-contract-badge {
          background:rgba(245,158,11,0.15);border:1px solid rgba(245,158,11,0.4);
          border-radius:8px;padding:6px 14px;font-size:0.88rem;font-weight:700;color:var(--gold);
        }
        .bridge-table {
          display:grid;grid-template-columns:1fr 240px 1fr;
          grid-template-rows:auto auto auto;
          gap:8px;align-items:center;
        }
        .bridge-seat {
          background:var(--bg-card);border:1px solid var(--border);border-radius:10px;
          padding:8px 10px;
        }
        .bridge-seat-label {
          font-size:0.72rem;font-weight:700;text-transform:uppercase;
          letter-spacing:.06em;color:var(--text-dim);margin-bottom:6px;
        }
        .bridge-seat.my-seat { border-color:var(--accent); }
        .bridge-seat.active-turn { border-color:var(--gold);box-shadow:0 0 0 2px rgba(245,158,11,0.25); }
        .bridge-center {
          background:var(--bg-elev);border:1px solid var(--border);border-radius:12px;
          padding:10px;text-align:center;grid-column:2;grid-row:2;
        }
        .bridge-trick-area {
          display:grid;grid-template-columns:1fr 60px 1fr;
          grid-template-rows:60px auto 60px;
          gap:4px;align-items:center;justify-items:center;min-height:140px;
        }
        .bridge-trick-card { display:flex;align-items:center;justify-content:center; }
        .bridge-score-row {
          display:flex;gap:10px;background:var(--bg-card);
          border:1px solid var(--border);border-radius:10px;padding:10px 14px;
          align-items:center;justify-content:space-around;flex-wrap:wrap;
        }
        .bridge-score-item { text-align:center; }
        .bridge-score-num { font-size:1.5rem;font-weight:800; }
        .bridge-score-lbl { font-size:0.72rem;color:var(--text-dim);text-transform:uppercase;letter-spacing:.05em; }

        /* Bidding UI */
        .bridge-bid-panel {
          background:var(--bg-card);border:1px solid var(--border);border-radius:12px;padding:12px;
        }
        .bridge-bid-levels { display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap; }
        .bridge-bid-suits  { display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap; }
        .bridge-bid-lvl, .bridge-bid-suit {
          width:42px;height:42px;border-radius:8px;font-size:1rem;font-weight:700;
          background:var(--bg-elev);border:2px solid var(--border);color:var(--text);
          cursor:pointer;transition:border-color 0.15s,background 0.15s;display:flex;
          align-items:center;justify-content:center;
        }
        .bridge-bid-lvl:hover,  .bridge-bid-suit:hover  { border-color:var(--accent); }
        .bridge-bid-lvl.sel,    .bridge-bid-suit.sel    {
          border-color:var(--accent);background:rgba(0,231,1,0.12);color:var(--accent);
        }
        .bridge-bid-suit[data-suit="♥"], .bridge-bid-suit[data-suit="♦"] { color:#ef4444; }
        .bridge-bid-suit[data-suit="♣"], .bridge-bid-suit[data-suit="♠"] { color:var(--text); }
        .bridge-bid-actions { display:flex;gap:8px;flex-wrap:wrap; }
        .bridge-bid-actions button { flex:1;min-width:80px; }
        .bridge-bid-history {
          background:var(--bg-elev);border:1px solid var(--border);border-radius:8px;
          overflow:hidden;margin-top:12px;
        }
        .bridge-bid-history table { width:100%;border-collapse:collapse;font-size:0.82rem; }
        .bridge-bid-history th {
          background:var(--bg-card);padding:6px 10px;text-align:center;
          font-size:0.72rem;color:var(--text-dim);text-transform:uppercase;letter-spacing:.05em;
          border-bottom:1px solid var(--border);
        }
        .bridge-bid-history td { padding:5px 10px;text-align:center;border-bottom:1px solid rgba(45,74,90,0.4); }
        .bridge-bid-history tr:last-child td { border-bottom:none; }
        .bridge-bid-suit-cell-H,.bridge-bid-suit-cell-D { color:#ef4444;font-weight:700; }
        .bridge-bid-suit-cell-S,.bridge-bid-suit-cell-C,.bridge-bid-suit-cell-N { font-weight:700; }
        .bridge-bid-suit-cell-P { color:var(--text-dim); }
        .bridge-bid-suit-cell-X { color:var(--loss);font-weight:700; }
        .bridge-bid-suit-cell-XX { color:var(--gold);font-weight:700; }

        /* Playing hand layout */
        .bridge-hand-strip {
          display:flex;flex-wrap:wrap;gap:4px;align-items:center;
        }
        .bridge-card-play { cursor:pointer; }
        .bridge-card-play:hover > div { border-color:var(--accent) !important; transform:translateY(-8px) !important; }

        .bridge-dummy-label {
          font-size:0.72rem;color:var(--gold);text-transform:uppercase;
          letter-spacing:.06em;margin-bottom:4px;
        }

        @media(max-width:600px) {
          .bridge-table { grid-template-columns:1fr; }
          .bridge-center { grid-column:1; }
        }
      `;
      document.head.appendChild(style);
    }

    // State refs
    const state = room.gameState || room.state || {};
    const mySeat = state.mySeat || "";
    const phase  = state.phase  || "bidding";

    // Build skeleton
    container.innerHTML = `<div class="bridge-wrap" id="bridge-root">
      <div class="bridge-header">
        <div>
          <h2 style="margin:0;font-size:1.2rem">&#9824; Contract Bridge</h2>
          <div style="font-size:0.78rem;color:var(--text-dim);margin-top:2px">Room: ${room.id} &nbsp;·&nbsp; You are <strong style="color:var(--accent)">${SEAT_LABELS[mySeat] || "?"}</strong></div>
        </div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <div class="bridge-phase-badge" id="br-phase-badge">
            <span id="br-phase-dot" style="width:8px;height:8px;border-radius:50%;background:var(--accent);display:inline-block"></span>
            <span id="br-phase-text">${phase === "bidding" ? "Bidding" : "Playing"}</span>
          </div>
          <div class="bridge-contract-badge" id="br-contract-badge" style="${state.currentContract ? "" : "display:none"}">
            Contract: <span id="br-contract-val">${formatContract(state.currentContract)}</span>
          </div>
        </div>
      </div>

      <!-- Score row -->
      <div class="bridge-score-row" id="br-score-row">
        <div class="bridge-score-item">
          <div class="bridge-score-num" id="br-ns-tricks" style="color:var(--accent)">0</div>
          <div class="bridge-score-lbl">NS Tricks</div>
        </div>
        <div style="color:var(--text-dim);font-size:1.2rem">vs</div>
        <div class="bridge-score-item">
          <div class="bridge-score-num" id="br-ew-tricks" style="color:#f59e0b">0</div>
          <div class="bridge-score-lbl">EW Tricks</div>
        </div>
        <div id="br-score-display" style="font-size:0.82rem;color:var(--text-dim)"></div>
      </div>

      <!-- 4-seat table layout -->
      <div class="bridge-table" id="br-table">
        <!-- North (top center) -->
        <div></div>
        <div class="bridge-seat" id="br-seat-N">
          <div class="bridge-seat-label">&#9650; North</div>
          <div class="bridge-hand-strip" id="br-hand-N"></div>
        </div>
        <div></div>

        <!-- West | Center | East -->
        <div class="bridge-seat" id="br-seat-W">
          <div class="bridge-seat-label">&#9668; West</div>
          <div class="bridge-hand-strip" id="br-hand-W"></div>
        </div>
        <div class="bridge-center" id="br-center">
          <div id="br-center-content"></div>
        </div>
        <div class="bridge-seat" id="br-seat-E">
          <div class="bridge-seat-label">East &#9658;</div>
          <div class="bridge-hand-strip" id="br-hand-E"></div>
        </div>

        <!-- South (bottom center) -->
        <div></div>
        <div class="bridge-seat" id="br-seat-S">
          <div class="bridge-seat-label">&#9660; South (You)</div>
          <div class="bridge-hand-strip" id="br-hand-S"></div>
        </div>
        <div></div>
      </div>

      <!-- Bidding panel -->
      <div class="bridge-bid-panel" id="br-bid-panel" style="${phase === "bidding" ? "" : "display:none"}">
        <div style="font-size:0.82rem;font-weight:700;color:var(--text-dim);margin-bottom:8px;text-transform:uppercase;letter-spacing:.05em">Your Bid</div>
        <div class="bridge-bid-levels" id="br-bid-levels">
          ${[1,2,3,4,5,6,7].map(l => `<button class="bridge-bid-lvl" data-lvl="${l}">${l}</button>`).join("")}
        </div>
        <div class="bridge-bid-suits" id="br-bid-suits">
          ${["♣","♦","♥","♠","NT"].map(s => `<button class="bridge-bid-suit" data-suit="${s}" style="${(s==="♥"||s==="♦")?"color:#ef4444":""}; width:${s==="NT"?"52px":"42px"}">${s}</button>`).join("")}
        </div>
        <div class="bridge-bid-actions">
          <button class="primary-btn" id="br-bid-confirm" disabled>Bid</button>
          <button class="secondary-btn" id="br-pass-btn">Pass</button>
          <button class="secondary-btn" id="br-dbl-btn">Double</button>
          <button class="secondary-btn" id="br-rdbl-btn">Redouble</button>
        </div>
        <div class="bridge-bid-history" id="br-bid-history-wrap">
          <table>
            <thead><tr>
              <th>North</th><th>East</th><th>South</th><th>West</th>
            </tr></thead>
            <tbody id="br-bid-history-body"></tbody>
          </table>
        </div>
      </div>

      <!-- Message / notification -->
      <div id="br-message" style="text-align:center;font-size:0.88rem;color:var(--text-dim);min-height:24px;padding:4px 0"></div>
    </div>`;

    // ── Element refs ──────────────────────────────────────────────
    const phaseText    = document.getElementById("br-phase-text");
    const phaseDot     = document.getElementById("br-phase-dot");
    const contractBadge= document.getElementById("br-contract-badge");
    const contractVal  = document.getElementById("br-contract-val");
    const nsTricksEl   = document.getElementById("br-ns-tricks");
    const ewTricksEl   = document.getElementById("br-ew-tricks");
    const scoreDisplay = document.getElementById("br-score-display");
    const centerContent= document.getElementById("br-center-content");
    const bidPanel     = document.getElementById("br-bid-panel");
    const bidHistBody  = document.getElementById("br-bid-history-body");
    const bidConfirm   = document.getElementById("br-bid-confirm");
    const passBtn      = document.getElementById("br-pass-btn");
    const dblBtn       = document.getElementById("br-dbl-btn");
    const rdblBtn      = document.getElementById("br-rdbl-btn");
    const msgEl        = document.getElementById("br-message");

    // Bid selector state
    let selLevel = null;
    let selSuit  = null;

    // ── Seat highlight helpers ────────────────────────────────────
    function highlightTurn(turn) {
      SEAT_ORDER.forEach(s => {
        const el = document.getElementById(`br-seat-${s}`);
        if (!el) return;
        el.classList.remove("active-turn", "my-seat");
        if (s === mySeat) el.classList.add("my-seat");
        if (s === turn)   el.classList.add("active-turn");
      });
    }

    // ── Render hands ──────────────────────────────────────────────
    function renderHands(st) {
      const turn       = st.turn;
      const myHand     = st.hand || [];
      const dummyHand  = st.dummyHand || null;
      const dummySeat  = dummySeatOf(st.currentContract, st.players);

      for (const seat of SEAT_ORDER) {
        const el = document.getElementById(`br-hand-${seat}`);
        if (!el) continue;

        const labelEl = document.querySelector(`#br-seat-${seat} .bridge-seat-label`);

        if (seat === mySeat) {
          // My hand — always face-up
          el.innerHTML = handStripHTML(myHand, {
            playable: (st.phase === "playing" && turn === mySeat),
            small: false,
          });
          if (labelEl) labelEl.textContent = `${SEAT_LABELS[seat]} (You)`;
        } else if (seat === dummySeat && dummyHand && st.phase === "playing") {
          // Dummy — revealed face-up after opening lead
          el.innerHTML = handStripHTML(dummyHand, {
            playable: false, // declarer plays dummy cards; handled below
            small: true,
          });
          if (labelEl) {
            labelEl.innerHTML = `${SEAT_LABELS[seat]} <span class="bridge-dummy-label">Dummy</span>`;
          }
        } else {
          // Other hidden hands — show count of face-down cards
          const count = st[`hand_${seat}`] || 13;
          const fakeCards = Array(count).fill({});
          el.innerHTML = fakeCards.map(() => cardEl({}, { faceDown: true, small: true })).join("");
        }
      }
    }

    // ── Render bidding history table ──────────────────────────────
    function renderBidHistory(history) {
      if (!history || !history.length) { bidHistBody.innerHTML = ""; return; }

      // Build rows: 4 seats per row (N, E, S, W)
      const cells = [];
      for (const entry of history) {
        cells.push({ seat: entry.seat, bid: entry.bid });
      }

      // Find index of first N entry to offset
      const seatIdx = { N:0, E:1, S:2, W:3 };
      const startSeat = cells.length ? cells[0].seat : "N";
      const offset = seatIdx[startSeat] || 0;

      let rows = [];
      let curRow = new Array(4).fill(null);
      let col = offset;
      for (const c of cells) {
        curRow[col % 4] = c;
        col++;
        if (col % 4 === 0) { rows.push(curRow); curRow = new Array(4).fill(null); }
      }
      if (curRow.some(x => x !== null)) rows.push(curRow);

      bidHistBody.innerHTML = rows.map(row =>
        `<tr>${row.map(c => {
          if (!c) return "<td></td>";
          const cls = bidCellClass(c.bid);
          return `<td class="${cls}">${formatBidCell(c.bid)}</td>`;
        }).join("")}</tr>`
      ).join("");
    }

    function bidCellClass(bid) {
      if (!bid) return "";
      if (bid.suit === "pass" || bid.type === "pass") return "bridge-bid-suit-cell-P";
      if (bid.type === "double")    return "bridge-bid-suit-cell-X";
      if (bid.type === "redouble")  return "bridge-bid-suit-cell-XX";
      const s = bid.suit || "";
      if (s === "♥" || s === "♦") return "bridge-bid-suit-cell-H";
      return "bridge-bid-suit-cell-S";
    }

    function formatBidCell(bid) {
      if (!bid) return "—";
      if (bid.type === "pass")      return "Pass";
      if (bid.type === "double")    return "Dbl";
      if (bid.type === "redouble")  return "Rdbl";
      return `${bid.level}${bid.suit}`;
    }

    // ── Center trick area ─────────────────────────────────────────
    function renderTrickArea(st) {
      const trick = st.currentTrick || [];
      // Positions: N=top-center, E=mid-right, S=bottom-center, W=mid-left
      const pos = { N:[0,1], E:[1,2], S:[2,1], W:[1,0] };
      // 3x3 grid, trick cards placed in cells
      const cells = Array(9).fill(null);
      for (const entry of trick) {
        const [r, c] = pos[entry.seat] || [1,1];
        cells[r * 3 + c] = entry;
      }

      const gridHTML = cells.map((entry, i) => {
        if (!entry) return `<div style="width:54px;height:78px"></div>`;
        const isMe = entry.seat === mySeat;
        return `<div style="position:relative">
          ${cardEl(entry.card, { small: false })}
          <div style="position:absolute;bottom:-16px;left:50%;transform:translateX(-50%);
            font-size:0.65rem;color:${isMe ? "var(--accent)" : "var(--text-dim)"};white-space:nowrap">
            ${SEAT_LABELS[entry.seat]}${isMe ? " ★" : ""}
          </div>
        </div>`;
      });

      centerContent.innerHTML = `
        <div style="font-size:0.72rem;color:var(--text-dim);margin-bottom:8px;text-transform:uppercase;letter-spacing:.05em">
          Current Trick (${trick.length}/4)
        </div>
        <div style="display:grid;grid-template-columns:repeat(3,64px);grid-template-rows:repeat(3,90px);gap:2px;align-items:center;justify-items:center;margin:0 auto;width:fit-content">
          ${gridHTML.join("")}
        </div>
      `;
    }

    // ── Render center content ─────────────────────────────────────
    function renderCenter(st) {
      if (st.phase === "playing") {
        renderTrickArea(st);
      } else {
        // Bidding phase center
        const contract = st.currentContract;
        centerContent.innerHTML = `
          <div style="font-size:0.72rem;color:var(--text-dim);margin-bottom:6px;text-transform:uppercase;letter-spacing:.05em">Current Contract</div>
          <div style="font-size:1.6rem;font-weight:800;color:var(--gold);min-height:40px">${contract ? formatContract(contract) : "—"}</div>
          <div style="font-size:0.78rem;color:var(--text-dim);margin-top:4px">${contract ? `Declarer: ${SEAT_LABELS[contract.declarer] || "?"}` : "No bid yet"}</div>
        `;
      }
    }

    // ── Update controls based on whose turn ──────────────────────
    function updateBidControls(st) {
      const isMyTurn = st.turn === mySeat;
      bidConfirm.disabled = !(isMyTurn && selLevel && selSuit);
      passBtn.disabled  = !isMyTurn;
      dblBtn.disabled   = !isMyTurn;
      rdblBtn.disabled  = !isMyTurn;

      if (isMyTurn) {
        msgEl.textContent = "Your turn to bid.";
        msgEl.style.color = "var(--accent)";
      } else {
        msgEl.textContent = `Waiting for ${SEAT_LABELS[st.turn] || "?"} to bid…`;
        msgEl.style.color = "var(--text-dim)";
      }
    }

    function updatePlayControls(st) {
      const isMyTurn = st.turn === mySeat;
      if (isMyTurn) {
        msgEl.textContent = "Your turn — click a card to play.";
        msgEl.style.color = "var(--accent)";
      } else {
        msgEl.textContent = `Waiting for ${SEAT_LABELS[st.turn] || "?"} to play…`;
        msgEl.style.color = "var(--text-dim)";
      }
    }

    // ── Full re-render from state ─────────────────────────────────
    function fullRender(st) {
      if (!st) return;

      // Phase badge
      if (st.phase === "playing") {
        phaseText.textContent = "Playing";
        phaseDot.style.background = "#f59e0b";
        bidPanel.style.display = "none";
      } else {
        phaseText.textContent = "Bidding";
        phaseDot.style.background = "var(--accent)";
        bidPanel.style.display = "";
      }

      // Contract badge
      if (st.currentContract) {
        contractBadge.style.display = "";
        contractVal.textContent = formatContract(st.currentContract);
      } else {
        contractBadge.style.display = "none";
      }

      // Tricks
      const tc = st.tricksCounts || { ns: 0, ew: 0 };
      nsTricksEl.textContent = tc.ns;
      ewTricksEl.textContent = tc.ew;

      // Score
      if (st.score) {
        scoreDisplay.textContent = `Score — NS: ${st.score.ns ?? 0}  EW: ${st.score.ew ?? 0}`;
      }

      // Seats highlight
      highlightTurn(st.turn);

      // Hands
      renderHands(st);

      // Center
      renderCenter(st);

      // Bid history
      if (st.phase === "bidding") {
        renderBidHistory(st.biddingHistory || []);
        updateBidControls(st);
      } else {
        updatePlayControls(st);
        attachCardClickHandlers(st);
      }
    }

    // ── Card click handlers for playing phase ─────────────────────
    function attachCardClickHandlers(st) {
      const isMyTurn = st.turn === mySeat;
      const myHandEl = document.getElementById(`br-hand-${mySeat}`);
      if (!myHandEl) return;

      // Re-render my hand with playable flag
      myHandEl.innerHTML = handStripHTML(st.hand || [], { playable: isMyTurn });

      myHandEl.querySelectorAll(".bridge-card-play").forEach(wrapper => {
        wrapper.addEventListener("click", () => {
          if (!isMyTurn) return;
          const inner = wrapper.querySelector("[data-suit]");
          if (!inner) return;
          const card = { suit: inner.dataset.suit, rank: inner.dataset.rank };
          socket.emit("bg:move", {
            roomId: room.id,
            move: { type: "play", card }
          });
        });
      });

      // Also handle dummy cards when you're the declarer
      const dummySeat = dummySeatOf(st.currentContract, st.players);
      if (dummySeat && declarerSeatOf(st.currentContract) === mySeat && st.dummyHand) {
        const dummyEl = document.getElementById(`br-hand-${dummySeat}`);
        if (dummyEl) {
          dummyEl.innerHTML = handStripHTML(st.dummyHand, { playable: isMyTurn, small: true });
          dummyEl.querySelectorAll(".bridge-card-play").forEach(wrapper => {
            wrapper.addEventListener("click", () => {
              if (!isMyTurn) return;
              const inner = wrapper.querySelector("[data-suit]");
              if (!inner) return;
              const card = { suit: inner.dataset.suit, rank: inner.dataset.rank };
              socket.emit("bg:move", {
                roomId: room.id,
                move: { type: "play", card }
              });
            });
          });
        }
      }
    }

    // ── Bid selector wiring ───────────────────────────────────────
    document.querySelectorAll(".bridge-bid-lvl").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".bridge-bid-lvl").forEach(b => b.classList.remove("sel"));
        btn.classList.add("sel");
        selLevel = parseInt(btn.dataset.lvl, 10);
        bidConfirm.disabled = !(selLevel && selSuit);
      });
    });

    document.querySelectorAll(".bridge-bid-suit").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".bridge-bid-suit").forEach(b => b.classList.remove("sel"));
        btn.classList.add("sel");
        selSuit = btn.dataset.suit;
        bidConfirm.disabled = !(selLevel && selSuit);
      });
    });

    bidConfirm.addEventListener("click", () => {
      if (!selLevel || !selSuit) return;
      socket.emit("bg:move", {
        roomId: room.id,
        move: { type: "bid", level: selLevel, suit: selSuit }
      });
      selLevel = null; selSuit = null;
      document.querySelectorAll(".bridge-bid-lvl,.bridge-bid-suit").forEach(b => b.classList.remove("sel"));
      bidConfirm.disabled = true;
    });

    passBtn.addEventListener("click", () => {
      socket.emit("bg:move", { roomId: room.id, move: { type: "bid", suit: "pass" } });
    });

    dblBtn.addEventListener("click", () => {
      socket.emit("bg:move", { roomId: room.id, move: { type: "bid", suit: "double" } });
    });

    rdblBtn.addEventListener("click", () => {
      socket.emit("bg:move", { roomId: room.id, move: { type: "bid", suit: "redouble" } });
    });

    // ── Socket listeners ──────────────────────────────────────────
    socket.on("bg:room-update", (updatedRoom) => {
      const newState = updatedRoom.gameState;
      if (!newState) return;
      refreshBridgeUI(newState, updatedRoom.players);
    });

    socket.on("bg:error", ({ message }) => {
      UI.toast(message || "An error occurred", "loss");
    });

    // ── Adapt backend state to UI state and re-render ────────────
    // Backend state shape:
    //   hands: { [userId]: string[] }   e.g. ["AS","KH","2D"]
    //   seats: { N: userId, S: userId, E: userId, W: userId }
    //   phase: "bidding" | "playing"
    //   bids: { seat, level?, suit? }[]
    //   contract: { level, suit, declarer, doubled } | null
    //   currentTurn: userId | seat
    //   tricks: { cards: { seat, card }[], winner }[]
    //   currentTrick: { seat, card }[]
    //   score: { NS: number, EW: number }
    //   status: "playing" | "finished"
    //   winner: "NS" | "EW" | null
    function refreshBridgeUI(backendState, roomPlayers) {
      // Resolve myUserId → mySeat from backend seats map
      const seatsMap = backendState.seats || {};
      let resolvedMySeat = mySeat;
      for (const [seatKey, uid] of Object.entries(seatsMap)) {
        if (uid === myUserId) { resolvedMySeat = seatKey; break; }
      }

      // Parse a card string like "AS" → { suit: "♠", rank: "A" }
      const SUIT_MAP = { S: "♠", H: "♥", D: "♦", C: "♣" };
      function parseCard(str) {
        if (!str || str.length < 2) return { suit: "?", rank: "?" };
        const suitChar = str[str.length - 1];
        const rankStr  = str.slice(0, str.length - 1);
        return {
          suit: SUIT_MAP[suitChar] || suitChar,
          rank: rankStr === "T" ? "10" : rankStr,
        };
      }

      // Build per-seat hand arrays
      const handsMap = backendState.hands || {};
      const handsBySeat = {};
      for (const [seatKey, uid] of Object.entries(seatsMap)) {
        const raw = handsMap[uid];
        if (Array.isArray(raw)) {
          handsBySeat[seatKey] = raw.map(parseCard);
        } else {
          handsBySeat[seatKey] = null;
        }
      }

      // Resolve currentTurn: backend may send userId or seat letter
      let turnSeat = backendState.currentTurn || "";
      if (turnSeat && !["N","S","E","W"].includes(turnSeat)) {
        // It's a userId — look up its seat
        for (const [seatKey, uid] of Object.entries(seatsMap)) {
          if (uid === turnSeat) { turnSeat = seatKey; break; }
        }
      }

      // Build contract in UI format
      const backContract = backendState.contract;
      let uiContract = null;
      if (backContract) {
        const contractSuitSymbols = { S: "♠", H: "♥", D: "♦", C: "♣", NT: "NT" };
        uiContract = {
          level:     backContract.level,
          suit:      contractSuitSymbols[backContract.suit] || backContract.suit,
          declarer:  backContract.declarer,
          doubled:   backContract.doubled || 0,
          redoubled: backContract.doubled === 2,
        };
      }

      // Build UI trick counts from tricks array
      let nsTricks = 0, ewTricks = 0;
      const tricks = backendState.tricks || [];
      for (const t of tricks) {
        const w = t.winner;
        if (w === "N" || w === "S") nsTricks++;
        else if (w === "E" || w === "W") ewTricks++;
      }

      // Parse currentTrick
      const uiCurrentTrick = (backendState.currentTrick || []).map(entry => ({
        seat: entry.seat,
        card: parseCard(entry.card),
      }));

      // Build bidding history from bids array
      const uiBidHistory = (backendState.bids || []).map(b => ({
        seat: b.seat,
        bid: b,
      }));

      // Determine dummy seat (partner of declarer)
      const partners = { N:"S", S:"N", E:"W", W:"E" };
      const dummySeat = uiContract ? (partners[uiContract.declarer] || null) : null;

      // Scores
      const scoreNS = backendState.score?.NS ?? 0;
      const scoreEW = backendState.score?.EW ?? 0;

      // Count cards per seat for face-down display
      const handCounts = {};
      for (const seatKey of ["N","E","S","W"]) {
        const uid = seatsMap[seatKey];
        const raw = handsMap[uid];
        handCounts[seatKey] = Array.isArray(raw) ? raw.length : 13;
      }

      // Build adapted UI state
      const uiState = {
        phase:          backendState.phase || "bidding",
        turn:           turnSeat,
        mySeat:         resolvedMySeat,
        hand:           handsBySeat[resolvedMySeat] || [],
        dummyHand:      (dummySeat && handsBySeat[dummySeat]) || null,
        currentContract: uiContract,
        tricksCounts:   { ns: nsTricks, ew: ewTricks },
        currentTrick:   uiCurrentTrick,
        biddingHistory: uiBidHistory,
        score:          { ns: scoreNS, ew: scoreEW },
        status:         backendState.status,
        winner:         backendState.winner,
        // Per-seat card counts for face-down display
        hand_N: handCounts["N"],
        hand_E: handCounts["E"],
        hand_S: handCounts["S"],
        hand_W: handCounts["W"],
        players: roomPlayers || [],
      };

      // Update mySeat in closure if resolved
      if (resolvedMySeat) {
        // Patch seat labels for South seat display
        const southEl = document.getElementById("br-seat-S");
        if (southEl) {
          const lbl = southEl.querySelector(".bridge-seat-label");
          if (lbl && resolvedMySeat === "S") lbl.textContent = "▼ South (You)";
        }
      }

      fullRender(uiState);
    }

    // ── Initial render ────────────────────────────────────────────
    // If room has initial gameState, adapt and render it
    if (room.gameState) {
      refreshBridgeUI(room.gameState, room.players);
    } else {
      fullRender(state);
    }
  }

  // ── Helpers ───────────────────────────────────────────────────
  function formatContract(c) {
    if (!c) return "—";
    if (typeof c === "string") return c;
    let s = "";
    s += c.level || "";
    s += c.suit || c.trumpSuit || "";
    if (c.doubled)   s += " Dbl";
    if (c.redoubled) s += " Rdbl";
    if (c.declarer)  s += ` by ${SEAT_LABELS[c.declarer] || c.declarer}`;
    return s || "—";
  }

  function dummySeatOf(contract, players) {
    if (!contract) return null;
    const declarer = contract.declarer;
    if (!declarer) return null;
    const partners = { N:"S", S:"N", E:"W", W:"E" };
    return partners[declarer] || null;
  }

  function declarerSeatOf(contract) {
    return contract?.declarer || null;
  }

  return { renderBoard };
})();
