const BattleDiceGame = (() => {
  const ROOMS = ["table-1", "table-2", "table-3", "table-4"];

  function render(container, state) {
    let socket = null;
    let currentRoom = "";

    container.innerHTML = `
      <div class="game-layout">
        <aside class="bet-panel">
          <div class="bp-tabs">
            <button class="bp-tab active">Manual</button>
            <button class="bp-tab">Auto</button>
          </div>
          <div>
            <div class="bp-label">Bet Amount</div>
            <div class="bp-input-row">
              <input id="bd-amount" type="number" value="100" min="1" step="1" />
              <button id="bd-half" class="quick-btn">&frac12;</button>
              <button id="bd-dbl" class="quick-btn">2&times;</button>
            </div>
          </div>
          <hr class="bp-divider" />
          <div>
            <div class="bp-label">Select Room</div>
            <div style="display:flex;flex-direction:column;gap:5px">
              ${ROOMS.map((r) => `<button class="quick-btn room-btn" data-room="${r}" style="text-align:left;padding:8px 10px">${r}</button>`).join("")}
            </div>
          </div>
          <button id="bd-join" class="play-btn">Join Room</button>
        </aside>
        <div class="game-canvas">
          <div id="bd-players" style="background:var(--bg-elev);border:1px solid var(--border);border-radius:10px;padding:12px;min-height:60px">
            <div style="color:var(--text-dim);font-size:0.85rem">Select a room to see players…</div>
          </div>
          <div id="bd-dice" style="display:flex;gap:14px;justify-content:center;flex-wrap:wrap;min-height:80px;align-items:center"></div>
          <div id="bd-result" class="result-banner" style="margin-top:auto"></div>
        </div>
      </div>`;

    const amountEl = container.querySelector("#bd-amount");
    const joinBtn = container.querySelector("#bd-join");
    const playersEl = container.querySelector("#bd-players");
    const diceEl = container.querySelector("#bd-dice");
    const resultEl = container.querySelector("#bd-result");

    container.querySelector("#bd-half").addEventListener("click", () => {
      amountEl.value = Math.max(1, Math.floor(Number(amountEl.value) * 0.5));
    });
    container.querySelector("#bd-dbl").addEventListener("click", () => {
      amountEl.value = Math.floor(Number(amountEl.value) * 2);
    });
    container.querySelectorAll(".bp-tab").forEach(t =>
      t.addEventListener("click", function() {
        container.querySelectorAll(".bp-tab").forEach(x => x.classList.remove("active"));
        this.classList.add("active");
      })
    );

    container.querySelectorAll(".room-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        container.querySelectorAll(".room-btn").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        currentRoom = btn.dataset.room;
        if (socket) socket.emit("leave_room", currentRoom);
      });
    });

    socket = io("/battledice", { auth: { token: Api.getToken() } });

    socket.on("room_state", ({ bets, endsAt, phase }) => {
      const entries = Object.entries(bets);
      const rem = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
      playersEl.innerHTML = entries.length
        ? `<div style="font-size:0.78rem;color:var(--text-dim);margin-bottom:8px">Rolls in ~${rem}s · ${entries.length}/8 players</div>` +
          entries.map(([,b]) => `<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--border);font-size:0.85rem"><span>${b.username}</span><span style="color:var(--gold)">${(b.amount/100).toLocaleString()} 🪙</span></div>`).join("")
        : `<div style="color:var(--text-dim);font-size:0.85rem">No players yet — join to start!</div>`;
    });

    socket.on("rolling", () => {
      joinBtn.disabled = true;
      diceEl.innerHTML = `<div style="font-size:2rem;animation:spin 0.5s linear infinite">🎲</div>`;
      playersEl.innerHTML = `<div style="color:var(--text-dim)">Rolling dice…</div>`;
    });

    socket.on("results", ({ rolls, winners, prize }) => {
      const myName = state.username;
      const isWinner = winners.includes(myName);
      resultEl.className = "result-banner " + (isWinner ? "win" : "loss");
      resultEl.textContent = isWinner ? `🎲 You rolled high! +${(prize/100).toLocaleString()} chips` : `Winners: ${winners.join(", ")}`;

      diceEl.innerHTML = rolls.map((r) => {
        const isMe = r.username === myName;
        const isWin = winners.includes(r.username);
        return `<div style="text-align:center;padding:10px;background:${isWin ? "rgba(52,211,153,0.15)" : "var(--bg-elev)"};border:2px solid ${isWin ? "var(--win)" : "var(--border)"};border-radius:12px">
          <div style="font-size:2rem">${["","⚀","⚁","⚂","⚃","⚄","⚅"][r.roll]}</div>
          <div style="font-size:0.75rem;color:${isMe ? "var(--accent)" : "var(--text-dim)"}">${r.username}${isMe ? " (you)" : ""}</div>
          <div style="font-weight:700">${r.roll}</div>
        </div>`;
      }).join("");

      if (isWinner) App.refreshAccount();
      joinBtn.disabled = false;
    });

    socket.on("room_closed", () => {
      joinBtn.disabled = false;
      diceEl.innerHTML = "";
    });

    socket.on("timer_reset", (endsAt) => {});

    socket.on("error", (msg) => { UI.toast(msg, "loss"); joinBtn.disabled = false; });

    joinBtn.addEventListener("click", () => {
      if (!currentRoom) return UI.toast("Select a room first", "loss");
      const amount = Math.round(Number(amountEl.value) * 100);
      if (amount < 100) return UI.toast("Min bet: 1 chip", "loss");
      joinBtn.disabled = true;
      socket.emit("join_room", { roomId: currentRoom, amount });
    });

    return () => { if (socket) socket.disconnect(); };
  }

  return { render };
})();
