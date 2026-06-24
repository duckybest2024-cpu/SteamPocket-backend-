const MultiRouletteGame = (() => {
  const RED = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
  function getColor(n) { return n === 0 ? "#10b981" : RED.has(n) ? "#ef4444" : "#1f2937"; }

  function render(container, state) {
    let socket = null;
    let myBets = [];
    let phaseTimer = null;

    const BET_TYPES = [
      {t:"red",l:"🔴 Red",p:2},{t:"black",l:"⚫ Black",p:2},{t:"green",l:"🟢 0",p:36},
      {t:"even",l:"Even",p:2},{t:"odd",l:"Odd",p:2},
      {t:"1-18",l:"Low (1-18)",p:2},{t:"19-36",l:"High (19-36)",p:2},
      {t:"1-12",l:"1st 12",p:3},{t:"13-24",l:"2nd 12",p:3},{t:"25-36",l:"3rd 12",p:3},
    ];

    container.innerHTML = `
      <div class="game-layout">
        <aside class="bet-panel">
          ${GameThemes.renderPicker("multiroulette", GameThemes.getSaved("multiroulette"))}
          <div class="bp-tabs">
            <button class="bp-tab active">Manual</button>
            <button class="bp-tab">Auto</button>
          </div>
          <div>
            <div class="bp-label">Bet Amount</div>
            <div class="bp-input-row">
              <input id="mr-amount" type="number" value="100" min="1" />
              <button id="mr-half" class="quick-btn">&frac12;</button>
              <button id="mr-dbl" class="quick-btn">2&times;</button>
            </div>
          </div>
          <hr class="bp-divider" />
          <div>
            <div class="bp-label">Bet Type — click to place</div>
            <div style="display:flex;flex-direction:column;gap:4px">
              ${BET_TYPES.map((b) => `<button class="quick-btn mr-bet-btn" data-type="${b.t}" style="display:flex;justify-content:space-between;padding:8px 10px">${b.l}<span style="color:var(--text-dim)">${b.p}×</span></button>`).join("")}
            </div>
          </div>
        </aside>
        <div class="game-canvas">
          <div style="display:flex;align-items:center;gap:14px;background:var(--bg-elev);border:1px solid var(--border);border-radius:10px;padding:14px">
            <div id="mr-ball" style="width:64px;height:64px;flex-shrink:0;border-radius:50%;background:var(--bg);border:3px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:1.8rem;font-weight:800;transition:all 0.5s">?</div>
            <div style="flex:1;min-width:0">
              <div id="mr-phase" style="font-size:1rem;font-weight:700;margin-bottom:6px">Loading…</div>
              <div id="mr-history" style="display:flex;gap:4px;overflow-x:auto;padding-bottom:2px"></div>
            </div>
          </div>
          <div id="mr-my-bets" style="background:var(--bg-elev);border:1px solid var(--border);border-radius:8px;padding:10px;font-size:0.84rem;color:var(--text-dim);min-height:36px">No bets placed yet.</div>
          <div id="mr-result" class="result-banner" style="margin-top:auto"></div>
        </div>
      </div>`;
    HowToPlay.addButton(container, "multiroulette");

    const ballEl = container.querySelector("#mr-ball");
    const phaseEl = container.querySelector("#mr-phase");
    const histEl = container.querySelector("#mr-history");
    const amountEl = container.querySelector("#mr-amount");
    const myBetsEl = container.querySelector("#mr-my-bets");
    const resultEl = container.querySelector("#mr-result");

    container.querySelector("#mr-half").addEventListener("click", () => {
      amountEl.value = Math.max(1, Math.floor(Number(amountEl.value) * 0.5));
    });
    container.querySelector("#mr-dbl").addEventListener("click", () => {
      amountEl.value = Math.floor(Number(amountEl.value) * 2);
    });
    container.querySelectorAll(".bp-tab").forEach(t =>
      t.addEventListener("click", function() {
        container.querySelectorAll(".bp-tab").forEach(x => x.classList.remove("active"));
        this.classList.add("active");
      })
    );

    function updateMyBets() {
      if (!myBets.length) { myBetsEl.textContent = "No bets placed yet."; return; }
      myBetsEl.innerHTML = myBets.map((b) => `<span style="background:var(--accent);color:white;border-radius:6px;padding:3px 8px;margin:2px;display:inline-block;font-size:0.78rem">${b.betType}: ${(b.amount/100)}🪙</span>`).join("");
    }

    function startPhaseTimer(ms) {
      if (phaseTimer) clearInterval(phaseTimer);
      let rem = Math.ceil(ms / 1000);
      const tick = () => {
        phaseEl.textContent = `🎰 Betting open — ${rem}s`;
        rem--;
        if (rem < 0) { clearInterval(phaseTimer); phaseTimer = null; }
      };
      tick();
      phaseTimer = setInterval(tick, 1000);
    }

    socket = io("/multiroulette", { auth: { token: Api.getToken() } });

    socket.on("phase", ({ phase, endsAt, number, color, results, history }) => {
      if (history) {
        histEl.innerHTML = (history || []).slice(0,15).map((n) =>
          `<div style="min-width:28px;height:28px;border-radius:50%;background:${getColor(n)};display:flex;align-items:center;justify-content:center;font-size:0.75rem;font-weight:700;color:white;flex-shrink:0">${n}</div>`
        ).join("");
      }

      if (phase === "betting") {
        myBets = [];
        updateMyBets();
        ballEl.textContent = "?";
        ballEl.style.background = "var(--bg)";
        ballEl.style.borderColor = "var(--border)";
        ballEl.style.color = "var(--text)";
        resultEl.className = "result-banner";
        container.querySelectorAll(".mr-bet-btn").forEach((b) => b.disabled = false);
        const ms = Math.max(0, endsAt - Date.now());
        startPhaseTimer(ms);
      } else if (phase === "spinning") {
        phaseEl.textContent = "🎰 Ball is spinning…";
        if (phaseTimer) { clearInterval(phaseTimer); phaseTimer = null; }
        container.querySelectorAll(".mr-bet-btn").forEach((b) => b.disabled = true);
        let spin = 0;
        const spinAnim = setInterval(() => {
          spin = Math.floor(Math.random() * 37);
          ballEl.textContent = spin;
          ballEl.style.background = getColor(spin);
          ballEl.style.color = "white";
        }, 150);
        setTimeout(() => {
          clearInterval(spinAnim);
          if (number !== undefined) {
            ballEl.textContent = number;
            ballEl.style.background = getColor(number);
          }
        }, 5500);
      } else if (phase === "results") {
        ballEl.textContent = number;
        ballEl.style.background = getColor(number);
        ballEl.style.color = "white";
        ballEl.style.borderColor = getColor(number);

        const myWins = (results || []).filter((r) => r.username === state.username);
        if (myWins.length) {
          const total = myWins.reduce((s, r) => s + r.payout, 0);
          resultEl.className = "result-banner win";
          resultEl.textContent = `🎉 You win! +${(total/100).toLocaleString()} chips on ${myWins.map((r) => r.betType).join(", ")}`;
          App.refreshAccount();
        } else if (myBets.length) {
          resultEl.className = "result-banner loss";
          resultEl.textContent = `Ball landed on ${number} — no win this round.`;
        }
        phaseEl.textContent = `Result: ${number} (${getColor(number) === "#ef4444" ? "🔴 Red" : getColor(number) === "#10b981" ? "🟢 Zero" : "⚫ Black"})`;
      }
    });

    socket.on("bet_ok", () => {});
    socket.on("bets_update", (count) => {
      phaseEl.textContent = phaseEl.textContent.replace(/\d+ bet.*$/, "") + ` · ${count} bets placed`;
    });
    socket.on("error", (msg) => UI.toast(msg, "loss"));

    container.querySelectorAll(".mr-bet-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const amount = Math.round(Number(amountEl.value) * 100);
        if (amount < 100) return UI.toast("Min bet: 1 chip", "loss");
        const betType = btn.dataset.type;
        socket.emit("bet", { betType, amount });
        myBets.push({ betType, amount });
        updateMyBets();
        App.refreshAccount();
      });
    });

    GameThemes.init(container, "multiroulette");
    return () => { if (socket) socket.disconnect(); if (phaseTimer) clearInterval(phaseTimer); };
  }

  return { render };
})();
