const BlackjackGame = (() => {
  function render(container, accountState) {
    let inRound = false;
    let busy = false;

    container.innerHTML = `
      <div class="game-panel"><div class="game-layout">

        <div class="bet-panel">
          <div class="bp-tabs">
            <button class="bp-tab active" id="bj-tab-manual">Manual</button>
            <button class="bp-tab" id="bj-tab-auto">Auto</button>
          </div>

          <div class="bp-field">
            <div class="bp-label">Bet Amount ($)</div>
            <div class="bp-input-row">
              <input type="number" id="bj-amount" value="10" min="0.01" step="0.01" />
              <button class="quick-btn" id="bj-half">½</button>
              <button class="quick-btn" id="bj-dbl">2×</button>
            </div>
          </div>

          <hr class="bp-divider" />

          <div id="bj-deal-row">
            <button id="bj-deal" class="play-btn">Deal</button>
          </div>
        </div>

        <div class="game-canvas">
          <div class="bj-area" id="bj-table"></div>

          <div class="btn-row hidden" id="bj-action-row" style="flex-wrap:wrap;">
            <button id="bj-hit" class="primary-btn">Hit</button>
            <button id="bj-stand" class="secondary-btn">Stand</button>
            <button id="bj-double" class="secondary-btn">Double</button>
            <button id="bj-split" class="secondary-btn">Split</button>
            <button id="bj-surrender" class="secondary-btn">Surrender</button>
            <button id="bj-insurance" class="secondary-btn hidden">Insurance</button>
          </div>

          <div id="bj-result" class="result-banner"></div>
          <div id="bj-fairness" class="fairness-line"></div>
        </div>

      </div></div>
    `;

    HowToPlay.addButton(container, "blackjack");

    const els = {
      table: container.querySelector("#bj-table"),
      amount: container.querySelector("#bj-amount"),
      half: container.querySelector("#bj-half"),
      dbl: container.querySelector("#bj-dbl"),
      dealRow: container.querySelector("#bj-deal-row"),
      actionRow: container.querySelector("#bj-action-row"),
      deal: container.querySelector("#bj-deal"),
      hit: container.querySelector("#bj-hit"),
      stand: container.querySelector("#bj-stand"),
      double: container.querySelector("#bj-double"),
      split: container.querySelector("#bj-split"),
      surrender: container.querySelector("#bj-surrender"),
      insurance: container.querySelector("#bj-insurance"),
      result: container.querySelector("#bj-result"),
      fairness: container.querySelector("#bj-fairness"),
    };

    // ½ and 2× quick buttons
    els.half.addEventListener("click", () => { els.amount.value = Math.max(1, Math.floor(Number(els.amount.value) * 50) / 100); });
    els.dbl.addEventListener("click", () => { els.amount.value = Math.floor(Number(els.amount.value) * 200) / 100; });

    // Manual/Auto tabs (visual only)
    container.querySelectorAll(".bp-tab").forEach(t => t.addEventListener("click", function() {
      container.querySelectorAll(".bp-tab").forEach(x => x.classList.remove("active"));
      this.classList.add("active");
    }));

    const STATUS_LABEL = {
      playing: "Playing", stood: "Stood", bust: "Bust", blackjack: "Blackjack!",
      surrendered: "Surrendered", win: "Won", loss: "Lost", push: "Push", "blackjack-pay": "Blackjack pays 3:2",
    };

    function renderHandRow(label, hand, isActive, settlement) {
      const statusClass = settlement ? settlement.outcome : hand.status;
      const value = hand.value ? `${hand.value.total}${hand.value.soft ? " (soft)" : ""}` : "";
      return `
        <div class="hand-row ${isActive ? "active" : ""} ${statusClass}">
          <h4>${label} — ${UI.money(hand.bet)} ${settlement ? `· ${STATUS_LABEL[settlement.outcome] || settlement.outcome}${settlement.payout ? ` (+${UI.money(settlement.payout)})` : ""}` : `· ${STATUS_LABEL[hand.status] || hand.status}`}</h4>
          <div class="cards">${hand.cards.map((c) => UI.renderCard(c)).join("")}</div>
          <div class="hand-meta">Total: ${value}</div>
        </div>
      `;
    }

    function renderTable(table, settlements) {
      const dealerCards = table.dealer.cards.map((c, i) =>
        UI.renderCard(c, table.dealer.holeHidden && i === 1)
      ).join("");
      const dealerValue = table.dealer.value ? `${table.dealer.value.total}${table.dealer.value.soft ? " (soft)" : ""}` : "?";

      const handsHtml = table.hands.map((hand, i) =>
        renderHandRow(table.hands.length > 1 ? `Hand ${i + 1}` : "Your hand", hand, i === table.activeHand && table.status === "player_turn", settlements?.find((s) => s.handIndex === i))
      ).join("");

      els.table.innerHTML = `
        <div class="hand-row">
          <h4>Dealer ${table.dealer.holeHidden ? "" : `— ${dealerValue}`}</h4>
          <div class="cards">${dealerCards}</div>
        </div>
        ${handsHtml}
      `;
    }

    function setActionAvailability(table) {
      const hand = table.hands[table.activeHand];
      els.hit.disabled = !hand?.canHit;
      els.stand.disabled = !hand?.canStand;
      els.double.disabled = !hand?.canDouble;
      els.split.disabled = !hand?.canSplit;
      els.surrender.disabled = !(hand?.cards.length === 2 && table.hands.length === 1 && hand.status === "playing");
      els.insurance.classList.toggle("hidden", !(table.insuranceOffered && !table.insuranceTaken && table.hands.length === 1 && hand?.cards.length === 2));
    }

    function showFairness(table) {
      els.fairness.innerHTML = UI.fairnessLine(table.fairness);
    }

    function enterRoundUI(table) {
      inRound = true;
      els.dealRow.classList.add("hidden");
      els.actionRow.classList.remove("hidden");
      els.amount.disabled = true;
      els.result.className = "result-banner";
      renderTable(table);
      setActionAvailability(table);
      showFairness(table);
    }

    function exitRoundUI() {
      inRound = false;
      els.dealRow.classList.remove("hidden");
      els.actionRow.classList.add("hidden");
      els.amount.disabled = false;
    }

    function describeFinish(finishPayload) {
      const totalWagered = finishPayload.table.hands.reduce((sum, h) => sum + h.bet, 0);
      const net = finishPayload.payout - totalWagered;
      const isWin = finishPayload.payout > totalWagered;
      els.result.className = `result-banner show ${isWin ? "win" : net === 0 ? "" : "loss"}`;
      if (net > 0) els.result.textContent = `🎉 Round over — won net ${UI.money(net)} (paid out ${UI.money(finishPayload.payout)}).`;
      else if (net === 0) els.result.textContent = `🤝 Round over — pushed, your ${UI.money(totalWagered)} stake was returned.`;
      else els.result.textContent = `Round over — lost net ${UI.money(-net)}.`;
    }

    els.deal.addEventListener("click", async () => {
      if (busy || inRound) return;
      const dollars = Number(els.amount.value);
      if (!dollars || dollars <= 0) return UI.toast("Enter a bet amount.", "loss");

      busy = true;
      try {
        const res = await Api.post("/games/blackjack/start", { amount: Math.round(dollars * 100) });
        if (res.finished) {
          renderTable(res.table, res.settlements);
          describeFinish(res);
          UI.applyAccountUpdate(accountState, res);
          UI.toast(res.payout > 0 ? `Blackjack settled instantly — won ${UI.money(res.payout)}!` : "Dealer had blackjack too — round settled.", res.payout > 0 ? "win" : "info");
          exitRoundUI();
        } else {
          accountState.balance = res.balance;
          UI.setBalance(res.balance);
          enterRoundUI(res.table);
          UI.toast("Cards dealt — your move.", "info");
        }
      } catch (err) {
        UI.toast(err.message, "loss");
      } finally {
        busy = false;
      }
    });

    async function sendAction(action) {
      if (busy || !inRound) return;
      busy = true;
      try {
        const res = await Api.post("/games/blackjack/action", { action });
        if (res.finished) {
          renderTable(res.table, res.settlements);
          describeFinish(res);
          UI.applyAccountUpdate(accountState, res);
          const net = res.payout - res.table.hands.reduce((s, h) => s + h.bet, 0);
          UI.toast(net > 0 ? `Won net ${UI.money(net)} on Blackjack!` : net === 0 ? "Pushed — stake returned." : `Lost net ${UI.money(-net)} on Blackjack.`, net > 0 ? "win" : net === 0 ? "info" : "loss");
          exitRoundUI();
        } else {
          renderTable(res.table);
          setActionAvailability(res.table);
          // Doubling/splitting silently deducts extra stake mid-hand — refresh the displayed balance.
          App.refreshAccount();
        }
      } catch (err) {
        UI.toast(err.message, "loss");
      } finally {
        busy = false;
      }
    }

    els.hit.addEventListener("click", () => sendAction("hit"));
    els.stand.addEventListener("click", () => sendAction("stand"));
    els.double.addEventListener("click", () => sendAction("double"));
    els.split.addEventListener("click", () => sendAction("split"));
    els.surrender.addEventListener("click", () => sendAction("surrender"));
    els.insurance.addEventListener("click", () => sendAction("insurance"));

    async function resumeIfActive() {
      try {
        const { table } = await Api.get("/games/blackjack/active");
        enterRoundUI(table);
        UI.toast("Resumed your in-progress hand.", "info");
      } catch {
        exitRoundUI();
      }
    }

    resumeIfActive();
  }

  return { render };
})();
