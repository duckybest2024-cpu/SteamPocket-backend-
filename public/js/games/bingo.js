const BingoGame = (() => {
  function render(container, state) {
    let socket = null;
    let myCard = null;
    let drawn = [];

    container.innerHTML = `
      <div class="game-layout">
        <aside class="bet-panel">
          <div style="font-size:0.82rem;color:var(--text-dim);line-height:1.6">
            Buy in for <strong style="color:var(--win)">50 🪙</strong> · Get a 5×5 card · First to complete a row, column, or diagonal wins the pot!
          </div>
          <hr class="bp-divider" />
          <div id="bingo-phase-panel" style="background:var(--bg);border-radius:8px;padding:10px;font-size:0.85rem">
            <div id="bingo-phase" style="font-weight:700;color:var(--accent)">Waiting for players…</div>
            <div id="bingo-player-count" style="color:var(--text-dim);margin-top:4px;font-size:0.8rem">Need 2+ players.</div>
          </div>
          <button id="bingo-join" class="play-btn">Join Round (50 🪙)</button>
        </aside>
        <div class="game-canvas">
          <div id="bingo-card-wrap" style="display:none">
            <div style="display:flex;gap:6px;margin-bottom:8px">
              ${["B","I","N","G","O"].map((l) => `<div style="flex:1;text-align:center;font-weight:800;font-size:1.1rem;color:var(--accent)">${l}</div>`).join("")}
            </div>
            <div id="bingo-card" style="display:flex;flex-direction:column;gap:4px"></div>
          </div>
          <div>
            <div style="font-size:0.75rem;color:var(--text-dim);margin-bottom:6px;text-transform:uppercase;letter-spacing:.06em">Numbers Drawn</div>
            <div id="bingo-drawn" style="display:flex;gap:4px;flex-wrap:wrap;min-height:30px"></div>
          </div>
          <div id="bingo-result" class="result-banner" style="margin-top:auto"></div>
        </div>
      </div>`;
    HowToPlay.addButton(container, "bingo");

    const phaseEl = container.querySelector("#bingo-phase");
    const playerCountEl = container.querySelector("#bingo-player-count");
    const joinBtn = container.querySelector("#bingo-join");
    const cardWrap = container.querySelector("#bingo-card-wrap");
    const cardEl = container.querySelector("#bingo-card");
    const drawnEl = container.querySelector("#bingo-drawn");
    const resultEl = container.querySelector("#bingo-result");

    function renderCard() {
      if (!myCard) return;
      cardEl.innerHTML = myCard.map((row, r) =>
        `<div style="display:flex;gap:4px">${row.map((num, c) => {
          const isDawn = drawn.includes(num);
          return `<div style="flex:1;text-align:center;padding:8px 2px;border-radius:8px;font-size:0.88rem;font-weight:700;
            background:${isDawn ? "var(--accent)" : "var(--bg-elev)"};
            color:${isDawn ? "white" : "var(--text)"};
            border:2px solid ${isDawn ? "var(--accent)" : "var(--border)"};
            transition:background 0.3s">${num}</div>`;
        }).join("")}</div>`
      ).join("");
    }

    function renderDrawn() {
      drawnEl.innerHTML = drawn.map((n) =>
        `<div style="background:var(--accent);color:white;border-radius:6px;padding:4px 8px;font-size:0.78rem;font-weight:700">${n}</div>`
      ).join("");
    }

    socket = io("/bingo", { auth: { token: Api.getToken() } });

    socket.on("state", ({ phase, players, drawn: d }) => {
      drawn = d || [];
      renderDrawn();
      if (phase === "waiting") {
        phaseEl.textContent = "Waiting for players…";
        playerCountEl.textContent = `${players} player${players !== 1 ? "s" : ""} joined. Need 2+ to start.`;
        joinBtn.disabled = false;
      } else if (phase === "playing") {
        phaseEl.textContent = "🎱 Game in progress";
        joinBtn.disabled = true;
      }
    });

    socket.on("card", ({ card }) => {
      myCard = card;
      joinBtn.disabled = true;
      joinBtn.textContent = "✅ Joined!";
      cardWrap.style.display = "";
      renderCard();
    });

    socket.on("player_joined", ({ players, username }) => {
      playerCountEl.textContent = `${players} players joined`;
      if (username !== state.username) UI.toast(`${username} joined!`, "info");
    });

    socket.on("starting_soon", ({ inMs, players }) => {
      phaseEl.textContent = `Starting in ${Math.ceil(inMs / 1000)}s with ${players} players…`;
    });

    socket.on("game_start", ({ players }) => {
      phaseEl.textContent = "🎱 Drawing numbers…";
      resultEl.className = "result-banner";
      resultEl.textContent = "";
    });

    socket.on("number_drawn", ({ num, drawn: d }) => {
      drawn = d;
      renderDrawn();
      renderCard();
    });

    socket.on("bingo", ({ winners, prize }) => {
      const isWinner = winners.includes(state.username);
      resultEl.className = "result-banner " + (isWinner ? "win" : "loss");
      resultEl.textContent = isWinner
        ? `🎱 BINGO! You won +${(prize/100).toLocaleString()} chips!`
        : `🎱 ${winners.join(", ")} called BINGO! Prize: ${(prize/100).toLocaleString()} chips`;
      if (isWinner) App.refreshAccount();
    });

    socket.on("waiting", () => {
      phaseEl.textContent = "Waiting for next round…";
      myCard = null;
      drawn = [];
      cardWrap.style.display = "none";
      joinBtn.disabled = false;
      joinBtn.textContent = "Join Round (50 🪙)";
      renderDrawn();
    });

    socket.on("error", (msg) => { UI.toast(msg, "loss"); joinBtn.disabled = false; });

    joinBtn.addEventListener("click", () => {
      joinBtn.disabled = true;
      socket.emit("join");
    });

    return () => { if (socket) socket.disconnect(); };
  }

  return { render };
})();
