const KenoGame = (() => {
  const PAYOUT_TABLE = {
    2:  { 2: 11 },
    3:  { 2: 2,  3: 26 },
    4:  { 2: 1,  3: 4,   4: 55 },
    5:  {        3: 2,   4: 11,  5: 90 },
    6:  {        3: 1,   4: 5,   5: 30,   6: 450 },
    7:  {        4: 3,   5: 15,  6: 80,   7: 650 },
    8:  {        4: 2,   5: 8,   6: 40,   7: 250,  8: 1800 },
    9:  {        4: 1,   5: 5,   6: 18,   7: 70,   8: 500,  9: 2800 },
    10: {        5: 4,   6: 13,  7: 35,   8: 120,  9: 800, 10: 4000 },
  };

  function render(container, accountState) {
    let picks = new Set();
    let busy = false;

    container.innerHTML = `
      <div class="game-panel"><div class="game-layout">

        <div class="bet-panel">
          <div class="bp-tabs">
            <button class="bp-tab active" id="keno-tab-manual">Manual</button>
            <button class="bp-tab" id="keno-tab-auto">Auto</button>
          </div>

          <div class="bp-field">
            <div class="bp-label">Bet ($)</div>
            <div class="bp-input-row">
              <input type="number" id="keno-amount" value="1.00" min="0.01" step="0.01" style="flex:1;" />
              <button class="quick-btn" id="keno-half">½</button>
              <button class="quick-btn" id="keno-dbl">2×</button>
            </div>
          </div>

          <div class="bp-field">
            <div class="bp-label">Picks selected</div>
            <div id="keno-pick-hint" style="color: var(--text-dim); font-size: 0.85rem;">Select 2–10 numbers</div>
          </div>

          <hr class="bp-divider" />

          <div id="keno-paytable" style="flex:1; overflow-y:auto; font-size:0.78rem;"></div>

          <div class="bp-bottom">
            <button id="keno-play" class="play-btn" disabled>Play Keno</button>
            <button id="keno-clear" class="play-btn secondary-play">Clear</button>
          </div>
        </div>

        <div class="game-canvas">
          <div class="keno-grid" id="keno-grid"></div>
          <div id="keno-result" class="result-banner"></div>
          <div id="keno-fairness"></div>
        </div>

      </div></div>
    `;

    const els = {
      grid: container.querySelector("#keno-grid"),
      amount: container.querySelector("#keno-amount"),
      pickHint: container.querySelector("#keno-pick-hint"),
      play: container.querySelector("#keno-play"),
      clear: container.querySelector("#keno-clear"),
      paytable: container.querySelector("#keno-paytable"),
      result: container.querySelector("#keno-result"),
      fairness: container.querySelector("#keno-fairness"),
      half: container.querySelector("#keno-half"),
      dbl: container.querySelector("#keno-dbl"),
    };

    // ½ and 2× quick buttons
    els.half.addEventListener("click", () => { els.amount.value = Math.max(0.01, Math.floor(Number(els.amount.value) * 0.5 * 100) / 100); });
    els.dbl.addEventListener("click", () => { els.amount.value = Math.floor(Number(els.amount.value) * 2 * 100) / 100; });

    // Manual/Auto tabs (visual only)
    container.querySelectorAll(".bp-tab").forEach(t => t.addEventListener("click", function() {
      container.querySelectorAll(".bp-tab").forEach(x => x.classList.remove("active"));
      this.classList.add("active");
    }));

    // Build 80-number grid
    for (let n = 1; n <= 80; n++) {
      const cell = document.createElement("div");
      cell.className = "keno-cell";
      cell.textContent = n;
      cell.dataset.n = n;
      cell.addEventListener("click", () => {
        if (busy) return;
        if (picks.has(n)) {
          picks.delete(n);
          cell.classList.remove("selected");
        } else if (picks.size < 10) {
          picks.add(n);
          cell.classList.add("selected");
        }
        updateUI();
      });
      els.grid.appendChild(cell);
    }

    function updateUI() {
      const cnt = picks.size;
      els.pickHint.textContent = picks.size === 0 ? "Select 2–10 numbers" :
        picks.size < 2 ? `${picks.size} selected — pick ${2 - picks.size} more` :
        `${picks.size}/10 selected`;
      els.play.disabled = busy || cnt < 2;
      renderPaytable(cnt);
    }

    function renderPaytable(spots) {
      if (spots < 2) { els.paytable.innerHTML = ""; return; }
      const table = PAYOUT_TABLE[spots] || {};
      const rows = Object.entries(table)
        .sort((a, b) => Number(a[0]) - Number(b[0]))
        .map(([hits, multi]) => `<div class="pt-row"><span>${hits} hits</span><span>${multi}x</span></div>`)
        .join("");
      els.paytable.innerHTML = `<div class="pt-head">${spots} spots pay table</div>${rows}`;
    }

    els.clear.addEventListener("click", () => {
      if (busy) return;
      picks.clear();
      container.querySelectorAll(".keno-cell").forEach((c) => {
        c.classList.remove("selected", "hit", "drawn");
      });
      els.result.className = "result-banner";
      updateUI();
    });

    els.play.addEventListener("click", async () => {
      if (busy || picks.size < 2) return;
      const amount = Math.round((Number(els.amount.value) || 0) * 100);
      if (amount <= 0) return UI.toast("Enter a bet.", "loss");

      busy = true;
      els.play.disabled = true;
      els.result.className = "result-banner";
      container.querySelectorAll(".keno-cell").forEach((c) => c.classList.remove("hit", "drawn"));

      try {
        const res = await Api.post("/games/keno", { amount, picks: [...picks] });
        const { picks: picksRes, drawn, hits, hitCount, multiplier } = res.result.state;
        const drawnSet = new Set(drawn);
        const hitsSet = new Set(hits);

        // Animate: reveal drawn numbers one by one
        let i = 0;
        const drawInterval = setInterval(() => {
          if (i >= drawn.length) {
            clearInterval(drawInterval);
            finalize();
            return;
          }
          const num = drawn[i++];
          const cell = els.grid.querySelector(`[data-n="${num}"]`);
          if (cell) cell.classList.add(hitsSet.has(num) ? "hit" : "drawn");
        }, 60);

        function finalize() {
          const isWin = res.result.result === "win";
          els.result.className = `result-banner show ${isWin ? "win" : "loss"}`;
          els.result.textContent = isWin
            ? `🎉 ${hitCount} hit${hitCount !== 1 ? "s" : ""} — ${multiplier}x — paid ${UI.money(res.result.payout)}!`
            : `${hitCount} hit${hitCount !== 1 ? "s" : ""} — no win this round.`;
          els.fairness.innerHTML = UI.fairnessLine({ serverSeedHash: accountState.fairness?.activeServerSeedHash, clientSeed: accountState.fairness?.clientSeed });
          UI.applyAccountUpdate(accountState, res);
          UI.toast(isWin ? `Won ${UI.money(res.result.payout)} on Keno!` : "No win this round.", isWin ? "win" : "info");
          busy = false;
          updateUI();
        }
      } catch (err) {
        UI.toast(err.message, "loss");
        busy = false;
        updateUI();
      }
    });

    updateUI();
  }

  return { render };
})();
