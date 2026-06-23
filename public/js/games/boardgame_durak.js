/* ═══════════════════════════════════════════════════════════════
   Durak Card Game — GrilledCoin
   Exported global: DurakGame
   Entry point:     DurakGame.renderBoard(container, socket, room, myUserId)

   Rules recap:
   - Attacker plays cards to the table (attack slots)
   - Defender must beat each attack card with a higher card of same suit,
     or any trump card
   - Defender can "take" (pick up all table cards) if they can't defend
   - After defending, attacker can "pile on" more cards of matching ranks
   - Round ends when attacker says "done"
   ═══════════════════════════════════════════════════════════════ */

const DurakGame = (() => {

  // ── Suit helpers ──────────────────────────────────────────────
  const RED_SUITS  = new Set(["♥", "♦"]);
  const RANK_ORDER = ["6","7","8","9","10","J","Q","K","A"];

  function suitColor(suit) {
    return RED_SUITS.has(suit) ? "#ef4444" : "#1e293b";
  }

  function suitClass(suit) {
    return RED_SUITS.has(suit) ? "dk-suit-red" : "dk-suit-black";
  }

  // ── CSS injected once per page ─────────────────────────────────
  function injectStyles() {
    if (document.getElementById("dk-styles")) return;
    const style = document.createElement("style");
    style.id = "dk-styles";
    style.textContent = `
      /* ── Layout ── */
      .dk-wrap {
        max-width: 860px;
        padding: 16px;
        font-family: inherit;
      }
      .dk-title {
        font-size: 1.4rem;
        font-weight: 800;
        margin: 0 0 4px;
        color: var(--text);
      }
      .dk-subtitle {
        font-size: 0.85rem;
        color: var(--text-dim);
        margin: 0 0 18px;
      }
      /* ── Status bar ── */
      .dk-status-bar {
        background: var(--bg-elev);
        border: 1px solid var(--border);
        border-radius: 10px;
        padding: 10px 16px;
        margin-bottom: 14px;
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
      }
      .dk-status-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: var(--gold);
        flex-shrink: 0;
        transition: background 0.3s;
      }
      .dk-status-dot.attacking { background: var(--loss); animation: dk-pulse 1s ease-in-out infinite; }
      .dk-status-dot.defending { background: var(--accent-2, #4d9fec); animation: dk-pulse 1s ease-in-out infinite; }
      .dk-status-dot.waiting { background: var(--gold); }
      @keyframes dk-pulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.5; transform: scale(1.35); }
      }
      .dk-status-text {
        font-size: 0.9rem;
        font-weight: 600;
        color: var(--text);
        flex: 1;
      }
      /* ── Main game body ── */
      .dk-game-body {
        display: flex;
        gap: 16px;
        margin-bottom: 14px;
        align-items: flex-start;
      }
      /* ── Sidebar ── */
      .dk-sidebar {
        display: flex;
        flex-direction: column;
        gap: 12px;
        min-width: 100px;
        flex-shrink: 0;
      }
      .dk-sidebar-panel {
        background: var(--bg-elev);
        border: 1px solid var(--border);
        border-radius: 10px;
        padding: 12px;
        text-align: center;
      }
      .dk-sidebar-label {
        font-size: 0.7rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.07em;
        color: var(--text-dim);
        margin-bottom: 6px;
      }
      /* ── Trump suit display ── */
      .dk-trump-suit {
        font-size: 2.6rem;
        line-height: 1;
        margin-bottom: 4px;
      }
      .dk-trump-suit.red { color: #ef4444; }
      .dk-trump-suit.black { color: var(--text); }
      .dk-trump-name {
        font-size: 0.75rem;
        color: var(--text-dim);
      }
      /* ── Deck count ── */
      .dk-deck-count {
        font-size: 1.6rem;
        font-weight: 800;
        color: var(--text);
      }
      .dk-deck-icon {
        font-size: 0.85rem;
        color: var(--text-dim);
        margin-bottom: 4px;
      }
      /* ── Players list ── */
      .dk-player-entry {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 6px;
        padding: 3px 0;
        font-size: 0.78rem;
        color: var(--text-dim);
        border-bottom: 1px solid var(--border);
      }
      .dk-player-entry:last-child { border-bottom: none; }
      .dk-player-entry.me { color: var(--accent); font-weight: 700; }
      .dk-player-entry.attacker-p { color: var(--loss); }
      .dk-player-entry.defender-p { color: #4d9fec; }
      .dk-player-name { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 60px; }
      .dk-player-cards {
        background: var(--bg);
        border-radius: 4px;
        padding: 2px 6px;
        font-size: 0.75rem;
        font-weight: 700;
        color: var(--gold);
        flex-shrink: 0;
      }
      /* ── Main center area ── */
      .dk-center {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 12px;
        min-width: 0;
      }
      /* ── Table (play area) ── */
      .dk-table-area {
        background: #16382a;
        border: 2px solid #1e5240;
        border-radius: 14px;
        min-height: 160px;
        padding: 16px 12px;
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
        align-items: center;
        justify-content: center;
        position: relative;
      }
      .dk-table-empty {
        color: #2a6e52;
        font-size: 0.88rem;
        font-weight: 600;
        user-select: none;
      }
      /* ── Attack/defend pair ── */
      .dk-pair {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: -12px;
        cursor: pointer;
        position: relative;
        transition: transform 0.15s;
      }
      .dk-pair:hover { transform: translateY(-3px); }
      .dk-pair.selected-pair > .dk-attack-card { box-shadow: 0 0 0 2px #4d9fec, 0 4px 12px rgba(0,0,0,0.4); }
      .dk-attack-card {
        position: relative;
        z-index: 1;
      }
      .dk-defend-card {
        position: relative;
        z-index: 2;
        margin-top: -28px;
        margin-left: 10px;
      }
      /* ── Playing card ── */
      .dk-card {
        width: 56px;
        height: 80px;
        border-radius: 7px;
        background: #ffffff;
        border: 1.5px solid #d1d5db;
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        justify-content: flex-start;
        padding: 4px 5px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.35);
        user-select: none;
        position: relative;
        transition: transform 0.15s, box-shadow 0.15s;
        flex-shrink: 0;
      }
      .dk-card.trump-card {
        border-color: #f59e0b;
        box-shadow: 0 0 0 1.5px #f59e0b, 0 2px 8px rgba(0,0,0,0.35);
      }
      .dk-card-rank {
        font-size: 0.85rem;
        font-weight: 900;
        line-height: 1;
      }
      .dk-card-suit-top {
        font-size: 0.7rem;
        line-height: 1;
      }
      .dk-card-center-suit {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        font-size: 1.35rem;
        line-height: 1;
        opacity: 0.18;
        pointer-events: none;
      }
      .dk-card-bottom {
        position: absolute;
        bottom: 4px;
        right: 5px;
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        transform: rotate(180deg);
        transform-origin: center;
      }
      .dk-suit-red  { color: #ef4444; }
      .dk-suit-black { color: #1e293b; }
      /* ── Hand cards ── */
      .dk-hand-area {
        background: var(--bg-elev);
        border: 1px solid var(--border);
        border-radius: 12px;
        padding: 14px 12px 10px;
      }
      .dk-hand-label {
        font-size: 0.72rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.07em;
        color: var(--text-dim);
        margin-bottom: 10px;
      }
      .dk-hand-cards {
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
        min-height: 80px;
        align-items: center;
      }
      .dk-hand-card {
        cursor: pointer;
        transition: transform 0.15s, box-shadow 0.15s;
      }
      .dk-hand-card:hover {
        transform: translateY(-10px);
        box-shadow: 0 6px 20px rgba(0,0,0,0.45);
      }
      .dk-hand-card.selected {
        transform: translateY(-14px);
        box-shadow: 0 0 0 2.5px var(--accent), 0 8px 24px rgba(0,0,0,0.5);
      }
      .dk-hand-card.disabled {
        opacity: 0.45;
        cursor: not-allowed;
        transform: none !important;
        box-shadow: none !important;
      }
      /* ── Action buttons ── */
      .dk-actions {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }
      .dk-btn {
        padding: 9px 16px;
        border-radius: 8px;
        font-size: 0.84rem;
        font-weight: 700;
        border: none;
        cursor: pointer;
        transition: filter 0.15s, transform 0.1s, opacity 0.15s;
        flex: 1;
        min-width: 100px;
        white-space: nowrap;
      }
      .dk-btn:hover:not(:disabled) { filter: brightness(1.12); transform: translateY(-1px); }
      .dk-btn:disabled { opacity: 0.35; cursor: not-allowed; transform: none !important; filter: none !important; }
      .dk-btn-attack {
        background: var(--loss);
        color: #fff;
      }
      .dk-btn-defend {
        background: #4d9fec;
        color: #fff;
      }
      .dk-btn-take {
        background: var(--gold, #f59e0b);
        color: #1a1a1a;
      }
      .dk-btn-done {
        background: var(--accent);
        color: #071c10;
      }
      /* ── Result banner ── */
      .dk-result {
        border-radius: 10px;
        padding: 14px 18px;
        font-size: 1rem;
        font-weight: 700;
        text-align: center;
        display: none;
        margin-top: 4px;
      }
      .dk-result.win {
        display: block;
        background: rgba(0, 231, 1, 0.13);
        border: 1.5px solid var(--win);
        color: var(--win);
      }
      .dk-result.loss {
        display: block;
        background: rgba(229, 70, 61, 0.12);
        border: 1.5px solid var(--loss);
        color: var(--loss);
      }
      .dk-result.neutral {
        display: block;
        background: var(--bg-elev);
        border: 1.5px solid var(--border);
        color: var(--text-dim);
      }
      /* ── Responsive ── */
      @media (max-width: 600px) {
        .dk-game-body { flex-direction: column; }
        .dk-sidebar { flex-direction: row; flex-wrap: wrap; min-width: unset; }
        .dk-sidebar-panel { flex: 1; min-width: 80px; }
        .dk-card { width: 48px; height: 68px; }
        .dk-card-rank { font-size: 0.75rem; }
        .dk-card-center-suit { font-size: 1.1rem; }
        .dk-defend-card { margin-top: -22px; }
      }
    `;
    document.head.appendChild(style);
  }

  // ── Build a card element ───────────────────────────────────────
  function makeCardEl(card, extraClass) {
    if (!card) return null;
    const { suit, rank } = card;
    const isRed = RED_SUITS.has(suit);
    const colorClass = isRed ? "dk-suit-red" : "dk-suit-black";
    const el = document.createElement("div");
    el.className = "dk-card" + (extraClass ? " " + extraClass : "");
    el.innerHTML = `
      <span class="dk-card-rank ${colorClass}">${rank}</span>
      <span class="dk-card-suit-top ${colorClass}">${suit}</span>
      <span class="dk-card-center-suit ${colorClass}">${suit}</span>
      <div class="dk-card-bottom">
        <span class="dk-card-rank ${colorClass}">${rank}</span>
        <span class="dk-card-suit-top ${colorClass}">${suit}</span>
      </div>
    `;
    return el;
  }

  function cardKey(card) {
    return card ? `${card.rank}${card.suit}` : "none";
  }

  function cardsEqual(a, b) {
    return a && b && a.rank === b.rank && a.suit === b.suit;
  }

  /** Convert a parsed card object back to a backend card string like "A♠" */
  function cardToStr(card) {
    return card ? `${card.rank}${card.suit}` : "";
  }

  // ── Parse a card string like "A♠" → { rank: "A", suit: "♠" } ──
  function parseCard(cardStr) {
    if (!cardStr || cardStr === "??") return { rank: "?", suit: "?" };
    // Suit is the last character (unicode suit symbol)
    const suit = cardStr.slice(-1);
    const rank = cardStr.slice(0, -1);
    return { rank, suit };
  }

  // ── Translate backend gameState → UI state ──
  // Backend: hands[userId] = string[], table=[{attack:str, defend?:str}],
  //          trump=suit char, attackerId, defenderId, deck=[...], players=[userId,...]
  // UI:      hand=[{rank,suit}], table=[{attack:{rank,suit}, defend?:{rank,suit}}],
  //          trump=suit char, attacker=userId, defender=userId, deckCount=n,
  //          players=[{id,username,cardCount}]
  function translateGameState(gs, roomPlayers, myUserId) {
    if (!gs) return null;

    const myHand = (gs.hands && gs.hands[myUserId]) || [];
    const hand = myHand.map(parseCard);

    const table = (gs.table || []).map(pair => ({
      attack: parseCard(pair.attack),
      defend: pair.defend ? parseCard(pair.defend) : null,
    }));

    // Build player info list with usernames from room.players
    const usernameMap = {};
    (roomPlayers || []).forEach(p => { usernameMap[p.userId] = p.username || p.userId; });

    const players = (gs.players || []).map(uid => ({
      id:        uid,
      userId:    uid,
      username:  usernameMap[uid] || uid,
      cardCount: (gs.hands && gs.hands[uid]) ? gs.hands[uid].length : 0,
    }));

    return {
      hand,
      table,
      trump:      gs.trump || "",
      attacker:   gs.attackerId || "",
      defender:   gs.defenderId || "",
      deckCount:  Array.isArray(gs.deck) ? gs.deck.length : 0,
      players,
      status:     gs.status || "playing",
      winner:     gs.winner || null,
      turn:       gs.turn || "attack",
    };
  }

  // ── Main renderBoard ──────────────────────────────────────────
  function renderBoard(container, socket, room, myUserId) {
    injectStyles();

    // Local state
    let selectedHandIdx  = -1;   // index in hand[] of selected card
    let selectedPairIdx  = -1;   // index in table[] of selected attack pair
    const rawInitState = room && (room.gameState || room.state);
    let currentState = rawInitState ? (translateGameState(rawInitState, room.players, myUserId) || {}) : {};

    // ── Build HTML shell ──
    container.innerHTML = `
      <div class="dk-wrap">
        <h2 class="dk-title">🃏 Durak</h2>
        <p class="dk-subtitle">Attack with cards of matching ranks · Defend with higher same-suit or any trump · Last player holding cards loses!</p>

        <div class="dk-status-bar">
          <div class="dk-status-dot waiting" id="dk-status-dot"></div>
          <span class="dk-status-text" id="dk-status-text">Waiting…</span>
        </div>

        <div class="dk-game-body">
          <!-- Sidebar -->
          <div class="dk-sidebar">
            <div class="dk-sidebar-panel">
              <div class="dk-sidebar-label">Trump</div>
              <div class="dk-trump-suit" id="dk-trump-suit">?</div>
              <div class="dk-trump-name" id="dk-trump-name">—</div>
            </div>
            <div class="dk-sidebar-panel">
              <div class="dk-sidebar-label">Deck</div>
              <div class="dk-deck-icon">🂠</div>
              <div class="dk-deck-count" id="dk-deck-count">—</div>
            </div>
            <div class="dk-sidebar-panel" id="dk-players-panel">
              <div class="dk-sidebar-label">Players</div>
              <div id="dk-players-list"></div>
            </div>
          </div>

          <!-- Center -->
          <div class="dk-center">
            <!-- Table -->
            <div class="dk-table-area" id="dk-table-area">
              <span class="dk-table-empty" id="dk-table-empty">Table is empty</span>
            </div>

            <!-- Action buttons -->
            <div class="dk-actions" id="dk-actions">
              <button class="dk-btn dk-btn-attack"  id="dk-btn-attack"  disabled>Attack</button>
              <button class="dk-btn dk-btn-defend"  id="dk-btn-defend"  disabled>Defend</button>
              <button class="dk-btn dk-btn-take"    id="dk-btn-take"    disabled>Take Cards</button>
              <button class="dk-btn dk-btn-done"    id="dk-btn-done"    disabled>Done Attacking</button>
            </div>

            <!-- Hand -->
            <div class="dk-hand-area">
              <div class="dk-hand-label">Your Hand (<span id="dk-hand-count">0</span> cards)</div>
              <div class="dk-hand-cards" id="dk-hand-cards"></div>
            </div>
          </div>
        </div>

        <div class="dk-result" id="dk-result"></div>
      </div>
    `;

    // ── Element refs ──
    const statusDot    = document.getElementById("dk-status-dot");
    const statusText   = document.getElementById("dk-status-text");
    const trumpSuitEl  = document.getElementById("dk-trump-suit");
    const trumpNameEl  = document.getElementById("dk-trump-name");
    const deckCountEl  = document.getElementById("dk-deck-count");
    const playersListEl= document.getElementById("dk-players-list");
    const tableArea    = document.getElementById("dk-table-area");
    const tableEmpty   = document.getElementById("dk-table-empty");
    const btnAttack    = document.getElementById("dk-btn-attack");
    const btnDefend    = document.getElementById("dk-btn-defend");
    const btnTake      = document.getElementById("dk-btn-take");
    const btnDone      = document.getElementById("dk-btn-done");
    const handCards    = document.getElementById("dk-hand-cards");
    const handCount    = document.getElementById("dk-hand-count");
    const resultEl     = document.getElementById("dk-result");

    // ── Derived role helpers ──
    function amIAttacker(st) { return st.attacker === myUserId; }
    function amIDefender(st) { return st.defender === myUserId; }
    function isMyTurn(st)    { return st.turn === myUserId; }

    // ── Render sidebar ──
    function renderSidebar(st) {
      // Trump suit
      const trump = st.trump || "";
      const isRed = RED_SUITS.has(trump);
      trumpSuitEl.textContent = trump || "?";
      trumpSuitEl.className   = "dk-trump-suit " + (isRed ? "red" : "black");
      trumpNameEl.textContent = trump
        ? ({ "♥": "Hearts", "♦": "Diamonds", "♠": "Spades", "♣": "Clubs" }[trump] || trump)
        : "—";

      // Deck count
      deckCountEl.textContent = st.deckCount != null ? st.deckCount : "—";

      // Players list
      const players = st.players || [];
      if (players.length === 0) {
        playersListEl.innerHTML = `<div style="font-size:0.78rem;color:var(--text-dim)">—</div>`;
        return;
      }
      playersListEl.innerHTML = players.map(p => {
        const isMe       = p.id === myUserId || p.userId === myUserId;
        const isAttacker = (p.id || p.userId) === st.attacker;
        const isDefender = (p.id || p.userId) === st.defender;
        let cls = "dk-player-entry";
        if (isMe)       cls += " me";
        else if (isAttacker) cls += " attacker-p";
        else if (isDefender) cls += " defender-p";
        const label = isAttacker ? "⚔" : isDefender ? "🛡" : "";
        return `<div class="${cls}">
          <span class="dk-player-name">${p.username || p.name || "?"}</span>
          <span>${label ? label + " " : ""}<span class="dk-player-cards">${p.cardCount != null ? p.cardCount : "?"}</span></span>
        </div>`;
      }).join("");
    }

    // ── Render table ──
    function renderTable(st) {
      const pairs = st.table || [];
      if (pairs.length === 0) {
        tableEmpty.style.display = "";
        // Remove all pair elements
        tableArea.querySelectorAll(".dk-pair").forEach(el => el.remove());
        return;
      }
      tableEmpty.style.display = "none";

      // Remove stale pairs
      tableArea.querySelectorAll(".dk-pair").forEach(el => el.remove());

      pairs.forEach((pair, idx) => {
        const pairEl = document.createElement("div");
        pairEl.className = "dk-pair" + (idx === selectedPairIdx ? " selected-pair" : "");
        pairEl.dataset.pairIdx = idx;

        // Attack card (bottom)
        const atkWrapper = document.createElement("div");
        atkWrapper.className = "dk-attack-card";
        const atkCard = makeCardEl(pair.attack);
        if (atkCard) {
          if (pair.attack && pair.attack.suit === st.trump) atkCard.classList.add("trump-card");
          atkWrapper.appendChild(atkCard);
        }
        pairEl.appendChild(atkWrapper);

        // Defend card (overlaid on top) — only if exists
        if (pair.defend) {
          const defWrapper = document.createElement("div");
          defWrapper.className = "dk-defend-card";
          const defCard = makeCardEl(pair.defend);
          if (defCard) {
            if (pair.defend.suit === st.trump) defCard.classList.add("trump-card");
            defWrapper.appendChild(defCard);
          }
          pairEl.appendChild(defWrapper);
        }

        // Click to select this pair (for defending)
        pairEl.addEventListener("click", () => {
          if (!amIDefender(st)) return;
          if (pair.defend) return; // already defended
          selectedPairIdx = (selectedPairIdx === idx) ? -1 : idx;
          renderTable(st);
          updateButtons(st);
        });

        tableArea.appendChild(pairEl);
      });
    }

    // ── Render hand ──
    function renderHand(st) {
      const hand = st.hand || [];
      handCount.textContent = hand.length;

      handCards.innerHTML = "";
      hand.forEach((card, idx) => {
        const wrapper = document.createElement("div");
        wrapper.className = "dk-hand-card" + (idx === selectedHandIdx ? " selected" : "");
        wrapper.dataset.handIdx = idx;

        const cardEl = makeCardEl(card, "");
        if (cardEl) {
          if (card.suit === st.trump) cardEl.classList.add("trump-card");
          wrapper.appendChild(cardEl);
        }

        wrapper.addEventListener("click", () => {
          if (wrapper.classList.contains("disabled")) return;
          selectedHandIdx = (selectedHandIdx === idx) ? -1 : idx;
          renderHand(st);
          updateButtons(st);
        });

        handCards.appendChild(wrapper);
      });
    }

    // ── Update action button states ──
    function updateButtons(st) {
      const hand = st.hand || [];
      const table = st.table || [];
      const iAm_attacker = amIAttacker(st);
      const iAm_defender = amIDefender(st);

      // Attack: I'm attacker AND have a card selected
      // On first attack (empty table) any card works.
      // On subsequent attacks, the card rank must match a rank already on table.
      const hasSelectedCard = selectedHandIdx >= 0 && selectedHandIdx < hand.length;
      let canAttack = false;
      if (iAm_attacker && hasSelectedCard && !amIDefender(st)) {
        if (table.length === 0) {
          canAttack = true;
        } else {
          // Check if selected card rank matches any card on table
          const selectedCard = hand[selectedHandIdx];
          const tableRanks = new Set();
          table.forEach(pair => {
            if (pair.attack) tableRanks.add(pair.attack.rank);
            if (pair.defend) tableRanks.add(pair.defend.rank);
          });
          canAttack = tableRanks.has(selectedCard.rank);
        }
      }

      // Defend: I'm defender AND have a card selected AND have an undefended attack pair selected
      let canDefend = false;
      if (iAm_defender && hasSelectedCard && selectedPairIdx >= 0 && selectedPairIdx < table.length) {
        const attackPair = table[selectedPairIdx];
        if (!attackPair.defend) {
          canDefend = true; // server will validate the actual legality
        }
      }

      // Take: I'm defender
      const canTake = iAm_defender && table.length > 0 && !allPairsDefended(table);

      // Done: I'm attacker and there are defended pairs (or table is empty — pass)
      const canDone = iAm_attacker && (table.length === 0 || allPairsDefended(table));

      btnAttack.disabled = !canAttack;
      btnDefend.disabled = !canDefend;
      btnTake.disabled   = !canTake;
      btnDone.disabled   = !canDone;
    }

    function allPairsDefended(table) {
      return table.length > 0 && table.every(p => p.defend != null);
    }

    // ── Status bar ──
    function updateStatus(st) {
      const iAm_attacker = amIAttacker(st);
      const iAm_defender = amIDefender(st);
      if (iAm_attacker && iAm_defender) {
        // edge case: single player or both roles
        statusDot.className = "dk-status-dot attacking";
        statusText.textContent = "Your turn (attacking + defending)";
      } else if (iAm_attacker) {
        statusDot.className = "dk-status-dot attacking";
        statusText.textContent = "Your turn — Attack!";
      } else if (iAm_defender) {
        statusDot.className = "dk-status-dot defending";
        statusText.textContent = "Defend! Play a card on an attack card, or take the table.";
      } else {
        statusDot.className = "dk-status-dot waiting";
        // find attacker name
        const players = st.players || [];
        const attacker = players.find(p => (p.id || p.userId) === st.attacker);
        const attackerName = attacker ? (attacker.username || attacker.name || "Opponent") : "Opponent";
        statusText.textContent = `${attackerName} is attacking — watch the action!`;
      }
    }

    // ── Full render from state ──
    function renderAll(st) {
      currentState = st;
      // Reset selections when state changes
      selectedHandIdx = -1;
      selectedPairIdx = -1;

      renderSidebar(st);
      renderTable(st);
      renderHand(st);
      updateButtons(st);
      updateStatus(st);
    }

    // ── Action button handlers ──
    btnAttack.addEventListener("click", () => {
      const hand = currentState.hand || [];
      if (selectedHandIdx < 0 || selectedHandIdx >= hand.length) {
        UI.toast("Select a card from your hand to attack with", "loss");
        return;
      }
      const card = cardToStr(hand[selectedHandIdx]);
      socket.emit("bg:move", {
        roomId: room.id,
        move: { type: "attack", card },
      });
      selectedHandIdx = -1;
    });

    btnDefend.addEventListener("click", () => {
      const hand  = currentState.hand  || [];
      const table = currentState.table || [];
      if (selectedHandIdx < 0 || selectedHandIdx >= hand.length) {
        UI.toast("Select a card from your hand to defend with", "loss");
        return;
      }
      if (selectedPairIdx < 0 || selectedPairIdx >= table.length) {
        UI.toast("Select an attack card on the table to defend against", "loss");
        return;
      }
      const defendCard = cardToStr(hand[selectedHandIdx]);
      const attackCard = cardToStr(table[selectedPairIdx].attack);
      socket.emit("bg:move", {
        roomId: room.id,
        move: { type: "defend", attackCard, defendCard },
      });
      selectedHandIdx = -1;
      selectedPairIdx = -1;
    });

    btnTake.addEventListener("click", () => {
      socket.emit("bg:move", {
        roomId: room.id,
        move: { type: "take" },
      });
      selectedHandIdx = -1;
      selectedPairIdx = -1;
    });

    btnDone.addEventListener("click", () => {
      socket.emit("bg:move", {
        roomId: room.id,
        move: { type: "done" },
      });
      selectedHandIdx = -1;
    });

    // ── Socket events ──
    socket.on("bg:room-update", (updatedRoom) => {
      const newState = updatedRoom.gameState;
      if (!newState) return;
      renderAll(translateGameState(newState, updatedRoom.players || room.players, myUserId));
    });

    socket.on("bg:error", ({ message }) => {
      UI.toast(message || "Invalid move", "loss");
      // Re-render to restore valid state
      renderAll(currentState);
    });

    // ── Initial render ──
    if (Object.keys(currentState).length > 0) {
      renderAll(currentState);
    } else {
      updateStatus(currentState);
    }
  }

  return { renderBoard };
})();
