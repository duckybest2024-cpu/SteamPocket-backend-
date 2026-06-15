const BaccaratGame = (() => {
  function render(container, accountState) {
    let busy = false;
    let betSide = "player";

    container.innerHTML = `
      <div class="game-panel"><div class="game-layout">

        <div class="bet-panel">
          <div class="bp-tabs">
            <button class="bp-tab active" id="bacc-tab-manual">Manual</button>
            <button class="bp-tab" id="bacc-tab-auto">Auto</button>
          </div>

          <div class="bp-field">
            <div class="bp-label">Bet Amount ($)</div>
            <div class="bp-input-row">
              <input type="number" id="bacc-amount" value="5.00" min="0.01" step="0.01" />
              <button class="quick-btn" id="bacc-half">½</button>
              <button class="quick-btn" id="bacc-dbl">2×</button>
            </div>
          </div>

          <div class="bp-field">
            <div class="bp-label">Bet On</div>
            <div class="toggle-group">
              <button id="bacc-player" class="active">Player</button>
              <button id="bacc-banker">Banker</button>
              <button id="bacc-tie">Tie</button>
            </div>
          </div>

          <hr class="bp-divider" />

          <button id="bacc-deal" class="play-btn" style="margin-top:auto;">Deal</button>
        </div>

        <div class="game-canvas">
          <div id="bacc-table" class="bacc-table"></div>

          <div id="bacc-result" class="result-banner"></div>
          <div id="bacc-fairness" class="fairness-line"></div>
        </div>

      </div></div>
    `;

    const els = {
      table: container.querySelector("#bacc-table"),
      amount: container.querySelector("#bacc-amount"),
      half: container.querySelector("#bacc-half"),
      dbl: container.querySelector("#bacc-dbl"),
      deal: container.querySelector("#bacc-deal"),
      result: container.querySelector("#bacc-result"),
      fairness: container.querySelector("#bacc-fairness"),
    };

    // ½ and 2× quick buttons
    els.half.addEventListener("click", () => { els.amount.value = Math.max(1, Math.floor(Number(els.amount.value) * 50) / 100); });
    els.dbl.addEventListener("click", () => { els.amount.value = Math.floor(Number(els.amount.value) * 200) / 100; });

    // Manual/Auto tabs (visual only)
    container.querySelectorAll(".bp-tab").forEach(t => t.addEventListener("click", function() {
      container.querySelectorAll(".bp-tab").forEach(x => x.classList.remove("active"));
      this.classList.add("active");
    }));

    // Side selection toggle group
    container.querySelectorAll(".toggle-group button").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (busy) return;
        betSide = btn.id === "bacc-player" ? "player" : btn.id === "bacc-banker" ? "banker" : "tie";
        container.querySelectorAll(".toggle-group button").forEach((b) => b.classList.toggle("active", b === btn));
      });
    });

    function renderTable(playerCards, bankerCards, playerTotal, bankerTotal, winner) {
      function cardsHtml(cards) {
        return cards.map((c) => UI.renderCard(c)).join("");
      }
      const pWin = winner === "player";
      const bWin = winner === "banker";
      const tie = winner === "tie";

      els.table.innerHTML = `
        <div class="bacc-side ${pWin ? "bacc-win" : tie ? "bacc-tie" : ""}">
          <div class="bacc-label">Player${pWin ? " 🏆" : tie ? " 🤝" : ""}</div>
          <div class="cards">${cardsHtml(playerCards)}</div>
          <div class="bacc-total">Total: <b>${playerTotal}</b></div>
        </div>
        <div class="bacc-vs">VS</div>
        <div class="bacc-side ${bWin ? "bacc-win" : tie ? "bacc-tie" : ""}">
          <div class="bacc-label">Banker${bWin ? " 🏆" : tie ? " 🤝" : ""}</div>
          <div class="cards">${cardsHtml(bankerCards)}</div>
          <div class="bacc-total">Total: <b>${bankerTotal}</b></div>
        </div>
      `;
    }

    function clearTable() {
      els.table.innerHTML = `
        <div class="bacc-side"><div class="bacc-label">Player</div><div class="cards bacc-placeholder">?? ??</div></div>
        <div class="bacc-vs">VS</div>
        <div class="bacc-side"><div class="bacc-label">Banker</div><div class="cards bacc-placeholder">?? ??</div></div>
      `;
    }
    clearTable();

    els.deal.addEventListener("click", async () => {
      if (busy) return;
      const amount = Math.round((Number(els.amount.value) || 0) * 100);
      if (amount <= 0) return UI.toast("Enter a bet.", "loss");

      busy = true;
      els.deal.disabled = true;
      els.result.className = "result-banner";

      try {
        const res = await Api.post("/games/baccarat", { amount, bet: betSide });
        const { playerCards, bankerCards, playerTotal, bankerTotal, winner } = res.result.state;

        renderTable(playerCards, bankerCards, playerTotal, bankerTotal, winner);

        const isWin = res.result.result === "win";
        const winnerLabel = winner === "player" ? "Player wins" : winner === "banker" ? "Banker wins" : "Tie";
        els.result.className = `result-banner show ${isWin ? "win" : "loss"}`;
        els.result.textContent = isWin
          ? `🎉 ${winnerLabel}! Paid ${UI.money(res.result.payout)}.`
          : `${winnerLabel} — you bet on ${betSide}. No win.`;

        els.fairness.innerHTML = UI.fairnessLine({ serverSeedHash: accountState.fairness?.activeServerSeedHash, clientSeed: accountState.fairness?.clientSeed });
        UI.applyAccountUpdate(accountState, res);
        UI.toast(isWin ? `Won ${UI.money(res.result.payout)} on Baccarat!` : "No win this hand.", isWin ? "win" : "info");
      } catch (err) {
        UI.toast(err.message, "loss");
      } finally {
        busy = false;
        els.deal.disabled = false;
      }
    });
  }

  return { render };
})();
