const RouletteGame = (() => {
  const RED = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
  const colorOf = (n) => (n === 0 ? "green" : RED.has(n) ? "red" : "black");
  const WHEEL_ORDER = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
  const TOTAL_POCKETS = 37;
  const SLICE_ANGLE = (2 * Math.PI) / TOTAL_POCKETS;

  function rotationForNumber(number) {
    const idx = WHEEL_ORDER.indexOf(number);
    return -Math.PI / 2 - (idx * SLICE_ANGLE + SLICE_ANGLE / 2);
  }

  function drawWheelAtRotation(canvas, highlightedNumber, rotation, showHighlight) {
    const ctx = canvas.getContext("2d");
    const W = canvas.width, H = canvas.height, cx = W/2, cy = H/2;
    const outerR = Math.min(cx, cy) - 8;
    const innerR = outerR * 0.18;
    const labelR = outerR * 0.82;
    ctx.clearRect(0, 0, W, H);
    const borderGrad = ctx.createRadialGradient(cx, cy, outerR-6, cx, cy, outerR+8);
    borderGrad.addColorStop(0,"#b8860b"); borderGrad.addColorStop(0.3,"#ffd700"); borderGrad.addColorStop(0.6,"#daa520"); borderGrad.addColorStop(1,"#8b6914");
    ctx.beginPath(); ctx.arc(cx, cy, outerR+7, 0, 2*Math.PI); ctx.fillStyle = borderGrad; ctx.fill();
    ctx.beginPath(); ctx.arc(cx, cy, outerR+7, 0, 2*Math.PI); ctx.strokeStyle = "#3a2600"; ctx.lineWidth = 2; ctx.stroke();
    for (let i = 0; i < TOTAL_POCKETS; i++) {
      const number = WHEEL_ORDER[i];
      const startAngle = rotation + i * SLICE_ANGLE, endAngle = startAngle + SLICE_ANGLE;
      const col = colorOf(number);
      const isHighlighted = showHighlight && (number === highlightedNumber);
      let fillColor = isHighlighted ? (col==="green"?"#00ff88":col==="red"?"#ff4444":"#888888") : (col==="green"?"#1a7a3a":col==="red"?"#c0392b":"#111111");
      ctx.beginPath(); ctx.moveTo(cx,cy); ctx.arc(cx,cy,outerR,startAngle,endAngle); ctx.closePath(); ctx.fillStyle = fillColor; ctx.fill();
      ctx.beginPath(); ctx.moveTo(cx,cy); ctx.arc(cx,cy,outerR,startAngle,endAngle); ctx.closePath(); ctx.strokeStyle = "rgba(0,0,0,0.6)"; ctx.lineWidth = 0.8; ctx.stroke();
      const midAngle = startAngle + SLICE_ANGLE/2, tx = cx+labelR*Math.cos(midAngle), ty = cy+labelR*Math.sin(midAngle);
      ctx.save(); ctx.translate(tx,ty); ctx.rotate(midAngle+Math.PI/2);
      ctx.fillStyle = isHighlighted ? "#ffe066" : "#ffffff";
      ctx.font = `bold ${Math.max(7, Math.round(outerR*0.072))}px sans-serif`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.shadowColor = "rgba(0,0,0,0.9)"; ctx.shadowBlur = 3;
      ctx.fillText(String(number), 0, 0); ctx.shadowBlur = 0; ctx.restore();
    }
    const innerBandR = outerR * 0.26;
    const ibg = ctx.createRadialGradient(cx,cy,innerBandR*0.6,cx,cy,innerBandR);
    ibg.addColorStop(0,"#1a1a1a"); ibg.addColorStop(1,"#3a2600");
    ctx.beginPath(); ctx.arc(cx,cy,innerBandR,0,2*Math.PI); ctx.fillStyle = ibg; ctx.fill();
    ctx.beginPath(); ctx.arc(cx,cy,innerBandR,0,2*Math.PI); ctx.strokeStyle = "#daa520"; ctx.lineWidth = 2; ctx.stroke();
    const hubGrad = ctx.createRadialGradient(cx-innerR*0.3,cy-innerR*0.3,innerR*0.1,cx,cy,innerR);
    hubGrad.addColorStop(0,"#ffffff"); hubGrad.addColorStop(0.4,"#cccccc"); hubGrad.addColorStop(1,"#666666");
    ctx.beginPath(); ctx.arc(cx,cy,innerR,0,2*Math.PI); ctx.fillStyle = hubGrad; ctx.fill();
    ctx.strokeStyle = "#daa520"; ctx.lineWidth = 2; ctx.stroke();
    ctx.beginPath(); ctx.arc(cx,cy,innerR*0.25,0,2*Math.PI); ctx.fillStyle = "#333"; ctx.fill();
    const mTipY = cy-outerR-2, mBaseY = cy-outerR-14, mHW = 7;
    ctx.beginPath(); ctx.moveTo(cx,mTipY); ctx.lineTo(cx-mHW,mBaseY); ctx.lineTo(cx+mHW,mBaseY); ctx.closePath();
    const mg = ctx.createLinearGradient(cx-mHW,mBaseY,cx+mHW,mTipY); mg.addColorStop(0,"#ffffff"); mg.addColorStop(1,"#cccccc");
    ctx.fillStyle = mg; ctx.fill(); ctx.strokeStyle = "#888"; ctx.lineWidth = 1; ctx.stroke();
  }

  function animateWheel(canvas, landingNumber, durationMs) {
    return new Promise((resolve) => {
      const targetRotation = rotationForNumber(landingNumber);
      const endRotation = targetRotation - 6 * 2 * Math.PI;
      const startTime = performance.now();
      function easeOut(t) { return 1 - Math.pow(1-t, 3); }
      function frame(now) {
        const t = Math.min((now - startTime) / durationMs, 1);
        const cur = -Math.PI/2 + (endRotation - (-Math.PI/2)) * easeOut(t);
        drawWheelAtRotation(canvas, landingNumber, cur, t === 1);
        if (t < 1) requestAnimationFrame(frame); else resolve();
      }
      requestAnimationFrame(frame);
    });
  }

  function render(container, accountState) {
    const selections = new Map();
    let busy = false;

    container.innerHTML = `
      <div class="game-panel"><div class="game-layout">
        <div class="bet-panel">
          <div class="bp-tabs">
            <button class="bp-tab active">Manual</button>
            <button class="bp-tab">Auto</button>
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
            <div id="roulette-summary" style="font-size:0.8rem;color:var(--text-dim);min-height:20px;"></div>
          </div>
          <hr class="bp-divider" />
          <div class="bp-bottom">
            <button id="roulette-spin" class="play-btn">Spin</button>
            <button id="roulette-clear" class="play-btn secondary-play">Clear Bets</button>
          </div>
        </div>
        <div class="game-canvas">
          <div style="display:flex;justify-content:center;padding:12px 0 8px;">
            <canvas id="roulette-wheel" width="300" height="300" style="max-width:300px;width:100%;border-radius:50%;box-shadow:0 0 24px rgba(0,0,0,0.7);"></canvas>
          </div>
          <div id="roulette-numbers" class="roulette-board"></div>
          <div id="roulette-outside" class="outside-bets"></div>
          <div id="roulette-wheel-result" class="hidden" style="text-align:center;">
            <div class="pocket-badge" id="roulette-pocket">--</div>
            <div id="roulette-pocket-label" style="font-weight:700"></div>
            <div id="roulette-pocket-sub" style="color:var(--text-dim);font-size:0.85rem"></div>
          </div>
          <div id="roulette-result" class="result-banner"></div>
          <div id="roulette-fairness" class="fairness-line"></div>
        </div>
      </div></div>
    `;

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

    drawWheelAtRotation(els.wheelCanvas, null, -Math.PI/2, false);

    els.half.addEventListener("click", () => { els.amount.value = Math.max(1, Math.floor(Number(els.amount.value)*50)/100); refreshSummary(); });
    els.dbl.addEventListener("click", () => { els.amount.value = Math.floor(Number(els.amount.value)*200)/100; refreshSummary(); });
    container.querySelectorAll(".bp-tab").forEach(t => t.addEventListener("click", function() {
      container.querySelectorAll(".bp-tab").forEach(x => x.classList.remove("active"));
      this.classList.add("active");
    }));

    function buildNumberGrid() {
      els.numbers.innerHTML = "";
      const zeroRow = document.createElement("div"); zeroRow.className = "roulette-row";
      zeroRow.style.gridTemplateColumns = "1fr";
      zeroRow.appendChild(makeCell(0, "straight"));
      els.numbers.appendChild(zeroRow);
      for (let row = 0; row < 3; row++) {
        const rowEl = document.createElement("div"); rowEl.className = "roulette-row";
        for (let col = 0; col < 12; col++) { rowEl.appendChild(makeCell((col*3)+(3-row), "straight")); }
        els.numbers.appendChild(rowEl);
      }
    }

    function makeCell(number, type) {
      const cell = document.createElement("div");
      cell.className = `roulette-cell ${colorOf(number)}`;
      cell.textContent = String(number);
      cell.dataset.key = `${type}:${number}`;
      cell.addEventListener("click", () => toggleSelection(cell.dataset.key, { type, numbers:[number], label:`Straight up ${number}` }, cell));
      return cell;
    }

    function buildOutsideBets() {
      els.outside.innerHTML = "";
      const groups = [
        {key:"red",type:"red",label:"Red (1:1)"},{key:"black",type:"black",label:"Black (1:1)"},
        {key:"even",type:"even",label:"Even (1:1)"},{key:"odd",type:"odd",label:"Odd (1:1)"},
        {key:"low",type:"low",label:"1-18 (1:1)"},{key:"high",type:"high",label:"19-36 (1:1)"},
        {key:"dozen:1",type:"dozen",group:1,label:"1st 12 (2:1)"},{key:"dozen:2",type:"dozen",group:2,label:"2nd 12 (2:1)"},{key:"dozen:3",type:"dozen",group:3,label:"3rd 12 (2:1)"},
        {key:"column:1",type:"column",group:1,label:"Column 1 (2:1)"},{key:"column:2",type:"column",group:2,label:"Column 2 (2:1)"},{key:"column:3",type:"column",group:3,label:"Column 3 (2:1)"},
      ];
      for (const g of groups) {
        const btn = document.createElement("button"); btn.textContent = g.label;
        btn.addEventListener("click", () => toggleSelection(g.key, { type:g.type, group:g.group, label:g.label }, btn));
        els.outside.appendChild(btn);
      }
    }

    function toggleSelection(key, payload, node) {
      if (selections.has(key)) { selections.delete(key); node.classList.remove("selected"); node.querySelector(".chip")?.remove(); }
      else { selections.set(key, { ...payload, node }); node.classList.add("selected"); }
      refreshSummary();
    }

    function refreshSummary() {
      for (const chip of container.querySelectorAll(".chip")) chip.remove();
      if (selections.size === 0) { els.summary.textContent = "No bets selected — click numbers or outside bets."; return; }
      const each = Math.floor(Math.round((Number(els.amount.value)||0)*100) / selections.size);
      const labels = [];
      for (const sel of selections.values()) {
        labels.push(`${sel.label} (${UI.money(each)})`);
        const chip = document.createElement("span"); chip.className = "chip"; chip.textContent = UI.money(each);
        sel.node.appendChild(chip);
      }
      els.summary.innerHTML = `<strong>${selections.size}</strong> bet(s), ${UI.money(each)} each — ${UI.money(each*selections.size)} total: ${labels.join(" · ")}`;
    }

    els.amount.addEventListener("input", refreshSummary);
    els.clear.addEventListener("click", () => {
      selections.clear();
      container.querySelectorAll(".roulette-cell.selected,.outside-bets button.selected").forEach(el => el.classList.remove("selected"));
      refreshSummary();
    });

    els.spin.addEventListener("click", async () => {
      if (busy) return;
      if (selections.size === 0) return UI.toast("Select at least one bet first.", "loss");
      const dollars = Number(els.amount.value);
      if (!dollars || dollars <= 0) return UI.toast("Enter a stake amount.", "loss");
      const each = Math.floor(Math.round(dollars*100) / selections.size);
      if (each <= 0) return UI.toast("Stake too small to split.", "loss");
      const bets = [...selections.values()].map((sel) => ({
        type: sel.type, amount: each,
        ...(sel.numbers ? { numbers: sel.numbers } : {}),
        ...(sel.group ? { group: sel.group } : {}),
      }));
      busy = true; els.spin.disabled = true;
      els.wheelResult.classList.add("hidden"); els.result.className = "result-banner";
      try {
        const res = await Api.post("/games/roulette/spin", { bets });
        const { landed, color, bets: breakdown } = res.result.state;
        await animateWheel(els.wheelCanvas, landed, 3000);
        els.pocket.textContent = String(landed);
        els.pocket.className = `pocket-badge ${color}`;
        els.pocketLabel.textContent = `Ball landed on ${landed} (${color})`;
        const wins = breakdown.filter((b) => b.won);
        els.pocketSub.textContent = wins.length ? `Winning: ${wins.map(w=>`${w.type}${w.numbers?.length===1?` (${w.numbers[0]})`:""} +${UI.money(w.payout)}`).join(", ")}` : "None of your bets covered this number.";
        els.wheelResult.classList.remove("hidden");
        const isWin = res.result.result === "win";
        els.result.className = `result-banner show ${isWin?"win":"loss"}`;
        els.result.textContent = isWin ? `🎉 Landed on ${landed} — won ${UI.money(res.result.payout)}!` : `Landed on ${landed} — lost ${UI.money(Math.round(dollars*100)-res.result.payout)} net.`;
        els.fairness.innerHTML = UI.fairnessLine({ serverSeedHash: accountState.fairness?.activeServerSeedHash, clientSeed: accountState.fairness?.clientSeed });
        UI.applyAccountUpdate(accountState, res);
        UI.toast(isWin ? `Won ${UI.money(res.result.payout)} on Roulette!` : `Lost on Roulette — ball on ${landed}.`, isWin?"win":"loss");
      } catch (err) {
        UI.toast(err.message, "loss");
      } finally {
        busy = false; els.spin.disabled = false;
      }
    });

    buildNumberGrid(); buildOutsideBets(); refreshSummary();
  }

  return { render };
})();
