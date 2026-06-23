const PokerGame = (() => {
  const TABLES = ["table-1", "table-2", "table-3"];
  function suitColor(card) { return (card?.includes("♥") || card?.includes("♦")) ? "#ef4444" : "var(--text)"; }

  function render(container, state) {
    let socket = null;
    let currentTable = "";
    let myHand = [];
    let discardSet = new Set();
    let inHand = false;

    container.innerHTML = `
      <div class="game-layout">
        <aside class="bet-panel">
          <div>
            <div class="bp-label">Select Table</div>
            <div style="display:flex;flex-direction:column;gap:5px">
              ${TABLES.map((t) => `<button class="quick-btn table-btn" data-table="${t}" style="text-align:left;padding:9px 12px">${t}</button>`).join("")}
            </div>
          </div>
          <div>
            <div class="bp-label">Buy-in Amount</div>
            <div class="bp-input-row">
              <input id="pk-buyin" type="number" value="500" min="1" step="100" />
              <button id="pk-half" class="quick-btn">½</button>
              <button id="pk-dbl" class="quick-btn">2×</button>
            </div>
          </div>
          <div style="font-size:0.82rem;color:var(--text-dim);line-height:1.5">
            Up to 6 players · Best hand wins the pot · Click cards to discard, then Draw.
          </div>
          <hr class="bp-divider" />
          <button id="pk-join" class="play-btn">Join Table</button>
          <div id="pk-actions" style="display:none;flex-direction:column;gap:6px">
            <button id="pk-draw" class="play-btn">Draw Cards</button>
            <button id="pk-fold" class="play-btn secondary-play">Fold</button>
          </div>
        </aside>
        <div class="game-canvas">
          <div id="pk-table-info" style="background:var(--bg-elev);border:1px solid var(--border);border-radius:10px;padding:12px;font-size:0.85rem;color:var(--text-dim)">Select a table and set your buy-in to join.</div>
          <div id="pk-hand-wrap" style="display:none">
            <div style="font-size:0.78rem;color:var(--text-dim);margin-bottom:8px">Your hand — click cards to discard:</div>
            <div id="pk-hand" style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap"></div>
          </div>
          <div id="pk-result" class="result-banner"></div>
          <div id="pk-showdown" style="display:none">
            <div style="font-size:0.75rem;color:var(--text-dim);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">Showdown</div>
            <div id="pk-showdown-hands" style="display:flex;flex-direction:column;gap:6px"></div>
          </div>
        </div>
      </div>`;
    HowToPlay.addButton(container, "poker");

    const buyinEl = container.querySelector("#pk-buyin");
    const joinBtn = container.querySelector("#pk-join");
    const tableInfoEl = container.querySelector("#pk-table-info");
    const handWrap = container.querySelector("#pk-hand-wrap");
    const handEl = container.querySelector("#pk-hand");
    const drawBtn = container.querySelector("#pk-draw");
    const foldBtn = container.querySelector("#pk-fold");
    const actionsEl = container.querySelector("#pk-actions");
    const resultEl = container.querySelector("#pk-result");
    const showdownEl = container.querySelector("#pk-showdown");
    const showdownHandsEl = container.querySelector("#pk-showdown-hands");

    container.querySelector("#pk-half").addEventListener("click", () => {
      buyinEl.value = Math.max(1, Math.floor(Number(buyinEl.value) * 0.5));
    });
    container.querySelector("#pk-dbl").addEventListener("click", () => {
      buyinEl.value = Math.floor(Number(buyinEl.value) * 2);
    });

    container.querySelectorAll(".table-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        container.querySelectorAll(".table-btn").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        currentTable = btn.dataset.table;
      });
    });

    function renderHand(hand, discards) {
      handEl.innerHTML = (hand || []).map((card, i) => {
        const isDiscard = discards.has(i);
        return `<div data-idx="${i}" style="
          width:62px;height:90px;border-radius:10px;display:flex;align-items:center;justify-content:center;
          font-size:1.3rem;font-weight:800;cursor:pointer;user-select:none;transition:all 0.2s;
          background:${isDiscard ? "rgba(239,68,68,0.2)" : "white"};
          border:3px solid ${isDiscard ? "#ef4444" : "var(--border)"};
          color:${suitColor(card)};
          transform:${isDiscard ? "translateY(10px)" : "none"};
          text-shadow: 0 1px 2px rgba(0,0,0,0.15);">${card}</div>`;
      }).join("");

      handEl.querySelectorAll("[data-idx]").forEach((el) => {
        el.addEventListener("click", () => {
          const idx = parseInt(el.dataset.idx, 10);
          if (discards.has(idx)) discards.delete(idx); else discards.add(idx);
          renderHand(myHand, discards);
        });
      });
    }

    socket = io("/poker", { auth: { token: Api.getToken() } });

    socket.on("table_update", ({ players, phase }) => {
      tableInfoEl.innerHTML = `<strong>${currentTable}</strong> · ${players.join(", ")} · Phase: ${phase}`;
    });

    socket.on("starting_soon", (ms) => {
      tableInfoEl.innerHTML = tableInfoEl.innerHTML + ` — hand starts in ${Math.ceil(ms/1000)}s`;
    });

    socket.on("table_phase", ({ phase, players }) => {
      if (phase === "drawing") {
        handWrap.style.display = "";
        actionsEl.style.display = "flex";
        showdownEl.style.display = "none";
        discardSet = new Set();
        inHand = true;
      }
    });

    socket.on("hand", ({ hand }) => {
      myHand = hand;
      discardSet = new Set();
      renderHand(myHand, discardSet);
    });

    socket.on("showdown", ({ hands, winners, prize }) => {
      inHand = false;
      handWrap.style.display = "none";
      actionsEl.style.display = "none";
      showdownEl.style.display = "";
      showdownHandsEl.innerHTML = hands.map((h) => {
        const isWinner = winners.includes(h.username);
        return `<div style="display:flex;align-items:center;gap:10px;padding:8px;border-radius:8px;background:${isWinner ? "rgba(52,211,153,0.1)" : "var(--bg-elev)"};border:1px solid ${isWinner ? "var(--win)" : "var(--border)"}">
          <strong style="width:100px;font-size:0.85rem">${h.username}${h.username === state.username ? " (you)" : ""}</strong>
          <div style="display:flex;gap:4px">${h.hand.map((c) => `<span style="color:${suitColor(c)};font-weight:700;font-size:0.9rem">${c}</span>`).join(" ")}</div>
          <span style="font-size:0.78rem;color:var(--text-dim)">${h.handName}</span>
          ${isWinner ? `<span style="color:var(--win);font-weight:700;margin-left:auto">+${(prize/100).toLocaleString()} 🪙</span>` : ""}
        </div>`;
      }).join("");

      const isWinner = winners.includes(state.username);
      resultEl.className = "result-banner " + (isWinner ? "win" : "loss");
      resultEl.textContent = isWinner ? `♠️ You win! +${(prize/100).toLocaleString()} chips` : `Winner: ${winners.join(", ")}`;
      if (isWinner) App.refreshAccount();
    });

    socket.on("error", (msg) => { UI.toast(msg, "loss"); joinBtn.disabled = false; });

    joinBtn.addEventListener("click", () => {
      if (!currentTable) return UI.toast("Select a table first", "loss");
      const buyIn = Math.round(Number(buyinEl.value) * 100);
      if (buyIn < 100) return UI.toast("Min buy-in: 1 chip", "loss");
      joinBtn.disabled = true;
      socket.emit("join_table", { tableId: currentTable, buyIn });
    });

    drawBtn.addEventListener("click", () => {
      if (!currentTable || !inHand) return;
      const indices = [...discardSet];
      socket.emit("draw_cards", { tableId: currentTable, discardIndices: indices });
      discardSet = new Set();
      drawBtn.disabled = true;
    });

    foldBtn.addEventListener("click", () => {
      if (!currentTable) return;
      socket.emit("fold", { tableId: currentTable });
      handWrap.style.display = "none";
      actionsEl.style.display = "none";
      inHand = false;
    });

    return () => { if (socket) socket.disconnect(); };
  }

  return { render };
})();
