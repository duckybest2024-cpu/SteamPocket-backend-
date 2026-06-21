const ChipShopGame = (() => {
  // $1 = 10 chips base rate — matches backend CHIP_PACKAGES in src/lib/stripe.ts
  const PACKAGES = [
    { id: "micro",      chips: 10,    priceCents: 100,   priceUAH: 4100,    name: "Micro Pack",   emoji: "🔵", badge: "Try it out",  saving: null },
    { id: "starter",    chips: 50,    priceCents: 500,   priceUAH: 20500,   name: "Starter Pack", emoji: "🟡", badge: "Best intro",  saving: null },
    { id: "regular",    chips: 100,   priceCents: 900,   priceUAH: 36900,   name: "Regular Pack", emoji: "🔴", badge: "10% off",     saving: "save $0.10" },
    { id: "pro",        chips: 250,   priceCents: 2000,  priceUAH: 82000,   name: "Pro Pack",     emoji: "💜", badge: "20% off",     saving: "save $0.50" },
    { id: "vip",        chips: 500,   priceCents: 3500,  priceUAH: 143500,  name: "VIP Pack",     emoji: "🟣", badge: "30% off",     saving: "save $1.50" },
    { id: "highroller", chips: 1000,  priceCents: 6000,  priceUAH: 246000,  name: "High Roller",  emoji: "⚫", badge: "40% off",     saving: "save $4" },
    { id: "whale",      chips: 2500,  priceCents: 12000, priceUAH: 492000,  name: "Whale Pack",   emoji: "🔷", badge: "52% off",     saving: "save $13" },
    { id: "diamond",    chips: 10000, priceCents: 35000, priceUAH: 1435000, name: "Diamond Pack", emoji: "💎", badge: "65% off",     saving: "save $65" },
  ];

  let selectedCurrency = localStorage.getItem("casino_currency") || "USD";

  function usd(cents) { return `$${(cents / 100).toFixed(2)}`; }
  function uah(kopecks) { return `₴${(kopecks / 100).toFixed(0)}`; }
  function formatPrice(pkg) {
    return selectedCurrency === "UAH" ? uah(pkg.priceUAH) : usd(pkg.priceCents);
  }

  function render(container, accountState) {
    function rebuild() {
      const gameChips = Math.floor(accountState.balance / 100);
      const bankChips = Math.floor((accountState.bank || 0) / 100);

      container.innerHTML = `
        <div class="game-panel">
          <div class="game-header">
            <h2>🏦 Chip Cage</h2>
            <p>Buy chips with a card (test mode — use card <code>4242 4242 4242 4242</code>), or move chips between your bank and table.</p>
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

          <!-- LiqPay card purchase -->
          <div class="chip-section stripe-section">
            <div class="stripe-header" style="flex-wrap:wrap;gap:8px">
              <h3>💳 Buy Chips with Card</h3>
              <div style="display:flex;align-items:center;gap:8px;margin-left:auto">
                <span style="font-size:0.78rem;color:var(--text-dim)">Currency:</span>
                <button id="curr-usd" class="secondary-btn" style="padding:4px 12px;font-size:0.8rem;${selectedCurrency==="USD"?"border-color:var(--accent);color:var(--accent)":""}">$ USD</button>
                <button id="curr-uah" class="secondary-btn" style="padding:4px 12px;font-size:0.8rem;${selectedCurrency==="UAH"?"border-color:var(--accent);color:var(--accent)":""}">₴ UAH</button>
                <span class="stripe-badge" style="background:rgba(0,160,255,0.15);color:#40b3ff;border-color:rgba(0,160,255,0.4)">LiqPay</span>
              </div>
            </div>
            <p class="chip-section-hint">
              Pay securely via LiqPay — Visa, Mastercard, Privat24, monobank and all Ukrainian cards.
              Chips are credited instantly after payment is confirmed.
            </p>
            <div class="buy-packages">
              ${PACKAGES.map(p => `
                <div class="chip-pkg" data-id="${p.id}">
                  <div class="pkg-top">
                    <span class="pkg-emoji">${p.emoji}</span>
                    ${p.saving ? `<span class="pkg-saving">${p.saving}</span>` : ""}
                  </div>
                  <div class="pkg-name">${p.name}</div>
                  <div class="pkg-chips">${p.chips.toLocaleString()} 🪙</div>
                  <div class="pkg-price pkg-price-display" data-usd="${usd(p.priceCents)}" data-uah="${uah(p.priceUAH)}">${formatPrice(p)}</div>
                  <button class="liqpay-buy-btn" data-id="${p.id}">Buy now</button>
                </div>
              `).join("")}
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

      // Currency toggle
      const usdBtn = container.querySelector("#curr-usd");
      const uahBtn = container.querySelector("#curr-uah");
      function setCurrency(cur) {
        selectedCurrency = cur;
        localStorage.setItem("casino_currency", cur);
        [usdBtn, uahBtn].forEach(b => b && (b.style.borderColor = b.id === `curr-${cur.toLowerCase()}` ? "var(--accent)" : "var(--border)", b.style.color = b.id === `curr-${cur.toLowerCase()}` ? "var(--accent)" : "var(--text-dim)"));
        container.querySelectorAll(".pkg-price-display").forEach(el => {
          el.textContent = cur === "UAH" ? el.dataset.uah : el.dataset.usd;
        });
      }
      if (usdBtn) usdBtn.addEventListener("click", () => setCurrency("USD"));
      if (uahBtn) uahBtn.addEventListener("click", () => setCurrency("UAH"));

      // LiqPay buy buttons — get signed payload from server, then submit form to LiqPay
      container.querySelectorAll(".liqpay-buy-btn").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const pkgId = btn.dataset.id;
          btn.disabled = true;
          btn.textContent = "Loading…";
          try {
            const { data, signature, checkoutUrl } = await Api.post("/wallet/liqpay-checkout", { packageId: pkgId, currency: selectedCurrency });
            const form = document.createElement("form");
            form.method = "POST";
            form.action = checkoutUrl;
            form.style.display = "none";
            [["data", data], ["signature", signature]].forEach(([name, value]) => {
              const input = document.createElement("input");
              input.type = "hidden";
              input.name = name;
              input.value = value;
              form.appendChild(input);
            });
            document.body.appendChild(form);
            form.submit();
          } catch (err) {
            UI.toast(err.message || "Payment unavailable — add LIQPAY_PUBLIC_KEY and LIQPAY_PRIVATE_KEY to env", "loss");
            btn.disabled = false;
            btn.textContent = "Buy now";
          }
        });
      });

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
