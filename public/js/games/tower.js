const TowerGame = (() => {
  const LEVELS = [1.05, 1.10, 1.20, 1.35, 1.55, 1.80, 2.15, 2.60, 3.20, 4.00, 5.00, 6.50, 8.50, 11.0, 15.0, 20.0, 30.0, 50.0, 75.0, 100.0];

  function render(container, state) {
    let socket = null;
    let active = false;
    let currentLevel = 0;
    let bet = 0;

    container.innerHTML = `
      <div class="game-layout">
        <aside class="bet-panel">
          ${GameThemes.renderPicker("tower", GameThemes.getSaved("tower"))}

          <div class="bp-tabs">
            <button class="bp-tab active">Manual</button>
            <button class="bp-tab">Auto</button>
          </div>
          <div>
            <div class="bp-label">Bet Amount</div>
            <div class="bp-input-row">
              <input id="tw-amount" type="number" value="100" min="1" step="1" />
              <button id="tw-half" class="quick-btn">&frac12;</button>
              <button id="tw-dbl" class="quick-btn">2&times;</button>
            </div>
          </div>
          <hr class="bp-divider" />
          <button id="tw-start" class="play-btn">Start Climb</button>
          <button id="tw-climb" class="play-btn" style="display:none">Climb Higher</button>
          <button id="tw-cashout" class="play-btn secondary-play" style="display:none">Cash Out</button>
        </aside>
        <div class="game-canvas">
          <div id="tw-tower" style="display:flex;flex-direction:column-reverse;gap:3px;flex:1;min-height:380px;overflow-y:auto"></div>
          <div id="tw-result" class="result-banner"></div>
        </div>
      </div>`;
    HowToPlay.addButton(container, "tower");

    const amountEl = container.querySelector("#tw-amount");
    const startBtn = container.querySelector("#tw-start");
    const climbBtn = container.querySelector("#tw-climb");
    const cashoutBtn = container.querySelector("#tw-cashout");
    const towerEl = container.querySelector("#tw-tower");
    const resultEl = container.querySelector("#tw-result");

    container.querySelector("#tw-half").addEventListener("click", () => {
      amountEl.value = Math.max(1, Math.floor(Number(amountEl.value) * 0.5));
    });
    container.querySelector("#tw-dbl").addEventListener("click", () => {
      amountEl.value = Math.floor(Number(amountEl.value) * 2);
    });
    container.querySelectorAll(".bp-tab").forEach(t =>
      t.addEventListener("click", function() {
        container.querySelectorAll(".bp-tab").forEach(x => x.classList.remove("active"));
        this.classList.add("active");
      })
    );

    function renderTower(level) {
      towerEl.innerHTML = LEVELS.map((mult, i) => {
        const floor = i + 1;
        const isActive = floor === level;
        const isPassed = floor < level;
        let bg = "var(--bg-elev)";
        let border = "var(--border)";
        let color = "var(--text-dim)";
        if (isActive) { bg = "var(--accent)"; border = "var(--accent)"; color = "white"; }
        else if (isPassed) { bg = "rgba(52,211,153,0.15)"; border = "var(--win)"; color = "var(--win)"; }

        return `<div style="display:flex;align-items:center;justify-content:space-between;padding:7px 12px;border-radius:8px;background:${bg};border:1px solid ${border};color:${color};font-size:0.85rem;transition:all 0.3s">
          <span style="font-weight:700">Floor ${floor}</span>
          <span>${isPassed ? "✅" : isActive ? "👤" : ""}</span>
          <span style="font-weight:700;color:${isActive ? "white" : "var(--gold)"}">×${mult}</span>
          <span style="font-size:0.75rem">${(bet > 0 ? (bet * mult / 100).toFixed(0) : "—")} 🪙</span>
        </div>`;
      }).join("");
    }

    socket = io("/tower", { auth: { token: Api.getToken() } });

    socket.on("tower_state", ({ level, multiplier, maxLevels }) => {
      active = true;
      currentLevel = level;
      renderTower(level);
      amountEl.disabled = true;
      startBtn.style.display = "none";
      climbBtn.style.display = "";
      cashoutBtn.style.display = "";
      cashoutBtn.textContent = `Cash Out (×${multiplier} = ${(bet * multiplier / 100).toFixed(0)} 🪙)`;
      resultEl.className = "result-banner";
      if (level === 0) resultEl.textContent = "";
      else resultEl.textContent = `Floor ${level} — multiplier: ×${multiplier}`;
    });

    socket.on("tower_fail", ({ level }) => {
      active = false;
      currentLevel = 0;
      resultEl.className = "result-banner loss";
      resultEl.textContent = `💥 Floor ${level + 1} collapsed! You lost ${(bet / 100).toFixed(0)} chips.`;
      reset();
    });

    socket.on("tower_cashout", ({ multiplier, payout }) => {
      active = false;
      currentLevel = 0;
      resultEl.className = "result-banner win";
      resultEl.textContent = `💰 Cashed out at ×${multiplier} — +${(payout / 100).toLocaleString()} chips!`;
      App.refreshAccount();
      reset();
    });

    socket.on("error", (msg) => { UI.toast(msg, "loss"); if (!active) reset(); });

    function reset() {
      amountEl.disabled = false;
      startBtn.style.display = "";
      climbBtn.style.display = "none";
      cashoutBtn.style.display = "none";
      renderTower(0);
    }

    startBtn.addEventListener("click", () => {
      bet = Math.round(Number(amountEl.value) * 100);
      if (bet < 100) return UI.toast("Min bet: 1 chip", "loss");
      socket.emit("start", { amount: bet });
      renderTower(0);
    });

    climbBtn.addEventListener("click", () => { socket.emit("climb"); });
    cashoutBtn.addEventListener("click", () => { socket.emit("cashout"); });

    renderTower(0);
    GameThemes.init(container, "tower");

    return () => { if (socket) socket.disconnect(); };
  }

  return { render };
})();
