const MinesGame = (() => {
  function render(container, accountState) {
    let active = null; // { amount, mineCount, revealed, currentMultiplier, nextMultiplier }
    let busy = false;
    let roundActive = false;

    container.innerHTML = `
      <div class="game-layout">

          <div class="bet-panel">
            <div class="bp-tabs">
              <button class="bp-tab active" id="mines-tab-manual">Manual</button>
              <button class="bp-tab" id="mines-tab-auto">Auto</button>
            </div>

            <div class="bp-field">
              <div class="bp-label">Bet Amount</div>
              <div class="bp-input-row">
                <input type="number" id="mines-amount" value="10" min="0.01" step="0.01" />
                <button class="quick-btn" id="mines-half">½</button>
                <button class="quick-btn" id="mines-dbl">2×</button>
              </div>
            </div>

            <div class="bp-field">
              <div class="bp-label">Mines</div>
              <div class="mine-opts">
                <button class="mine-opt active" data-count="3">3</button>
                <button class="mine-opt" data-count="5">5</button>
                <button class="mine-opt" data-count="10">10</button>
                <button class="mine-opt" data-count="15">15</button>
                <button class="mine-opt" data-count="20">20</button>
              </div>
              <input type="hidden" id="mines-count" value="3" />
            </div>

            <div class="bp-bottom">
              <button id="mines-start" class="play-btn">Start Round</button>
              <button id="mines-cashout" class="play-btn secondary-play" disabled>Cash Out 0.00×</button>
            </div>
          </div>

          <div class="game-canvas">
            <div id="mines-stats" style="text-align:center; color: var(--text-dim); font-size:0.85rem;"></div>
            <div class="mines-grid" id="mines-grid"></div>
            <div id="mines-result" class="result-banner"></div>
            <div id="mines-fairness" class="fairness-line"></div>
          </div>

        </div>
    `;

    const els = {
      grid: container.querySelector("#mines-grid"),
      stats: container.querySelector("#mines-stats"),
      amount: container.querySelector("#mines-amount"),
      half: container.querySelector("#mines-half"),
      dbl: container.querySelector("#mines-dbl"),
      count: container.querySelector("#mines-count"),
      start: container.querySelector("#mines-start"),
      cashout: container.querySelector("#mines-cashout"),
      result: container.querySelector("#mines-result"),
      fairness: container.querySelector("#mines-fairness"),
    };

    // Wire ½ and 2× buttons
    els.half.addEventListener("click", () => {
      els.amount.value = Math.max(0.01, Math.floor(Number(els.amount.value) * 0.5 * 100) / 100);
    });
    els.dbl.addEventListener("click", () => {
      els.amount.value = Math.floor(Number(els.amount.value) * 2 * 100) / 100;
    });

    // Wire Manual/Auto tabs (visual only)
    container.querySelectorAll(".bp-tab").forEach(t => t.addEventListener("click", function() {
      container.querySelectorAll(".bp-tab").forEach(x => x.classList.remove("active"));
      this.classList.add("active");
    }));

    // Wire mine-opt quick-select buttons
    container.querySelectorAll(".mine-opt").forEach(opt => {
      opt.addEventListener("click", () => {
        if (roundActive) return;
        container.querySelectorAll(".mine-opt").forEach(o => o.classList.remove("active"));
        opt.classList.add("active");
        els.count.value = opt.dataset.count;
      });
    });

    function buildGrid() {
      els.grid.innerHTML = "";
      for (let i = 0; i < 25; i++) {
        const tile = UI.el("button", { class: "mine-tile", onclick: () => revealTile(i) }, "");
        tile.dataset.index = i;
        els.grid.appendChild(tile);
      }
    }

    function setControlsForRound(inRound) {
      roundActive = inRound;
      els.amount.disabled = inRound;
      els.start.classList.toggle("hidden", inRound);
      els.cashout.disabled = !inRound;
      container.querySelectorAll(".mine-opt").forEach(o => {
        o.style.opacity = inRound ? "0.4" : "1";
        o.style.pointerEvents = inRound ? "none" : "";
      });
    }

    function refreshStats() {
      if (!active) {
        els.stats.textContent = "";
        els.cashout.textContent = "Cash Out 0.00×";
        return;
      }
      els.stats.innerHTML = `Current multiplier: <strong style="color:var(--win)">${active.currentMultiplier.toFixed(2)}x</strong>` +
        `&nbsp;·&nbsp; Next safe tile: <strong>${active.nextMultiplier ? active.nextMultiplier.toFixed(2) + "x" : "--"}</strong>` +
        `&nbsp;·&nbsp; Potential payout: <strong>${UI.money(Math.floor(active.amount * active.currentMultiplier))}</strong>`;
      els.cashout.textContent = `Cash Out ${active.currentMultiplier.toFixed(2)}×`;
    }

    function paintTile(index, kind, glyph) {
      const tile = els.grid.querySelector(`[data-index="${index}"]`);
      tile.classList.add("revealed", kind, "disabled");
      tile.textContent = glyph;
    }

    function showFairness(round) {
      els.fairness.innerHTML = UI.fairnessLine({
        serverSeedHash: round.serverSeedHash,
        clientSeed: round.clientSeed,
        nonce: round.nonce,
      });
    }

    els.start.addEventListener("click", async () => {
      if (busy) return;
      const dollars = Number(els.amount.value);
      const mineCount = Number(els.count.value);
      if (!dollars || dollars <= 0) return UI.toast("Enter a bet amount.", "loss");
      if (!Number.isInteger(mineCount) || mineCount < 1 || mineCount > 24) return UI.toast("Mines must be 1-24.", "loss");

      busy = true;
      try {
        const res = await Api.post("/games/mines/start", { amount: Math.round(dollars * 100), mineCount });
        active = res.round;
        accountState.balance = res.balance;
        UI.setBalance(res.balance);

        buildGrid();
        els.result.className = "result-banner";
        refreshStats();
        showFairness(active);
        setControlsForRound(true);
        UI.toast(`Round started — ${mineCount} mines hidden in the grid. Pick a tile!`, "info");
      } catch (err) {
        UI.toast(err.message, "loss");
      } finally {
        busy = false;
      }
    });

    async function revealTile(index) {
      if (busy || !active) return;
      if (active.revealed.includes(index)) return;

      busy = true;
      try {
        const res = await Api.post("/games/mines/reveal", { tile: index });

        if (res.outcome === "bust") {
          paintTile(index, "mine", "💥");
          for (const m of res.round.mines) if (m !== index) paintTile(m, "mine", "💣");
          for (const r of active.revealed) paintTile(r, "safe", "💎");

          els.result.className = "result-banner show loss";
          els.result.textContent = `💥 Boom — tile ${index} was a mine. Lost ${UI.money(active.amount)}.`;
          UI.toast(`Hit a mine — lost ${UI.money(active.amount)}.`, "loss");

          UI.applyAccountUpdate(accountState, res);
          finishRound();
          return;
        }

        active.revealed.push(index);
        active.currentMultiplier = res.multiplier;
        paintTile(index, "safe", "💎");

        if (res.outcome === "cleared") {
          active.currentMultiplier = res.multiplier;
          for (const m of res.round.mines) paintTile(m, "mine", "🚩");
          els.result.className = "result-banner show win";
          els.result.textContent = `🏆 Board cleared! Cashed out at ${res.multiplier.toFixed(2)}x for ${UI.money(res.payout)}.`;
          UI.toast(`Cleared the board — won ${UI.money(res.payout)}!`, "win");
          UI.applyAccountUpdate(accountState, res);
          finishRound();
          return;
        }

        active.nextMultiplier = res.nextMultiplier;
        refreshStats();
        setControlsForRound(true);
      } catch (err) {
        UI.toast(err.message, "loss");
      } finally {
        busy = false;
      }
    }

    els.cashout.addEventListener("click", async () => {
      if (busy || !active) return;
      busy = true;
      try {
        const res = await Api.post("/games/mines/cashout", {});
        for (const m of res.round.mines) {
          if (!active.revealed.includes(m)) paintTile(m, "mine", "🚩");
        }
        els.result.className = "result-banner show win";
        els.result.textContent = `💰 Cashed out at ${res.multiplier.toFixed(2)}x for ${UI.money(res.payout)}.`;
        UI.toast(`Cashed out — won ${UI.money(res.payout)}!`, "win");
        UI.applyAccountUpdate(accountState, res);
        finishRound();
      } catch (err) {
        UI.toast(err.message, "loss");
      } finally {
        busy = false;
      }
    });

    function finishRound() {
      active = null;
      setControlsForRound(false);
      refreshStats();
      for (const tile of els.grid.querySelectorAll(".mine-tile")) tile.classList.add("disabled");
    }

    async function resumeIfActive() {
      try {
        const { round } = await Api.get("/games/mines/active");
        active = round;
        buildGrid();
        for (const r of active.revealed) paintTile(r, "safe", "💎");
        refreshStats();
        showFairness(active);
        setControlsForRound(true);
        UI.toast("Resumed your in-progress mines round.", "info");
      } catch {
        buildGrid();
        setControlsForRound(false);
      }
    }

    resumeIfActive();
  }

  return { render };
})();
