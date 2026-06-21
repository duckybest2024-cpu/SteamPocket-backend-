const HiloGame = (() => {
  function render(container, accountState) {
    let inRound = false;
    let busy = false;
    let currentMultiplier = 1;

    container.innerHTML = `
      <div class="game-panel"><div class="game-layout">

        <div class="bet-panel">
          <div class="bp-tabs">
            <button class="bp-tab active" id="hilo-tab-manual">Manual</button>
            <button class="bp-tab" id="hilo-tab-auto">Auto</button>
          </div>

          <div class="bp-field">
            <div class="bp-label">Bet ($)</div>
            <div class="bp-input-row">
              <input type="number" id="hilo-amount" value="5.00" min="0.01" step="0.01" style="flex:1;" />
              <button class="quick-btn" id="hilo-half">½</button>
              <button class="quick-btn" id="hilo-dbl">2×</button>
            </div>
          </div>

          <hr class="bp-divider" />

          <div class="bp-field">
            <div class="bp-label">Multiplier</div>
            <div id="hilo-multi" class="hilo-multi" style="font-size:1.3rem; font-weight:800;">1.00×</div>
          </div>

          <div class="bp-bottom">
            <div id="hilo-start-row"><button id="hilo-start" class="play-btn">Start Round</button></div>
          </div>
        </div>

        <div class="game-canvas">
          <div class="hilo-stage">
            <div class="hilo-card-wrap">
              <div class="hilo-card-slot" id="hilo-card">
                <img class="card-svg hilo-card-img" src="/images/card-back.png" alt="Card" />
              </div>
            </div>
          </div>

          <div id="hilo-chances" class="hilo-chances" style="justify-content:center;"></div>

          <div class="btn-row hidden" id="hilo-action-row" style="justify-content:center; gap:12px;">
            <button id="hilo-higher" class="primary-btn" style="flex:1; padding:16px 0;">⬆ Higher</button>
            <button id="hilo-lower"  class="danger-btn"  style="flex:1; padding:16px 0;">⬇ Lower</button>
            <button id="hilo-cashout" class="secondary-btn">Cash Out</button>
          </div>

          <div id="hilo-result" class="result-banner"></div>
          <div id="hilo-fairness"></div>
        </div>

      </div></div>
    `;

    const els = {
      card: container.querySelector("#hilo-card"),
      multi: container.querySelector("#hilo-multi"),
      chances: container.querySelector("#hilo-chances"),
      amount: container.querySelector("#hilo-amount"),
      startRow: container.querySelector("#hilo-start-row"),
      actionRow: container.querySelector("#hilo-action-row"),
      start: container.querySelector("#hilo-start"),
      higher: container.querySelector("#hilo-higher"),
      lower: container.querySelector("#hilo-lower"),
      cashout: container.querySelector("#hilo-cashout"),
      result: container.querySelector("#hilo-result"),
      fairness: container.querySelector("#hilo-fairness"),
      half: container.querySelector("#hilo-half"),
      dbl: container.querySelector("#hilo-dbl"),
    };

    // ½ and 2× quick buttons
    els.half.addEventListener("click", () => { els.amount.value = Math.max(0.01, Math.floor(Number(els.amount.value) * 0.5 * 100) / 100); });
    els.dbl.addEventListener("click", () => { els.amount.value = Math.floor(Number(els.amount.value) * 2 * 100) / 100; });

    // Manual/Auto tabs (visual only)
    container.querySelectorAll(".bp-tab").forEach(t => t.addEventListener("click", function() {
      container.querySelectorAll(".bp-tab").forEach(x => x.classList.remove("active"));
      this.classList.add("active");
    }));

    const SUIT_LETTER = {"♠":"S","♥":"H","♦":"D","♣":"C"};
    function renderCard(card) {
      const letter = SUIT_LETTER[card.suit] || "S";
      return `<img class="card-svg hilo-card-img" src="/images/cards/${card.rank}${letter}.svg" alt="${card.rank}${card.suit}" />`;
    }

    function updateChances(higher, lower) {
      els.chances.innerHTML = `
        <span class="chance-badge up">⬆ ${Math.round(higher * 100)}%</span>
        <span class="chance-badge down">⬇ ${Math.round(lower * 100)}%</span>
      `;
    }

    function setMultiplier(m) {
      currentMultiplier = m;
      els.multi.textContent = m.toFixed(2) + "×";
    }

    function enterRound() {
      inRound = true;
      els.startRow.classList.add("hidden");
      els.actionRow.classList.remove("hidden");
      els.amount.disabled = true;
    }

    function exitRound() {
      inRound = false;
      els.actionRow.classList.add("hidden");
      els.startRow.classList.remove("hidden");
      els.amount.disabled = false;
      els.card.innerHTML = `<img class="card-svg hilo-card-img" src="/images/card-back.png" alt="Card" />`;
      els.chances.innerHTML = "";
      setMultiplier(1);
    }

    els.start.addEventListener("click", async () => {
      if (busy || inRound) return;
      const amount = Math.round((Number(els.amount.value) || 0) * 100);
      if (amount <= 0) return UI.toast("Enter a bet.", "loss");

      busy = true;
      els.start.disabled = true;
      els.result.className = "result-banner";

      try {
        const res = await Api.post("/games/hilo/start", { amount });
        enterRound();
        els.card.innerHTML = renderCard(res.card);
        setMultiplier(res.currentMultiplier);
        updateChances(res.higherChance, res.lowerChance);
        els.fairness.innerHTML = UI.fairnessLine(res.fairness);
        UI.applyAccountUpdate(accountState, res);
      } catch (err) {
        UI.toast(err.message, "loss");
      } finally {
        busy = false;
        els.start.disabled = false;
      }
    });

    async function doAction(action) {
      if (busy || !inRound) return;
      busy = true;
      [els.higher, els.lower, els.cashout].forEach((b) => (b.disabled = true));

      try {
        const res = await Api.post("/games/hilo/action", { action });

        if (res.card) els.card.innerHTML = renderCard(res.card);
        if (res.currentMultiplier !== undefined) setMultiplier(res.currentMultiplier);
        if (res.higherChance !== undefined) updateChances(res.higherChance, res.lowerChance);

        if (res.finished) {
          const isWin = res.outcome !== "bust";
          els.result.className = `result-banner show ${isWin ? "win" : "loss"}`;
          if (action === "cashout") {
            els.result.textContent = `💰 Cashed out at ${currentMultiplier.toFixed(2)}x — paid ${UI.money(res.payout)}!`;
          } else if (res.outcome === "bust") {
            els.result.textContent = `💥 Wrong guess! You busted — lost your bet.`;
          } else {
            els.result.textContent = `🎉 Paid ${UI.money(res.payout)}.`;
          }
          UI.applyAccountUpdate(accountState, res);
          UI.toast(isWin ? `Won ${UI.money(res.payout)} on Hi-Lo!` : "Busted on Hi-Lo.", isWin ? "win" : "loss");
          exitRound();
        } else if (res.push) {
          UI.toast("Push — same rank, multiplier unchanged.", "info");
        }
      } catch (err) {
        UI.toast(err.message, "loss");
      } finally {
        busy = false;
        [els.higher, els.lower, els.cashout].forEach((b) => (b.disabled = false));
      }
    }

    els.higher.addEventListener("click", () => doAction("higher"));
    els.lower.addEventListener("click", () => doAction("lower"));
    els.cashout.addEventListener("click", () => doAction("cashout"));

    // Attempt to resume any active round on mount
    (async () => {
      try {
        const res = await Api.get("/games/hilo/active");
        enterRound();
        els.card.innerHTML = renderCard(res.card);
        setMultiplier(res.currentMultiplier);
        updateChances(res.higherChance, res.lowerChance);
        els.fairness.innerHTML = UI.fairnessLine(res.fairness);
      } catch {
        // No active round — that's fine
      }
    })();
  }

  return { render };
})();
