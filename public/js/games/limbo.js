const LimboGame = (() => {
  function render(container, accountState) {
    let limboHistory = [];

    container.innerHTML = `
      <div class="game-panel"><div class="game-layout">

        <aside class="bet-panel">
          <div class="bp-tabs">
            <button class="bp-tab active" id="limbo-tab-manual">Manual</button>
            <button class="bp-tab" id="limbo-tab-auto">Auto</button>
          </div>

          <div class="bp-field">
            <label class="bp-label">Bet Amount ($)</label>
            <div class="bp-input-row">
              <input type="number" id="limbo-amount" value="10" min="0.01" step="0.01" />
              <button class="quick-btn" id="limbo-half">½</button>
              <button class="quick-btn" id="limbo-dbl">2×</button>
            </div>
          </div>

          <div class="bp-field">
            <label class="bp-label">Target Multiplier</label>
            <input type="number" id="limbo-target" value="2.00" min="1.01" step="0.01" />
          </div>

          <div class="bp-field">
            <label class="bp-label">Win Chance</label>
            <input type="text" id="limbo-wc" value="49.50%" disabled />
          </div>

          <hr class="bp-divider" />

          <div class="bp-bottom">
            <button class="play-btn" id="limbo-bet">Bet</button>
          </div>
        </aside>

        <div class="game-canvas">
          <div class="limbo-history" id="limbo-history"></div>

          <div class="roll-display"><span id="limbo-number" class="roll-number">--x</span></div>

          <div id="limbo-result" class="result-banner"></div>
          <div id="limbo-fairness" class="fairness-line"></div>
        </div>

      </div></div>
    `;
    HowToPlay.addButton(container, "limbo");

    const els = {
      number: container.querySelector("#limbo-number"),
      amount: container.querySelector("#limbo-amount"),
      half: container.querySelector("#limbo-half"),
      dbl: container.querySelector("#limbo-dbl"),
      target: container.querySelector("#limbo-target"),
      chance: container.querySelector("#limbo-wc"),
      play: container.querySelector("#limbo-bet"),
      history: container.querySelector("#limbo-history"),
      result: container.querySelector("#limbo-result"),
      fairness: container.querySelector("#limbo-fairness"),
    };

    function refreshChance() {
      const target = Math.max(1.01, Number(els.target.value) || 1.01);
      // Mirrors the server's curve: P(crashAt >= target) = (1 - houseEdge) / target
      const chance = Math.min(100, ((1 - 0.01) / target) * 100);
      els.chance.value = `${chance.toFixed(2)}%`;
    }
    els.target.addEventListener("input", refreshChance);

    // ½ and 2× quick buttons
    els.half.addEventListener("click", () => {
      els.amount.value = Math.max(1, Math.floor(Number(els.amount.value) * 50) / 100);
    });
    els.dbl.addEventListener("click", () => {
      els.amount.value = Math.floor(Number(els.amount.value) * 200) / 100;
    });

    // Manual/Auto tabs (visual only)
    container.querySelectorAll(".bp-tab").forEach(t => t.addEventListener("click", function() {
      container.querySelectorAll(".bp-tab").forEach(x => x.classList.remove("active"));
      this.classList.add("active");
    }));

    els.play.addEventListener("click", async () => {
      const dollars = Number(els.amount.value);
      const targetMultiplier = Number(els.target.value);
      if (!dollars || dollars <= 0) return UI.toast("Enter a bet amount.", "loss");
      if (!targetMultiplier || targetMultiplier < 1.01) return UI.toast("Target must be at least 1.01x.", "loss");

      const amount = Math.round(dollars * 100);
      els.play.disabled = true;
      els.number.textContent = "…";
      els.number.className = "roll-number";

      try {
        const res = await Api.post("/games/limbo", { amount, targetMultiplier });
        const crashAt = res.result.state.crashAt;
        const isWin = res.result.result === "win";

        animateCountUp(els.number, crashAt, isWin);

        els.result.className = `result-banner show ${isWin ? "win" : "loss"}`;
        els.result.textContent = isWin
          ? `🎉 Crashed at ${crashAt}x — your ${targetMultiplier}x call landed! Won ${UI.money(res.result.payout)}.`
          : `Crashed at ${crashAt}x — short of your ${targetMultiplier}x call. Lost ${UI.money(amount)}.`;

        els.fairness.innerHTML = UI.fairnessLine({
          serverSeedHash: accountState.fairness?.activeServerSeedHash,
          clientSeed: accountState.fairness?.clientSeed,
          nonce: res.nextNonce - 1,
        });

        // Update history chips
        limboHistory.unshift(crashAt);
        if (limboHistory.length > 10) limboHistory.pop();
        const histEl = els.history;
        histEl.innerHTML = limboHistory.map(v => {
          const cls = v < 2 ? "lhc-low" : v < 10 ? "lhc-mid" : "lhc-high";
          return `<span class="lh-chip ${cls}">${v.toFixed(2)}×</span>`;
        }).join("");

        UI.applyAccountUpdate(accountState, res);
        UI.toast(isWin ? `Won ${UI.money(res.result.payout)} on Limbo!` : `Lost ${UI.money(amount)} on Limbo.`, isWin ? "win" : "loss");
      } catch (err) {
        UI.toast(err.message, "loss");
      } finally {
        els.play.disabled = false;
      }
    });

    function animateCountUp(node, target, isWin) {
      const duration = 700;
      const start = performance.now();
      function frame(now) {
        const t = Math.min(1, (now - start) / duration);
        const value = 1 + (target - 1) * t;
        node.textContent = `${value.toFixed(2)}x`;
        if (t < 1) requestAnimationFrame(frame);
        else node.className = `roll-number ${isWin ? "win" : "loss"}`;
      }
      requestAnimationFrame(frame);
    }

    refreshChance();
  }

  return { render };
})();
