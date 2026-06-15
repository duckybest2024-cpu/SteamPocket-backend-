const PlinkoGame = (() => {
  function render(container, accountState) {
    let risk = "medium";
    let rows = 12;
    let busy = false;

    container.innerHTML = `
      <div class="game-layout">

          <div class="bet-panel">
            <div class="bp-tabs">
              <button class="bp-tab active" id="plinko-tab-manual">Manual</button>
              <button class="bp-tab" id="plinko-tab-auto">Auto</button>
            </div>

            <div class="bp-field">
              <div class="bp-label">Bet Amount</div>
              <div class="bp-input-row">
                <input type="number" id="plinko-amount" value="10" min="1" step="1" />
                <button class="quick-btn" id="plinko-half">½</button>
                <button class="quick-btn" id="plinko-dbl">2×</button>
              </div>
            </div>

            <div class="bp-field">
              <div class="bp-label">Risk</div>
              <select id="plinko-risk">
                <option value="low">Low</option>
                <option value="medium" selected>Medium</option>
                <option value="high">High</option>
              </select>
            </div>

            <div class="bp-field">
              <div class="bp-label">Rows</div>
              <select id="plinko-rows">
                <option value="8">8</option>
                <option value="10">10</option>
                <option value="12" selected>12</option>
                <option value="14">14</option>
                <option value="16">16</option>
              </select>
            </div>

            <button id="plinko-drop" class="play-btn">Drop Ball</button>
          </div>

          <div class="game-canvas">
            <div class="plinko-board" id="plinko-board" style="flex:1; min-height:380px; position:relative;"></div>
            <div class="plinko-slots-wrap" id="plinko-slots-wrap">
              <div class="plinko-slots" id="plinko-slots"></div>
            </div>
            <div id="plinko-result" class="result-banner"></div>
            <div id="plinko-fairness" class="fairness-line"></div>
          </div>

        </div>
    `;

    const els = {
      board: container.querySelector("#plinko-board"),
      slotsWrap: container.querySelector("#plinko-slots-wrap"),
      slots: container.querySelector("#plinko-slots"),
      amount: container.querySelector("#plinko-amount"),
      half: container.querySelector("#plinko-half"),
      dbl: container.querySelector("#plinko-dbl"),
      riskSel: container.querySelector("#plinko-risk"),
      rowsSel: container.querySelector("#plinko-rows"),
      drop: container.querySelector("#plinko-drop"),
      result: container.querySelector("#plinko-result"),
      fairness: container.querySelector("#plinko-fairness"),
    };

    // Multiplier tables mirror src/games/plinko.ts
    const TABLES = {
      low: {
        8: [5.6,2.1,1.1,1,0.5,1,1.1,2.1,5.6],
        10:[8.9,3,1.4,1.1,1,0.5,1,1.1,1.4,3,8.9],
        12:[10,3,1.6,1.4,1.1,1,0.5,1,1.1,1.4,1.6,3,10],
        14:[15,4,1.9,1.4,1.1,1,0.7,0.5,0.7,1,1.1,1.4,1.9,4,15],
        16:[16,9,2,1.4,1.4,1.2,1.1,1,0.5,1,1.1,1.2,1.4,1.4,2,9,16],
      },
      medium: {
        8:[10,2.5,1.2,0.7,0.6,0.7,1.2,2.5,10],
        10:[18,4.5,1.8,1.2,0.7,0.5,0.7,1.2,1.8,4.5,18],
        12:[22,9,3.5,1.7,1.1,0.6,0.5,0.6,1.1,1.7,3.5,9,22],
        14:[45,12,6,3.5,1.9,1,0.5,0.4,0.5,1,1.9,3.5,6,12,45],
        16:[85,30,9,4.5,2.8,1.5,1,0.5,0.4,0.5,1,1.5,2.8,4.5,9,30,85],
      },
      high: {
        8:[29,4,1.5,0.3,0.2,0.3,1.5,4,29],
        10:[76,10,3,0.9,0.3,0.2,0.3,0.9,3,10,76],
        12:[170,24,8.1,2,0.7,0.2,0.2,0.2,0.7,2,8.1,24,170],
        14:[420,56,18,5,1.9,0.3,0.2,0.2,0.2,0.3,1.9,5,18,56,420],
        16:[1000,130,26,9,4,2,0.2,0.2,0.2,0.2,0.2,2,4,9,26,130,1000],
      },
    };

    let boardLayout = null;

    function getLayout() {
      const w = els.board.clientWidth || 500;
      const h = els.board.clientHeight || 360;
      const spread = w / (rows + 3); // horizontal peg spacing
      const topPad = 30;
      const bottomPad = 40;
      return { w, h, spread, topPad, bottomPad };
    }

    function slotColor(mult) {
      if (mult >= 10) return "#fbbf24"; // gold
      if (mult >= 3)  return "#22d3ee"; // cyan
      if (mult >= 1)  return "#6f5cf2"; // purple
      return "#f87171";                  // red (sub-1x)
    }

    function buildBoard() {
      els.board.innerHTML = "";
      boardLayout = getLayout();
      const { w, h, spread, topPad, bottomPad } = boardLayout;

      // Peg rows: row r has (r + 3) pegs centred horizontally
      for (let r = 0; r < rows; r++) {
        const pegCount = r + 3;
        const y = topPad + (r / (rows - 1)) * (h - topPad - bottomPad);
        for (let c = 0; c < pegCount; c++) {
          const x = w / 2 + (c - (pegCount - 1) / 2) * spread;
          const peg = document.createElement("div");
          peg.className = "peg";
          peg.style.left = `${x - 3}px`;
          peg.style.top = `${y - 3}px`;
          els.board.appendChild(peg);
        }
      }

      // Ball (hidden until drop)
      const ball = document.createElement("div");
      ball.className = "plinko-ball";
      ball.id = "plinko-ball";
      ball.style.left = `${w / 2 - 7}px`;
      ball.style.top = `${topPad - 16}px`;
      ball.style.display = "none";
      els.board.appendChild(ball);
    }

    function buildSlots(table) {
      const { w, spread } = boardLayout || getLayout();
      // Each slot width = spread so centers align with ball trajectory.
      // Container spans (rows+1) slots, centred on the board.
      const slotCount = table.length; // = rows + 1
      const containerWidth = slotCount * spread;
      const marginLeft = (w - containerWidth) / 2;

      els.slots.innerHTML = "";
      els.slots.style.gridTemplateColumns = `repeat(${slotCount}, ${spread}px)`;
      els.slots.style.gap = "0";
      els.slotsWrap.style.paddingLeft = `${marginLeft}px`;
      els.slotsWrap.style.paddingRight = `${marginLeft}px`;

      table.forEach((mult) => {
        const slot = document.createElement("div");
        slot.className = "plinko-slot";
        slot.textContent = `${mult}x`;
        slot.style.setProperty("--slot-color", slotColor(mult));
        els.slots.appendChild(slot);
      });
    }

    function refreshLayout() {
      buildBoard();
      buildSlots(TABLES[risk][rows]);
    }

    els.riskSel.addEventListener("change", () => { risk = els.riskSel.value; refreshLayout(); });
    els.rowsSel.addEventListener("change", () => { rows = Number(els.rowsSel.value); refreshLayout(); });

    els.half.addEventListener("click", () => {
      els.amount.value = Math.max(1, Math.floor(Number(els.amount.value) * 0.5));
    });
    els.dbl.addEventListener("click", () => {
      els.amount.value = Math.floor(Number(els.amount.value) * 2);
    });

    container.querySelectorAll(".bp-tab").forEach(t => t.addEventListener("click", function() {
      container.querySelectorAll(".bp-tab").forEach(x => x.classList.remove("active"));
      this.classList.add("active");
    }));

    let resizeTimer;
    const onResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(refreshLayout, 100);
    };
    window.addEventListener("resize", onResize);

    function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

    async function animateDrop(path, slot) {
      const ball = els.board.querySelector("#plinko-ball");
      const { w, h, spread, topPad, bottomPad } = boardLayout || getLayout();

      ball.style.display = "block";
      ball.style.transition = "none";
      ball.style.left = `${w / 2 - 7}px`;
      ball.style.top = `${topPad - 16}px`;
      void ball.offsetHeight; // flush layout
      ball.style.transition = "left 0.26s cubic-bezier(.2,.9,.3,1), top 0.26s cubic-bezier(.2,.9,.3,1)";

      let x = w / 2;
      for (let r = 0; r < path.length; r++) {
        x += path[r] === 1 ? spread / 2 : -spread / 2;
        const y = topPad + ((r + 1) / rows) * (h - topPad - bottomPad);
        ball.style.left = `${x - 7}px`;
        ball.style.top = `${y - 7}px`;
        await sleep(280);
      }

      // Highlight the correct slot
      const slotEl = els.slots.children[slot];
      if (slotEl) {
        slotEl.classList.add("landed");
        slotEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }

    els.drop.addEventListener("click", async () => {
      if (busy) return;
      const chips = Number(els.amount.value);
      if (!chips || chips <= 0) return UI.toast("Enter a bet amount.", "loss");
      const amount = Math.round(chips * 100); // chips → cents

      busy = true;
      els.drop.disabled = true;
      for (const s of els.slots.children) s.classList.remove("landed");
      els.result.className = "result-banner";

      try {
        const res = await Api.post("/games/plinko", { amount, risk, rows });
        const { path, slot } = res.result.state;
        await animateDrop(path, slot);

        const isWin = res.result.result === "win";
        els.result.className = `result-banner show ${isWin ? "win" : "loss"}`;
        els.result.textContent = isWin
          ? `🎉 Landed in the ${res.result.multiplier}x slot — won ${UI.money(res.result.payout)}!`
          : `Landed in the ${res.result.multiplier}x slot — payout ${UI.money(res.result.payout)} on a ${UI.money(amount)} bet.`;

        els.fairness.innerHTML = UI.fairnessLine({
          serverSeedHash: accountState.fairness?.activeServerSeedHash,
          clientSeed: accountState.fairness?.clientSeed,
          nonce: res.nextNonce - 1,
        });

        UI.applyAccountUpdate(accountState, res);
        UI.toast(isWin ? `Won ${UI.money(res.result.payout)} on Plinko!` : `Plinko: ${UI.money(res.result.payout)} back.`, isWin ? "win" : "info");
      } catch (err) {
        UI.toast(err.message, "loss");
      } finally {
        busy = false;
        els.drop.disabled = false;
      }
    });

    // Defer layout so the board has rendered dimensions
    requestAnimationFrame(() => refreshLayout());
    return () => window.removeEventListener("resize", onResize);
  }

  return { render };
})();