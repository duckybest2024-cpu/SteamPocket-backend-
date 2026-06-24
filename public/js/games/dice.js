const DiceGame = (() => {
  function render(container, accountState) {
    let target = 50;
    let direction = "under"; // "under" wins below target, "over" wins above

    container.innerHTML = `
      <div class="game-panel"><div class="game-layout">

        <aside class="bet-panel">
          ${GameThemes.renderPicker("dice", GameThemes.getSaved("dice"))}

          <div class="bp-tabs">
            <button class="bp-tab active" id="dice-tab-manual">Manual</button>
            <button class="bp-tab" id="dice-tab-auto">Auto</button>
          </div>

          <div class="bp-field">
            <label class="bp-label">Bet Amount ($)</label>
            <div class="bp-input-row">
              <input type="number" id="dice-amount" value="10" min="0.01" step="0.01" />
              <button class="quick-btn" id="dice-half">½</button>
              <button class="quick-btn" id="dice-dbl">2×</button>
            </div>
          </div>

          <div class="bp-field">
            <label class="bp-label">Target (0 – 99.99)</label>
            <input type="number" id="dice-target" value="50" min="0.01" max="99.99" step="0.01" />
          </div>

          <div class="bp-field">
            <label class="bp-label">Direction</label>
            <div class="toggle-group">
              <button id="dice-under" class="active">Roll Under</button>
              <button id="dice-over">Roll Over</button>
            </div>
          </div>

          <hr class="bp-divider" />

          <div class="bp-bottom">
            <button class="play-btn" id="dice-bet">Roll Dice</button>
          </div>
        </aside>

        <div class="game-canvas">

          <div id="dice-3d-wrap" class="dice-3d-wrap" style="display:flex;justify-content:center;align-items:center;padding:20px 0 10px">
            <div id="dice-3d" class="dice-3d">
              <div class="dice-face dice-front">
                <div class="dice-dot dc-c"></div>
              </div>
              <div class="dice-face dice-back">
                <div class="dice-dot dc-tl"></div><div class="dice-dot dc-tr"></div>
                <div class="dice-dot dc-bl"></div><div class="dice-dot dc-br"></div>
                <div class="dice-dot dc-c"></div><div class="dice-dot dc-cr"></div>
              </div>
              <div class="dice-face dice-right">
                <div class="dice-dot dc-tl"></div><div class="dice-dot dc-br"></div>
              </div>
              <div class="dice-face dice-left">
                <div class="dice-dot dc-tl"></div><div class="dice-dot dc-tr"></div>
                <div class="dice-dot dc-c"></div><div class="dice-dot dc-bl"></div>
                <div class="dice-dot dc-br"></div>
              </div>
              <div class="dice-face dice-top">
                <div class="dice-dot dc-tl"></div><div class="dice-dot dc-tr"></div>
                <div class="dice-dot dc-bl"></div><div class="dice-dot dc-br"></div>
              </div>
              <div class="dice-face dice-bottom">
                <div class="dice-dot dc-tl"></div><div class="dice-dot dc-tr"></div>
                <div class="dice-dot dc-bl"></div>
              </div>
            </div>
          </div>
          <style>
            .dice-3d-scene { perspective: 300px; }
            .dice-3d {
              width: 90px; height: 90px;
              position: relative;
              transform-style: preserve-3d;
              transform: rotateX(-20deg) rotateY(30deg);
              transition: transform 0.6s cubic-bezier(0.25,0.46,0.45,0.94);
            }
            .dice-3d.rolling {
              animation: dice-tumble 0.6s ease-in-out;
            }
            @keyframes dice-tumble {
              0%   { transform: rotateX(-20deg) rotateY(30deg); }
              25%  { transform: rotateX(120deg) rotateY(200deg); }
              50%  { transform: rotateX(240deg) rotateY(380deg); }
              75%  { transform: rotateX(300deg) rotateY(500deg); }
              100% { transform: rotateX(360deg) rotateY(720deg) rotateX(-20deg) rotateY(30deg); }
            }
            .dice-3d-wrap { transition: filter 0.3s ease; }
            .dice-3d-wrap.win-state { filter: drop-shadow(0 0 16px #34d399); }
            .dice-3d-wrap.loss-state { filter: drop-shadow(0 0 16px #ef4444); }
            .dice-face {
              position: absolute;
              width: 90px; height: 90px;
              background: linear-gradient(155deg, #fdfbf5 0%, #f4ecd8 45%, #e3d6b8 100%);
              border: 1px solid #c9b98c;
              border-radius: 14px;
              display: grid;
              grid-template-areas:
                "tl . tr"
                ". c ."
                "bl . br";
              padding: 10px;
              box-sizing: border-box;
              backface-visibility: hidden;
              box-shadow:
                inset 0 2px 3px rgba(255,255,255,0.85),
                inset 0 -6px 10px rgba(120,100,60,0.25),
                0 2px 6px rgba(0,0,0,0.35);
              overflow: hidden;
            }
            .dice-face::before {
              content: "";
              position: absolute;
              inset: 0;
              z-index: 0;
              background: radial-gradient(circle at 28% 22%, rgba(255,255,255,0.85), rgba(255,255,255,0) 55%);
              pointer-events: none;
            }
            .dice-front  { transform: translateZ(45px); }
            .dice-back   { transform: rotateY(180deg) translateZ(45px); }
            .dice-right  { transform: rotateY(90deg) translateZ(45px); }
            .dice-left   { transform: rotateY(-90deg) translateZ(45px); }
            .dice-top    { transform: rotateX(90deg) translateZ(45px); }
            .dice-bottom { transform: rotateX(-90deg) translateZ(45px); }
            .dice-dot {
              position: relative;
              z-index: 1;
              width: 14px; height: 14px;
              background: radial-gradient(circle at 35% 30%, #ff6b5e 0%, #c0392b 55%, #7a1f12 100%);
              border-radius: 50%;
              align-self: center;
              justify-self: center;
              box-shadow: inset 0 1px 1px rgba(255,255,255,0.45), 0 1px 2px rgba(0,0,0,0.5);
            }
            .dc-tl { grid-area: tl; } .dc-tr { grid-area: tr; }
            .dc-bl { grid-area: bl; } .dc-br { grid-area: br; }
            .dc-c  { grid-area: c;  }
            .dc-cr { grid-column: 3; grid-row: 2; }
          </style>

          <div class="roll-display"><span id="dice-roll-number" class="roll-number">--</span></div>

          <div class="range-track" id="dice-track" style="--split: 50%">
            <div class="range-marker" id="dice-marker" style="left: 50%"></div>
          </div>

          <div class="range-track-labels">
            <span>0</span><span>25</span><span>50</span><span>75</span><span>100</span>
          </div>

          <div class="stat-boxes">
            <div class="stat-box" id="dice-mult-box">
              <div class="sb-label">Multiplier</div>
              <div class="sb-value" id="dice-mult-display">1.98×</div>
            </div>
            <div class="stat-box" id="dice-target-box">
              <div class="sb-label" id="dice-target-label">Roll Under</div>
              <div class="sb-value" id="dice-target-display">&lt; 50.00</div>
            </div>
            <div class="stat-box" id="dice-chance-box">
              <div class="sb-label">Win Chance</div>
              <div class="sb-value" id="dice-chance-display">50.00%</div>
            </div>
          </div>

          <p class="dice-explainer" id="dice-explainer"></p>

          <div id="dice-result" class="result-banner"></div>
          <div id="dice-fairness" class="fairness-line"></div>
        </div>

      </div></div>
    `;
    HowToPlay.addButton(container, "dice");

    const els = {
      number: container.querySelector("#dice-roll-number"),
      track: container.querySelector("#dice-track"),
      marker: container.querySelector("#dice-marker"),
      chance: container.querySelector("#dice-chance-display"),
      mult: container.querySelector("#dice-mult-display"),
      multDisplay: container.querySelector("#dice-mult-display"),
      targetLabel: container.querySelector("#dice-target-label"),
      targetDisplay: container.querySelector("#dice-target-display"),
      chanceDisplay: container.querySelector("#dice-chance-display"),
      explainer: container.querySelector("#dice-explainer"),
      amount: container.querySelector("#dice-amount"),
      half: container.querySelector("#dice-half"),
      dbl: container.querySelector("#dice-dbl"),
      target: container.querySelector("#dice-target"),
      under: container.querySelector("#dice-under"),
      over: container.querySelector("#dice-over"),
      betBtn: container.querySelector("#dice-bet"),
      result: container.querySelector("#dice-result"),
      fairness: container.querySelector("#dice-fairness"),
      dice3d: container.querySelector("#dice-3d"),
      dice3dWrap: container.querySelector("#dice-3d-wrap"),
    };

    function refreshOdds() {
      target = Math.min(99.99, Math.max(0.01, Number(els.target.value) || 50));
      const winChance = direction === "over" ? 100 - target : target;
      const fairMultiplier = 100 / winChance;
      const multiplier = fairMultiplier * 0.99;
      const outcome = { multiplier, winChance };

      els.track.style.setProperty("--split", `${target}%`);
      // Colour the track so the *winning* zone is green regardless of direction.
      els.track.style.background =
        direction === "under"
          ? `linear-gradient(90deg, var(--win) 0%, var(--win) ${target}%, var(--loss) ${target}%, var(--loss) 100%)`
          : `linear-gradient(90deg, var(--loss) 0%, var(--loss) ${target}%, var(--win) ${target}%, var(--win) 100%)`;

      els.multDisplay.textContent = `${outcome.multiplier.toFixed(4)}×`;
      els.targetLabel.textContent = direction === "under" ? "Roll Under" : "Roll Over";
      els.targetDisplay.textContent = direction === "under" ? `< ${target.toFixed(2)}` : `> ${target.toFixed(2)}`;
      els.chanceDisplay.textContent = `${outcome.winChance.toFixed(4)}%`;
      els.explainer.textContent = direction === "under"
        ? `A random number between 0 and 100 will be rolled. You win if it lands below ${target.toFixed(2)}.`
        : `A random number between 0 and 100 will be rolled. You win if it lands above ${target.toFixed(2)}.`;
    }

    els.target.addEventListener("input", refreshOdds);

    function setDirection(dir) {
      direction = dir;
      els.under.classList.toggle("active", dir === "under");
      els.over.classList.toggle("active", dir === "over");
      refreshOdds();
    }
    els.under.addEventListener("click", () => setDirection("under"));
    els.over.addEventListener("click", () => setDirection("over"));

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

    els.betBtn.addEventListener("click", async () => {
      const dollars = Number(els.amount.value);
      if (!dollars || dollars <= 0) return UI.toast("Enter a bet amount first.", "loss");
      const amount = Math.round(dollars * 100);

      els.betBtn.disabled = true;
      els.number.textContent = "…";
      els.number.className = "roll-number";

      // Animate the 3D dice
      if (els.dice3d) {
        els.dice3dWrap.classList.remove("win-state", "loss-state");
        els.dice3d.classList.add("rolling");
        setTimeout(() => els.dice3d.classList.remove("rolling"), 620);
      }

      try {
        const res = await Api.post("/games/dice", { amount, target, direction });
        const rollValue = res.result.state.roll;
        const isWin = res.result.result === "win";

        els.marker.style.left = `${rollValue}%`;
        els.number.textContent = rollValue.toFixed(2);
        els.number.className = `roll-number ${isWin ? "win" : "loss"}`;

        // Set dice win/loss glow
        if (els.dice3d) {
          els.dice3dWrap.classList.remove("win-state", "loss-state");
          els.dice3dWrap.classList.add(isWin ? "win-state" : "loss-state");
        }

        els.result.className = `result-banner show ${isWin ? "win" : "loss"}`;
        els.result.textContent = isWin
          ? `🎉 Rolled ${rollValue.toFixed(2)} — you won ${UI.money(res.result.payout)} (${res.result.multiplier}x)`
          : `Rolled ${rollValue.toFixed(2)} — that didn't clear your target. Lost ${UI.money(amount)}.`;

        els.fairness.innerHTML = UI.fairnessLine({
          serverSeedHash: accountState.fairness?.activeServerSeedHash,
          clientSeed: accountState.fairness?.clientSeed,
          nonce: res.nextNonce - 1,
        });

        UI.applyAccountUpdate(accountState, res);
        UI.toast(isWin ? `Won ${UI.money(res.result.payout)} on Dice!` : `Lost ${UI.money(amount)} on Dice.`, isWin ? "win" : "loss");
      } catch (err) {
        UI.toast(err.message, "loss");
      } finally {
        els.betBtn.disabled = false;
      }
    });

    refreshOdds();
    GameThemes.init(container, "dice");
  }

  return { render };
})();
