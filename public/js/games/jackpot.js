const JackpotGame = (() => {
  function render(container, state) {
    let socket = null;
    let countdown = null;

    container.innerHTML = `
      <div class="game-layout">
        <aside class="bet-panel">
          <div class="bp-tabs">
            <button class="bp-tab active">Manual</button>
            <button class="bp-tab">Auto</button>
          </div>
          <div>
            <div class="bp-label">Entry Amount (min 1 chip)</div>
            <div class="bp-input-row">
              <input id="jp-amount" type="number" value="1000" min="100" step="100" />
              <button id="jp-half" class="quick-btn">&frac12;</button>
              <button id="jp-dbl" class="quick-btn">2&times;</button>
            </div>
          </div>
          <div style="font-size:0.82rem;color:var(--text-dim);line-height:1.5">
            Drop chips in the pot — one winner takes it all, weighted by contribution.
          </div>
          <hr class="bp-divider" />
          <button id="jp-enter" class="play-btn">Enter Jackpot</button>
          <div id="jp-result" class="result-banner"></div>
        </aside>
        <div class="game-canvas">
          <div class="stat-boxes">
            <div class="stat-box">
              <span class="sb-label">Total Pot</span>
              <span class="sb-value" id="jp-pot" style="color:var(--gold)">0 🪙</span>
            </div>
            <div class="stat-box">
              <span class="sb-label">Players</span>
              <span class="sb-value" id="jp-players">0</span>
            </div>
            <div class="stat-box">
              <span class="sb-label">Spin In</span>
              <span class="sb-value" id="jp-countdown" style="color:var(--accent)">—</span>
            </div>
          </div>
          <div id="jp-entries" style="background:var(--bg-elev);border:1px solid var(--border);border-radius:10px;padding:14px;flex:1;overflow-y:auto;min-height:80px;max-height:300px"></div>
          <div>
            <div style="font-size:0.75rem;color:var(--text-dim);margin-bottom:6px;text-transform:uppercase;letter-spacing:.06em">Recent Winners</div>
            <div id="jp-history" style="display:flex;gap:6px;flex-wrap:wrap"></div>
          </div>
        </div>
      </div>`;
    HowToPlay.addButton(container, "jackpot");

    const potEl = container.querySelector("#jp-pot");
    const playersEl = container.querySelector("#jp-players");
    const cdEl = container.querySelector("#jp-countdown");
    const entriesEl = container.querySelector("#jp-entries");
    const resultEl = container.querySelector("#jp-result");
    const historyEl = container.querySelector("#jp-history");
    const amountEl = container.querySelector("#jp-amount");
    const enterBtn = container.querySelector("#jp-enter");

    container.querySelector("#jp-half").addEventListener("click", () => {
      amountEl.value = Math.max(100, Math.floor(Number(amountEl.value) * 0.5));
    });
    container.querySelector("#jp-dbl").addEventListener("click", () => {
      amountEl.value = Math.floor(Number(amountEl.value) * 2);
    });
    container.querySelectorAll(".bp-tab").forEach(t =>
      t.addEventListener("click", function() {
        container.querySelectorAll(".bp-tab").forEach(x => x.classList.remove("active"));
        this.classList.add("active");
      })
    );

    function renderEntries(entries, totalPot) {
      if (!entries.length) {
        entriesEl.innerHTML = '<div style="color:var(--text-dim);font-size:0.88rem;text-align:center;padding:20px">No entries yet — be the first!</div>';
        return;
      }
      entriesEl.innerHTML = entries.map((e) => {
        const pct = totalPot > 0 ? ((e.amount / totalPot) * 100).toFixed(1) : "0";
        return `<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border)">
          <span style="font-weight:600">${e.username}</span>
          <span style="color:var(--gold)">${(e.amount / 100).toLocaleString()} 🪙</span>
          <span style="color:var(--text-dim);font-size:0.82rem">${pct}% chance</span>
        </div>`;
      }).join("");
    }

    socket = io("/jackpot", { auth: { token: Api.getToken() } });

    socket.on("state", ({ entries, totalPot, spinning, history }) => {
      potEl.textContent = (totalPot / 100).toLocaleString() + " 🪙";
      const uniq = new Set(entries.map((e) => e.userId)).size;
      playersEl.textContent = uniq;
      renderEntries(entries, totalPot);
      if (!spinning) cdEl.textContent = entries.length ? "soon" : "—";
      renderHistory(history);
    });

    socket.on("countdown", (ms) => {
      if (countdown) clearInterval(countdown);
      let rem = Math.ceil(ms / 1000);
      cdEl.textContent = rem + "s";
      countdown = setInterval(() => {
        rem--;
        if (rem <= 0) { clearInterval(countdown); cdEl.textContent = "—"; }
        else cdEl.textContent = rem + "s";
      }, 1000);
    });

    socket.on("spinning", () => {
      enterBtn.disabled = true;
      cdEl.textContent = "🎰";
      if (countdown) { clearInterval(countdown); countdown = null; }
    });

    socket.on("result", ({ winner, prize, totalPot }) => {
      const myName = state.username;
      const isWinner = winner === myName;
      resultEl.className = "result-banner " + (isWinner ? "win" : "loss");
      resultEl.textContent = isWinner
        ? `🏆 You won! +${(prize / 100).toLocaleString()} chips`
        : `Winner: ${winner} took ${(prize / 100).toLocaleString()} 🪙`;
      if (isWinner) App.refreshAccount();
      enterBtn.disabled = false;
    });

    socket.on("error", (msg) => { UI.toast(msg, "loss"); enterBtn.disabled = false; });

    function renderHistory(history) {
      historyEl.innerHTML = (history || []).map((h) =>
        `<div style="background:var(--bg-elev);border:1px solid var(--border);border-radius:8px;padding:5px 10px;font-size:0.8rem"><strong>${h.winner}</strong> won ${(h.amount/100).toLocaleString()} 🪙</div>`
      ).join("");
    }

    enterBtn.addEventListener("click", () => {
      const amount = Math.round(Number(amountEl.value) * 100);
      if (amount < 100) return UI.toast("Min entry: 1 chip", "loss");
      enterBtn.disabled = true;
      socket.emit("enter", { amount });
      setTimeout(() => { enterBtn.disabled = false; }, 1500);
    });

    return () => { if (socket) socket.disconnect(); if (countdown) clearInterval(countdown); };
  }

  return { render };
})();
