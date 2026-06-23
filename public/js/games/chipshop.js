const ChipShopGame = (() => {
  function render(container, accountState) {
    function rebuild() {
      const gameChips = Math.floor(accountState.balance / 100);
      const bankChips = Math.floor((accountState.bank || 0) / 100);

      container.innerHTML = `
        <div class="game-panel">
          <div class="game-header">
            <h2>🏦 Chip Cage</h2>
            <p>Move chips between your bank and table, or redeem a promo code.</p>
          </div>

          <div class="chip-balances">
            <div class="chip-bal-card playing">
              <div class="cbc-label">Playing Chips</div>
              <div class="cbc-amount">${gameChips.toLocaleString()} 🪙</div>
              <div class="cbc-hint">On the table</div>
            </div>
            <div class="chip-bal-card bank">
              <div class="cbc-label">Bank</div>
              <div class="cbc-amount">${bankChips.toLocaleString()} 🏦</div>
              <div class="cbc-hint">Safe from losses</div>
            </div>
          </div>

          <!-- Cash out to bank -->
          <div class="chip-section cashout-section">
            <h3>💰 Cash Out to Bank</h3>
            <p class="chip-section-hint">Lock chips in the bank — safe from bets. Min 50 chips.</p>
            ${gameChips === 0 ? `<p class="chip-empty-hint">No chips on the table to cash out.</p>` : `
              <div class="controls-row" style="margin-bottom:10px">
                <div class="field">
                  <label>Amount (chips)</label>
                  <input type="number" id="cashout-amount" min="50" max="${gameChips}" value="${gameChips}" />
                </div>
              </div>
              <div class="cashout-preview">
                <div class="cashout-row"><span>Playing chips</span><span>${gameChips.toLocaleString()} 🪙</span></div>
              </div>
              <div class="btn-row" style="margin-top:12px;gap:8px">
                <button id="cashout-btn" class="danger-btn">Cash Out Selected</button>
                <button id="cashout-all-btn" class="danger-btn" style="opacity:0.7">Cash Out All</button>
              </div>
            `}
          </div>

          <!-- Buy from bank -->
          ${bankChips > 0 ? `
          <div class="chip-section">
            <h3>🏦 Move from Bank to Table</h3>
            <p class="chip-section-hint">You have ${bankChips.toLocaleString()} chips in the bank.</p>
            <div class="controls-row">
              <div class="field">
                <label>Amount (chips)</label>
                <input type="number" id="buy-from-bank" min="1" max="${bankChips}" value="${Math.min(bankChips, 100)}" />
              </div>
              <div class="btn-row" style="align-items:flex-end">
                <button id="bank-to-table-btn" class="primary-btn">Move to Table</button>
              </div>
            </div>
          </div>` : ""}

          <!-- Promo code -->
          <div class="chip-section">
            <h3>🎫 Promo Code</h3>
            <p class="chip-section-hint">Have a promo code? Enter it below to claim free chips.</p>
            <div class="controls-row">
              <div class="field">
                <label>Promo Code</label>
                <input type="text" id="promo-code-input" placeholder="EXAMPLE2024" style="text-transform:uppercase" />
              </div>
              <div class="btn-row" style="align-items:flex-end">
                <button id="promo-redeem-btn" class="primary-btn">Redeem</button>
              </div>
            </div>
            <div id="promo-result" style="font-size:0.85rem;margin-top:8px"></div>
          </div>
        </div>
      `;

      // Cash out (chosen amount)
      async function doCashout(allChips) {
        const amountInput = container.querySelector("#cashout-amount");
        const chips = allChips ? null : Math.round(Number(amountInput?.value || 0));
        if (!allChips && (!chips || chips < 50)) return UI.toast("Minimum cashout is 50 chips", "loss");
        const body = chips ? { amount: chips * 100 } : {};
        try {
          const res = await Api.post("/wallet/cashout-chips", body);
          accountState.balance = res.balance;
          accountState.bank = res.bank;
          UI.setBalance(res.balance);
          UI.toast(`${Math.floor(res.cashedOut / 100).toLocaleString()} chips moved to bank!`, "win");
          rebuild();
        } catch (err) {
          UI.toast(err.message, "loss");
        }
      }
      const cashoutBtn = container.querySelector("#cashout-btn");
      if (cashoutBtn) cashoutBtn.addEventListener("click", () => doCashout(false));
      const cashoutAllBtn = container.querySelector("#cashout-all-btn");
      if (cashoutAllBtn) cashoutAllBtn.addEventListener("click", () => doCashout(true));

      // Bank → table
      const b2tBtn = container.querySelector("#bank-to-table-btn");
      if (b2tBtn) {
        b2tBtn.addEventListener("click", async () => {
          const chips = Math.round(Number(container.querySelector("#buy-from-bank").value));
          if (!chips || chips <= 0) return;
          b2tBtn.disabled = true;
          try {
            const res = await Api.post("/wallet/buy-chips", { amount: chips * 100 });
            accountState.balance = res.balance;
            accountState.bank = res.bank;
            UI.setBalance(res.balance);
            UI.toast(`${chips} chips moved to table!`, "win");
            rebuild();
          } catch (err) {
            UI.toast(err.message, "loss");
            b2tBtn.disabled = false;
          }
        });
      }

      // Promo code redemption
      const promoInput = container.querySelector("#promo-code-input");
      const promoRedeemBtn = container.querySelector("#promo-redeem-btn");
      const promoResult = container.querySelector("#promo-result");
      if (promoInput) {
        promoInput.addEventListener("input", () => {
          promoInput.value = promoInput.value.toUpperCase();
        });
      }
      if (promoRedeemBtn) {
        promoRedeemBtn.addEventListener("click", async () => {
          const code = (promoInput ? promoInput.value.trim().toUpperCase() : "");
          if (!code) {
            if (promoResult) { promoResult.style.color = "var(--loss)"; promoResult.textContent = "Enter a promo code."; }
            return;
          }
          promoRedeemBtn.disabled = true;
          promoRedeemBtn.textContent = "Redeeming…";
          if (promoResult) promoResult.textContent = "";
          try {
            const res = await Api.post("/wallet/promo/redeem", { code });
            if (promoResult) {
              promoResult.style.color = "var(--win)";
              promoResult.textContent = res.message || `Redeemed! ${Math.floor((res.chips || 0) / 100)} chips added.`;
            }
            accountState.balance = res.balance;
            UI.setBalance(res.balance);
            UI.toast(res.message || "Promo code redeemed!", "win");
            if (typeof App !== "undefined" && App.refreshAccount) App.refreshAccount();
            rebuild();
          } catch (err) {
            if (promoResult) {
              promoResult.style.color = "var(--loss)";
              promoResult.textContent = err.message || "Failed to redeem code.";
            }
            UI.toast(err.message || "Failed to redeem.", "loss");
            promoRedeemBtn.disabled = false;
            promoRedeemBtn.textContent = "Redeem";
          }
        });
      }
    }

    rebuild();
  }

  return { render };
})();
