const RPSGame = (() => {
  const EMOJI = { rock: "🪨", paper: "📄", scissors: "✂️" };

  function render(container, state) {
    let socket = null;
    let matchId = "";
    let inQueue = false;
    let inMatch = false;

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
              <input id="rps-amount" type="number" value="100" min="1" step="1" />
              <button id="rps-half" class="quick-btn">&frac12;</button>
              <button id="rps-dbl" class="quick-btn">2&times;</button>
            </div>
          </div>
          <div style="font-size:0.82rem;color:var(--text-dim);line-height:1.5">
            1v1 — winner takes <strong style="color:var(--win)">95%</strong> of the pot. You are matched with someone who bet the same amount.
          </div>
          <hr class="bp-divider" />
          <button id="rps-queue" class="play-btn">Find Match</button>
        </aside>
        <div class="game-canvas">
          <div id="rps-lobby">
            <div id="rps-status" style="background:var(--bg-elev);border:1px solid var(--border);border-radius:10px;padding:14px;font-size:0.88rem;color:var(--text-dim)">
              Enter a bet and click Find Match to be paired with someone.
            </div>
          </div>
          <div id="rps-match" style="display:none">
            <div id="rps-vs" style="font-size:1.1rem;font-weight:700;text-align:center;padding:12px;background:var(--bg-elev);border:1px solid var(--border);border-radius:10px"></div>
            <div style="display:flex;gap:14px;justify-content:center;margin-top:14px">
              <button class="rps-choice secondary-btn" data-c="rock" style="font-size:2rem;padding:16px 20px;flex:1;max-width:140px">🪨<br><span style="font-size:0.75rem">Rock</span></button>
              <button class="rps-choice secondary-btn" data-c="paper" style="font-size:2rem;padding:16px 20px;flex:1;max-width:140px">📄<br><span style="font-size:0.75rem">Paper</span></button>
              <button class="rps-choice secondary-btn" data-c="scissors" style="font-size:2rem;padding:16px 20px;flex:1;max-width:140px">✂️<br><span style="font-size:0.75rem">Scissors</span></button>
            </div>
            <div id="rps-waiting-choice" style="color:var(--text-dim);font-size:0.88rem;text-align:center;margin-top:10px;display:none">Waiting for opponent…</div>
          </div>
          <div id="rps-result" class="result-banner" style="font-size:1.1rem;margin-top:auto"></div>
        </div>
      </div>`;
    HowToPlay.addButton(container, "rps");

    const amountEl = container.querySelector("#rps-amount");
    const queueBtn = container.querySelector("#rps-queue");
    const statusEl = container.querySelector("#rps-status");
    const lobbyEl = container.querySelector("#rps-lobby");
    const matchEl = container.querySelector("#rps-match");
    const vsEl = container.querySelector("#rps-vs");
    const resultEl = container.querySelector("#rps-result");
    const waitingEl = container.querySelector("#rps-waiting-choice");

    container.querySelector("#rps-half").addEventListener("click", () => {
      amountEl.value = Math.max(1, Math.floor(Number(amountEl.value) * 0.5));
    });
    container.querySelector("#rps-dbl").addEventListener("click", () => {
      amountEl.value = Math.floor(Number(amountEl.value) * 2);
    });
    container.querySelectorAll(".bp-tab").forEach(t =>
      t.addEventListener("click", function() {
        container.querySelectorAll(".bp-tab").forEach(x => x.classList.remove("active"));
        this.classList.add("active");
      })
    );

    socket = io("/rps", { auth: { token: Api.getToken() } });

    socket.on("queued", () => {
      inQueue = true;
      queueBtn.textContent = "Cancel";
      statusEl.innerHTML = "<span style='color:var(--accent)'>🔍 Looking for an opponent with the same bet…</span>";
    });

    socket.on("dequeued", () => {
      inQueue = false;
      queueBtn.textContent = "Find Match";
      statusEl.textContent = "Enter a bet and click Find Match.";
    });

    socket.on("match_found", ({ matchId: mid, opponent, amount }) => {
      matchId = mid;
      inMatch = true;
      inQueue = false;
      lobbyEl.style.display = "none";
      matchEl.style.display = "";
      vsEl.innerHTML = `⚔️ You vs <strong>${opponent}</strong> — ${(amount/100).toLocaleString()} 🪙 each`;
      resultEl.className = "result-banner";
      resultEl.textContent = "";
    });

    socket.on("choice_recorded", () => {
      container.querySelectorAll(".rps-choice").forEach((b) => b.disabled = true);
      waitingEl.style.display = "";
    });

    socket.on("result", ({ p1, p2, winner, prize }) => {
      const myName = state.username;
      const me = p1.username === myName ? p1 : p2;
      const opp = p1.username === myName ? p2 : p1;
      const isWinner = winner === myName;
      const isTie = !winner;

      resultEl.className = "result-banner " + (isWinner ? "win" : isTie ? "" : "loss");
      resultEl.innerHTML = `
        <div style="font-size:1.4rem">${EMOJI[me.choice]} vs ${EMOJI[opp.choice]}</div>
        <div>${isWinner ? `🏆 You win! +${(prize/100).toLocaleString()} chips` : isTie ? "🤝 Tie — refunded!" : `${winner} wins with ${EMOJI[opp.choice]}`}</div>`;

      if (isWinner || isTie) App.refreshAccount();

      setTimeout(() => {
        matchEl.style.display = "none";
        lobbyEl.style.display = "";
        waitingEl.style.display = "none";
        container.querySelectorAll(".rps-choice").forEach((b) => b.disabled = false);
        queueBtn.textContent = "Find Match";
        inMatch = false;
        matchId = "";
      }, 4000);
    });

    socket.on("error", (msg) => UI.toast(msg, "loss"));

    queueBtn.addEventListener("click", () => {
      if (inQueue) {
        socket.emit("dequeue");
      } else if (!inMatch) {
        const amount = Math.round(Number(amountEl.value) * 100);
        if (amount < 100) return UI.toast("Min bet: 1 chip", "loss");
        socket.emit("queue", { amount });
      }
    });

    container.querySelectorAll(".rps-choice").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (!matchId) return;
        socket.emit("choose", { matchId, choice: btn.dataset.c });
      });
    });

    return () => { if (socket) socket.disconnect(); };
  }

  return { render };
})();
