const RouletteGame = (() => {
  const RED = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
  const colorOf = (n) => (n === 0 ? "green" : RED.has(n) ? "red" : "black");

  // Correct European roulette wheel order (clockwise from 0)
  const WHEEL_ORDER = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
  const TOTAL_POCKETS = 37;
  const SLICE_ANGLE = (2 * Math.PI) / TOTAL_POCKETS;

  // Returns the wheel rotation (in radians) so that the given number is at the top (12 o'clock)
  // We define "top" as straight up, which corresponds to -π/2 in canvas coordinates.
  // Pocket i is centered at angle: rotation + i * SLICE_ANGLE - π/2 + SLICE_ANGLE/2
  // We want pocket index of landingNumber to be at top → rotation = -π/2 - idx*SLICE_ANGLE - SLICE_ANGLE/2 + π/2
  function rotationForNumber(number) {
    const idx = WHEEL_ORDER.indexOf(number);
    // Center of pocket idx is at: rotation + idx * SLICE_ANGLE + SLICE_ANGLE/2
    // We want that center to equal -Math.PI / 2 (straight up in canvas = top)
    return -Math.PI / 2 - (idx * SLICE_ANGLE + SLICE_ANGLE / 2);
  }

  function drawRouletteWheel(canvas, highlightedNumber) {
    const ctx = canvas.getContext("2d");
    const W = canvas.width;
    const H = canvas.height;
    const cx = W / 2;
    const cy = H / 2;
    const outerR = Math.min(cx, cy) - 8;  // leave room for marker
    const innerR = outerR * 0.18;          // hub radius
    const labelR  = outerR * 0.82;         // where text is placed

    ctx.clearRect(0, 0, W, H);

    // Base rotation: if highlightedNumber is provided, orient so it's at top
    const baseRotation = highlightedNumber !== null && highlightedNumber !== undefined
      ? rotationForNumber(highlightedNumber)
      : -Math.PI / 2; // 0 at the top by default

    // --- Draw metallic outer border ring ---
    const borderGrad = ctx.createRadialGradient(cx, cy, outerR - 6, cx, cy, outerR + 8);
    borderGrad.addColorStop(0,   "#b8860b");
    borderGrad.addColorStop(0.3, "#ffd700");
    borderGrad.addColorStop(0.6, "#daa520");
    borderGrad.addColorStop(1,   "#8b6914");
    ctx.beginPath();
    ctx.arc(cx, cy, outerR + 7, 0, 2 * Math.PI);
    ctx.fillStyle = borderGrad;
    ctx.fill();

    // Thin dark outline
    ctx.beginPath();
    ctx.arc(cx, cy, outerR + 7, 0, 2 * Math.PI);
    ctx.strokeStyle = "#3a2600";
    ctx.lineWidth = 2;
    ctx.stroke();

    // --- Draw pockets ---
    for (let i = 0; i < TOTAL_POCKETS; i++) {
      const number = WHEEL_ORDER[i];
      const startAngle = baseRotation + i * SLICE_ANGLE;
      const endAngle   = startAngle + SLICE_ANGLE;
      const col = colorOf(number);

      // Highlighted pocket gets a bright glow
      const isHighlighted = (number === highlightedNumber);

      // Fill colour
      let fillColor;
      if (isHighlighted) {
        fillColor = col === "green" ? "#00ff88" : col === "red" ? "#ff4444" : "#888888";
      } else {
        fillColor = col === "green" ? "#1a7a3a" : col === "red" ? "#c0392b" : "#111111";
      }

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, outerR, startAngle, endAngle);
      ctx.closePath();
      ctx.fillStyle = fillColor;
      ctx.fill();

      // Thin separator line between pockets
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, outerR, startAngle, endAngle);
      ctx.closePath();
      ctx.strokeStyle = "rgba(0,0,0,0.6)";
      ctx.lineWidth = 0.8;
      ctx.stroke();

      // Number label
      const midAngle = startAngle + SLICE_ANGLE / 2;
      const tx = cx + labelR * Math.cos(midAngle);
      const ty = cy + labelR * Math.sin(midAngle);

      ctx.save();
      ctx.translate(tx, ty);
      ctx.rotate(midAngle + Math.PI / 2);
      ctx.fillStyle = isHighlighted ? "#ffe066" : "#ffffff";
      ctx.font = `bold ${Math.max(7, Math.round(outerR * 0.072))}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.shadowColor = "rgba(0,0,0,0.9)";
      ctx.shadowBlur = 3;
      ctx.fillText(String(number), 0, 0);
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    // --- Inner decorative ring (darker band near hub) ---
    const innerBandR = outerR * 0.26;
    const innerBandGrad = ctx.createRadialGradient(cx, cy, innerBandR * 0.6, cx, cy, innerBandR);
    innerBandGrad.addColorStop(0, "#1a1a1a");
    innerBandGrad.addColorStop(1, "#3a2600");
    ctx.beginPath();
    ctx.arc(cx, cy, innerBandR, 0, 2 * Math.PI);
    ctx.fillStyle = innerBandGrad;
    ctx.fill();

    // Inner gold ring outline
    ctx.beginPath();
    ctx.arc(cx, cy, innerBandR, 0, 2 * Math.PI);
    ctx.strokeStyle = "#daa520";
    ctx.lineWidth = 2;
    ctx.stroke();

    // --- Center hub ---
    const hubGrad = ctx.createRadialGradient(cx - innerR * 0.3, cy - innerR * 0.3, innerR * 0.1, cx, cy, innerR);
    hubGrad.addColorStop(0, "#ffffff");
    hubGrad.addColorStop(0.4, "#cccccc");
    hubGrad.addColorStop(1, "#666666");
    ctx.beginPath();
    ctx.arc(cx, cy, innerR, 0, 2 * Math.PI);
    ctx.fillStyle = hubGrad;
    ctx.fill();
    ctx.strokeStyle = "#daa520";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Hub dot
    ctx.beginPath();
    ctx.arc(cx, cy, innerR * 0.25, 0, 2 * Math.PI);
    ctx.fillStyle = "#333";
    ctx.fill();

    // --- Ball marker / pointer at the top (fixed, outside wheel) ---
    // A downward-pointing triangle just outside the gold ring at 12 o'clock
    const markerTipY  = cy - outerR - 2;   // tip just at outer rim
    const markerBaseY = cy - outerR - 14;  // base above
    const markerHalfW = 7;

    ctx.beginPath();
    ctx.moveTo(cx, markerTipY);
    ctx.lineTo(cx - markerHalfW, markerBaseY);
    ctx.lineTo(cx + markerHalfW, markerBaseY);
    ctx.closePath();

    const markerGrad = ctx.createLinearGradient(cx - markerHalfW, markerBaseY, cx + markerHalfW, markerTipY);
    markerGrad.addColorStop(0, "#ffffff");
    markerGrad.addColorStop(1, "#cccccc");
    ctx.fillStyle = markerGrad;
    ctx.fill();
    ctx.strokeStyle = "#888";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Animates the wheel spinning and ends with landingNumber at the top marker.
  // Returns a Promise that resolves when animation is complete.
  function animateWheel(canvas, landingNumber, durationMs) {
    return new Promise((resolve) => {
      const targetRotation = rotationForNumber(landingNumber);

      // We want the wheel to spin several full rotations before settling.
      // Pick a number of extra full spins (5-8) to make it feel exciting.
      const extraSpins = 6;
      // Current "base" rotation is -π/2 (the default neutral orientation).
      // The total rotation delta we want the wheel to travel:
      //   targetRotation = startRotation - totalDelta  (wheel moves clockwise = negative direction in canvas)
      // Simplify: we drive rotation from startAngle → endAngle
      const startRotation = -Math.PI / 2;
      // endRotation must land on targetRotation, but we subtract extra full rotations
      // going in the negative direction (spinning clockwise visually).
      // Normalize targetRotation into a clean offset from startRotation
      const endRotation = targetRotation - extraSpins * 2 * Math.PI;

      const startTime = performance.now();

      function easeOut(t) {
        // Cubic ease-out: starts fast, decelerates
        return 1 - Math.pow(1 - t, 3);
      }

      function frame(now) {
        const elapsed = now - startTime;
        const t = Math.min(elapsed / durationMs, 1);
        const easedT = easeOut(t);
        const currentRotation = startRotation + (endRotation - startRotation) * easedT;

        drawRouletteWheelAtRotation(canvas, landingNumber, currentRotation, t === 1);

        if (t < 1) {
          requestAnimationFrame(frame);
        } else {
          resolve();
        }
      }

      requestAnimationFrame(frame);
    });
  }

  // Internal: draws wheel at an explicit rotation angle, optionally highlighting the landed number
  function drawRouletteWheelAtRotation(canvas, highlightedNumber, rotation, showHighlight) {
    const ctx = canvas.getContext("2d");
    const W = canvas.width;
    const H = canvas.height;
    const cx = W / 2;
    const cy = H / 2;
    const outerR = Math.min(cx, cy) - 8;
    const innerR = outerR * 0.18;
    const labelR  = outerR * 0.82;

    ctx.clearRect(0, 0, W, H);

    // Metallic outer border ring
    const borderGrad = ctx.createRadialGradient(cx, cy, outerR - 6, cx, cy, outerR + 8);
    borderGrad.addColorStop(0,   "#b8860b");
    borderGrad.addColorStop(0.3, "#ffd700");
    borderGrad.addColorStop(0.6, "#daa520");
    borderGrad.addColorStop(1,   "#8b6914");
    ctx.beginPath();
    ctx.arc(cx, cy, outerR + 7, 0, 2 * Math.PI);
    ctx.fillStyle = borderGrad;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy, outerR + 7, 0, 2 * Math.PI);
    ctx.strokeStyle = "#3a2600";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Pockets
    for (let i = 0; i < TOTAL_POCKETS; i++) {
      const number = WHEEL_ORDER[i];
      const startAngle = rotation + i * SLICE_ANGLE;
      const endAngle   = startAngle + SLICE_ANGLE;
      const col = colorOf(number);
      const isHighlighted = showHighlight && (number === highlightedNumber);

      let fillColor;
      if (isHighlighted) {
        fillColor = col === "green" ? "#00ff88" : col === "red" ? "#ff4444" : "#888888";
      } else {
        fillColor = col === "green" ? "#1a7a3a" : col === "red" ? "#c0392b" : "#111111";
      }

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, outerR, startAngle, endAngle);
      ctx.closePath();
      ctx.fillStyle = fillColor;
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, outerR, startAngle, endAngle);
      ctx.closePath();
      ctx.strokeStyle = "rgba(0,0,0,0.6)";
      ctx.lineWidth = 0.8;
      ctx.stroke();

      const midAngle = startAngle + SLICE_ANGLE / 2;
      const tx = cx + labelR * Math.cos(midAngle);
      const ty = cy + labelR * Math.sin(midAngle);

      ctx.save();
      ctx.translate(tx, ty);
      ctx.rotate(midAngle + Math.PI / 2);
      ctx.fillStyle = isHighlighted ? "#ffe066" : "#ffffff";
      ctx.font = `bold ${Math.max(7, Math.round(outerR * 0.072))}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.shadowColor = "rgba(0,0,0,0.9)";
      ctx.shadowBlur = 3;
      ctx.fillText(String(number), 0, 0);
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    // Inner decorative band
    const innerBandR = outerR * 0.26;
    const innerBandGrad = ctx.createRadialGradient(cx, cy, innerBandR * 0.6, cx, cy, innerBandR);
    innerBandGrad.addColorStop(0, "#1a1a1a");
    innerBandGrad.addColorStop(1, "#3a2600");
    ctx.beginPath();
    ctx.arc(cx, cy, innerBandR, 0, 2 * Math.PI);
    ctx.fillStyle = innerBandGrad;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy, innerBandR, 0, 2 * Math.PI);
    ctx.strokeStyle = "#daa520";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Center hub
    const hubGrad = ctx.createRadialGradient(cx - innerR * 0.3, cy - innerR * 0.3, innerR * 0.1, cx, cy, innerR);
    hubGrad.addColorStop(0, "#ffffff");
    hubGrad.addColorStop(0.4, "#cccccc");
    hubGrad.addColorStop(1, "#666666");
    ctx.beginPath();
    ctx.arc(cx, cy, innerR, 0, 2 * Math.PI);
    ctx.fillStyle = hubGrad;
    ctx.fill();
    ctx.strokeStyle = "#daa520";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, innerR * 0.25, 0, 2 * Math.PI);
    ctx.fillStyle = "#333";
    ctx.fill();

    // Ball marker / pointer (always fixed at top — drawn last so it's on top)
    const markerTipY  = cy - outerR - 2;
    const markerBaseY = cy - outerR - 14;
    const markerHalfW = 7;

    ctx.beginPath();
    ctx.moveTo(cx, markerTipY);
    ctx.lineTo(cx - markerHalfW, markerBaseY);
    ctx.lineTo(cx + markerHalfW, markerBaseY);
    ctx.closePath();
    const markerGrad = ctx.createLinearGradient(cx - markerHalfW, markerBaseY, cx + markerHalfW, markerTipY);
    markerGrad.addColorStop(0, "#ffffff");
    markerGrad.addColorStop(1, "#cccccc");
    ctx.fillStyle = markerGrad;
    ctx.fill();
    ctx.strokeStyle = "#888";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  function render(container, accountState) {
    // Selection model: a Map from a stable key -> { type, numbers?, group?, label, amount }
    const selections = new Map();
    let busy = false;

    container.innerHTML = `
      <style>
        #roulette-wheel-canvas-wrap {
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 12px 0 8px;
        }
        #roulette-wheel {
          max-width: 320px;
          width: 100%;
          height: auto;
          display: block;
          border-radius: 50%;
          box-shadow: 0 0 24px rgba(0,0,0,0.7), 0 0 8px rgba(218,165,32,0.3);
        }
      </style>
      <div class="game-panel"><div class="game-layout">

        <div class="bet-panel">
          <div class="bp-tabs">
            <button class="bp-tab active" id="roulette-tab-manual">Manual</button>
            <button class="bp-tab" id="roulette-tab-auto">Auto</button>
          </div>

          <div class="bp-field">
            <div class="bp-label">Stake Amount ($)</div>
            <div class="bp-input-row">
              <input type="number" id="roulette-amount" value="10" min="0.01" step="0.01" />
              <button class="quick-btn" id="roulette-half">½</button>
              <button class="quick-btn" id="roulette-dbl">2×</button>
            </div>
          </div>

          <div class="bp-field">
            <div class="bp-label">Selected Bets</div>
            <div id="roulette-summary" style="font-size:0.8rem; color:var(--text-dim); min-height:20px;"></div>
          </div>

          <hr class="bp-divider" />

          <div class="bp-bottom">
            <button id="roulette-spin" class="play-btn">Spin</button>
            <button id="roulette-clear" class="play-btn secondary-play">Clear Bets</button>
          </div>
        </div>

        <div class="game-canvas">
          <div id="roulette-wheel-canvas-wrap">
            <canvas id="roulette-wheel" width="320" height="320"></canvas>
          </div>
          <div id="roulette-numbers" class="roulette-board"></div>
          <div id="roulette-outside" class="outside-bets"></div>

          <div id="roulette-wheel-result" class="hidden" style="text-align:center;">
            <div class="pocket-badge" id="roulette-pocket">--</div>
            <div>
              <div id="roulette-pocket-label" style="font-weight:700"></div>
              <div id="roulette-pocket-sub" style="color:var(--text-dim); font-size:0.85rem"></div>
            </div>
          </div>

          <div id="roulette-result" class="result-banner"></div>
          <div id="roulette-fairness" class="fairness-line"></div>
        </div>

      </div></div>
    `;

    HowToPlay.addButton(container, "roulette");

    const els = {
      numbers: container.querySelector("#roulette-numbers"),
      outside: container.querySelector("#roulette-outside"),
      amount: container.querySelector("#roulette-amount"),
      half: container.querySelector("#roulette-half"),
      dbl: container.querySelector("#roulette-dbl"),
      clear: container.querySelector("#roulette-clear"),
      spin: container.querySelector("#roulette-spin"),
      summary: container.querySelector("#roulette-summary"),
      wheelResult: container.querySelector("#roulette-wheel-result"),
      pocket: container.querySelector("#roulette-pocket"),
      pocketLabel: container.querySelector("#roulette-pocket-label"),
      pocketSub: container.querySelector("#roulette-pocket-sub"),
      result: container.querySelector("#roulette-result"),
      fairness: container.querySelector("#roulette-fairness"),
      wheelCanvas: container.querySelector("#roulette-wheel"),
    };

    // Draw wheel in neutral state on initial render
    drawRouletteWheel(els.wheelCanvas, null);

    // ½ and 2× quick buttons
    els.half.addEventListener("click", () => { els.amount.value = Math.max(1, Math.floor(Number(els.amount.value) * 50) / 100); refreshSummary(); });
    els.dbl.addEventListener("click", () => { els.amount.value = Math.floor(Number(els.amount.value) * 200) / 100; refreshSummary(); });

    // Manual/Auto tabs (visual only)
    container.querySelectorAll(".bp-tab").forEach(t => t.addEventListener("click", function() {
      container.querySelectorAll(".bp-tab").forEach(x => x.classList.remove("active"));
      this.classList.add("active");
    }));

    function buildNumberGrid() {
      els.numbers.innerHTML = "";

      const zeroRow = UI.el("div", { class: "roulette-row", style: "grid-template-columns: 1fr;" });
      zeroRow.appendChild(makeCell(0, "straight"));
      els.numbers.appendChild(zeroRow);

      // Three rows of 12, classic layout: row1 = 3,6,9...36 ; row2 = 2,5,8...35 ; row3 = 1,4,7...34
      for (let row = 0; row < 3; row++) {
        const rowEl = UI.el("div", { class: "roulette-row" });
        for (let col = 0; col < 12; col++) {
          const n = (col * 3) + (3 - row);
          rowEl.appendChild(makeCell(n, "straight"));
        }
        els.numbers.appendChild(rowEl);
      }
    }

    function makeCell(number, type) {
      const cell = UI.el("div", { class: `roulette-cell ${colorOf(number)}` }, String(number));
      cell.dataset.key = `${type}:${number}`;
      cell.addEventListener("click", () => toggleSelection(cell.dataset.key, { type, numbers: [number], label: `Straight up ${number}` }, cell));
      return cell;
    }

    function buildOutsideBets() {
      els.outside.innerHTML = "";
      const groups = [
        { key: "red", type: "red", label: "Red (1:1)" },
        { key: "black", type: "black", label: "Black (1:1)" },
        { key: "even", type: "even", label: "Even (1:1)" },
        { key: "odd", type: "odd", label: "Odd (1:1)" },
        { key: "low", type: "low", label: "1-18 (1:1)" },
        { key: "high", type: "high", label: "19-36 (1:1)" },
        { key: "dozen:1", type: "dozen", group: 1, label: "1st 12 (2:1)" },
        { key: "dozen:2", type: "dozen", group: 2, label: "2nd 12 (2:1)" },
        { key: "dozen:3", type: "dozen", group: 3, label: "3rd 12 (2:1)" },
        { key: "column:1", type: "column", group: 1, label: "Column 1 (2:1)" },
        { key: "column:2", type: "column", group: 2, label: "Column 2 (2:1)" },
        { key: "column:3", type: "column", group: 3, label: "Column 3 (2:1)" },
      ];
      for (const g of groups) {
        const btn = UI.el("button", {}, g.label);
        btn.addEventListener("click", () => toggleSelection(g.key, { type: g.type, group: g.group, label: g.label }, btn));
        els.outside.appendChild(btn);
      }
    }

    function toggleSelection(key, payload, node) {
      if (selections.has(key)) {
        selections.delete(key);
        node.classList.remove("selected");
        node.querySelector(".chip")?.remove();
      } else {
        selections.set(key, { ...payload, node });
        node.classList.add("selected");
      }
      refreshSummary();
    }

    function refreshSummary() {
      // Remove stale chips, then re-render the per-cell stake amounts.
      for (const chip of container.querySelectorAll(".chip")) chip.remove();

      if (selections.size === 0) {
        els.summary.textContent = "No bets selected — click numbers or outside bets above.";
        return;
      }

      const dollars = Number(els.amount.value) || 0;
      const totalCents = Math.round(dollars * 100);
      const each = Math.floor(totalCents / selections.size);

      const labels = [];
      for (const sel of selections.values()) {
        labels.push(`${sel.label} (${UI.money(each)})`);
        sel.node.appendChild(UI.el("span", { class: "chip" }, UI.money(each)));
      }
      els.summary.innerHTML = `<strong>${selections.size}</strong> bet(s), ${UI.money(each)} each — ${UI.money(each * selections.size)} total: ${labels.join(" · ")}`;
    }

    els.amount.addEventListener("input", refreshSummary);

    els.clear.addEventListener("click", () => {
      selections.clear();
      for (const c of els.numbers.querySelectorAll(".roulette-cell.selected")) c.classList.remove("selected");
      for (const b of els.outside.querySelectorAll("button.selected")) b.classList.remove("selected");
      refreshSummary();
    });

    els.spin.addEventListener("click", async () => {
      if (busy) return;
      if (selections.size === 0) return UI.toast("Select at least one bet first.", "loss");
      const dollars = Number(els.amount.value);
      if (!dollars || dollars <= 0) return UI.toast("Enter a stake amount.", "loss");

      const totalCents = Math.round(dollars * 100);
      const each = Math.floor(totalCents / selections.size);
      if (each <= 0) return UI.toast("Stake is too small to split across your selections.", "loss");

      const bets = [...selections.values()].map((sel) => ({
        type: sel.type,
        amount: each,
        ...(sel.numbers ? { numbers: sel.numbers } : {}),
        ...(sel.group ? { group: sel.group } : {}),
      }));

      busy = true;
      els.spin.disabled = true;
      els.wheelResult.classList.add("hidden");
      els.result.className = "result-banner";

      try {
        // Fire API call and wheel animation in parallel.
        // We need the landed number from the API to know where to stop,
        // so we start a placeholder spin (fast for 2s), then once the API
        // resolves we do the final deceleration landing on the correct pocket.

        // Start the API call
        const apiPromise = Api.post("/games/roulette/spin", { bets });

        // Wait for the API result first (usually fast), then animate landing
        const res = await apiPromise;
        const { landed, color, bets: breakdown } = res.result.state;

        // Now animate the wheel to land on the correct number (3 second spin)
        await animateWheel(els.wheelCanvas, landed, 3000);

        els.pocket.textContent = String(landed);
        els.pocket.className = `pocket-badge ${color}`;
        els.pocketLabel.textContent = `Ball landed on ${landed} (${color})`;
        const wins = breakdown.filter((b) => b.won);
        els.pocketSub.textContent = wins.length
          ? `Winning bets: ${wins.map((w) => `${w.type}${w.numbers?.length === 1 ? ` (${w.numbers[0]})` : ""} +${UI.money(w.payout)}`).join(", ")}`
          : "None of your bets covered this number.";
        els.wheelResult.classList.remove("hidden");

        const isWin = res.result.result === "win";
        els.result.className = `result-banner show ${isWin ? "win" : "loss"}`;
        els.result.textContent = isWin
          ? `🎉 The wheel landed on ${landed} — won ${UI.money(res.result.payout)} total.`
          : `The wheel landed on ${landed} — lost ${UI.money(totalCents - res.result.payout)} net.`;

        els.fairness.innerHTML = UI.fairnessLine({
          serverSeedHash: accountState.fairness?.activeServerSeedHash,
          clientSeed: accountState.fairness?.clientSeed,
        });

        UI.applyAccountUpdate(accountState, res);
        UI.toast(isWin ? `Won ${UI.money(res.result.payout)} on Roulette!` : `Lost on Roulette — ball landed on ${landed}.`, isWin ? "win" : "loss");
      } catch (err) {
        UI.toast(err.message, "loss");
      } finally {
        busy = false;
        els.spin.disabled = false;
      }
    });

    buildNumberGrid();
    buildOutsideBets();
    refreshSummary();
  }

  return { render };
})();
