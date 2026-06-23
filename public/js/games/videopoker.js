const VideoPokerGame = (() => {
  const HAND_NAMES = {
    royal_flush: "Royal Flush",
    straight_flush: "Straight Flush",
    four_of_a_kind: "Four of a Kind",
    full_house: "Full House",
    flush: "Flush",
    straight: "Straight",
    three_of_a_kind: "Three of a Kind",
    two_pair: "Two Pair",
    jacks_or_better: "Jacks or Better",
    high_card: "No Win",
  };

  const PAY_TABLE = [
    ["Royal Flush", 800], ["Straight Flush", 50], ["Four of a Kind", 25],
    ["Full House", 9], ["Flush", 6], ["Straight", 4],
    ["Three of a Kind", 3], ["Two Pair", 2], ["Jacks or Better", 1],
  ];

  function render(container, accountState) {
    let inRound = false;
    let busy = false;
    let held = [false, false, false, false, false];

    container.innerHTML = `
      <div class="game-panel"><div class="game-layout">

        <div class="bet-panel">
          <div class="bp-tabs">
            <button class="bp-tab active" id="vp-tab-manual">Manual</button>
            <button class="bp-tab" id="vp-tab-auto">Auto</button>
          </div>

          <div class="bp-field">
            <div class="bp-label">Bet Amount ($)</div>
            <div class="bp-input-row">
              <input type="number" id="vp-amount" value="1.00" min="0.01" step="0.01" />
              <button class="quick-btn" id="vp-half">½</button>
              <button class="quick-btn" id="vp-dbl">2×</button>
            </div>
          </div>

          <div style="flex:1; overflow-y:auto;">
            <div class="bp-label" style="margin-bottom:6px;">Paytable</div>
            <div id="vp-paytable" class="vp-paytable" style="font-size:0.78rem;"></div>
          </div>

          <div id="vp-deal-wrap" class="bp-bottom">
            <button id="vp-deal" class="play-btn">Deal</button>
            <button id="vp-draw" class="play-btn hidden">Draw</button>
          </div>
        </div>

        <div class="game-canvas">
          <div id="vp-table" class="vp-table"><div id="vp-hand" class="vp-hand"></div></div>

          <div id="vp-result" class="result-banner"></div>
          <div id="vp-fairness" class="fairness-line"></div>
        </div>

      </div></div>
    `;

    HowToPlay.addButton(container, "videopoker");

    const els = {
      hand: container.querySelector("#vp-hand"),
      amount: container.querySelector("#vp-amount"),
      half: container.querySelector("#vp-half"),
      dbl: container.querySelector("#vp-dbl"),
      paytable: container.querySelector("#vp-paytable"),
      dealWrap: container.querySelector("#vp-deal-wrap"),
      deal: container.querySelector("#vp-deal"),
      draw: container.querySelector("#vp-draw"),
      result: container.querySelector("#vp-result"),
      fairness: container.querySelector("#vp-fairness"),
    };

    // Populate paytable
    els.paytable.innerHTML = PAY_TABLE.map(([h, m]) => `<div class="vpt-row"><span>${h}</span><span>${m}x</span></div>`).join("");

    // ½ and 2× quick buttons
    els.half.addEventListener("click", () => { els.amount.value = Math.max(1, Math.floor(Number(els.amount.value) * 50) / 100); });
    els.dbl.addEventListener("click", () => { els.amount.value = Math.floor(Number(els.amount.value) * 200) / 100; });

    // Manual/Auto tabs (visual only)
    container.querySelectorAll(".bp-tab").forEach(t => t.addEventListener("click", function() {
      container.querySelectorAll(".bp-tab").forEach(x => x.classList.remove("active"));
      this.classList.add("active");
    }));

    function renderHand(cards, allowToggle, highlightIndexes) {
      els.hand.innerHTML = "";
      cards.forEach((card, i) => {
        const isHeld = held[i];
        const isHighlight = highlightIndexes && highlightIndexes.includes(i);
        const wrap = document.createElement("div");
        wrap.className = `vp-card-wrap${isHighlight ? " vp-highlight" : ""}`;

        const suitLetter = {"♠":"S","♥":"H","♦":"D","♣":"C"}[card.suit] || "S";
        wrap.innerHTML = `
          <img class="card-svg vp-card-img${isHighlight ? " vp-highlight-card" : ""}" src="/images/cards/${card.rank}${suitLetter}.svg" alt="${card.rank}${card.suit}" />
          <div class="vp-hold-badge${isHeld ? " active" : ""}">${isHeld ? "HELD" : "HOLD"}</div>
        `;

        if (allowToggle) {
          wrap.style.cursor = "pointer";
          wrap.addEventListener("click", () => {
            held[i] = !held[i];
            renderHand(cards, true);
          });
        }
        els.hand.appendChild(wrap);
      });
    }

    function clearHand() {
      els.hand.innerHTML = `<div style="color:var(--text-dim);text-align:center;padding:40px 0;width:100%">Deal to start a hand</div>`;
    }
    clearHand();

    els.deal.addEventListener("click", async () => {
      if (busy || inRound) return;
      const amount = Math.round((Number(els.amount.value) || 0) * 100);
      if (amount <= 0) return UI.toast("Enter a bet.", "loss");

      busy = true;
      els.deal.disabled = true;
      els.result.className = "result-banner";
      held = [false, false, false, false, false];

      try {
        const res = await Api.post("/games/videopoker/deal", { amount });
        inRound = true;
        els.deal.classList.add("hidden");
        els.draw.classList.remove("hidden");
        els.amount.disabled = true;
        renderHand(res.hand, true);
        els.fairness.innerHTML = UI.fairnessLine(res.fairness);
        UI.applyAccountUpdate(accountState, res);
      } catch (err) {
        UI.toast(err.message, "loss");
      } finally {
        busy = false;
        els.deal.disabled = false;
      }
    });

    els.draw.addEventListener("click", async () => {
      if (busy || !inRound) return;
      busy = true;
      els.draw.disabled = true;

      try {
        const res = await Api.post("/games/videopoker/draw", { hold: held });
        inRound = false;
        els.draw.classList.add("hidden");
        els.deal.classList.remove("hidden");
        els.amount.disabled = false;

        renderHand(res.hand, false);

        const name = HAND_NAMES[res.handRank] || res.handRank;
        const isWin = res.payout > 0;
        els.result.className = `result-banner show ${isWin ? "win" : "loss"}`;
        els.result.textContent = isWin
          ? `🎉 ${name}! ${res.multiplier}x — paid ${UI.money(res.payout)}.`
          : `${name} — no win this hand.`;

        UI.applyAccountUpdate(accountState, res);
        UI.toast(isWin ? `Won ${UI.money(res.payout)} on Video Poker!` : "No win this hand.", isWin ? "win" : "info");
        held = [false, false, false, false, false];
      } catch (err) {
        UI.toast(err.message, "loss");
      } finally {
        busy = false;
        els.draw.disabled = false;
      }
    });

    // Resume active hand if navigating back
    (async () => {
      try {
        const res = await Api.get("/games/videopoker/active");
        inRound = true;
        els.deal.classList.add("hidden");
        els.draw.classList.remove("hidden");
        els.amount.disabled = true;
        held = [false, false, false, false, false];
        renderHand(res.hand, true);
        els.fairness.innerHTML = UI.fairnessLine(res.fairness);
      } catch {
        // No active hand
      }
    })();
  }

  return { render };
})();
