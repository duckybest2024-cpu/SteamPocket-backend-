/**
 * Chip Store — buy play-money chips with real money via Stripe Checkout.
 *
 * Chips are virtual credits for in-game play only. They have NO cash value and
 * cannot be redeemed or exchanged for money — this is the standard "social
 * casino" model (legal e-commerce). Real-money cash-OUT is intentionally NOT
 * part of this screen.
 *
 * Backend: GET /wallet/packages (list) + POST /wallet/create-checkout-session
 * (redirect to Stripe). Chips are credited by the Stripe webhook after payment.
 */
const StoreGame = (() => {
  // Packs we visually feature. Everything else still renders normally.
  const POPULAR = "pro";
  const BEST_VALUE = "diamond";

  const money = (cents) => `$${(cents / 100).toFixed(2)}`;
  const perChip = (p) => p.priceCents / p.chips; // cents per chip, lower = better

  function render(container, state) {
    container.innerHTML = `
      <style>
        .store-wrap { padding: 24px; max-width: 1080px; margin: 0 auto; }

        /* Hero */
        .store-hero {
          position: relative; overflow: hidden;
          background:
            radial-gradient(120% 140% at 100% 0%, rgba(243,193,75,0.18), transparent 60%),
            linear-gradient(135deg, #14110a 0%, #0a0b10 55%, #110d05 100%);
          border: 1px solid var(--gold, #f3c14b);
          border-radius: 18px; padding: 30px 32px; margin-bottom: 22px;
        }
        .store-hero::after {
          content: ""; position: absolute; inset: 0;
          background: radial-gradient(60% 100% at 50% -20%, rgba(243,193,75,0.10), transparent 70%);
          pointer-events: none;
        }
        .store-hero h2 {
          font-size: 1.9rem; font-weight: 900; margin: 0 0 6px;
          background: linear-gradient(135deg, #fff5d6, #f3c14b 55%, #b8860b);
          -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
        }
        .store-hero p { color: var(--text-dim); margin: 0; font-size: 0.95rem; max-width: 560px; line-height: 1.5; }
        .store-hero-badges { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 16px; }
        .store-hero-badge {
          display: inline-flex; align-items: center; gap: 7px;
          background: rgba(243,193,75,0.08); border: 1px solid rgba(243,193,75,0.35);
          color: #f3c14b; border-radius: 999px; padding: 6px 13px; font-size: 0.8rem; font-weight: 600;
        }

        /* Grid */
        .store-grid {
          display: grid; grid-template-columns: repeat(auto-fill, minmax(232px, 1fr));
          gap: 16px; margin-bottom: 24px;
        }

        /* Card */
        .pack {
          position: relative; display: flex; flex-direction: column;
          background: linear-gradient(180deg, var(--bg-card) 0%, var(--bg-elev) 100%);
          border: 1px solid var(--border); border-radius: 16px;
          padding: 22px 20px 20px; transition: transform .18s ease, border-color .18s ease, box-shadow .18s ease;
        }
        .pack:hover { transform: translateY(-4px); border-color: rgba(243,193,75,0.55);
          box-shadow: 0 14px 36px -18px rgba(243,193,75,0.55); }
        .pack.featured {
          border-color: var(--gold, #f3c14b);
          box-shadow: 0 0 0 1px rgba(243,193,75,0.35), 0 18px 40px -22px rgba(243,193,75,0.7);
        }
        .pack-ribbon {
          position: absolute; top: 12px; right: -34px; transform: rotate(45deg);
          background: linear-gradient(135deg, #f3c14b, #b8860b); color: #1a1405;
          font-size: 0.62rem; font-weight: 900; letter-spacing: .08em;
          padding: 4px 38px; text-transform: uppercase; box-shadow: 0 2px 8px rgba(0,0,0,0.4);
        }
        .pack-emoji { font-size: 2.6rem; line-height: 1; margin-bottom: 10px; filter: drop-shadow(0 3px 6px rgba(0,0,0,0.5)); }
        .pack-name { font-size: 0.78rem; text-transform: uppercase; letter-spacing: .07em; color: var(--text-dim); font-weight: 700; }
        .pack-chips {
          font-size: 1.85rem; font-weight: 900; margin: 4px 0 2px;
          background: linear-gradient(135deg, #fff5d6, #f3c14b 60%, #b8860b);
          -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
        }
        .pack-chips small { font-size: 0.82rem; font-weight: 700; -webkit-text-fill-color: var(--text-dim); color: var(--text-dim); }
        .pack-badge {
          display: inline-block; align-self: flex-start; margin: 8px 0 2px;
          background: rgba(52,211,153,0.12); color: var(--win, #34d399);
          border: 1px solid rgba(52,211,153,0.35); border-radius: 999px;
          padding: 3px 10px; font-size: 0.7rem; font-weight: 700;
        }
        .pack-saving { font-size: 0.74rem; color: var(--text-dim); margin-top: 4px; min-height: 1.1em; }
        .pack-spacer { flex: 1; }
        .pack-price { font-size: 1.15rem; font-weight: 800; color: var(--text); margin: 14px 0 12px; }
        .pack-buy {
          width: 100%; padding: 12px; border: none; border-radius: 11px; cursor: pointer;
          font-weight: 800; font-size: 0.95rem; color: #1a1405;
          background: linear-gradient(135deg, #fce38a, #f3c14b 55%, #c9971f);
          transition: filter .15s, transform .05s;
        }
        .pack-buy:hover { filter: brightness(1.08); }
        .pack-buy:active { transform: translateY(1px); }
        .pack-buy:disabled { opacity: .5; cursor: progress; }

        /* Notice / disclaimer */
        .store-note {
          background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px;
          padding: 16px 18px; color: var(--text-dim); font-size: 0.82rem; line-height: 1.55;
        }
        .store-note strong { color: var(--text); }
        .store-banner {
          background: rgba(243,193,75,0.07); border: 1px solid rgba(243,193,75,0.3);
          border-radius: 12px; padding: 14px 16px; margin-bottom: 18px;
          color: #f3c14b; font-size: 0.85rem;
        }
        @media (max-width: 560px) { .store-wrap { padding: 16px; } .store-hero { padding: 22px; } }
      </style>

      <div class="store-wrap">
        <div class="store-hero">
          <h2>💰 Chip Store</h2>
          <p>Top up your chip balance instantly. The more you grab, the bigger the bonus.</p>
          <div class="store-hero-badges">
            <span class="store-hero-badge">⚡ Instant delivery</span>
            <span class="store-hero-badge">🔒 Secure checkout by Stripe</span>
            <span class="store-hero-badge">🪙 Current: <span id="store-bal">${Math.floor((state.balance || 0) / 100).toLocaleString()}</span></span>
          </div>
        </div>

        <div id="store-body">
          <div style="color:var(--text-dim);padding:40px;text-align:center;">⏳ Loading packages…</div>
        </div>
      </div>
    `;

    const body = container.querySelector("#store-body");

    Api.get("/wallet/packages").then((d) => {
      const packs = d.packages || [];
      if (!d.configured) {
        body.innerHTML = `<div class="store-note">
          <strong>💳 Payments not set up yet.</strong><br/>
          To go live, add <code>STRIPE_SECRET_KEY</code> and <code>STRIPE_WEBHOOK_SECRET</code> to the
          environment, then point a Stripe webhook at <code>/api/stripe/webhook</code> for the
          <code>checkout.session.completed</code> event. The packages below will become buyable instantly.
        </div>
        ${renderGrid(packs, false)}`;
      } else if (!d.enabled) {
        body.innerHTML = `<div class="store-banner">⏸️ Chip purchases are temporarily paused by the operator.</div>${renderGrid(packs, false)}`;
      } else {
        body.innerHTML = renderGrid(packs, true);
      }
      wireBuys(body, packs);
    }).catch((err) => {
      body.innerHTML = `<div class="store-note"><span style="color:var(--loss);">${(err && err.message) || "Couldn't load the store."}</span></div>`;
    });

    function renderGrid(packs, buyable) {
      // Flag the genuine best per-chip value automatically (in case prices change).
      let bestId = BEST_VALUE;
      if (packs.length) bestId = packs.reduce((a, b) => (perChip(b) < perChip(a) ? b : a)).id;

      const cards = packs.map((p) => {
        const featured = p.id === POPULAR || p.id === bestId;
        const ribbon = p.id === bestId ? "Best value" : (p.id === POPULAR ? "Popular" : "");
        return `
          <div class="pack ${featured ? "featured" : ""}">
            ${ribbon ? `<div class="pack-ribbon">${ribbon}</div>` : ""}
            <div class="pack-emoji">${p.emoji || "🪙"}</div>
            <div class="pack-name">${escapeHtml(p.name)}</div>
            <div class="pack-chips">${p.chips.toLocaleString()} <small>chips</small></div>
            ${p.badge ? `<span class="pack-badge">${escapeHtml(p.badge)}</span>` : ""}
            <div class="pack-saving">${p.saving ? escapeHtml(p.saving) : ""}</div>
            <div class="pack-spacer"></div>
            <div class="pack-price">${money(p.priceCents)}</div>
            <button class="pack-buy" data-pkg="${p.id}" ${buyable ? "" : "disabled"}>
              ${buyable ? "Buy now" : "Unavailable"}
            </button>
          </div>`;
      }).join("");

      return `<div class="store-grid">${cards}</div>
        <div class="store-note">
          <strong>Chips are virtual credits for play only.</strong> They have no cash value and cannot
          be exchanged, withdrawn, or redeemed for money. All sales are final. By purchasing you confirm
          you are of legal age in your country.
        </div>`;
    }

    function wireBuys(scope, packs) {
      scope.querySelectorAll(".pack-buy").forEach((btn) => {
        if (btn.disabled) return;
        btn.addEventListener("click", async () => {
          const pkgId = btn.dataset.pkg;
          const pkg = packs.find((p) => p.id === pkgId);
          btn.disabled = true;
          const original = btn.textContent;
          btn.textContent = "Redirecting…";
          try {
            const r = await Api.post("/wallet/create-checkout-session", { packageId: pkgId });
            if (r && r.url) {
              window.location.href = r.url; // hand off to Stripe's hosted page
            } else {
              throw new Error("No checkout URL returned");
            }
          } catch (err) {
            UI.toast((err && err.message) || "Couldn't start checkout.", "loss");
            btn.disabled = false;
            btn.textContent = original;
          }
          void pkg;
        });
      });
    }

    function escapeHtml(str) {
      return String(str ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    }
  }

  return { render };
})();
