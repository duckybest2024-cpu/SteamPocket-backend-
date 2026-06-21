const CrashGame = (() => {
  function render(container, accountState) {
    let phase = "connecting";
    let roundId = null;
    let serverSeedHash = null;
    let revealedSeed = null;
    let bettingEndsAt = null;
    let crashPoint = null;
    let bets = [];
    let historyList = [];
    let myBetPlaced = false;
    let myCashedOut = false;
    let countdownHandle = null;

    container.innerHTML = `
      <div class="game-panel"><div class="game-layout">

        <div class="bet-panel">
          <div class="bp-tabs">
            <button class="bp-tab active" id="crash-tab-manual">Manual</button>
            <button class="bp-tab" id="crash-tab-auto">Auto</button>
          </div>

          <div class="bp-field">
            <div class="bp-label">Bet amount (chips)</div>
            <div class="bp-input-row">
              <input type="number" id="crash-amount" value="10" min="1" step="1" style="flex:1;" />
              <button class="quick-btn" id="crash-half">½</button>
              <button class="quick-btn" id="crash-dbl">2×</button>
            </div>
          </div>

          <hr class="bp-divider" />

          <div class="bp-field">
            <div class="bp-label">Auto cash-out (optional)</div>
            <input type="number" id="crash-auto" placeholder="e.g. 2.00" min="1.01" step="0.01" />
          </div>

          <div class="bp-bottom">
            <button id="crash-bet-btn" class="play-btn" disabled>Connecting…</button>
            <button id="crash-cashout-btn" class="play-btn secondary-play hidden">Cash Out</button>
          </div>
        </div>

        <div class="game-canvas">
          <div class="crash-stage" id="crash-stage">
            <div class="crash-multiplier betting" id="crash-multiplier">--</div>
            <div class="crash-phase-label" id="crash-phase-label">Connecting to the table…</div>
          </div>

          <div class="crash-history" id="crash-history"></div>

          <div style="display:flex; align-items:center; gap:8px; margin-top:8px;">
            <span style="font-weight:700; font-size:0.9rem;">Live bets (<span id="crash-bet-count">0</span>)</span>
          </div>
          <div class="crash-bets-list" id="crash-bets-list"></div>

          <div id="crash-result" class="result-banner"></div>
          <div id="crash-fairness"></div>
        </div>

      </div></div>
    `;

    const els = {
      multiplier: container.querySelector("#crash-multiplier"),
      phaseLabel: container.querySelector("#crash-phase-label"),
      history: container.querySelector("#crash-history"),
      amount: container.querySelector("#crash-amount"),
      auto: container.querySelector("#crash-auto"),
      betBtn: container.querySelector("#crash-bet-btn"),
      cashoutBtn: container.querySelector("#crash-cashout-btn"),
      result: container.querySelector("#crash-result"),
      fairness: container.querySelector("#crash-fairness"),
      betCount: container.querySelector("#crash-bet-count"),
      betsList: container.querySelector("#crash-bets-list"),
      half: container.querySelector("#crash-half"),
      dbl: container.querySelector("#crash-dbl"),
    };

    // ½ and 2× quick buttons
    els.half.addEventListener("click", () => { els.amount.value = Math.max(1, Math.floor(Number(els.amount.value) * 50) / 100); });
    els.dbl.addEventListener("click", () => { els.amount.value = Math.floor(Number(els.amount.value) * 200) / 100; });

    // Manual/Auto tabs (visual only)
    container.querySelectorAll(".bp-tab").forEach(t => t.addEventListener("click", function() {
      container.querySelectorAll(".bp-tab").forEach(x => x.classList.remove("active"));
      this.classList.add("active");
    }));

    function setMultiplier(text, cls) {
      els.multiplier.textContent = text;
      els.multiplier.className = `crash-multiplier ${cls}`;
    }

    function startCountdown() {
      stopCountdown();
      countdownHandle = setInterval(() => {
        const remaining = Math.max(0, bettingEndsAt - Date.now());
        els.phaseLabel.textContent = `Betting closes in ${(remaining / 1000).toFixed(1)}s — place your bets!`;
        if (remaining <= 0) stopCountdown();
      }, 100);
    }
    function stopCountdown() {
      if (countdownHandle) {
        clearInterval(countdownHandle);
        countdownHandle = null;
      }
    }

    function renderBets() {
      els.betCount.textContent = String(bets.length);
      els.betsList.innerHTML = "";
      if (!bets.length) {
        els.betsList.appendChild(UI.el("div", { style: "color:var(--text-dim); font-size:0.85rem; padding:8px;" }, "No bets placed yet this round."));
        return;
      }
      for (const b of bets) {
        const cls = b.cashedOutAt !== null ? "cashed" : b.lost ? "lost" : "";
        const status = b.cashedOutAt !== null
          ? `Cashed out at ${b.cashedOutAt.toFixed(2)}x → ${UI.money(b.payout)}`
          : b.lost
            ? "Crashed — lost the lot"
            : `Riding${b.autoCashout ? ` · auto ${b.autoCashout.toFixed(2)}x` : ""}`;
        const you = b.username === accountState.username ? " (you)" : "";
        els.betsList.appendChild(UI.el("div", { class: `crash-bet-row ${cls}` }, [
          UI.el("span", {}, `${b.username}${you} — ${UI.money(b.amount)}`),
          UI.el("span", {}, status),
        ]));
      }
    }

    function renderHistory(list) {
      els.history.innerHTML = "";
      for (const h of list.slice(0, 20)) {
        const cls = h.crashPoint < 1.5 ? "low" : h.crashPoint < 3 ? "mid" : "high";
        els.history.appendChild(UI.el("span", { class: cls }, `${h.crashPoint.toFixed(2)}x`));
      }
    }

    function showFairness() {
      if (!roundId) return;
      let html = UI.fairnessLine({ serverSeedHash, clientSeed: `crash-round-${roundId}`, nonce: roundId });
      if (revealedSeed) {
        html += `<div class="fairness-line">🔓 Server seed revealed: <code>${revealedSeed}</code> — hash it yourself to confirm it matches the commitment shown above.</div>`;
      }
      els.fairness.innerHTML = html;
    }

    function setBetControlsForBetting(alreadyPlaced) {
      els.amount.disabled = alreadyPlaced;
      els.auto.disabled = alreadyPlaced;
      els.betBtn.disabled = alreadyPlaced;
      els.betBtn.textContent = alreadyPlaced ? "Bet placed — riding next round" : "Place bet";
      els.cashoutBtn.classList.add("hidden");
    }

    function setBetControlsForRunning() {
      els.amount.disabled = true;
      els.auto.disabled = true;
      els.betBtn.disabled = true;
      if (myBetPlaced && !myCashedOut) {
        els.cashoutBtn.classList.remove("hidden");
        els.cashoutBtn.disabled = false;
      } else {
        els.cashoutBtn.classList.add("hidden");
      }
    }

    function setBetControlsForCrashed() {
      els.amount.disabled = true;
      els.auto.disabled = true;
      els.betBtn.disabled = true;
      els.cashoutBtn.classList.add("hidden");
    }

    const socket = io("/crash", { auth: { token: Api.getToken() } });

    socket.on("state", (s) => {
      roundId = s.roundId;
      serverSeedHash = s.serverSeedHash;
      bets = (s.bets || []).map((b) => ({ ...b, lost: false }));
      const mine = bets.find((b) => b.username === accountState.username);

      if (s.phase === "betting") {
        phase = "betting";
        bettingEndsAt = s.bettingEndsAt;
        crashPoint = null;
        revealedSeed = null;
        myBetPlaced = !!mine;
        myCashedOut = false;
        setMultiplier("Place your bets", "betting");
        setBetControlsForBetting(myBetPlaced);
        startCountdown();
      } else if (s.phase === "running") {
        phase = "running";
        crashPoint = null;
        revealedSeed = null;
        myBetPlaced = !!mine;
        myCashedOut = !!(mine && mine.cashedOutAt !== null);
        setMultiplier(`${s.multiplier.toFixed(2)}x`, "running");
        els.phaseLabel.textContent = "Climbing — cash out before it crashes!";
        setBetControlsForRunning();
      } else {
        phase = "crashed";
        crashPoint = s.crashPoint;
        revealedSeed = null;
        myBetPlaced = false;
        myCashedOut = false;
        setMultiplier(`💥 ${s.crashPoint.toFixed(2)}x`, "crashed");
        els.phaseLabel.textContent = "Crashed — next round starting soon…";
        setBetControlsForCrashed();
      }
      renderBets();
      showFairness();
    });

    socket.on("history", (h) => {
      historyList = h || [];
      renderHistory(historyList);
    });

    socket.on("round_betting", (p) => {
      phase = "betting";
      roundId = p.roundId;
      serverSeedHash = p.serverSeedHash;
      bettingEndsAt = p.bettingEndsAt;
      crashPoint = null;
      revealedSeed = null;
      bets = [];
      myBetPlaced = false;
      myCashedOut = false;

      setMultiplier("Place your bets", "betting");
      setBetControlsForBetting(false);
      els.result.className = "result-banner";
      els.result.textContent = "";
      renderBets();
      showFairness();
      startCountdown();
    });

    socket.on("round_running", () => {
      phase = "running";
      stopCountdown();
      setMultiplier("1.00x", "running");
      els.phaseLabel.textContent = "Climbing — cash out before it crashes!";
      setBetControlsForRunning();
    });

    socket.on("round_tick", (p) => setMultiplier(`${p.multiplier.toFixed(2)}x`, "running"));

    socket.on("bet_placed", (p) => {
      bets.push({ username: p.username, amount: p.amount, autoCashout: p.autoCashout, cashedOutAt: null, payout: 0, lost: false });
      renderBets();
    });

    socket.on("cash_out", (p) => {
      const row = bets.find((b) => b.username === p.username && b.cashedOutAt === null);
      if (row) {
        row.cashedOutAt = p.multiplier;
        row.payout = p.payout;
      }
      renderBets();

      if (p.username === accountState.username) {
        myCashedOut = true;
        els.cashoutBtn.classList.add("hidden");
        if (p.balance !== undefined) UI.applyAccountUpdate(accountState, { balance: p.balance });
        els.result.className = "result-banner show win";
        els.result.textContent = `🎉 Cashed out at ${p.multiplier.toFixed(2)}x — won ${UI.money(p.payout)}.`;
        UI.toast(`Cashed out at ${p.multiplier.toFixed(2)}x for ${UI.money(p.payout)}!`, "win");
      }
    });

    socket.on("round_crash", (p) => {
      phase = "crashed";
      stopCountdown();
      crashPoint = p.crashPoint;
      serverSeedHash = p.serverSeedHash;
      revealedSeed = p.serverSeed;

      setMultiplier(`💥 ${p.crashPoint.toFixed(2)}x`, "crashed");
      els.phaseLabel.textContent = "Crashed — next round starting soon…";
      setBetControlsForCrashed();

      for (const s of p.settlements) {
        const row = bets.find((b) => b.username === s.username);
        if (!row) continue;
        row.payout = s.payout;
        row.cashedOutAt = s.multiplier > 0 ? s.multiplier : row.cashedOutAt;
        row.lost = s.multiplier === 0;
      }
      renderBets();

      historyList = [{ roundId: p.roundId, crashPoint: p.crashPoint, serverSeedHash: p.serverSeedHash }, ...historyList].slice(0, 50);
      renderHistory(historyList);
      showFairness();

      const mine = p.settlements.find((s) => s.username === accountState.username);
      if (mine && mine.payout === 0) {
        els.result.className = "result-banner show loss";
        els.result.textContent = `💥 Crashed at ${p.crashPoint.toFixed(2)}x — lost ${UI.money(mine.amount)}.`;
        UI.toast(`Crashed at ${p.crashPoint.toFixed(2)}x — lost ${UI.money(mine.amount)}.`, "loss");
      }
      if (mine) App.refreshAccount();
    });

    els.betBtn.addEventListener("click", () => {
      if (phase !== "betting" || myBetPlaced) return;
      const dollars = Number(els.amount.value);
      if (!dollars || dollars <= 0) return UI.toast("Enter a bet amount.", "loss");
      const amount = Math.round(dollars * 100);

      let autoCashout;
      if (els.auto.value) {
        autoCashout = Number(els.auto.value);
        if (!Number.isFinite(autoCashout) || autoCashout < 1.01) return UI.toast("Auto cash-out must be at least 1.01x.", "loss");
      }

      els.betBtn.disabled = true;
      socket.emit("place_bet", { amount, autoCashout }, (resp) => {
        if (resp?.error) {
          UI.toast(resp.error, "loss");
          els.betBtn.disabled = phase !== "betting" || myBetPlaced;
          return;
        }
        myBetPlaced = true;
        setBetControlsForBetting(true);
        if (resp.balance !== undefined) UI.applyAccountUpdate(accountState, { balance: resp.balance });
        UI.toast(`Bet placed — ${UI.money(amount)} riding this round.`, "info");
      });
    });

    els.cashoutBtn.addEventListener("click", () => {
      if (phase !== "running" || !myBetPlaced || myCashedOut) return;
      els.cashoutBtn.disabled = true;
      socket.emit("cash_out", {}, (resp) => {
        if (resp?.error) {
          UI.toast(resp.error, "loss");
          els.cashoutBtn.disabled = myCashedOut;
        }
        // Success path is reflected via the broadcast `cash_out` event everyone receives.
      });
    });

    return () => {
      stopCountdown();
      socket.disconnect();
    };
  }

  return { render };
})();
