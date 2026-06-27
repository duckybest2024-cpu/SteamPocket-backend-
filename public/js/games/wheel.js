const WheelGame = (() => {
  const SEGMENTS = {
    low:    [{ m: 0, w: 5 }, { m: 1.2, w: 30 }, { m: 1.5, w: 20 }, { m: 2, w: 12 }, { m: 3, w: 8 }, { m: 5, w: 4 }, { m: 10, w: 1 }],
    medium: [{ m: 0, w: 20 }, { m: 1.5, w: 20 }, { m: 2, w: 15 }, { m: 3, w: 10 }, { m: 5, w: 8 }, { m: 10, w: 4 }, { m: 20, w: 2 }, { m: 50, w: 1 }],
    high:   [{ m: 0, w: 40 }, { m: 2, w: 10 }, { m: 5, w: 8 }, { m: 10, w: 5 }, { m: 20, w: 3 }, { m: 50, w: 2 }, { m: 100, w: 1 }, { m: 200, w: 1 }],
  };

  const COLORS = ["#f87171","#6f5cf2","#22d3ee","#fbbf24","#34d399","#a78bfa","#f472b6","#67e8f9"];

  function render(container, accountState) {
    let busy = false;
    let risk = "medium";

    container.innerHTML = `
      <div class="game-panel"><div class="game-layout">

        <div class="bet-panel">
          ${GameThemes.renderPicker("wheel", GameThemes.getSaved("wheel"))}

          <div class="bp-tabs">
            <button class="bp-tab active" id="wheel-tab-manual">Manual</button>
            <button class="bp-tab" id="wheel-tab-auto">Auto</button>
          </div>

          <div class="bp-field">
            <div class="bp-label">Bet Amount (chips)</div>
            <div class="bp-input-row">
              <input type="number" id="wheel-amount" value="1.00" min="0.01" step="0.01" />
              <button class="quick-btn" id="wheel-half">½</button>
              <button class="quick-btn" id="wheel-dbl">2×</button>
            </div>
          </div>

          <div class="bp-field">
            <div class="bp-label">Risk</div>
            <div class="toggle-group">
              <button id="wheel-low" data-r="low">Low</button>
              <button id="wheel-med" data-r="medium" class="active">Med</button>
              <button id="wheel-high" data-r="high">High</button>
            </div>
          </div>

          <div class="bp-field" id="wheel-auto-controls" style="display:none;">
            <div class="bp-label">Number of Bets (0 = until stopped)</div>
            <input type="number" id="wheel-auto-count" value="10" min="0" step="1" />
          </div>

          <hr class="bp-divider" />

          <button id="wheel-spin" class="play-btn">Spin</button>
        </div>

        <div class="game-canvas">
          <div class="wheel-wrap">
            <canvas id="wheel-canvas" width="300" height="300"></canvas>
            <div class="wheel-pointer">▼</div>
          </div>

          <div id="wheel-result" class="result-banner"></div>
          <div id="wheel-fairness" class="fairness-line"></div>
        </div>

      </div></div>
    `;
    HowToPlay.addButton(container, "wheel");

    const canvas = container.querySelector("#wheel-canvas");
    const ctx = canvas.getContext("2d");
    const els = {
      amount: container.querySelector("#wheel-amount"),
      half: container.querySelector("#wheel-half"),
      dbl: container.querySelector("#wheel-dbl"),
      spin: container.querySelector("#wheel-spin"),
      result: container.querySelector("#wheel-result"),
      fairness: container.querySelector("#wheel-fairness"),
    };

    // ½ and 2× quick buttons
    els.half.addEventListener("click", () => { els.amount.value = Math.max(1, Math.floor(Number(els.amount.value) * 50) / 100); });
    els.dbl.addEventListener("click", () => { els.amount.value = Math.floor(Number(els.amount.value) * 200) / 100; });

    // Manual / Auto tabs — Auto reveals the bet-count box and turns the
    // Spin button into a Start/Stop auto-runner.
    let autoMode = false;
    const autoControls = container.querySelector("#wheel-auto-controls");
    const autoCount = container.querySelector("#wheel-auto-count");
    container.querySelectorAll(".bp-tab").forEach(t => t.addEventListener("click", function() {
      if (autoRunning) return; // don't switch modes mid-run
      container.querySelectorAll(".bp-tab").forEach(x => x.classList.remove("active"));
      this.classList.add("active");
      autoMode = this.id === "wheel-tab-auto";
      autoControls.style.display = autoMode ? "" : "none";
      els.spin.textContent = autoMode ? "Start Auto" : "Spin";
    }));

    function segmentsForRisk(r) {
      const segs = SEGMENTS[r];
      const total = segs.reduce((s, sg) => s + sg.w, 0);
      let start = -Math.PI / 2;
      return segs.map((sg, i) => {
        const sweep = (sg.w / total) * Math.PI * 2;
        const end = start + sweep;
        const seg = { ...sg, start, end, color: COLORS[i % COLORS.length] };
        start = end;
        return seg;
      });
    }

    let currentSegs = segmentsForRisk(risk);
    let rotation = 0;

    function drawWheel(rot) {
      const cx = canvas.width / 2, cy = canvas.height / 2, r = cx - 10;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const seg of currentSegs) {
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, r, seg.start + rot, seg.end + rot);
        ctx.closePath();
        ctx.fillStyle = seg.color;
        ctx.fill();
        ctx.strokeStyle = "#1d2233";
        ctx.lineWidth = 2;
        ctx.stroke();

        // Label
        const mid = (seg.start + seg.end) / 2 + rot;
        const lx = cx + Math.cos(mid) * (r * 0.65);
        const ly = cy + Math.sin(mid) * (r * 0.65);
        ctx.fillStyle = "#fff";
        ctx.font = `bold ${r > 100 ? 13 : 10}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(seg.m + "x", lx, ly);
      }

      // Center cap
      ctx.beginPath();
      ctx.arc(cx, cy, 18, 0, Math.PI * 2);
      ctx.fillStyle = "#161925";
      ctx.fill();
      ctx.strokeStyle = "#6f5cf2";
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    drawWheel(0);

    // Risk toggle
    container.querySelectorAll(".toggle-group button").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (busy) return;
        risk = btn.dataset.r;
        container.querySelectorAll(".toggle-group button").forEach((b) => b.classList.toggle("active", b === btn));
        currentSegs = segmentsForRisk(risk);
        drawWheel(rotation);
      });
    });

    // One spin, start to finish. Resolves when the result is shown (or rejects).
    function doSpin() {
      return new Promise(async (resolve, reject) => {
      const amount = Math.round((Number(els.amount.value) || 0) * 100);
      if (amount <= 0) { UI.toast("Enter a bet.", "loss"); return reject(new Error("bad amount")); }

      els.result.className = "result-banner";

      try {
        const res = await Api.post("/games/wheel", { amount, risk });
        const { landedIndex, segments, multiplier } = res.result.state;

        // Recalculate segs with the returned segment list to stay in sync
        const total = segments.reduce((s, sg) => s + sg.weight, 0);
        let angle = -Math.PI / 2;
        const computedSegs = segments.map((sg, i) => {
          const sweep = (sg.weight / total) * Math.PI * 2;
          const end = angle + sweep;
          const s = { m: sg.multiplier, start: angle, end, color: COLORS[i % COLORS.length], w: sg.weight };
          angle = end;
          return s;
        });
        currentSegs = computedSegs;

        // Target angle: the pointer (top = -π/2) should land in the middle of the landed segment
        const landed = computedSegs[landedIndex];
        const midAngle = (landed.start + landed.end) / 2;
        // We want rotation such that midAngle + rotation = -π/2 (top)
        const targetAngle = -Math.PI / 2 - midAngle;

        // Spin a WHOLE number of full rotations then land, so the wheel comes
        // to rest with the landed segment's middle exactly under the pointer.
        // (A fractional turn here would stop the wheel on the wrong segment
        // even though the result itself is correct.)
        const spins = Math.PI * 2 * (5 + Math.floor(Math.random() * 4));
        const endRot = targetAngle + spins;
        const startRot = rotation;
        const duration = 3000;
        const startTime = performance.now();

        function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

        function frame(now) {
          const t = Math.min(1, (now - startTime) / duration);
          rotation = startRot + (endRot - startRot) * ease(t);
          drawWheel(rotation);
          if (t < 1) {
            requestAnimationFrame(frame);
          } else {
            rotation = endRot % (Math.PI * 2);
            drawWheel(rotation);
            showResult();
          }
        }
        requestAnimationFrame(frame);

        function showResult() {
          const isWin = res.result.result === "win";
          els.result.className = `result-banner show ${isWin ? "win" : "loss"}`;
          els.result.textContent = isWin
            ? `🎉 Landed on ${multiplier}x — paid ${UI.money(res.result.payout)}!`
            : `Landed on 0x — no win this spin.`;
          els.fairness.innerHTML = UI.fairnessLine({ serverSeedHash: accountState.fairness?.activeServerSeedHash, clientSeed: accountState.fairness?.clientSeed });
          UI.applyAccountUpdate(accountState, res);
          UI.toast(isWin ? `Won ${UI.money(res.result.payout)} on Wheel!` : "No win this spin.", isWin ? "win" : "info");
          resolve({ isWin });
        }
      } catch (err) {
        UI.toast(err.message, "loss");
        reject(err);
      }
      });
    }

    // Single spin (Manual) vs. an automated batch (Auto).
    let autoRunning = false;

    async function runAuto() {
      if (autoRunning) { autoRunning = false; return; } // toggle = stop
      const target = Math.max(0, Math.floor(Number(autoCount.value) || 0)); // 0 = endless
      autoRunning = true;
      els.spin.textContent = "Stop";
      els.spin.classList.add("danger");
      // Lock the mode tabs while running
      container.querySelectorAll(".bp-tab").forEach(t => t.style.pointerEvents = "none");
      let done = 0;
      try {
        while (autoRunning && (target === 0 || done < target)) {
          await doSpin();
          done++;
          if (autoRunning && (target === 0 || done < target)) await new Promise(r => setTimeout(r, 500));
        }
      } catch { /* stop on error (e.g. insufficient balance) */ }
      autoRunning = false;
      els.spin.textContent = "Start Auto";
      els.spin.classList.remove("danger");
      container.querySelectorAll(".bp-tab").forEach(t => t.style.pointerEvents = "");
    }

    els.spin.addEventListener("click", async () => {
      if (autoMode) return runAuto();
      if (busy) return;
      busy = true;
      els.spin.disabled = true;
      try { await doSpin(); } catch { /* toast already shown */ }
      busy = false;
      els.spin.disabled = false;
    });

    GameThemes.init(container, "wheel");
  }

  return { render };
})();
