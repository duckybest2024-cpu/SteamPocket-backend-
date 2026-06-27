const AdminGame = (() => {
  const RANK_INFO = {
    newcomer:    { label: "Newcomer",     c: "#9ca3af" },
    beginner:    { label: "Beginner",     c: "#6b7280" },
    amateur:     { label: "Amateur",      c: "#78716c" },
    apprentice:  { label: "Apprentice",   c: "#92400e" },
    bronze:      { label: "Bronze",       c: "#cd7f32" },
    silver:      { label: "Silver",       c: "#c0c0c0" },
    gold:        { label: "Gold",         c: "#ffd700" },
    platinum:    { label: "Platinum",     c: "#b9f2ff" },
    diamond:     { label: "Diamond",      c: "#00e5ff" },
    emerald:     { label: "Emerald",      c: "#10b981" },
    sapphire:    { label: "Sapphire",     c: "#3b82f6" },
    ruby:        { label: "Ruby",         c: "#ef4444" },
    jade:        { label: "Jade",         c: "#06b6d4" },
    crystal:     { label: "Crystal",      c: "#8b5cf6" },
    elite:       { label: "Elite",        c: "#6366f1" },
    master:      { label: "Master",       c: "#f59e0b" },
    grandmaster: { label: "Grandmaster",  c: "#f97316" },
    legend:      { label: "Legend",       c: "#ec4899" },
    titan:       { label: "Titan",        c: "#a855f7" },
    owner:       { label: "👑 Owner",     c: "#a855f7" },
  };

  const PATREON_TIER_INFO = {
    bronze_patron:   { label: "🥉 Bronze Patron",   c: "#cd7f32", price: "$1/mo" },
    silver_patron:   { label: "🥈 Silver Patron",   c: "#c0c0c0", price: "$5/mo" },
    gold_patron:     { label: "🥇 Gold Patron",     c: "#ffd700", price: "$10/mo" },
    platinum_patron: { label: "💠 Platinum Patron", c: "#b9f2ff", price: "$25/mo" },
    diamond_patron:  { label: "💎 Diamond Patron",  c: "#00e5ff", price: "$50/mo" },
    netherite_patron:{ label: "⚫ Netherite Patron", c: "#4a4a52", price: "$75/mo" },
  };

  const RANK_OPTS = ["newcomer","beginner","amateur","apprentice","bronze","silver","gold","platinum","diamond","emerald","sapphire","ruby","jade","crystal","elite","master","grandmaster","legend","titan"];

  const GAMES = ["dice","limbo","mines","plinko","crash","keno","hilo","blackjack","roulette","slots","baccarat","videopoker","wheel","coinflip"];

  const S = {
    panel: `background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:24px;`,
    header: `display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:20px;`,
    title: `margin:0;font-size:1.3rem;`,
    subtitle: `margin:4px 0 0;font-size:0.82rem;color:var(--loss);font-weight:600;`,
    tabs: `display:flex;gap:8px;margin-bottom:22px;flex-wrap:wrap;`,
    tab: `background:var(--bg-elev);border:1px solid var(--border);color:var(--text-dim);padding:9px 18px;border-radius:999px;cursor:pointer;font-size:0.85rem;font-weight:700;`,
    tabActive: `background:rgba(111,92,242,0.18);border-color:var(--accent);color:var(--text);`,
    statsGrid: `display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px;margin-bottom:8px;`,
    statBox: `background:var(--bg-elev);border:1px solid var(--border);border-radius:12px;padding:16px;display:flex;flex-direction:column;gap:4px;`,
    sbLabel: `font-size:0.68rem;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.05em;`,
    sbValue: `font-size:1.25rem;font-weight:900;color:var(--text);`,
    searchRow: `display:flex;gap:10px;align-items:center;margin-bottom:16px;flex-wrap:wrap;`,
    searchInput: `background:var(--bg-elev);border:1px solid var(--border);color:var(--text);padding:10px 14px;border-radius:10px;font-size:0.9rem;flex:1;min-width:180px;`,
    tableWrap: `overflow-x:auto;`,
    table: `width:100%;border-collapse:collapse;font-size:0.85rem;`,
    th: `text-align:left;padding:10px 12px;font-size:0.68rem;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-dim);border-bottom:1px solid var(--border);white-space:nowrap;`,
    td: `padding:10px 12px;border-bottom:1px solid var(--border);white-space:nowrap;`,
    banBtn: `background:transparent;border:1px solid rgba(248,113,113,0.45);color:var(--loss);border-radius:7px;padding:5px 11px;font-weight:700;font-size:0.78rem;cursor:pointer;`,
    unbanBtn: `background:transparent;border:1px solid rgba(52,211,153,0.45);color:var(--win);border-radius:7px;padding:5px 11px;font-weight:700;font-size:0.78rem;cursor:pointer;`,
    usernameLink: `color:var(--accent-2);cursor:pointer;font-weight:700;text-decoration:underline;text-decoration-color:rgba(34,211,238,0.35);`,
    bannedRow: `opacity:0.6;`,
    form: `display:flex;flex-direction:column;gap:14px;max-width:480px;`,
    formGroup: `display:flex;flex-direction:column;gap:6px;`,
    formLabel: `font-size:0.75rem;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.05em;`,
    formInput: `background:var(--bg-elev);border:1px solid var(--border);color:var(--text);padding:11px 14px;border-radius:10px;font-size:0.95rem;`,
    formSelect: `background:var(--bg-elev);border:1px solid var(--border);color:var(--text);padding:11px 14px;border-radius:10px;font-size:0.95rem;`,
    submitBtn: `background:linear-gradient(135deg,var(--accent),#8b5cf6);color:white;border:none;border-radius:10px;padding:11px 22px;font-weight:700;font-size:0.95rem;cursor:pointer;width:fit-content;`,
    dangerZone: `border:1px solid rgba(248,113,113,0.4);border-radius:12px;padding:20px;background:rgba(248,113,113,0.05);margin-top:4px;`,
    dangerTitle: `margin:0 0 14px;font-size:1rem;color:var(--loss);`,
    deleteBtn: `background:linear-gradient(135deg,var(--loss),#ef4444);color:#2c0a0a;border:none;border-radius:10px;padding:11px 22px;font-weight:700;font-size:0.95rem;cursor:pointer;margin-top:6px;`,
    resultBox: `margin-top:14px;padding:14px;border-radius:10px;font-size:0.88rem;font-weight:600;background:var(--bg-elev);border:1px solid var(--border);color:var(--text);`,
    pagination: `display:flex;gap:8px;align-items:center;margin-top:14px;flex-wrap:wrap;`,
    pageBtn: `background:var(--bg-elev);border:1px solid var(--border);color:var(--text-dim);padding:7px 14px;border-radius:8px;cursor:pointer;font-size:0.82rem;font-weight:600;`,
    pageBtnActive: `border-color:var(--accent);color:var(--accent-2);background:rgba(111,92,242,0.12);`,
    bankCard: `background:var(--bg-elev);border:1px solid var(--border);border-radius:12px;padding:18px;`,
    bankGrid: `display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px;margin-bottom:18px;`,
    incomePos: `color:var(--win);font-weight:800;`,
    incomeNeg: `color:var(--loss);font-weight:800;`,
    rankSelect: `background:var(--bg-elev);border:1px solid var(--border);color:var(--text);padding:4px 8px;border-radius:8px;font-size:0.8rem;cursor:pointer;`,
    sectionCard: `background:var(--bg-elev);border:1px solid var(--border);border-radius:12px;padding:18px;margin-bottom:16px;`,
    sectionTitle: `margin:0 0 14px;font-size:1rem;font-weight:800;`,
    smallBtn: `background:var(--bg-elev);border:1px solid var(--border);color:var(--text);border-radius:7px;padding:5px 11px;font-weight:700;font-size:0.78rem;cursor:pointer;`,
    redBtn: `background:transparent;border:1px solid rgba(248,113,113,0.45);color:var(--loss);border-radius:7px;padding:5px 11px;font-weight:700;font-size:0.78rem;cursor:pointer;`,
    greenBtn: `background:transparent;border:1px solid rgba(52,211,153,0.45);color:var(--win);border-radius:7px;padding:5px 11px;font-weight:700;font-size:0.78rem;cursor:pointer;`,
    toggleOn: `background:rgba(52,211,153,0.15);border:1px solid rgba(52,211,153,0.5);color:var(--win);border-radius:7px;padding:5px 14px;font-weight:700;font-size:0.78rem;cursor:pointer;`,
    toggleOff: `background:rgba(248,113,113,0.12);border:1px solid rgba(248,113,113,0.4);color:var(--loss);border-radius:7px;padding:5px 14px;font-weight:700;font-size:0.78rem;cursor:pointer;`,
    badge: `display:inline-block;border-radius:6px;padding:2px 8px;font-size:0.72rem;font-weight:700;`,
  };

  const TABS = ["stats","users","adjust","bets","players","broadcasts","promos","controls","nfts","bank","danger","maintenance","config","ipblocks","reports","analytics","referrals","leaderboard","chatmod","scratch","prizes","subscriptions"];

  function money(cents) { return UI.money(cents); }
  function chips(cents) { return Math.floor(cents / 100).toLocaleString() + " 🪙"; }
  function fmtDate(d) { return new Date(d).toLocaleString(); }

  function rankBadge(rank) {
    const r = RANK_INFO[rank] || RANK_INFO.bronze;
    return `<span style="color:${r.c};font-weight:700;font-size:0.78rem;">${r.label}</span>`;
  }

  function typeBadge(type) {
    const map = { info: "#6366f1", win: "#10b981", loss: "#ef4444", warning: "#f59e0b" };
    const col = map[type] || "#6366f1";
    return `<span style="${S.badge};background:${col}22;color:${col};border:1px solid ${col}44;">${type}</span>`;
  }

  // ── User Detail Modal ───────────────────────────────────────────────────────
  function openUserDetailModal(userId) {
    const existing = document.getElementById("adm-user-modal-overlay");
    if (existing) existing.remove();

    const overlay = document.createElement("div");
    overlay.id = "adm-user-modal-overlay";
    overlay.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:1000;display:flex;align-items:flex-start;justify-content:center;padding:40px 16px;overflow-y:auto;`;
    overlay.innerHTML = `
      <div id="adm-user-modal" style="background:var(--bg-card);border:1px solid var(--border);border-radius:16px;width:100%;max-width:820px;padding:28px;position:relative;min-height:200px;">
        <button id="adm-modal-close" style="position:absolute;top:14px;right:14px;background:var(--bg-elev);border:1px solid var(--border);color:var(--text);border-radius:8px;padding:6px 12px;cursor:pointer;font-weight:700;">✕ Close</button>
        <div id="adm-modal-body" style="color:var(--text-dim);padding:40px 0;text-align:center;">⏳ Loading user detail…</div>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
    overlay.querySelector("#adm-modal-close").addEventListener("click", () => overlay.remove());

    Api.get(`/admin/users/${userId}/detail`).then(data => {
      const { user, bets, txs, nfts } = data;
      const body = overlay.querySelector("#adm-modal-body");
      body.innerHTML = `
        <div style="display:flex;flex-wrap:wrap;gap:12px;margin-bottom:20px;">
          <div style="flex:1;min-width:180px;">
            <h2 style="margin:0 0 4px;font-size:1.2rem;">${user.username}</h2>
            <div style="color:var(--text-dim);font-size:0.82rem;margin-bottom:8px;">${user.email}</div>
            ${rankBadge(user.rank || "bronze")}
            ${user.isBanned ? ` <span style="color:var(--loss);font-weight:700;font-size:0.78rem;">🚫 Banned</span>` : ""}
          </div>
          <div style="${S.statsGrid};flex:2;min-width:260px;">
            ${[
              ["Balance", money(user.balance||0), "var(--gold)"],
              ["Bank", money(user.bank||0), "var(--accent-2)"],
              ["Level", `Lv ${user.level}`, "var(--text)"],
              ["Total Bets", (user._count?.bets||0).toLocaleString(), "var(--text)"],
              ["NFTs", (user._count?.nfts||0).toLocaleString(), "var(--text)"],
            ].map(([l,v,c]) => `
              <div style="${S.statBox}">
                <div style="${S.sbLabel}">${l}</div>
                <div style="${S.sbValue};color:${c};font-size:1rem;">${v}</div>
              </div>`).join("")}
          </div>
        </div>

        <button id="adm-modal-zero-btn" data-id="${user.id}" style="${S.redBtn};margin-bottom:18px;">
          Zero Balance
        </button>

        <h3 style="margin:0 0 10px;font-size:0.9rem;font-weight:800;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.05em;">💵 Real-Money Payout</h3>
        <div style="background:var(--bg-elev);border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:18px;">
          <div style="font-size:0.85rem;color:var(--text-dim);margin-bottom:10px;">
            ${user.payoutMethod === "paypal"
              ? `PayPal: <strong style="color:var(--text);">${user.payoutPaypalEmail || "—"}</strong>`
              : user.payoutMethod === "card"
              ? `Card on file: <strong style="color:var(--text);">${user.stripeCardBrand || "card"} •••• ${user.stripeCardLast4 || "????"}</strong>`
              : user.payoutMethod === "note"
              ? `Payout note: <strong style="color:var(--text);">${(user.payoutNote || "—").replace(/</g,"&lt;")}</strong>`
              : `<span style="color:var(--loss);">No payout method on file.</span>`}
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:flex-end;">
            <div>
              <label style="font-size:0.72rem;color:var(--text-dim);display:block;margin-bottom:3px;">Amount (USD)</label>
              <input id="adm-payout-amount" type="number" min="0.01" step="0.01" placeholder="50.00"
                style="width:110px;padding:7px 10px;border-radius:8px;border:1px solid var(--border);background:var(--bg);color:var(--text);" />
            </div>
            <div style="flex:1;min-width:160px;">
              <label style="font-size:0.72rem;color:var(--text-dim);display:block;margin-bottom:3px;">Note (optional)</label>
              <input id="adm-payout-note" type="text" placeholder="e.g. Weekly jackpot winner"
                style="width:100%;padding:7px 10px;border-radius:8px;border:1px solid var(--border);background:var(--bg);color:var(--text);box-sizing:border-box;" />
            </div>
            <button id="adm-payout-auto-btn" data-id="${user.id}" style="${S.greenBtn}">Send via PayPal</button>
            <button id="adm-payout-manual-btn" data-id="${user.id}" style="${S.smallBtn}">Log Manual Payout</button>
          </div>
          <div id="adm-payout-history" style="margin-top:12px;font-size:0.8rem;color:var(--text-dim);"></div>
        </div>

        <h3 style="margin:0 0 10px;font-size:0.9rem;font-weight:800;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.05em;">Last 20 Bets</h3>
        <div style="${S.tableWrap};margin-bottom:18px;">
          <table style="${S.table}">
            <thead><tr>
              <th style="${S.th}">Game</th><th style="${S.th}">Wager</th><th style="${S.th}">Payout</th>
              <th style="${S.th}">Mult</th><th style="${S.th}">Result</th><th style="${S.th}">Time</th>
            </tr></thead>
            <tbody>
              ${bets.length ? bets.map(b => `
                <tr>
                  <td style="${S.td}">${b.game}</td>
                  <td style="${S.td};color:var(--gold);">${chips(b.amount)}</td>
                  <td style="${S.td};color:${b.payout>0?"var(--win)":"var(--loss)"};">${chips(b.payout)}</td>
                  <td style="${S.td};">${b.multiplier.toFixed(2)}x</td>
                  <td style="${S.td};color:${b.result==="win"?"var(--win)":"var(--loss)"};">${b.result}</td>
                  <td style="${S.td};color:var(--text-dim);">${fmtDate(b.createdAt)}</td>
                </tr>`).join("") : `<tr><td colspan="6" style="padding:20px;text-align:center;color:var(--text-dim);">No bets yet.</td></tr>`}
            </tbody>
          </table>
        </div>

        <h3 style="margin:0 0 10px;font-size:0.9rem;font-weight:800;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.05em;">Last 20 Transactions</h3>
        <div style="${S.tableWrap};margin-bottom:18px;">
          <table style="${S.table}">
            <thead><tr>
              <th style="${S.th}">Type</th><th style="${S.th}">Amount</th><th style="${S.th}">Balance After</th>
              <th style="${S.th}">Ref</th><th style="${S.th}">Time</th>
            </tr></thead>
            <tbody>
              ${txs.length ? txs.map(tx => `
                <tr>
                  <td style="${S.td}">${tx.type}</td>
                  <td style="${S.td};color:${tx.amount>=0?"var(--win)":"var(--loss)"};">
                    ${tx.amount>=0?"+":""}${chips(tx.amount)}
                  </td>
                  <td style="${S.td};color:var(--gold);">${chips(tx.balance)}</td>
                  <td style="${S.td};color:var(--text-dim);max-width:140px;overflow:hidden;text-overflow:ellipsis;">${tx.reference||"—"}</td>
                  <td style="${S.td};color:var(--text-dim);">${fmtDate(tx.createdAt)}</td>
                </tr>`).join("") : `<tr><td colspan="5" style="padding:20px;text-align:center;color:var(--text-dim);">No transactions.</td></tr>`}
            </tbody>
          </table>
        </div>

        ${nfts.length ? `
          <h3 style="margin:0 0 10px;font-size:0.9rem;font-weight:800;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.05em;">NFTs (${nfts.length})</h3>
          <div style="display:flex;flex-wrap:wrap;gap:8px;">
            ${nfts.map(n => `
              <div style="${S.statBox};min-width:100px;align-items:center;">
                <div style="font-size:1.5rem;">${n.emoji}</div>
                <div style="font-size:0.78rem;font-weight:700;">${n.name}</div>
                <div style="font-size:0.68rem;color:var(--text-dim);">${n.rarity}</div>
              </div>`).join("")}
          </div>
        ` : ""}
      `;

      const zeroBtn = overlay.querySelector("#adm-modal-zero-btn");
      if (zeroBtn) {
        zeroBtn.addEventListener("click", async () => {
          if (!confirm("Zero this user's balance?")) return;
          zeroBtn.disabled = true; zeroBtn.textContent = "Zeroing…";
          try {
            const r = await Api.post(`/admin/users/${userId}/zero-balance`, {});
            UI.toast(`Balance zeroed. New balance: ${money(r.balance)}`, "info");
            overlay.remove();
          } catch (err) {
            UI.toast(err.message || "Failed.", "loss");
            zeroBtn.disabled = false; zeroBtn.textContent = "Zero Balance";
          }
        });
      }

      const historyEl = overlay.querySelector("#adm-payout-history");
      function loadPayoutHistory() {
        Api.get(`/admin/users/${userId}/payouts`).then(({ records, paypalConfigured }) => {
          const autoBtn = overlay.querySelector("#adm-payout-auto-btn");
          if (autoBtn) {
            const eligible = user.payoutMethod === "paypal" && user.payoutPaypalEmail && paypalConfigured;
            autoBtn.disabled = !eligible;
            autoBtn.title = paypalConfigured
              ? (eligible ? "" : "User hasn't set PayPal as their payout method")
              : "PayPal isn't configured in Admin → Config yet";
          }
          if (!historyEl) return;
          historyEl.innerHTML = records.length
            ? `<strong style="color:var(--text);">Payout history:</strong><br/>` + records.map(r => `
                <div style="padding:4px 0;border-bottom:1px solid var(--border);">
                  ${money(r.amountCents)} via ${r.method} to ${r.destination}
                  — <span style="color:${r.status === "sent" ? "var(--win)" : "var(--loss)"};">${r.status}</span>
                  by ${r.adminUsername} (${fmtDate(r.createdAt)})${r.note ? ` — "${r.note}"` : ""}
                </div>`).join("")
            : "No payouts logged yet.";
        }).catch(() => { if (historyEl) historyEl.textContent = ""; });
      }
      loadPayoutHistory();

      async function sendPayout(mode) {
        const amountInput = overlay.querySelector("#adm-payout-amount");
        const noteInput = overlay.querySelector("#adm-payout-note");
        const amount = Number(amountInput.value);
        if (!amount || amount <= 0) { UI.toast("Enter a payout amount.", "loss"); return; }
        if (mode === "manual" && !confirm(`Log a manual payout of $${amount.toFixed(2)} to ${user.username}? This doesn't move any money — it's just a record that you paid them outside the app.`)) return;
        const btn = overlay.querySelector(mode === "auto" ? "#adm-payout-auto-btn" : "#adm-payout-manual-btn");
        if (btn) { btn.disabled = true; btn.dataset.prevText = btn.textContent; btn.textContent = "Sending…"; }
        try {
          await Api.post(`/admin/users/${userId}/payout`, {
            amountCents: Math.round(amount * 100),
            note: noteInput.value.trim() || undefined,
            mode,
          });
          UI.toast(`Payout of $${amount.toFixed(2)} ${mode === "auto" ? "sent via PayPal" : "logged"}!`, "win");
          amountInput.value = ""; noteInput.value = "";
          loadPayoutHistory();
        } catch (err) {
          UI.toast(err.message || "Payout failed.", "loss");
        } finally {
          if (btn) { btn.disabled = mode === "auto" ? !(user.payoutMethod === "paypal" && user.payoutPaypalEmail) : false; btn.textContent = btn.dataset.prevText; }
        }
      }
      const autoBtn = overlay.querySelector("#adm-payout-auto-btn");
      if (autoBtn) autoBtn.addEventListener("click", () => sendPayout("auto"));
      const manualBtn = overlay.querySelector("#adm-payout-manual-btn");
      if (manualBtn) manualBtn.addEventListener("click", () => sendPayout("manual"));
    }).catch(err => {
      const body = overlay.querySelector("#adm-modal-body");
      if (body) body.innerHTML = `<div style="color:var(--loss);">${err.message}</div>`;
    });
  }

  function render(container, accountState) {
    let activeTab = "stats";
    let cachedUsers = [];
    let usersPage = 1;
    let usersSearch = "";
    let usersTotal = 0;

    function tabStyle(key) { return key === activeTab ? S.tab + S.tabActive : S.tab; }

    function buildSkeleton() {
      container.innerHTML = `
        <div class="game-panel" style="${S.panel}">
          <div style="${S.header}">
            <div>
              <h2 style="${S.title}">🛠️ Admin Panel</h2>
              <p style="${S.subtitle}">⚠️ Restricted to authorised users only</p>
            </div>
          </div>
          <div style="${S.tabs}" id="adm-tabs">
            <button id="adm-tab-stats"      style="${tabStyle("stats")}">📊 Stats</button>
            <button id="adm-tab-users"      style="${tabStyle("users")}">👥 Users</button>
            <button id="adm-tab-adjust"     style="${tabStyle("adjust")}">💰 Adjust</button>
            <button id="adm-tab-bets"       style="${tabStyle("bets")}">🎲 Bets</button>
            <button id="adm-tab-players"    style="${tabStyle("players")}">🏆 Players</button>
            <button id="adm-tab-broadcasts" style="${tabStyle("broadcasts")}">📢 Broadcasts</button>
            <button id="adm-tab-promos"     style="${tabStyle("promos")}">🎫 Promos</button>
            <button id="adm-tab-controls"   style="${tabStyle("controls")}">🔧 Controls</button>
            <button id="adm-tab-nfts"       style="${tabStyle("nfts")}">🖼️ NFTs</button>
            <button id="adm-tab-bank"       style="${tabStyle("bank")}">🏦 Bank</button>
            <button id="adm-tab-danger"       style="${tabStyle("danger")}">⚠️ Danger</button>
            <button id="adm-tab-maintenance"  style="${tabStyle("maintenance")}">🔒 Maintenance</button>
            <button id="adm-tab-config"       style="${tabStyle("config")}">⚙️ Config</button>
            <button id="adm-tab-ipblocks"     style="${tabStyle("ipblocks")}">🚫 IP Blocks</button>
            <button id="adm-tab-reports"      style="${tabStyle("reports")}">🔍 Reports</button>
            <button id="adm-tab-analytics"    style="${tabStyle("analytics")}">📈 Analytics</button>
            <button id="adm-tab-referrals"    style="${tabStyle("referrals")}">🔗 Referrals</button>
            <button id="adm-tab-leaderboard"  style="${tabStyle("leaderboard")}">🏆 Leaderboard</button>
            <button id="adm-tab-chatmod"      style="${tabStyle("chatmod")}">💬 Chat Mod</button>
            <button id="adm-tab-scratch"        style="${tabStyle("scratch")}">🎟️ Scratch</button>
            <button id="adm-tab-prizes"         style="${tabStyle("prizes")}">🎁 Prizes</button>
            <button id="adm-tab-subscriptions"  style="${tabStyle("subscriptions")}">🔑 Subscriptions</button>
          </div>
          ${TABS.map(t => `<div id="adm-pane-${t}" style="${t === "stats" ? "" : "display:none;"}"></div>`).join("")}
        </div>
      `;

      TABS.forEach(key => {
        const btn = container.querySelector(`#adm-tab-${key}`);
        if (btn) btn.addEventListener("click", () => switchTab(key));
      });

      buildAdjustPane();
      buildDangerPane();
      buildConfigPane();
      switchTab("stats", true);
    }

    function updateTabBar() {
      TABS.forEach(key => {
        const btn = container.querySelector(`#adm-tab-${key}`);
        if (btn) btn.setAttribute("style", tabStyle(key));
      });
    }

    function switchTab(key, initial) {
      activeTab = key;
      updateTabBar();
      TABS.forEach(t => {
        const pane = container.querySelector(`#adm-pane-${t}`);
        if (pane) pane.style.display = t === key ? "block" : "none";
      });
      if (key === "stats") loadStats();
      if (key === "users") loadUsers();
      if (key === "bets") loadBets();
      if (key === "players") loadPlayers();
      if (key === "broadcasts") loadBroadcasts();
      if (key === "promos") loadPromos();
      if (key === "controls") loadControls();
      if (key === "nfts") loadNfts();
      if (key === "bank") loadBank();
      if (key === "maintenance") loadMaintenance();
      if (key === "config") loadConfig();
      if (key === "ipblocks") loadIpBlocks();
      if (key === "reports") loadReports();
      if (key === "analytics") loadAnalytics();
      if (key === "referrals") loadReferrals();
      if (key === "leaderboard") loadLeaderboard();
      if (key === "chatmod") loadChatMod();
      if (key === "scratch") loadScratch();
      if (key === "prizes") loadPrizes();
      if (key === "subscriptions") loadSubscriptions();
    }

    // ── Stats ──────────────────────────────────────────────────────────────────
    async function loadStats() {
      const pane = container.querySelector("#adm-pane-stats");
      if (!pane) return;
      pane.innerHTML = `<div style="color:var(--text-dim);padding:40px 20px;text-align:center;">⏳ Loading stats…</div>`;
      try {
        const [s, gameStats, revenue, active] = await Promise.all([
          Api.get("/admin/stats"),
          Api.get("/admin/stats/games").catch(() => ({ games: [] })),
          Api.get("/admin/stats/revenue").catch(() => ({ days: [] })),
          Api.get("/admin/stats/active").catch(() => ({ last24h:0, last7d:0, last30d:0 })),
        ]);

        const houseEdgePct = s.totalWagered > 0
          ? (((s.totalWagered - s.totalPaidOut) / s.totalWagered) * 100).toFixed(2)
          : "0.00";

        // Revenue chart
        const days = revenue.days || [];
        const maxProfit = Math.max(1, ...days.map(d => Math.abs(d.profit)));
        const chartHtml = days.length ? `
          <div style="${S.sectionCard}">
            <h3 style="${S.sectionTitle}">📈 14-Day Revenue</h3>
            <div style="display:flex;align-items:flex-end;gap:4px;height:100px;padding:0 4px 0;overflow:hidden;">
              ${days.map(d => {
                const pct = Math.max(4, Math.round((Math.abs(d.profit) / maxProfit) * 90));
                const col = d.profit >= 0 ? "var(--win)" : "var(--loss)";
                const label = d.date.slice(5);
                return `
                  <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;" title="${d.date}: profit=${chips(d.profit)}">
                    <div style="width:100%;height:${pct}px;background:${col};border-radius:3px 3px 0 0;min-width:8px;"></div>
                    <div style="font-size:0.55rem;color:var(--text-dim);transform:rotate(-45deg);margin-top:2px;white-space:nowrap;">${label}</div>
                  </div>
                `;
              }).join("")}
            </div>
          </div>
        ` : "";

        // Per-game table
        const gamesHtml = gameStats.games && gameStats.games.length ? `
          <div style="${S.sectionCard}">
            <h3 style="${S.sectionTitle}">🎮 Per-Game Stats</h3>
            <div style="${S.tableWrap}">
              <table style="${S.table}">
                <thead><tr>
                  <th style="${S.th}">Game</th>
                  <th style="${S.th}">Bets</th>
                  <th style="${S.th}">Wagered</th>
                  <th style="${S.th}">Paid Out</th>
                  <th style="${S.th}">House Edge</th>
                </tr></thead>
                <tbody>
                  ${gameStats.games.map(g => `
                    <tr>
                      <td style="${S.td};font-weight:700;">${g.game}</td>
                      <td style="${S.td};">${g.bets.toLocaleString()}</td>
                      <td style="${S.td};color:var(--gold);">${chips(g.wagered)}</td>
                      <td style="${S.td};color:var(--win);">${chips(g.paidOut)}</td>
                      <td style="${S.td};color:var(--accent-2);">${g.edge}%</td>
                    </tr>
                  `).join("")}
                </tbody>
              </table>
            </div>
          </div>
        ` : "";

        pane.innerHTML = `
          <div style="${S.statsGrid}">
            ${[
              ["Total Users",   (s.totalUsers||0).toLocaleString(), "var(--text)"],
              ["Total Bets",    (s.totalBets||0).toLocaleString(),  "var(--text)"],
              ["Total Wagered", money(s.totalWagered||0),           "var(--gold)"],
              ["Total Paid Out",money(s.totalPaidOut||0),           "var(--win)"],
              ["House Edge",    `${houseEdgePct}%`,                 "var(--accent-2)"],
            ].map(([label,val,col]) => `
              <div style="${S.statBox}">
                <div style="${S.sbLabel}">${label}</div>
                <div style="${S.sbValue};color:${col}">${val}</div>
              </div>`).join("")}
          </div>

          <div style="${S.statsGrid};margin-top:12px;">
            ${[
              ["Active 24h",  (active.last24h||0).toLocaleString(), "var(--win)"],
              ["Active 7d",   (active.last7d||0).toLocaleString(),  "var(--accent-2)"],
              ["Active 30d",  (active.last30d||0).toLocaleString(), "var(--text)"],
            ].map(([label,val,col]) => `
              <div style="${S.statBox}">
                <div style="${S.sbLabel}">👤 ${label}</div>
                <div style="${S.sbValue};color:${col}">${val}</div>
              </div>`).join("")}
          </div>

          ${chartHtml}
          ${gamesHtml}
        `;
      } catch (err) {
        pane.innerHTML = `<div style="color:var(--loss);padding:30px 20px;text-align:center;">${err.message}</div>`;
      }
    }

    // ── Users ──────────────────────────────────────────────────────────────────
    async function loadUsers(page, search) {
      const pane = container.querySelector("#adm-pane-users");
      if (!pane) return;
      if (page !== undefined) usersPage = page;
      if (search !== undefined) usersSearch = search;

      if (!pane.querySelector("#adm-users-tbody")) {
        pane.innerHTML = buildUsersShell();
        wireUsersPane();
      }

      const tableBody = pane.querySelector("#adm-users-tbody");
      const paginationEl = pane.querySelector("#adm-users-pagination");
      if (tableBody) tableBody.innerHTML = `<tr><td colspan="9" style="padding:30px;text-align:center;color:var(--text-dim);">⏳ Loading…</td></tr>`;

      try {
        const params = new URLSearchParams({ page: usersPage, limit: 20 });
        if (usersSearch) params.set("search", usersSearch);
        const data = await Api.get(`/admin/users?${params}`);
        const users = data.users || [];
        cachedUsers = users;
        usersTotal = data.total || users.length;
        const totalPages = Math.max(1, Math.ceil(usersTotal / 20));

        if (!tableBody) return;
        if (!users.length) {
          tableBody.innerHTML = `<tr><td colspan="9" style="padding:30px;text-align:center;color:var(--text-dim);">No users found.</td></tr>`;
        } else {
          tableBody.innerHTML = users.map((u) => {
            const isOwnerUser = (u.rank || "") === "owner";
            const rankSelectHtml = isOwnerUser
              ? `<span style="color:var(--accent-2);font-weight:700;font-size:0.8rem;">👑 Owner</span>`
              : `<select class="adm-rank-select" data-id="${u.id}" style="${S.rankSelect}">
                  ${RANK_OPTS.map(r =>
                    `<option value="${r}" ${r === (u.rank || "bronze") ? "selected" : ""}>${RANK_INFO[r].label}</option>`
                  ).join("")}
                </select>`;
            return `
              <tr style="${u.isBanned ? S.bannedRow : ""}">
                <td style="${S.td}">
                  <span class="adm-username-link" data-id="${u.id}" data-username="${u.username}" style="${S.usernameLink}">${u.username}</span>
                </td>
                <td style="${S.td};color:var(--gold);">${money(u.balance || 0)}</td>
                <td style="${S.td};color:var(--accent-2);">Lv ${u.level}</td>
                <td style="${S.td};color:var(--text-dim);">${(u.betCount || 0).toLocaleString()}</td>
                <td style="${S.td};">${rankSelectHtml}</td>
                <td style="${S.td};">
                  ${u.isBanned
                    ? `<span style="color:var(--loss);font-size:0.78rem;font-weight:700;">🚫 Banned</span>`
                    : `<span style="color:var(--win);font-size:0.78rem;font-weight:700;">✅ Active</span>`}
                </td>
                <td style="${S.td};">
                  <button class="adm-ban-btn" data-id="${u.id}" data-banned="${u.isBanned}"
                    style="${u.isBanned ? S.unbanBtn : S.banBtn}">
                    ${u.isBanned ? "Unban" : "Ban"}
                  </button>
                </td>
                <td style="${S.td};">
                  <button class="adm-zero-btn" data-id="${u.id}" style="${S.redBtn}">Zero</button>
                </td>
                <td style="${S.td};">
                  <button class="adm-detail-btn" data-id="${u.id}" style="${S.smallBtn}">Detail</button>
                </td>
              </tr>
            `;
          }).join("");
        }

        // Rank select change
        pane.querySelectorAll(".adm-rank-select").forEach(sel => {
          sel.addEventListener("change", async () => {
            const id = sel.dataset.id;
            const rank = sel.value;
            sel.disabled = true;
            try {
              await Api.patch(`/admin/users/${id}/rank`, { rank });
              UI.toast(`Rank updated to ${RANK_INFO[rank].label}.`, "win");
            } catch (err) {
              UI.toast(err.message || "Failed to update rank.", "loss");
              await loadUsers();
            } finally {
              sel.disabled = false;
            }
          });
        });

        // Username click → open detail modal
        pane.querySelectorAll(".adm-username-link").forEach(el => {
          el.addEventListener("click", () => {
            openUserDetailModal(el.dataset.id);
          });
        });

        // Detail button
        pane.querySelectorAll(".adm-detail-btn").forEach(btn => {
          btn.addEventListener("click", () => openUserDetailModal(btn.dataset.id));
        });

        // Zero balance button
        pane.querySelectorAll(".adm-zero-btn").forEach(btn => {
          btn.addEventListener("click", async () => {
            if (!confirm("Zero this user's balance?")) return;
            btn.disabled = true; btn.textContent = "…";
            try {
              const r = await Api.post(`/admin/users/${btn.dataset.id}/zero-balance`, {});
              UI.toast(`Balance zeroed: ${money(r.balance)}`, "info");
              await loadUsers();
            } catch (err) {
              UI.toast(err.message || "Failed.", "loss");
              btn.disabled = false; btn.textContent = "Zero";
            }
          });
        });

        // Ban/unban
        pane.querySelectorAll(".adm-ban-btn").forEach(btn => {
          btn.addEventListener("click", async () => {
            const id = btn.dataset.id;
            const isBanned = btn.dataset.banned === "true";
            btn.disabled = true;
            try {
              await Api.post(`/admin/ban/${id}`, {});
              UI.toast(isBanned ? "User unbanned." : "User banned.", "info");
              await loadUsers();
            } catch (err) {
              UI.toast(err.message || "Action failed.", "loss");
              btn.disabled = false;
            }
          });
        });

        if (paginationEl) {
          if (totalPages <= 1) {
            paginationEl.innerHTML = "";
          } else {
            paginationEl.innerHTML = Array.from({ length: totalPages }, (_, i) => i + 1).map(p => `
              <button class="adm-page-btn" data-page="${p}"
                style="${S.pageBtn}${p === usersPage ? S.pageBtnActive : ""}">${p}</button>
            `).join("");
            paginationEl.querySelectorAll(".adm-page-btn").forEach(btn =>
              btn.addEventListener("click", () => loadUsers(Number(btn.dataset.page)))
            );
          }
        }
      } catch (err) {
        if (tableBody) tableBody.innerHTML = `<tr><td colspan="9" style="padding:24px;color:var(--loss);">${err.message}</td></tr>`;
      }
    }

    function buildUsersShell() {
      return `
        <div style="${S.searchRow}">
          <input id="adm-users-search" type="text" placeholder="Search username…"
            style="${S.searchInput}" value="${usersSearch}" autocomplete="off" />
        </div>
        <div style="${S.tableWrap}">
          <table style="${S.table}">
            <thead>
              <tr>
                <th style="${S.th}">Username</th>
                <th style="${S.th}">Balance</th>
                <th style="${S.th}">Level</th>
                <th style="${S.th}">Bets</th>
                <th style="${S.th}">Rank</th>
                <th style="${S.th}">Status</th>
                <th style="${S.th}">Ban</th>
                <th style="${S.th}">Zero</th>
                <th style="${S.th}">Detail</th>
              </tr>
            </thead>
            <tbody id="adm-users-tbody"></tbody>
          </table>
        </div>
        <div id="adm-users-pagination" style="${S.pagination}"></div>
      `;
    }

    function wireUsersPane() {
      const pane = container.querySelector("#adm-pane-users");
      if (!pane) return;
      const inp = pane.querySelector("#adm-users-search");
      if (!inp) return;
      let timer = null;
      inp.addEventListener("input", () => {
        clearTimeout(timer);
        timer = setTimeout(() => { usersPage = 1; loadUsers(1, inp.value.trim()); }, 350);
      });
    }

    // ── Adjust Balance ─────────────────────────────────────────────────────────
    function buildAdjustPane() {
      const pane = container.querySelector("#adm-pane-adjust");
      if (!pane) return;
      pane.innerHTML = `
        <form id="adm-adjust-form" style="${S.form}">
          <div style="${S.formGroup}">
            <label style="${S.formLabel}" for="adm-adjust-username">Username</label>
            <input id="adm-adjust-username" type="text" placeholder="Enter username…"
              style="${S.formInput}" autocomplete="off" required />
          </div>
          <div style="${S.formGroup}">
            <label style="${S.formLabel}" for="adm-adjust-amount">Amount (chips — negative to deduct)</label>
            <input id="adm-adjust-amount" type="number" placeholder="e.g. 100 or -50"
              style="${S.formInput}" step="1" required />
          </div>
          <div style="${S.formGroup}">
            <label style="${S.formLabel}" for="adm-adjust-note">Note / reason</label>
            <input id="adm-adjust-note" type="text" placeholder="e.g. compensation…"
              style="${S.formInput}" />
          </div>
          <div>
            <button type="submit" style="${S.submitBtn}" id="adm-adjust-submit">Apply Adjustment</button>
          </div>
        </form>
        <div id="adm-adjust-result" style="display:none;${S.resultBox}"></div>
      `;

      const form = pane.querySelector("#adm-adjust-form");
      const resultBox = pane.querySelector("#adm-adjust-result");

      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const usernameVal = pane.querySelector("#adm-adjust-username").value.trim();
        const amountChips = Number(pane.querySelector("#adm-adjust-amount").value);
        const note = pane.querySelector("#adm-adjust-note").value.trim() || "admin adjustment";
        const submitBtn = pane.querySelector("#adm-adjust-submit");

        if (!usernameVal) { UI.toast("Enter a username.", "loss"); return; }
        if (isNaN(amountChips) || amountChips === 0) { UI.toast("Enter a non-zero amount.", "loss"); return; }

        submitBtn.disabled = true; submitBtn.textContent = "Working…"; resultBox.style.display = "none";

        try {
          const lookupData = await Api.get(`/admin/users?search=${encodeURIComponent(usernameVal)}&limit=5`);
          const match = (lookupData.users || []).find(u => u.username.toLowerCase() === usernameVal.toLowerCase());
          if (!match) throw new Error(`User "${usernameVal}" not found.`);

          const data = await Api.post(`/admin/adjust-balance/${match.id}`, {
            amount: amountChips * 100,
            note,
          });
          resultBox.style.display = "block";
          resultBox.style.borderColor = "var(--win)";
          resultBox.style.color = "var(--win)";
          resultBox.innerHTML = `✅ Adjusted <strong>${usernameVal}</strong> by <strong>${amountChips > 0 ? "+" : ""}${amountChips}</strong> chips${data.balance !== undefined ? ` · New balance: ${money(data.balance)}` : ""}`;
          UI.toast(`Balance adjusted for ${usernameVal}.`, "win");
        } catch (err) {
          resultBox.style.display = "block";
          resultBox.style.borderColor = "var(--loss)";
          resultBox.style.color = "var(--loss)";
          resultBox.textContent = `❌ ${err.message}`;
          UI.toast(err.message, "loss");
        } finally {
          submitBtn.disabled = false; submitBtn.textContent = "Apply Adjustment";
        }
      });
    }

    // ── Bets ───────────────────────────────────────────────────────────────────
    async function loadBets() {
      const pane = container.querySelector("#adm-pane-bets");
      if (!pane) return;
      pane.innerHTML = `<div style="color:var(--text-dim);padding:40px 20px;text-align:center;">⏳ Loading…</div>`;

      try {
        const [betsData, paymentsData] = await Promise.all([
          Api.get("/admin/bets?limit=50"),
          Api.get("/admin/payments"),
        ]);

        const bets = betsData.bets || [];
        const payments = paymentsData.items || [];

        pane.innerHTML = `
          <div style="${S.sectionCard}">
            <h3 style="${S.sectionTitle}">🎲 Recent Bets (last 50)</h3>
            <div style="${S.tableWrap}">
              <table style="${S.table}">
                <thead><tr>
                  <th style="${S.th}">Username</th>
                  <th style="${S.th}">Game</th>
                  <th style="${S.th}">Wager</th>
                  <th style="${S.th}">Payout</th>
                  <th style="${S.th}">Mult</th>
                  <th style="${S.th}">Result</th>
                  <th style="${S.th}">Time</th>
                </tr></thead>
                <tbody>
                  ${bets.length ? bets.map(b => `
                    <tr>
                      <td style="${S.td};color:var(--accent-2);">${b.user?.username || "—"}</td>
                      <td style="${S.td}">${b.game}</td>
                      <td style="${S.td};color:var(--gold);">${chips(b.amount)}</td>
                      <td style="${S.td};color:${b.payout>0?"var(--win)":"var(--loss)"};">${chips(b.payout)}</td>
                      <td style="${S.td}">${b.multiplier.toFixed(2)}x</td>
                      <td style="${S.td};color:${b.result==="win"?"var(--win)":"var(--loss)"};">${b.result}</td>
                      <td style="${S.td};color:var(--text-dim);">${fmtDate(b.createdAt)}</td>
                    </tr>`).join("") : `<tr><td colspan="7" style="padding:24px;text-align:center;color:var(--text-dim);">No bets.</td></tr>`}
                </tbody>
              </table>
            </div>
          </div>

          <div style="${S.sectionCard}">
            <h3 style="${S.sectionTitle}">💳 Payment History</h3>
            <div style="${S.tableWrap}">
              <table style="${S.table}">
                <thead><tr>
                  <th style="${S.th}">Username</th>
                  <th style="${S.th}">Type</th>
                  <th style="${S.th}">Amount</th>
                  <th style="${S.th}">Date</th>
                </tr></thead>
                <tbody>
                  ${payments.length ? payments.map(tx => `
                    <tr>
                      <td style="${S.td};color:var(--accent-2);">${tx.user?.username || "—"}</td>
                      <td style="${S.td}">${typeBadge(tx.type)}</td>
                      <td style="${S.td};color:${tx.amount>=0?"var(--win)":"var(--loss)"};">${chips(tx.amount)}</td>
                      <td style="${S.td};color:var(--text-dim);">${fmtDate(tx.createdAt)}</td>
                    </tr>`).join("") : `<tr><td colspan="4" style="padding:24px;text-align:center;color:var(--text-dim);">No payments.</td></tr>`}
                </tbody>
              </table>
            </div>
          </div>
        `;
      } catch (err) {
        pane.innerHTML = `<div style="color:var(--loss);padding:30px 20px;text-align:center;">${err.message}</div>`;
      }
    }

    // ── Players ────────────────────────────────────────────────────────────────
    async function loadPlayers() {
      const pane = container.querySelector("#adm-pane-players");
      if (!pane) return;
      pane.innerHTML = `<div style="color:var(--text-dim);padding:40px 20px;text-align:center;">⏳ Loading…</div>`;

      try {
        const data = await Api.get("/admin/top-players");
        const players = data.players || [];

        pane.innerHTML = `
          <div style="${S.sectionCard}">
            <h3 style="${S.sectionTitle}">🏆 Top 20 Players by Wagered</h3>
            <div style="${S.tableWrap}">
              <table style="${S.table}">
                <thead><tr>
                  <th style="${S.th}">#</th>
                  <th style="${S.th}">Username</th>
                  <th style="${S.th}">Level</th>
                  <th style="${S.th}">Wagered</th>
                  <th style="${S.th}">Paid Out</th>
                  <th style="${S.th}">Profit (player)</th>
                  <th style="${S.th}">Bets</th>
                </tr></thead>
                <tbody>
                  ${players.length ? players.map((p, i) => `
                    <tr>
                      <td style="${S.td};color:var(--text-dim);">${i + 1}</td>
                      <td style="${S.td};font-weight:700;color:var(--accent-2);">${p.username}</td>
                      <td style="${S.td};">Lv ${p.level}</td>
                      <td style="${S.td};color:var(--gold);">${chips(p.wagered)}</td>
                      <td style="${S.td};color:var(--win);">${chips(p.paidOut)}</td>
                      <td style="${S.td};color:${p.profit>=0?"var(--win)":"var(--loss)"};">
                        ${p.profit>=0?"+":""}${chips(p.profit)}
                      </td>
                      <td style="${S.td};">${p.bets.toLocaleString()}</td>
                    </tr>`).join("") : `<tr><td colspan="7" style="padding:24px;text-align:center;color:var(--text-dim);">No data.</td></tr>`}
                </tbody>
              </table>
            </div>
          </div>
        `;
      } catch (err) {
        pane.innerHTML = `<div style="color:var(--loss);padding:30px 20px;text-align:center;">${err.message}</div>`;
      }
    }

    // ── Broadcasts ─────────────────────────────────────────────────────────────
    async function loadBroadcasts() {
      const pane = container.querySelector("#adm-pane-broadcasts");
      if (!pane) return;

      async function render() {
        try {
          const data = await Api.get("/admin/broadcasts");
          const broadcasts = data.broadcasts || [];

          pane.innerHTML = `
            <div style="${S.sectionCard}">
              <h3 style="${S.sectionTitle}">📢 Send Broadcast</h3>
              <div style="${S.form}">
                <div style="${S.formGroup}">
                  <label style="${S.formLabel}">Message</label>
                  <textarea id="adm-bc-msg" rows="3" style="${S.formInput};resize:vertical;" placeholder="Enter broadcast message…"></textarea>
                </div>
                <div style="${S.formGroup}">
                  <label style="${S.formLabel}">Type</label>
                  <select id="adm-bc-type" style="${S.formSelect}">
                    <option value="info">Info</option>
                    <option value="win">Win / Jackpot</option>
                    <option value="loss">Warning</option>
                  </select>
                </div>
                <div>
                  <button id="adm-bc-send" style="${S.submitBtn}">Send Broadcast</button>
                </div>
              </div>
            </div>

            <div style="${S.sectionCard}">
              <h3 style="${S.sectionTitle}">📋 Active Broadcasts</h3>
              ${broadcasts.length ? `
                <div style="${S.tableWrap}">
                  <table style="${S.table}">
                    <thead><tr>
                      <th style="${S.th}">Type</th>
                      <th style="${S.th}">Message</th>
                      <th style="${S.th}">Date</th>
                      <th style="${S.th}">Del</th>
                    </tr></thead>
                    <tbody>
                      ${broadcasts.map(b => `
                        <tr>
                          <td style="${S.td}">${typeBadge(b.type)}</td>
                          <td style="${S.td};max-width:300px;white-space:normal;">${b.message}</td>
                          <td style="${S.td};color:var(--text-dim);">${fmtDate(b.createdAt)}</td>
                          <td style="${S.td};">
                            <button class="adm-bc-del" data-id="${b.id}" style="${S.redBtn}">Delete</button>
                          </td>
                        </tr>`).join("")}
                    </tbody>
                  </table>
                </div>
              ` : `<p style="color:var(--text-dim);font-size:0.88rem;">No broadcasts yet.</p>`}
            </div>
          `;

          pane.querySelector("#adm-bc-send").addEventListener("click", async () => {
            const msg = pane.querySelector("#adm-bc-msg").value.trim();
            const type = pane.querySelector("#adm-bc-type").value;
            if (!msg) { UI.toast("Enter a message.", "loss"); return; }
            const btn = pane.querySelector("#adm-bc-send");
            btn.disabled = true; btn.textContent = "Sending…";
            try {
              await Api.post("/admin/broadcast", { message: msg, type });
              UI.toast("Broadcast sent!", "win");
              render();
            } catch (err) {
              UI.toast(err.message || "Failed.", "loss");
              btn.disabled = false; btn.textContent = "Send Broadcast";
            }
          });

          pane.querySelectorAll(".adm-bc-del").forEach(btn => {
            btn.addEventListener("click", async () => {
              if (!confirm("Delete this broadcast?")) return;
              btn.disabled = true;
              try {
                await fetch(`/admin/broadcasts/${btn.dataset.id}`, {
                  method: "DELETE",
                  headers: { authorization: `Bearer ${Api.getToken()}` },
                });
                UI.toast("Deleted.", "info");
                render();
              } catch (err) {
                UI.toast(err.message || "Failed.", "loss");
                btn.disabled = false;
              }
            });
          });
        } catch (err) {
          pane.innerHTML = `<div style="color:var(--loss);padding:30px 20px;text-align:center;">${err.message}</div>`;
        }
      }

      render();
    }

    // ── Promos ─────────────────────────────────────────────────────────────────
    async function loadPromos() {
      const pane = container.querySelector("#adm-pane-promos");
      if (!pane) return;

      async function render() {
        try {
          const data = await Api.get("/admin/promos");
          const promos = data.promos || [];

          pane.innerHTML = `
            <div style="${S.sectionCard}">
              <h3 style="${S.sectionTitle}">🎫 Create Promo Code</h3>
              <p style="color:var(--text-dim);font-size:0.82rem;margin:0 0 14px;">Create codes for giveaways and events.</p>
              <div style="${S.form}">
                <div style="display:flex;gap:12px;flex-wrap:wrap;">
                  <div style="${S.formGroup};flex:1;min-width:140px;">
                    <label style="${S.formLabel}">Code</label>
                    <input id="adm-promo-code" type="text" placeholder="EXAMPLE2024"
                      style="${S.formInput};text-transform:uppercase;" autocomplete="off" />
                  </div>
                  <div style="${S.formGroup};flex:1;min-width:100px;">
                    <label style="${S.formLabel}">Chips</label>
                    <input id="adm-promo-chips" type="number" min="1" placeholder="100"
                      style="${S.formInput}" />
                  </div>
                  <div style="${S.formGroup};flex:1;min-width:100px;">
                    <label style="${S.formLabel}">Max Uses</label>
                    <input id="adm-promo-maxuses" type="number" min="1" value="1"
                      style="${S.formInput}" />
                  </div>
                  <div style="${S.formGroup};flex:1;min-width:140px;">
                    <label style="${S.formLabel}">Expires (optional)</label>
                    <input id="adm-promo-expires" type="date"
                      style="${S.formInput}" />
                  </div>
                </div>
                <div>
                  <button id="adm-promo-create" style="${S.submitBtn}">Create Code</button>
                </div>
              </div>
            </div>

            <div style="${S.sectionCard}">
              <h3 style="${S.sectionTitle}">📋 Promo Codes</h3>
              ${promos.length ? `
                <div style="${S.tableWrap}">
                  <table style="${S.table}">
                    <thead><tr>
                      <th style="${S.th}">Code</th>
                      <th style="${S.th}">Chips</th>
                      <th style="${S.th}">Uses / Max</th>
                      <th style="${S.th}">Expires</th>
                      <th style="${S.th}">Active</th>
                      <th style="${S.th}">Del</th>
                    </tr></thead>
                    <tbody>
                      ${promos.map(p => `
                        <tr style="${!p.active ? "opacity:0.5;" : ""}">
                          <td style="${S.td};font-family:monospace;font-weight:700;">${p.code}</td>
                          <td style="${S.td};color:var(--gold);">${Math.floor(p.chips/100).toLocaleString()}</td>
                          <td style="${S.td};">${p.uses} / ${p.maxUses}</td>
                          <td style="${S.td};color:var(--text-dim);">${p.expiresAt ? new Date(p.expiresAt).toLocaleDateString() : "Never"}</td>
                          <td style="${S.td};">
                            ${p.active
                              ? `<span style="color:var(--win);font-weight:700;font-size:0.78rem;">✅ Active</span>`
                              : `<span style="color:var(--loss);font-weight:700;font-size:0.78rem;">🚫 Inactive</span>`}
                          </td>
                          <td style="${S.td};">
                            <button class="adm-promo-del" data-id="${p.id}" style="${S.redBtn}">Deactivate</button>
                          </td>
                        </tr>`).join("")}
                    </tbody>
                  </table>
                </div>
              ` : `<p style="color:var(--text-dim);font-size:0.88rem;">No promo codes yet.</p>`}
            </div>
          `;

          const codeInput = pane.querySelector("#adm-promo-code");
          codeInput.addEventListener("input", () => { codeInput.value = codeInput.value.toUpperCase(); });

          pane.querySelector("#adm-promo-create").addEventListener("click", async () => {
            const code = codeInput.value.trim().toUpperCase();
            const chipsVal = Number(pane.querySelector("#adm-promo-chips").value);
            const maxUses = Number(pane.querySelector("#adm-promo-maxuses").value) || 1;
            const expiresAt = pane.querySelector("#adm-promo-expires").value || undefined;

            if (!code) { UI.toast("Enter a code.", "loss"); return; }
            if (!chipsVal || chipsVal <= 0) { UI.toast("Enter a valid chips amount.", "loss"); return; }

            const btn = pane.querySelector("#adm-promo-create");
            btn.disabled = true; btn.textContent = "Creating…";
            try {
              await Api.post("/admin/promos", { code, chips: chipsVal, maxUses, expiresAt });
              UI.toast(`Promo code ${code} created!`, "win");
              render();
            } catch (err) {
              UI.toast(err.message || "Failed to create.", "loss");
              btn.disabled = false; btn.textContent = "Create Code";
            }
          });

          pane.querySelectorAll(".adm-promo-del").forEach(btn => {
            btn.addEventListener("click", async () => {
              if (!confirm("Deactivate this promo code?")) return;
              btn.disabled = true;
              try {
                await fetch(`/admin/promos/${btn.dataset.id}`, {
                  method: "DELETE",
                  headers: { authorization: `Bearer ${Api.getToken()}` },
                });
                UI.toast("Promo deactivated.", "info");
                render();
              } catch (err) {
                UI.toast(err.message || "Failed.", "loss");
                btn.disabled = false;
              }
            });
          });
        } catch (err) {
          pane.innerHTML = `<div style="color:var(--loss);padding:30px 20px;text-align:center;">${err.message}</div>`;
        }
      }

      render();
    }

    // ── Controls ───────────────────────────────────────────────────────────────
    async function loadControls() {
      const pane = container.querySelector("#adm-pane-controls");
      if (!pane) return;
      pane.innerHTML = `<div style="color:var(--text-dim);padding:40px 20px;text-align:center;">⏳ Loading config…</div>`;

      try {
        const cfg = await Api.get("/admin/config");

        const maintenanceOn = cfg["maintenance_mode"] === "true";
        const startingBalance = cfg["starting_balance"] || "1000";

        const gamesHtml = GAMES.map(g => {
          const disabled = cfg[`game_disabled_${g}`] === "true";
          return `
            <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);">
              <span style="font-weight:600;text-transform:capitalize;">${g}</span>
              <button class="adm-game-toggle" data-game="${g}" data-disabled="${disabled}"
                style="${disabled ? S.toggleOff : S.toggleOn}">
                ${disabled ? "🚫 Disabled" : "✅ Enabled"}
              </button>
            </div>
          `;
        }).join("");

        pane.innerHTML = `
          <!-- Maintenance Mode -->
          <div style="${S.sectionCard}">
            <h3 style="${S.sectionTitle}">🔧 Maintenance Mode</h3>
            <p style="color:var(--text-dim);font-size:0.85rem;margin:0 0 14px;">
              When enabled, the site shows a maintenance message to all users.
              Currently: <strong style="color:${maintenanceOn?"var(--loss)":"var(--win)"};">${maintenanceOn?"🚫 ON":"✅ OFF"}</strong>
            </p>
            <button id="adm-maintenance-toggle" style="${maintenanceOn ? S.greenBtn : S.redBtn}">
              ${maintenanceOn ? "✅ Disable Maintenance Mode" : "🔧 Enable Maintenance Mode"}
            </button>
          </div>

          <!-- Game Controls -->
          <div style="${S.sectionCard}">
            <h3 style="${S.sectionTitle}">🎮 Game Controls</h3>
            <p style="color:var(--text-dim);font-size:0.82rem;margin:0 0 14px;">Toggle individual games on or off for all players.</p>
            ${gamesHtml}
          </div>

          <!-- Bulk Chip Giveaway -->
          <div style="${S.sectionCard}">
            <h3 style="${S.sectionTitle}">🎁 Bulk Chip Giveaway</h3>
            <p style="color:var(--text-dim);font-size:0.82rem;margin:0 0 14px;">Give chips to every user on the platform.</p>
            <div style="display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap;">
              <div style="${S.formGroup};flex:1;min-width:140px;">
                <label style="${S.formLabel}">Chips per user</label>
                <input id="adm-bulk-chips" type="number" min="1" placeholder="100"
                  style="${S.formInput}" />
              </div>
              <div style="${S.formGroup};flex:2;min-width:200px;">
                <label style="${S.formLabel}">Note (optional)</label>
                <input id="adm-bulk-note" type="text" placeholder="bulk giveaway"
                  style="${S.formInput}" />
              </div>
              <button id="adm-bulk-give" style="${S.submitBtn}">Give to All Users</button>
            </div>
            <div id="adm-bulk-result" style="display:none;margin-top:10px;"></div>
          </div>

          <!-- Site Settings -->
          <div style="${S.sectionCard}">
            <h3 style="${S.sectionTitle}">⚙️ Site Settings</h3>
            <div style="${S.form};max-width:320px;">
              <div style="${S.formGroup}">
                <label style="${S.formLabel}">Starting Balance (chips for new users)</label>
                <input id="adm-starting-balance" type="number" min="0" value="${startingBalance}"
                  style="${S.formInput}" />
              </div>
              <div>
                <button id="adm-settings-save" style="${S.submitBtn}">Save Settings</button>
              </div>
            </div>
          </div>

          <!-- Google Integrations -->
          <div style="${S.sectionCard}">
            <h3 style="${S.sectionTitle}">🔗 Google Integrations</h3>
            <p style="color:var(--text-dim);font-size:0.82rem;margin:0 0 14px;">
              These IDs are public identifiers (not secrets) and take effect immediately for all visitors — no redeploy needed.
            </p>
            <div style="${S.form};max-width:420px;">
              <div style="${S.formGroup}">
                <label style="${S.formLabel}">Google Sign-In Client ID</label>
                <input id="adm-google-client-id" type="text" placeholder="xxxxxxxx.apps.googleusercontent.com"
                  value="${cfg["google_client_id"] || ""}" style="${S.formInput}" />
              </div>
              <div style="${S.formGroup}">
                <label style="${S.formLabel}">Google Analytics Measurement ID</label>
                <input id="adm-ga-id" type="text" placeholder="G-XXXXXXXXXX"
                  value="${cfg["ga_measurement_id"] || ""}" style="${S.formInput}" />
              </div>
              <div style="${S.formGroup}">
                <label style="${S.formLabel}">Google AdSense Publisher ID</label>
                <input id="adm-adsense-id" type="text" placeholder="ca-pub-XXXXXXXXXXXXXXXX"
                  value="${cfg["adsense_publisher_id"] || ""}" style="${S.formInput}" />
              </div>
              <div style="${S.formGroup}">
                <label style="${S.formLabel}">AdSense Ad Slot ID (login/sign-up screen — first thing visitors see)</label>
                <input id="adm-adsense-slot-auth" type="text" placeholder="1234567890"
                  value="${cfg["adsense_slot_auth"] || ""}" style="${S.formInput}" />
              </div>
              <div style="${S.formGroup}">
                <label style="${S.formLabel}">AdSense Ad Slot ID (top banner — shows on every page)</label>
                <input id="adm-adsense-slot-top" type="text" placeholder="1234567890"
                  value="${cfg["adsense_slot_top"] || ""}" style="${S.formInput}" />
              </div>
              <div style="${S.formGroup}">
                <label style="${S.formLabel}">AdSense Ad Slot ID (sidebar unit)</label>
                <input id="adm-adsense-slot" type="text" placeholder="1234567890"
                  value="${cfg["adsense_slot_sidebar"] || ""}" style="${S.formInput}" />
              </div>
              <div style="${S.formGroup}">
                <label style="${S.formLabel}">AdSense Ad Slot ID (footer banner — shows on every page)</label>
                <input id="adm-adsense-slot-footer" type="text" placeholder="1234567890"
                  value="${cfg["adsense_slot_footer"] || ""}" style="${S.formInput}" />
              </div>
              <div style="${S.formGroup}">
                <label style="${S.formLabel}">AdSense Ad Slot ID (lobby page)</label>
                <input id="adm-adsense-slot-lobby" type="text" placeholder="1234567890"
                  value="${cfg["adsense_slot_lobby"] || ""}" style="${S.formInput}" />
              </div>
              <div>
                <button id="adm-google-save" style="${S.submitBtn}">Save Google Settings</button>
              </div>
            </div>
          </div>

          <!-- Email Settings (SMTP) -->
          <div style="${S.sectionCard}">
            <h3 style="${S.sectionTitle}">📧 Email Settings (SMTP)</h3>
            <p style="color:var(--text-dim);font-size:0.82rem;margin:0 0 14px;">
              Required for verification code emails to actually be delivered. Without these,
              codes only get printed to the server logs. Most providers (Gmail, SendGrid,
              Mailgun, etc.) give you a host, port, username, and password/API key to fill in here.
            </p>
            <div style="${S.form};max-width:420px;">
              <div style="${S.formGroup}">
                <label style="${S.formLabel}">SMTP Host</label>
                <input id="adm-smtp-host" type="text" placeholder="smtp.gmail.com"
                  value="${cfg["smtp_host"] || ""}" style="${S.formInput}" />
              </div>
              <div style="${S.formGroup}">
                <label style="${S.formLabel}">SMTP Port</label>
                <input id="adm-smtp-port" type="number" placeholder="587"
                  value="${cfg["smtp_port"] || ""}" style="${S.formInput}" />
              </div>
              <div style="${S.formGroup}">
                <label style="${S.formLabel}">SMTP Username</label>
                <input id="adm-smtp-user" type="text" placeholder="you@example.com"
                  value="${cfg["smtp_user"] || ""}" style="${S.formInput}" />
              </div>
              <div style="${S.formGroup}">
                <label style="${S.formLabel}">SMTP Password / API Key</label>
                <input id="adm-smtp-pass" type="password" placeholder="••••••••"
                  value="${cfg["smtp_pass"] || ""}" style="${S.formInput}" />
              </div>
              <div style="${S.formGroup}">
                <label style="${S.formLabel}">From Address</label>
                <input id="adm-smtp-from" type="text" placeholder="GrilledCoin <noreply@grilledcoin.app>"
                  value="${cfg["smtp_from"] || ""}" style="${S.formInput}" />
              </div>
              <div>
                <button id="adm-smtp-save" style="${S.submitBtn}">Save Email Settings</button>
                <button id="adm-smtp-test" style="${S.submitBtn};margin-left:8px;background:var(--bg-elev);">Send Test Email</button>
              </div>
              <div id="adm-smtp-result" style="display:none;margin-top:10px;font-size:0.85rem;"></div>
            </div>
          </div>

          <!-- PayPal Payouts -->
          <div style="${S.sectionCard}">
            <h3 style="${S.sectionTitle}">💵 PayPal Payouts</h3>
            <p style="color:var(--text-dim);font-size:0.82rem;margin:0 0 14px;">
              Required for the "Send via PayPal" automated payout button on a user's profile to work.
              Get these from a PayPal Business account under Apps & Credentials. Use Sandbox while testing,
              then switch to Live to send real money.
            </p>
            <div style="${S.form};max-width:420px;">
              <div style="${S.formGroup}">
                <label style="${S.formLabel}">Client ID</label>
                <input id="adm-paypal-client-id" type="text" placeholder="AeA1QIZX..."
                  value="${cfg["paypal_client_id"] || ""}" style="${S.formInput}" />
              </div>
              <div style="${S.formGroup}">
                <label style="${S.formLabel}">Client Secret</label>
                <input id="adm-paypal-client-secret" type="password" placeholder="••••••••"
                  value="${cfg["paypal_client_secret"] || ""}" style="${S.formInput}" />
              </div>
              <div style="${S.formGroup}">
                <label style="${S.formLabel}">Mode</label>
                <select id="adm-paypal-mode" style="${S.formInput}">
                  <option value="sandbox" ${cfg["paypal_mode"] !== "live" ? "selected" : ""}>Sandbox (testing)</option>
                  <option value="live" ${cfg["paypal_mode"] === "live" ? "selected" : ""}>Live (real money)</option>
                </select>
              </div>
              <div>
                <button id="adm-paypal-save" style="${S.submitBtn}">Save PayPal Settings</button>
              </div>
            </div>
          </div>

          <!-- Game Odds / House Edge -->
          <div style="${S.sectionCard}">
            <h3 style="${S.sectionTitle}">🎲 Game Odds (House Edge)</h3>
            <p style="color:var(--text-dim);font-size:0.82rem;margin:0 0 14px;">
              Sets the global house edge for the engine-driven games (Dice, Crash, Limbo, Mines, Hi-Lo).
              This is a uniform odds knob that applies to <strong>everyone</strong> — higher = players win
              less and the house keeps more; lower (or negative) = players win more.
              <strong>1%</strong> = the standard 99% payout. Takes effect immediately, no redeploy needed.
            </p>
            <div style="${S.form};max-width:420px;">
              <div style="${S.formGroup}">
                <label style="${S.formLabel}">House Edge (%)</label>
                <input id="adm-house-edge" type="number" step="0.1" min="-50" max="95" placeholder="1"
                  value="${cfg["house_edge"] !== undefined && cfg["house_edge"] !== "" ? cfg["house_edge"] : "1"}" style="${S.formInput}" />
              </div>
              <div>
                <button id="adm-odds-save" style="${S.submitBtn}">Save Game Odds</button>
              </div>
            </div>
            <hr class="bp-divider" style="margin:16px 0;" />
            <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
              <div>
                <div style="font-weight:700;">🍀 Owner Lucky Mode</div>
                <div style="color:var(--text-dim);font-size:0.8rem;max-width:340px;">
                  When ON, <strong>your own</strong> Dice &amp; Limbo bets always win. Owner-only — affects no other players.
                </div>
              </div>
              <button id="adm-owner-lucky" data-on="${cfg["owner_lucky"] === "true"}"
                style="${cfg["owner_lucky"] === "true" ? S.toggleOn : S.toggleOff}">
                ${cfg["owner_lucky"] === "true" ? "✅ ON" : "🚫 OFF"}
              </button>
            </div>
          </div>
        `;

        UI.wireAllPasswordToggles(pane);

        // Maintenance toggle
        pane.querySelector("#adm-maintenance-toggle").addEventListener("click", async (e) => {
          const btn = e.currentTarget;
          btn.disabled = true;
          const newVal = maintenanceOn ? "false" : "true";
          try {
            await Api.post("/admin/config", { maintenance_mode: newVal });
            UI.toast(`Maintenance mode ${newVal === "true" ? "enabled" : "disabled"}.`, "info");
            loadControls();
          } catch (err) {
            UI.toast(err.message || "Failed.", "loss");
            btn.disabled = false;
          }
        });

        // Game toggles
        pane.querySelectorAll(".adm-game-toggle").forEach(btn => {
          btn.addEventListener("click", async () => {
            const game = btn.dataset.game;
            const isDisabled = btn.dataset.disabled === "true";
            btn.disabled = true;
            try {
              await Api.post("/admin/config", { [`game_disabled_${game}`]: isDisabled ? "false" : "true" });
              UI.toast(`${game} ${isDisabled ? "enabled" : "disabled"}.`, "info");
              loadControls();
            } catch (err) {
              UI.toast(err.message || "Failed.", "loss");
              btn.disabled = false;
            }
          });
        });

        // Bulk chips
        pane.querySelector("#adm-bulk-give").addEventListener("click", async () => {
          const chipsVal = Number(pane.querySelector("#adm-bulk-chips").value);
          const note = pane.querySelector("#adm-bulk-note").value.trim() || "bulk giveaway";
          if (!chipsVal || chipsVal <= 0) { UI.toast("Enter a valid chips amount.", "loss"); return; }
          if (!confirm(`Give ${chipsVal} chips to ALL users?`)) return;
          const btn = pane.querySelector("#adm-bulk-give");
          const resultEl = pane.querySelector("#adm-bulk-result");
          btn.disabled = true; btn.textContent = "Working…";
          try {
            const r = await Api.post("/admin/bulk-chips", { chips: chipsVal, note });
            resultEl.style.display = "block";
            resultEl.innerHTML = `<span style="color:var(--win);font-weight:700;">✅ Gave ${r.chipsEach} chips to ${r.count} users!</span>`;
            UI.toast(`Bulk chips sent to ${r.count} users!`, "win");
          } catch (err) {
            resultEl.style.display = "block";
            resultEl.innerHTML = `<span style="color:var(--loss);">❌ ${err.message}</span>`;
            UI.toast(err.message || "Failed.", "loss");
          } finally {
            btn.disabled = false; btn.textContent = "Give to All Users";
          }
        });

        // Save settings
        pane.querySelector("#adm-settings-save").addEventListener("click", async () => {
          const val = pane.querySelector("#adm-starting-balance").value.trim();
          const btn = pane.querySelector("#adm-settings-save");
          btn.disabled = true; btn.textContent = "Saving…";
          try {
            await Api.post("/admin/config", { starting_balance: val });
            UI.toast("Settings saved.", "win");
          } catch (err) {
            UI.toast(err.message || "Failed.", "loss");
          } finally {
            btn.disabled = false; btn.textContent = "Save Settings";
          }
        });

        // Save Google integration settings
        pane.querySelector("#adm-google-save").addEventListener("click", async () => {
          const googleClientId = pane.querySelector("#adm-google-client-id").value.trim();
          const gaId = pane.querySelector("#adm-ga-id").value.trim();
          const adsenseId = pane.querySelector("#adm-adsense-id").value.trim();
          const adsenseSlot = pane.querySelector("#adm-adsense-slot").value.trim();
          const adsenseSlotFooter = pane.querySelector("#adm-adsense-slot-footer").value.trim();
          const adsenseSlotLobby = pane.querySelector("#adm-adsense-slot-lobby").value.trim();
          const adsenseSlotAuth = pane.querySelector("#adm-adsense-slot-auth").value.trim();
          const adsenseSlotTop = pane.querySelector("#adm-adsense-slot-top").value.trim();
          const btn = pane.querySelector("#adm-google-save");
          btn.disabled = true; btn.textContent = "Saving…";
          try {
            await Api.post("/admin/config", {
              google_client_id: googleClientId,
              ga_measurement_id: gaId,
              adsense_publisher_id: adsenseId,
              adsense_slot_sidebar: adsenseSlot,
              adsense_slot_footer: adsenseSlotFooter,
              adsense_slot_lobby: adsenseSlotLobby,
              adsense_slot_auth: adsenseSlotAuth,
              adsense_slot_top: adsenseSlotTop,
            });
            UI.toast("Google settings saved.", "win");
          } catch (err) {
            UI.toast(err.message || "Failed.", "loss");
          } finally {
            btn.disabled = false; btn.textContent = "Save Google Settings";
          }
        });

        // Save Email (SMTP) settings
        pane.querySelector("#adm-smtp-save").addEventListener("click", async () => {
          const btn = pane.querySelector("#adm-smtp-save");
          btn.disabled = true; btn.textContent = "Saving…";
          try {
            await Api.post("/admin/config", {
              smtp_host: pane.querySelector("#adm-smtp-host").value.trim(),
              smtp_port: pane.querySelector("#adm-smtp-port").value.trim(),
              smtp_user: pane.querySelector("#adm-smtp-user").value.trim(),
              smtp_pass: pane.querySelector("#adm-smtp-pass").value,
              smtp_from: pane.querySelector("#adm-smtp-from").value.trim(),
            });
            UI.toast("Email settings saved.", "win");
          } catch (err) {
            UI.toast(err.message || "Failed.", "loss");
          } finally {
            btn.disabled = false; btn.textContent = "Save Email Settings";
          }
        });

        // Save PayPal settings
        pane.querySelector("#adm-paypal-save").addEventListener("click", async () => {
          const btn = pane.querySelector("#adm-paypal-save");
          btn.disabled = true; btn.textContent = "Saving…";
          try {
            await Api.post("/admin/config", {
              paypal_client_id: pane.querySelector("#adm-paypal-client-id").value.trim(),
              paypal_client_secret: pane.querySelector("#adm-paypal-client-secret").value,
              paypal_mode: pane.querySelector("#adm-paypal-mode").value,
            });
            UI.toast("PayPal settings saved.", "win");
          } catch (err) {
            UI.toast(err.message || "Failed.", "loss");
          } finally {
            btn.disabled = false; btn.textContent = "Save PayPal Settings";
          }
        });

        // Owner Lucky Mode toggle
        pane.querySelector("#adm-owner-lucky").addEventListener("click", async (e) => {
          const btn = e.currentTarget;
          const newOn = btn.dataset.on !== "true";
          btn.disabled = true;
          try {
            await Api.post("/admin/config", { owner_lucky: String(newOn) });
            btn.dataset.on = String(newOn);
            btn.setAttribute("style", newOn ? S.toggleOn : S.toggleOff);
            btn.textContent = newOn ? "✅ ON" : "🚫 OFF";
            UI.toast(`Owner Lucky Mode ${newOn ? "ON — your Dice & Limbo bets always win" : "OFF"}.`, newOn ? "win" : "info");
          } catch (err) {
            UI.toast(err.message || "Failed.", "loss");
          } finally {
            btn.disabled = false;
          }
        });

        // Save Game Odds (house edge)
        pane.querySelector("#adm-odds-save").addEventListener("click", async () => {
          const btn = pane.querySelector("#adm-odds-save");
          const raw = pane.querySelector("#adm-house-edge").value.trim();
          const pct = Number(raw);
          if (raw === "" || !Number.isFinite(pct) || pct < -50 || pct > 95) {
            return UI.toast("Enter a house edge between -50 and 95.", "loss");
          }
          btn.disabled = true; btn.textContent = "Saving…";
          try {
            await Api.post("/admin/config", { house_edge: String(pct) });
            UI.toast(`House edge set to ${pct}%. Live now.`, "win");
          } catch (err) {
            UI.toast(err.message || "Failed.", "loss");
          } finally {
            btn.disabled = false; btn.textContent = "Save Game Odds";
          }
        });

        // Send a test email using the currently saved SMTP settings
        pane.querySelector("#adm-smtp-test").addEventListener("click", async () => {
          const btn = pane.querySelector("#adm-smtp-test");
          const resultEl = pane.querySelector("#adm-smtp-result");
          btn.disabled = true; btn.textContent = "Sending…";
          resultEl.style.display = "none";
          try {
            const r = await Api.post("/admin/test-email", {});
            resultEl.style.display = "block";
            resultEl.innerHTML = `<span style="color:var(--win);">✅ Test email sent to ${r.to}. Check your inbox (and spam folder).</span>`;
          } catch (err) {
            resultEl.style.display = "block";
            resultEl.innerHTML = `<span style="color:var(--loss);">❌ ${err.message}</span>`;
          } finally {
            btn.disabled = false; btn.textContent = "Send Test Email";
          }
        });

      } catch (err) {
        pane.innerHTML = `<div style="color:var(--loss);padding:30px 20px;text-align:center;">${err.message}</div>`;
      }
    }

    // ── NFTs ───────────────────────────────────────────────────────────────────
    async function loadNfts() {
      const pane = container.querySelector("#adm-pane-nfts");
      if (!pane) return;

      async function render() {
        try {
          const data = await Api.get("/admin/nfts");
          const nfts = data.nfts || [];

          pane.innerHTML = `
            <div style="${S.sectionCard}">
              <h3 style="${S.sectionTitle}">🏪 NFT Store — Supply &amp; Restock</h3>
              <p style="color:var(--text-dim);font-size:0.82rem;margin:0 0 12px;">
                Limited-supply NFTs and how many are left. Restock a sold-out one to put it back in the store.
              </p>
              <label style="display:flex;align-items:center;gap:8px;font-size:0.85rem;color:var(--text-dim);margin-bottom:10px;cursor:pointer;">
                <input type="checkbox" id="adm-nft-soldout-only" style="width:16px;height:16px;" /> Show sold-out only
              </label>
              <div id="adm-nft-store-list" style="color:var(--text-dim);">Loading store…</div>
            </div>

            <div style="${S.sectionCard}">
              <h3 style="${S.sectionTitle}">🖼️ Mint NFT for User</h3>
              <div style="${S.form}">
                <div style="display:flex;gap:12px;flex-wrap:wrap;">
                  <div style="${S.formGroup};flex:1;min-width:140px;">
                    <label style="${S.formLabel}">Username</label>
                    <input id="adm-nft-username" type="text" placeholder="Username"
                      style="${S.formInput}" autocomplete="off" />
                  </div>
                  <div style="${S.formGroup};flex:1;min-width:140px;">
                    <label style="${S.formLabel}">Name</label>
                    <input id="adm-nft-name" type="text" placeholder="NFT Name"
                      style="${S.formInput}" />
                  </div>
                  <div style="${S.formGroup};flex:1;min-width:180px;">
                    <label style="${S.formLabel}">Description</label>
                    <input id="adm-nft-desc" type="text" placeholder="Optional description"
                      style="${S.formInput}" />
                  </div>
                </div>
                <div style="display:flex;gap:12px;flex-wrap:wrap;">
                  <div style="${S.formGroup};flex:1;min-width:140px;">
                    <label style="${S.formLabel}">Rarity</label>
                    <select id="adm-nft-rarity" style="${S.formSelect}">
                      <option value="common">Common</option>
                      <option value="uncommon">Uncommon</option>
                      <option value="rare">Rare</option>
                      <option value="epic">Epic</option>
                      <option value="legendary">Legendary</option>
                    </select>
                  </div>
                  <div style="${S.formGroup};flex:1;min-width:100px;">
                    <label style="${S.formLabel}">Emoji</label>
                    <input id="adm-nft-emoji" type="text" placeholder="⭐" value="⭐"
                      style="${S.formInput}" maxlength="4" />
                  </div>
                </div>
                <div>
                  <button id="adm-nft-mint" style="${S.submitBtn}">Mint NFT</button>
                </div>
              </div>
            </div>

            <div style="${S.sectionCard}">
              <h3 style="${S.sectionTitle}">🖼️ All NFTs (latest 100)</h3>
              <div style="${S.tableWrap}">
                <table style="${S.table}">
                  <thead><tr>
                    <th style="${S.th}">Owner</th>
                    <th style="${S.th}">Emoji</th>
                    <th style="${S.th}">Name</th>
                    <th style="${S.th}">Rarity</th>
                    <th style="${S.th}">Category</th>
                    <th style="${S.th}">Minted</th>
                    <th style="${S.th}">Del</th>
                  </tr></thead>
                  <tbody>
                    ${nfts.length ? nfts.map(n => `
                      <tr>
                        <td style="${S.td};color:var(--accent-2);">${n.owner?.username || "—"}</td>
                        <td style="${S.td};font-size:1.4rem;">${n.emoji}</td>
                        <td style="${S.td};font-weight:700;">${n.name}</td>
                        <td style="${S.td};color:var(--gold);text-transform:capitalize;">${n.rarity}</td>
                        <td style="${S.td};color:var(--text-dim);">${n.category}</td>
                        <td style="${S.td};color:var(--text-dim);">${fmtDate(n.mintedAt)}</td>
                        <td style="${S.td};">
                          <button class="adm-nft-del" data-id="${n.id}" style="${S.redBtn}">Delete</button>
                        </td>
                      </tr>`).join("") : `<tr><td colspan="7" style="padding:24px;text-align:center;color:var(--text-dim);">No NFTs.</td></tr>`}
                  </tbody>
                </table>
              </div>
            </div>
          `;

          pane.querySelector("#adm-nft-mint").addEventListener("click", async () => {
            const username = pane.querySelector("#adm-nft-username").value.trim();
            const name = pane.querySelector("#adm-nft-name").value.trim();
            const description = pane.querySelector("#adm-nft-desc").value.trim();
            const rarity = pane.querySelector("#adm-nft-rarity").value;
            const emoji = pane.querySelector("#adm-nft-emoji").value.trim() || "⭐";

            if (!username || !name) { UI.toast("Username and name required.", "loss"); return; }

            const btn = pane.querySelector("#adm-nft-mint");
            btn.disabled = true; btn.textContent = "Minting…";
            try {
              await Api.post("/admin/nft/mint", { username, name, description, rarity, category: "special", emoji });
              UI.toast(`NFT "${name}" minted for ${username}!`, "win");
              render();
            } catch (err) {
              UI.toast(err.message || "Failed to mint.", "loss");
              btn.disabled = false; btn.textContent = "Mint NFT";
            }
          });

          pane.querySelectorAll(".adm-nft-del").forEach(btn => {
            btn.addEventListener("click", async () => {
              if (!confirm("Permanently delete this NFT?")) return;
              btn.disabled = true;
              try {
                await fetch(`/admin/nft/${btn.dataset.id}`, {
                  method: "DELETE",
                  headers: { authorization: `Bearer ${Api.getToken()}` },
                });
                UI.toast("NFT deleted.", "info");
                render();
              } catch (err) {
                UI.toast(err.message || "Failed.", "loss");
                btn.disabled = false;
              }
            });
          });

          // ── NFT store supply / restock ──────────────────────────────
          const soldOutOnly = pane.querySelector("#adm-nft-soldout-only");
          async function loadStore() {
            const host = pane.querySelector("#adm-nft-store-list");
            if (!host) return;
            try {
              const { items } = await Api.get("/admin/nft-store");
              const limited = items.filter(i => i.supply !== -1);
              const list = (soldOutOnly && soldOutOnly.checked) ? limited.filter(i => i.soldOut) : limited;
              if (!list.length) {
                host.innerHTML = `<p style="color:var(--text-dim);font-size:0.88rem;">${soldOutOnly && soldOutOnly.checked ? "Nothing is sold out. 🎉" : "No limited-supply NFTs in the catalog."}</p>`;
                return;
              }
              host.innerHTML = list.map(i => `
                <div style="display:flex;align-items:center;gap:10px;padding:8px 10px;border:1px solid var(--border);border-radius:10px;margin-bottom:6px;${i.soldOut ? "background:rgba(229,70,61,0.06);" : ""}">
                  <span style="font-size:1.4rem;">${i.emoji}</span>
                  <div style="flex:1;min-width:0;">
                    <div style="font-weight:700;">${escapeHtmlAdm(i.name)} <span style="color:var(--gold);font-size:0.75rem;text-transform:capitalize;">${i.rarity}</span></div>
                    <div style="font-size:0.78rem;color:var(--text-dim);">${i.minted}/${i.supply} sold · ${i.soldOut ? "<span style='color:var(--loss);'>SOLD OUT</span>" : `${i.remaining} left`} · ${i.priceChips} 🪙</div>
                  </div>
                  <button class="adm-nft-restock" data-id="${i.id}" style="${S.smallBtn}">Restock</button>
                </div>`).join("");
              host.querySelectorAll(".adm-nft-restock").forEach(b => {
                b.addEventListener("click", async () => {
                  b.disabled = true; b.textContent = "…";
                  try {
                    await Api.post(`/admin/nft-store/${b.dataset.id}/restock`, { minted: 0 });
                    UI.toast("Restocked — back in the store!", "win");
                    loadStore();
                  } catch (err) { UI.toast(err.message || "Failed.", "loss"); b.disabled = false; b.textContent = "Restock"; }
                });
              });
            } catch (err) {
              host.innerHTML = `<p style="color:var(--loss);">${err.message}</p>`;
            }
          }
          if (soldOutOnly) soldOutOnly.addEventListener("change", loadStore);
          loadStore();

        } catch (err) {
          pane.innerHTML = `<div style="color:var(--loss);padding:30px 20px;text-align:center;">${err.message}</div>`;
        }
      }

      render();
    }

    // ── House Bank ─────────────────────────────────────────────────────────────
    async function loadBank() {
      const pane = container.querySelector("#adm-pane-bank");
      if (!pane) return;
      pane.innerHTML = `<div style="color:var(--text-dim);padding:40px 20px;text-align:center;">⏳ Loading bank…</div>`;

      try {
        const d = await Api.get("/admin/bank");
        const netColor = d.houseIncome >= 0 ? "var(--win)" : "var(--loss)";

        pane.innerHTML = `
          <div style="${S.bankGrid}">
            ${[
              ["🪙 House Chips",  chips(d.chips || 0),         "var(--gold)"],
              ["💵 House Dollars", "$" + Math.floor((d.dollars||0)/100).toLocaleString(), "var(--win)"],
              ["📈 House Income",  money(d.houseIncome || 0),   netColor],
              ["💸 Total Wagered", money(d.totalWagered || 0),  "var(--text)"],
              ["💰 Total Paid Out",money(d.totalPaidOut || 0),  "var(--text)"],
            ].map(([label,val,col]) => `
              <div style="${S.statBox}">
                <div style="${S.sbLabel}">${label}</div>
                <div style="${S.sbValue};color:${col}">${val}</div>
              </div>`).join("")}
          </div>

          <div style="${S.bankCard};margin-bottom:18px;">
            <h3 style="margin:0 0 14px;font-size:0.95rem;font-weight:800;">Manual Adjustment</h3>
            <form id="adm-bank-form" style="display:flex;flex-direction:column;gap:12px;max-width:440px;">
              <div style="${S.formGroup}">
                <label style="${S.formLabel}">Type</label>
                <select id="adm-bank-type" style="${S.formSelect}">
                  <option value="chips">Chips</option>
                  <option value="dollars">Dollars</option>
                </select>
              </div>
              <div style="${S.formGroup}">
                <label style="${S.formLabel}">Amount (negative to remove)</label>
                <input id="adm-bank-amount" type="number" placeholder="e.g. 1000 or -500"
                  style="${S.formInput}" step="1" required />
              </div>
              <div style="${S.formGroup}">
                <label style="${S.formLabel}">Note</label>
                <input id="adm-bank-note" type="text" placeholder="Reason…"
                  style="${S.formInput}" />
              </div>
              <div>
                <button type="submit" style="${S.submitBtn}" id="adm-bank-submit">Apply</button>
              </div>
            </form>
          </div>

          ${d.transactions && d.transactions.length ? `
            <div style="${S.bankCard}">
              <h3 style="margin:0 0 14px;font-size:0.95rem;font-weight:800;">Recent Transactions</h3>
              <div style="${S.tableWrap}">
                <table style="${S.table}">
                  <thead><tr>
                    <th style="${S.th}">Type</th>
                    <th style="${S.th}">Chips Δ</th>
                    <th style="${S.th}">Dollars Δ</th>
                    <th style="${S.th}">Note</th>
                    <th style="${S.th}">Date</th>
                  </tr></thead>
                  <tbody>
                    ${d.transactions.map(tx => `
                      <tr>
                        <td style="${S.td}">${tx.type}</td>
                        <td style="${S.td};color:${tx.chipsChange >= 0 ? "var(--win)" : "var(--loss)"}">
                          ${tx.chipsChange >= 0 ? "+" : ""}${Math.floor(tx.chipsChange/100).toLocaleString()}
                        </td>
                        <td style="${S.td};color:${tx.dollarsChange >= 0 ? "var(--win)" : "var(--loss)"}">
                          ${tx.dollarsChange >= 0 ? "+" : ""}$${Math.floor(tx.dollarsChange/100).toLocaleString()}
                        </td>
                        <td style="${S.td};color:var(--text-dim);">${tx.note || "—"}</td>
                        <td style="${S.td};color:var(--text-dim);">${new Date(tx.createdAt).toLocaleDateString()}</td>
                      </tr>
                    `).join("")}
                  </tbody>
                </table>
              </div>
            </div>
          ` : ""}
        `;

        const bankForm = pane.querySelector("#adm-bank-form");
        bankForm.addEventListener("submit", async (e) => {
          e.preventDefault();
          const type = pane.querySelector("#adm-bank-type").value;
          const amt = Number(pane.querySelector("#adm-bank-amount").value);
          const note = pane.querySelector("#adm-bank-note").value.trim() || "manual";
          const submitBtn = pane.querySelector("#adm-bank-submit");
          if (isNaN(amt) || amt === 0) { UI.toast("Enter a non-zero amount.", "loss"); return; }
          submitBtn.disabled = true; submitBtn.textContent = "Saving…";
          try {
            await Api.post("/admin/bank/adjust", { type, amount: amt * 100, note });
            UI.toast("Bank updated.", "win");
            await loadBank();
          } catch (err) {
            UI.toast(err.message || "Failed to update bank.", "loss");
            submitBtn.disabled = false; submitBtn.textContent = "Apply";
          }
        });

      } catch (err) {
        pane.innerHTML = `<div style="color:var(--loss);padding:30px 20px;text-align:center;">${err.message}</div>`;
      }
    }

    // ── Danger Zone ────────────────────────────────────────────────────────────
    function buildDangerPane() {
      const pane = container.querySelector("#adm-pane-danger");
      if (!pane) return;
      pane.innerHTML = `
        <div style="${S.dangerZone}">
          <h3 style="${S.dangerTitle}">⚠️ Delete Account</h3>
          <p style="color:var(--text-dim);font-size:0.85rem;margin:0 0 16px;">
            Permanently deletes a user account and all associated data. This cannot be undone.
          </p>
          <div style="${S.form}">
            <div style="${S.formGroup}">
              <label style="${S.formLabel}" for="adm-delete-username">Username to delete</label>
              <input id="adm-delete-username" type="text" placeholder="Enter exact username…"
                style="${S.formInput}" autocomplete="off" />
            </div>
            <div id="adm-delete-preview" style="display:none;padding:12px 14px;
              background:rgba(248,113,113,0.1);border:1px solid rgba(248,113,113,0.4);
              border-radius:10px;font-size:0.88rem;margin-bottom:2px;"></div>
            <div>
              <button id="adm-delete-lookup-btn" type="button"
                style="${S.submitBtn};background:var(--bg-elev);color:var(--text);border:1px solid var(--border);">
                Look Up User
              </button>
            </div>
            <div>
              <button id="adm-delete-confirm-btn" type="button" style="${S.deleteBtn};display:none;">
                🗑️ Permanently Delete Account
              </button>
            </div>
          </div>
          <div id="adm-delete-result" style="display:none;${S.resultBox};margin-top:14px;"></div>
        </div>
      `;

      let deleteTargetId = null, deleteTargetName = null;
      const lookupBtn = pane.querySelector("#adm-delete-lookup-btn");
      const confirmBtn = pane.querySelector("#adm-delete-confirm-btn");
      const previewEl = pane.querySelector("#adm-delete-preview");
      const resultEl = pane.querySelector("#adm-delete-result");
      const usernameInput = pane.querySelector("#adm-delete-username");

      usernameInput.addEventListener("input", () => {
        deleteTargetId = null; deleteTargetName = null;
        confirmBtn.style.display = "none"; previewEl.style.display = "none"; resultEl.style.display = "none";
      });

      lookupBtn.addEventListener("click", async () => {
        const username = usernameInput.value.trim();
        if (!username) { UI.toast("Enter a username.", "loss"); return; }
        lookupBtn.disabled = true; lookupBtn.textContent = "Looking up…";
        deleteTargetId = null; deleteTargetName = null;
        confirmBtn.style.display = "none"; previewEl.style.display = "none"; resultEl.style.display = "none";
        try {
          const data = await Api.get(`/admin/users?search=${encodeURIComponent(username)}&limit=5`);
          const match = (data.users || []).find(u => u.username.toLowerCase() === username.toLowerCase());
          previewEl.style.display = "block";
          if (!match) {
            previewEl.innerHTML = `<span style="color:var(--loss);">User "${username}" not found.</span>`;
          } else {
            deleteTargetId = match.id; deleteTargetName = match.username;
            previewEl.innerHTML = `Found: <strong>${match.username}</strong> — Balance ${money(match.balance||0)} · Level ${match.level} · ${(match.betCount||0).toLocaleString()} bets${match.isBanned ? " · <span style='color:var(--loss);'>Banned</span>" : ""}`;
            confirmBtn.style.display = "inline-block";
          }
        } catch (err) {
          previewEl.style.display = "block";
          previewEl.innerHTML = `<span style="color:var(--loss);">${err.message}</span>`;
        } finally {
          lookupBtn.disabled = false; lookupBtn.textContent = "Look Up User";
        }
      });

      confirmBtn.addEventListener("click", async () => {
        if (!deleteTargetId || !deleteTargetName) return;
        if (!confirm(`Permanently delete "${deleteTargetName}"? This cannot be undone.`)) return;
        confirmBtn.disabled = true; confirmBtn.textContent = "Deleting…";
        try {
          await fetch(`/admin/users/${deleteTargetId}`, {
            method: "DELETE",
            headers: { authorization: `Bearer ${Api.getToken()}` },
          });
          previewEl.style.display = "none"; confirmBtn.style.display = "none";
          usernameInput.value = ""; deleteTargetId = null; deleteTargetName = null;
          resultEl.style.display = "block";
          resultEl.style.borderColor = "var(--win)"; resultEl.style.color = "var(--win)";
          resultEl.textContent = `✅ Account deleted.`;
          UI.toast("Account deleted.", "info");
        } catch (err) {
          resultEl.style.display = "block";
          resultEl.style.borderColor = "var(--loss)"; resultEl.style.color = "var(--loss)";
          resultEl.textContent = `❌ ${err.message}`;
          UI.toast(err.message, "loss");
          confirmBtn.disabled = false; confirmBtn.textContent = "🗑️ Permanently Delete Account";
        }
      });
    }

    // ── Maintenance Mode ───────────────────────────────────────────────────────
    async function loadMaintenance() {
      const pane = container.querySelector("#adm-pane-maintenance");
      if (!pane) return;
      pane.innerHTML = `<div style="color:var(--text-dim);padding:40px 20px;text-align:center;">⏳ Loading…</div>`;
      try {
        const data = await Api.get("/admin/maintenance");
        const on = data.enabled;
        pane.innerHTML = `
          <div style="${S.sectionCard}">
            <h3 style="${S.sectionTitle}">🔒 Maintenance Mode</h3>
            <p style="color:var(--text-dim);font-size:0.85rem;margin:0 0 18px;">
              When enabled, non-admin visitors see a maintenance page instead of the site.
            </p>
            <div style="display:flex;align-items:center;gap:16px;margin-bottom:18px;">
              <span style="font-size:1.1rem;font-weight:800;color:${on ? "var(--win)" : "var(--loss)"};">
                Status: ${on ? "🟢 ACTIVE" : "🔴 INACTIVE"}
              </span>
            </div>
            <button id="adm-maint-toggle" style="${on ? S.toggleOn : S.toggleOff}">
              ${on ? "Disable Maintenance Mode" : "Enable Maintenance Mode"}
            </button>
            <div id="adm-maint-result" style="display:none;${S.resultBox};margin-top:14px;"></div>
          </div>
        `;
        pane.querySelector("#adm-maint-toggle").addEventListener("click", async (e) => {
          const btn = e.currentTarget;
          btn.disabled = true; btn.textContent = "Saving…";
          try {
            await Api.post("/admin/maintenance/toggle", {});
            loadMaintenance();
          } catch (err) {
            const r = pane.querySelector("#adm-maint-result");
            r.style.display = "block"; r.style.color = "var(--loss)"; r.textContent = err.message;
            btn.disabled = false;
          }
        });
      } catch (err) {
        pane.innerHTML = `<div style="color:var(--loss);padding:20px;">${err.message}</div>`;
      }
    }

    // ── Site Config ────────────────────────────────────────────────────────────
    function buildConfigPane() {
      // Will be loaded on demand via loadConfig
    }

    // Numeric fields saved together via the "Save Config" button below.
    const ECONOMY_NUMBER_FIELDS = [
      { key: "minCashoutChips",       label: "Minimum Cashout (chips)",            def: 50,  min: 0 },
      { key: "withdrawalFeePercent",  label: "Withdrawal Fee (%)",                 def: 0,   min: 0, max: 100, step: "0.01" },
      { key: "maxDailyCashoutChips",  label: "Max Cashout per 24h (chips, 0 = unlimited)", def: 0, min: 0 },
      { key: "minBuyChips",           label: "Minimum Chip Purchase (chips)",      def: 1,   min: 1 },
      { key: "dailyBonusChips",       label: "Daily Bonus Amount (chips)",         def: 50,  min: 0 },
      { key: "rakebackPercent",       label: "Rakeback (%)",                       def: 5,   min: 0, max: 100, step: "0.01" },
      { key: "rakebackCooldownHours", label: "Rakeback Cooldown (hours)",          def: 24,  min: 1 },
      { key: "leaderboardWindowDays", label: "Leaderboard Window (days)",          def: 7,   min: 1 },
      { key: "emailCodeExpiryMinutes", label: "Email Code Expiry (minutes)",       def: 15,  min: 1 },
    ];

    // Toggle fields saved immediately on click, mirroring the Game Controls toggles.
    const ECONOMY_TOGGLE_FIELDS = [
      { key: "dailyBonusEnabled",    label: "Daily Login Bonus" },
      { key: "rakebackEnabled",      label: "Rakeback Claims" },
      { key: "leaderboardEnabled",   label: "Leaderboard" },
      { key: "registrationEnabled",  label: "New Registrations" },
      { key: "promoRedeemEnabled",   label: "Promo Code Redemption" },
      { key: "stripeCheckoutEnabled", label: "Chip Purchases (Stripe)" },
    ];

    async function loadConfig() {
      const pane = container.querySelector("#adm-pane-config");
      if (!pane) return;
      pane.innerHTML = `<div style="color:var(--text-dim);padding:40px 20px;text-align:center;">⏳ Loading…</div>`;
      try {
        const cfg = await Api.get("/admin/config");

        const numberFieldsHtml = ECONOMY_NUMBER_FIELDS.map(f => `
          <div style="${S.formGroup}">
            <label style="${S.formLabel}" for="adm-eco-${f.key}">${f.label}</label>
            <input id="adm-eco-${f.key}" type="number" min="${f.min ?? 0}" ${f.max !== undefined ? `max="${f.max}"` : ""} ${f.step ? `step="${f.step}"` : ""}
              value="${cfg[f.key] !== undefined ? cfg[f.key] : f.def}" style="${S.formInput}" />
          </div>
        `).join("");

        const toggleFieldsHtml = ECONOMY_TOGGLE_FIELDS.map(f => {
          const disabled = cfg[f.key] === "false";
          return `
            <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);">
              <span style="font-weight:600;">${f.label}</span>
              <button class="adm-eco-toggle" data-key="${f.key}" data-disabled="${disabled}"
                style="${disabled ? S.toggleOff : S.toggleOn}">
                ${disabled ? "🚫 Disabled" : "✅ Enabled"}
              </button>
            </div>
          `;
        }).join("");

        pane.innerHTML = `
          <div style="${S.sectionCard}">
            <h3 style="${S.sectionTitle}">⚙️ Site Config</h3>
            <div style="${S.form}">
              <div style="${S.formGroup}">
                <label style="${S.formLabel}" for="adm-cfg-minbet">Min Bet (chips)</label>
                <input id="adm-cfg-minbet" type="number" min="0" value="${cfg.minBet}" style="${S.formInput}" />
              </div>
              <div style="${S.formGroup}">
                <label style="${S.formLabel}" for="adm-cfg-maxbet">Max Bet (chips)</label>
                <input id="adm-cfg-maxbet" type="number" min="0" value="${cfg.maxBet}" style="${S.formInput}" />
              </div>
              <div style="${S.formGroup}">
                <label style="${S.formLabel}" for="adm-cfg-edge">House Edge % — win rate for Dice, Crash, Limbo, Mines, Hi-Lo (blank = default 1%; higher = players win less)</label>
                <input id="adm-cfg-edge" type="number" min="-50" max="95" step="0.1"
                  value="${cfg.house_edge != null && cfg.house_edge !== '' && cfg.house_edge !== 'null' ? cfg.house_edge : ''}"
                  placeholder="e.g. 5" style="${S.formInput}" />
              </div>
              <div>
                <button id="adm-cfg-save" style="${S.submitBtn}">Save Config</button>
              </div>
              <div id="adm-cfg-result" style="display:none;${S.resultBox}"></div>
            </div>
          </div>

          <div style="${S.sectionCard}">
            <h3 style="${S.sectionTitle}">🧩 Economy &amp; Feature Controls</h3>
            <p style="color:var(--text-dim);font-size:0.82rem;margin:0 0 14px;">
              Limits and bonus amounts used across cashouts, daily bonus, rakeback, and the leaderboard. Saved fields take effect immediately — no redeploy needed.
            </p>
            <div style="${S.form}">
              ${numberFieldsHtml}
              <div>
                <button id="adm-eco-save" style="${S.submitBtn}">Save Economy Settings</button>
              </div>
              <div id="adm-eco-result" style="display:none;${S.resultBox}"></div>
            </div>
            <hr class="bp-divider" style="margin:16px 0;" />
            ${toggleFieldsHtml}
          </div>
        `;

        pane.querySelector("#adm-cfg-save").addEventListener("click", async () => {
          const btn = pane.querySelector("#adm-cfg-save");
          const r = pane.querySelector("#adm-cfg-result");
          const minBet = Number(pane.querySelector("#adm-cfg-minbet").value);
          const maxBet = Number(pane.querySelector("#adm-cfg-maxbet").value);
          const edgeRaw = pane.querySelector("#adm-cfg-edge").value.trim();
          btn.disabled = true; btn.textContent = "Saving…";
          try {
            // house_edge "" → backend resets to the 1% default; a number applies live.
            await Api.post("/admin/config", { minBet, maxBet, house_edge: edgeRaw });
            r.style.display = "block"; r.style.color = "var(--win)"; r.textContent = edgeRaw === "" ? "✅ Saved — house edge reset to 1%." : `✅ Saved — house edge is now ${edgeRaw}%.`;
            UI.toast("Config saved.", "info");
          } catch (err) {
            r.style.display = "block"; r.style.color = "var(--loss)"; r.textContent = err.message;
          } finally {
            btn.disabled = false; btn.textContent = "Save Config";
          }
        });

        pane.querySelector("#adm-eco-save").addEventListener("click", async () => {
          const btn = pane.querySelector("#adm-eco-save");
          const r = pane.querySelector("#adm-eco-result");
          const updates = {};
          for (const f of ECONOMY_NUMBER_FIELDS) {
            updates[f.key] = Number(pane.querySelector(`#adm-eco-${f.key}`).value);
          }
          btn.disabled = true; btn.textContent = "Saving…";
          try {
            await Api.post("/admin/config", updates);
            r.style.display = "block"; r.style.color = "var(--win)"; r.textContent = "✅ Economy settings saved.";
            UI.toast("Economy settings saved.", "info");
          } catch (err) {
            r.style.display = "block"; r.style.color = "var(--loss)"; r.textContent = err.message;
          } finally {
            btn.disabled = false; btn.textContent = "Save Economy Settings";
          }
        });

        pane.querySelectorAll(".adm-eco-toggle").forEach(btn => {
          btn.addEventListener("click", async () => {
            const key = btn.dataset.key;
            const isDisabled = btn.dataset.disabled === "true";
            btn.disabled = true;
            try {
              await Api.post("/admin/config", { [key]: isDisabled ? "true" : "false" });
              UI.toast(`${key} ${isDisabled ? "enabled" : "disabled"}.`, "info");
              loadConfig();
            } catch (err) {
              UI.toast(err.message || "Failed.", "loss");
              btn.disabled = false;
            }
          });
        });
      } catch (err) {
        pane.innerHTML = `<div style="color:var(--loss);padding:20px;">${err.message}</div>`;
      }
    }

    // ── IP Blocks ──────────────────────────────────────────────────────────────
    async function loadIpBlocks() {
      const pane = container.querySelector("#adm-pane-ipblocks");
      if (!pane) return;
      pane.innerHTML = `<div style="color:var(--text-dim);padding:40px 20px;text-align:center;">⏳ Loading…</div>`;
      try {
        const data = await Api.get("/admin/ip-blocks");
        const blocks = data.blocks || [];
        pane.innerHTML = `
          <div style="${S.sectionCard}">
            <h3 style="${S.sectionTitle}">🚫 IP Blocklist (${blocks.length})</h3>
            <div style="${S.tableWrap};margin-bottom:20px;">
              <table style="${S.table}">
                <thead><tr>
                  <th style="${S.th}">IP Address</th>
                  <th style="${S.th}">Reason</th>
                  <th style="${S.th}">Added At</th>
                  <th style="${S.th}">Action</th>
                </tr></thead>
                <tbody id="adm-ip-tbody">
                  ${blocks.length === 0
                    ? `<tr><td colspan="4" style="${S.td};color:var(--text-dim);text-align:center;">No blocked IPs</td></tr>`
                    : blocks.map(b => `
                      <tr>
                        <td style="${S.td};font-family:monospace;">${b.ip}</td>
                        <td style="${S.td};color:var(--text-dim);">${b.reason || "—"}</td>
                        <td style="${S.td};color:var(--text-dim);">${fmtDate(b.addedAt)}</td>
                        <td style="${S.td};">
                          <button class="adm-ip-remove-btn" data-ip="${b.ip}" style="${S.redBtn}">Remove</button>
                        </td>
                      </tr>`).join("")}
                </tbody>
              </table>
            </div>
            <div style="border-top:1px solid var(--border);padding-top:18px;">
              <h4 style="margin:0 0 12px;font-size:0.88rem;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.05em;">Block New IP</h4>
              <div style="${S.form}">
                <div style="${S.formGroup}">
                  <label style="${S.formLabel}" for="adm-ip-addr">IP Address</label>
                  <input id="adm-ip-addr" type="text" placeholder="e.g. 1.2.3.4" style="${S.formInput}" />
                </div>
                <div style="${S.formGroup}">
                  <label style="${S.formLabel}" for="adm-ip-reason">Reason (optional)</label>
                  <input id="adm-ip-reason" type="text" placeholder="e.g. Spam / abuse" style="${S.formInput}" />
                </div>
                <div>
                  <button id="adm-ip-add-btn" style="${S.submitBtn}">Block IP</button>
                </div>
                <div id="adm-ip-result" style="display:none;${S.resultBox}"></div>
              </div>
            </div>
          </div>
        `;

        pane.querySelectorAll(".adm-ip-remove-btn").forEach(btn => {
          btn.addEventListener("click", async () => {
            const ip = btn.getAttribute("data-ip");
            if (!confirm(`Remove block for ${ip}?`)) return;
            btn.disabled = true;
            try {
              await fetch(`/admin/ip-blocks/${encodeURIComponent(ip)}`, {
                method: "DELETE",
                headers: { authorization: `Bearer ${Api.getToken()}` },
              });
              loadIpBlocks();
            } catch (err) { UI.toast(err.message, "loss"); btn.disabled = false; }
          });
        });

        pane.querySelector("#adm-ip-add-btn").addEventListener("click", async () => {
          const btn = pane.querySelector("#adm-ip-add-btn");
          const r = pane.querySelector("#adm-ip-result");
          const ip = pane.querySelector("#adm-ip-addr").value.trim();
          const reason = pane.querySelector("#adm-ip-reason").value.trim();
          if (!ip) { UI.toast("Enter an IP address.", "loss"); return; }
          btn.disabled = true; btn.textContent = "Blocking…";
          try {
            await Api.post("/admin/ip-blocks", { ip, reason });
            loadIpBlocks();
          } catch (err) {
            r.style.display = "block"; r.style.color = "var(--loss)"; r.textContent = err.message;
            btn.disabled = false; btn.textContent = "Block IP";
          }
        });
      } catch (err) {
        pane.innerHTML = `<div style="color:var(--loss);padding:20px;">${err.message}</div>`;
      }
    }

    // ── Reports ────────────────────────────────────────────────────────────────
    function escapeHtmlAdm(str) {
      return String(str ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    }

    async function loadReports() {
      const pane = container.querySelector("#adm-pane-reports");
      if (!pane) return;
      pane.innerHTML = `<div style="color:var(--text-dim);padding:40px 20px;text-align:center;">⏳ Loading…</div>`;
      try {
        const [data, userReportsData] = await Promise.all([
          Api.get("/admin/reports/suspicious"),
          Api.get("/admin/reports/user").catch(() => ({ reports: [] })),
        ]);
        const users = data.users || [];
        const userReports = (userReportsData && userReportsData.reports) || [];
        const openReports = userReports.filter(r => r.status !== "resolved");
        pane.innerHTML = `
          <div style="${S.sectionCard}">
            <h3 style="${S.sectionTitle}">🚩 Player Reports (${openReports.length} open)</h3>
            ${userReports.length === 0
              ? `<p style="color:var(--text-dim);font-size:0.88rem;">No player reports yet.</p>`
              : userReports.map(r => `
                <div style="border:1px solid var(--border);border-radius:10px;padding:12px;margin-bottom:10px;${r.status === "resolved" ? "opacity:0.5;" : ""}">
                  <div style="font-weight:700;">🚩 ${escapeHtmlAdm(r.reportedName)} <span style="color:var(--text-dim);font-weight:400;">reported by ${escapeHtmlAdm(r.reporterName)}</span></div>
                  <div style="font-size:0.9rem;margin:6px 0;">${escapeHtmlAdm(r.reason)}</div>
                  ${r.context ? `<div style="font-size:0.8rem;color:var(--text-dim);font-style:italic;">Context: "${escapeHtmlAdm(r.context)}"</div>` : ""}
                  <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;">
                    <span style="font-size:0.72rem;color:var(--text-mute);">${new Date(r.createdAt).toLocaleString()}</span>
                    ${r.status === "resolved" ? `<span style="color:var(--win);font-size:0.8rem;">✓ Resolved</span>` : `<button class="adm-report-resolve" data-id="${r.id}" style="${S.smallBtn}">Mark Resolved</button>`}
                  </div>
                </div>`).join("")}
          </div>
          <div style="${S.sectionCard}">
            <h3 style="${S.sectionTitle}">🔍 Suspicious Users — Balance > 0, No Deposits (${users.length})</h3>
            <p style="color:var(--text-dim);font-size:0.82rem;margin:0 0 14px;">
              Users with a positive balance and active bets but no confirmed deposit transactions.
            </p>
            <div style="${S.tableWrap}">
              <table style="${S.table}">
                <thead><tr>
                  <th style="${S.th}">Username</th>
                  <th style="${S.th}">Balance</th>
                  <th style="${S.th}">Bets</th>
                  <th style="${S.th}">Total Wagered</th>
                </tr></thead>
                <tbody>
                  ${users.length === 0
                    ? `<tr><td colspan="4" style="${S.td};color:var(--text-dim);text-align:center;">No suspicious users found</td></tr>`
                    : users.map(u => `
                      <tr>
                        <td style="${S.td}"><span style="${S.usernameLink}" data-uid="${u.id}">${u.username}</span></td>
                        <td style="${S.td}">${chips(u.balance || 0)}</td>
                        <td style="${S.td}">${(u.betCount || 0).toLocaleString()}</td>
                        <td style="${S.td}">${chips(u.totalWagered || 0)}</td>
                      </tr>`).join("")}
                </tbody>
              </table>
            </div>
          </div>
        `;
        pane.querySelectorAll("[data-uid]").forEach(el => {
          el.addEventListener("click", () => openUserDetailModal(el.getAttribute("data-uid")));
        });
        pane.querySelectorAll(".adm-report-resolve").forEach(btn => {
          btn.addEventListener("click", async () => {
            btn.disabled = true; btn.textContent = "…";
            try {
              await Api.post(`/admin/reports/${btn.dataset.id}/resolve`, {});
              UI.toast("Report resolved.", "win");
              loadReports();
            } catch (err) { UI.toast(err.message || "Failed.", "loss"); btn.disabled = false; btn.textContent = "Mark Resolved"; }
          });
        });
      } catch (err) {
        pane.innerHTML = `<div style="color:var(--loss);padding:20px;">${err.message}</div>`;
      }
    }

    // ── Analytics ──────────────────────────────────────────────────────────────
    async function loadAnalytics() {
      const pane = container.querySelector("#adm-pane-analytics");
      if (!pane) return;
      pane.innerHTML = `<div style="color:var(--text-dim);padding:40px 20px;text-align:center;">⏳ Loading…</div>`;
      try {
        const data = await Api.get("/admin/analytics");
        const { dailySignups = [], betsPerGame = [], winLossRatio = "0.0", totalBets = 0 } = data;

        const maxSignups = Math.max(1, ...dailySignups.map(d => d.count));
        const maxBetsGame = Math.max(1, ...betsPerGame.map(g => g.count));

        pane.innerHTML = `
          <div style="${S.sectionCard}">
            <h3 style="${S.sectionTitle}">📈 Analytics</h3>
            <div style="${S.statsGrid};margin-bottom:18px;">
              <div style="${S.statBox}"><div style="${S.sbLabel}">Total Bets</div><div style="${S.sbValue}">${totalBets.toLocaleString()}</div></div>
              <div style="${S.statBox}"><div style="${S.sbLabel}">Win Rate</div><div style="${S.sbValue}">${winLossRatio}%</div></div>
            </div>

            <h4 style="margin:0 0 10px;font-size:0.82rem;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.05em;">Daily Signups — Last 7 Days</h4>
            <div style="display:flex;align-items:flex-end;gap:6px;height:80px;margin-bottom:20px;">
              ${dailySignups.map(d => {
                const h = Math.max(4, Math.round((d.count / maxSignups) * 72));
                return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;">
                  <span style="font-size:0.65rem;color:var(--text-dim);">${d.count}</span>
                  <div style="width:100%;height:${h}px;background:var(--accent);border-radius:4px 4px 0 0;opacity:0.85;"></div>
                  <span style="font-size:0.6rem;color:var(--text-dim);">${d.date.slice(5)}</span>
                </div>`;
              }).join("")}
            </div>

            <h4 style="margin:0 0 10px;font-size:0.82rem;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.05em;">Bets by Game</h4>
            <div style="${S.tableWrap}">
              <table style="${S.table}">
                <thead><tr>
                  <th style="${S.th}">Game</th>
                  <th style="${S.th}">Bet Count</th>
                  <th style="${S.th}">Total Wagered</th>
                  <th style="${S.th}">Total Paid Out</th>
                  <th style="${S.th}">Bar</th>
                </tr></thead>
                <tbody>
                  ${betsPerGame.slice(0, 20).map(g => `
                    <tr>
                      <td style="${S.td};font-weight:700;">${g.game}</td>
                      <td style="${S.td}">${g.count.toLocaleString()}</td>
                      <td style="${S.td}">${chips(g.wagered || 0)}</td>
                      <td style="${S.td}">${chips(g.paidOut || 0)}</td>
                      <td style="${S.td};min-width:80px;">
                        <div style="width:${Math.round((g.count/maxBetsGame)*100)}%;min-width:4px;height:8px;background:var(--accent);border-radius:4px;opacity:0.8;"></div>
                      </td>
                    </tr>`).join("")}
                </tbody>
              </table>
            </div>
          </div>
        `;
      } catch (err) {
        pane.innerHTML = `<div style="color:var(--loss);padding:20px;">${err.message}</div>`;
      }
    }

    // ── Referrals ──────────────────────────────────────────────────────────────
    async function loadReferrals() {
      const pane = container.querySelector("#adm-pane-referrals");
      if (!pane) return;
      pane.innerHTML = `<div style="color:var(--text-dim);padding:40px 20px;text-align:center;">⏳ Loading…</div>`;
      try {
        const data = await Api.get("/admin/referrals");
        const refs = data.referrals || [];
        pane.innerHTML = `
          <div style="${S.sectionCard}">
            <h3 style="${S.sectionTitle}">🔗 Referral Codes (${refs.length} users)</h3>
            <p style="color:var(--text-dim);font-size:0.82rem;margin:0 0 14px;">
              Each user has an auto-generated referral code. Referred users who register with a code earn the referrer 50 chips.
            </p>
            <div style="${S.tableWrap}">
              <table style="${S.table}">
                <thead><tr>
                  <th style="${S.th}">Username</th>
                  <th style="${S.th}">Referral Code</th>
                  <th style="${S.th}">Referred</th>
                  <th style="${S.th}">Bonus Earned</th>
                </tr></thead>
                <tbody>
                  ${refs.length === 0
                    ? `<tr><td colspan="4" style="${S.td};color:var(--text-dim);text-align:center;">No users found</td></tr>`
                    : refs.map(r => `
                      <tr>
                        <td style="${S.td};font-weight:700;">${r.username}</td>
                        <td style="${S.td};font-family:monospace;color:var(--accent-2);">${r.referralCode}</td>
                        <td style="${S.td}">${r.referredCount}</td>
                        <td style="${S.td}">${chips(r.bonusEarned * 100)}</td>
                      </tr>`).join("")}
                </tbody>
              </table>
            </div>
          </div>
        `;
      } catch (err) {
        pane.innerHTML = `<div style="color:var(--loss);padding:20px;">${err.message}</div>`;
      }
    }

    // ── Leaderboard ────────────────────────────────────────────────────────────
    async function loadLeaderboard() {
      const pane = container.querySelector("#adm-pane-leaderboard");
      if (!pane) return;
      pane.innerHTML = `<div style="color:var(--text-dim);padding:40px 20px;text-align:center;">⏳ Loading…</div>`;
      try {
        const data = await Api.get("/admin/leaderboard");
        const users = data.users || [];
        pane.innerHTML = `
          <div style="${S.sectionCard}">
            <h3 style="${S.sectionTitle}">🏆 Top Players by Total Wagered</h3>
            <div style="${S.tableWrap};margin-bottom:20px;">
              <table style="${S.table}">
                <thead><tr>
                  <th style="${S.th}">#</th>
                  <th style="${S.th}">Username</th>
                  <th style="${S.th}">Balance</th>
                  <th style="${S.th}">XP</th>
                  <th style="${S.th}">Total Wagered</th>
                </tr></thead>
                <tbody>
                  ${users.length === 0
                    ? `<tr><td colspan="5" style="${S.td};color:var(--text-dim);text-align:center;">No players found</td></tr>`
                    : users.map((u, i) => `
                      <tr>
                        <td style="${S.td};color:var(--text-dim);">${i + 1}</td>
                        <td style="${S.td}"><span style="${S.usernameLink}" data-uid="${u.id}">${u.username}</span></td>
                        <td style="${S.td}">${chips(u.balance || 0)}</td>
                        <td style="${S.td}">${(u.xp || 0).toLocaleString()}</td>
                        <td style="${S.td}">${chips(u.totalWagered || 0)}</td>
                      </tr>`).join("")}
                </tbody>
              </table>
            </div>
            <div style="border-top:1px solid var(--border);padding-top:16px;">
              <button id="adm-lb-reset" style="${S.deleteBtn}">⚠️ Reset All XP to 0</button>
              <div id="adm-lb-result" style="display:none;${S.resultBox};margin-top:14px;"></div>
            </div>
          </div>
        `;
        pane.querySelectorAll("[data-uid]").forEach(el => {
          el.addEventListener("click", () => openUserDetailModal(el.getAttribute("data-uid")));
        });
        pane.querySelector("#adm-lb-reset").addEventListener("click", async () => {
          if (!confirm("Reset XP for ALL users to 0? This cannot be undone.")) return;
          const btn = pane.querySelector("#adm-lb-reset");
          const r = pane.querySelector("#adm-lb-result");
          btn.disabled = true; btn.textContent = "Resetting…";
          try {
            await Api.post("/admin/leaderboard/reset", {});
            r.style.display = "block"; r.style.color = "var(--win)"; r.textContent = "✅ XP reset for all users.";
            UI.toast("XP reset.", "info");
            loadLeaderboard();
          } catch (err) {
            r.style.display = "block"; r.style.color = "var(--loss)"; r.textContent = err.message;
            btn.disabled = false; btn.textContent = "⚠️ Reset All XP to 0";
          }
        });
      } catch (err) {
        pane.innerHTML = `<div style="color:var(--loss);padding:20px;">${err.message}</div>`;
      }
    }

    // ── Chat Moderation ────────────────────────────────────────────────────────
    async function loadChatMod() {
      const pane = container.querySelector("#adm-pane-chatmod");
      if (!pane) return;
      pane.innerHTML = `<div style="color:var(--text-dim);padding:40px 20px;text-align:center;">⏳ Loading…</div>`;
      try {
        const data = await Api.get("/admin/chat/messages");
        const muted = data.mutedUsers || [];
        pane.innerHTML = `
          <div style="${S.sectionCard}">
            <h3 style="${S.sectionTitle}">💬 Chat Moderation</h3>
            <p style="color:var(--text-dim);font-size:0.85rem;margin:0 0 18px;">
              Recent chat messages will appear here — chat is stored in memory per session and resets on server restart.
            </p>
            <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:10px;padding:16px;min-height:80px;margin-bottom:20px;color:var(--text-dim);font-size:0.85rem;font-style:italic;">
              No chat messages available (chat is in-memory, no history is persisted).
            </div>
            <div style="border-top:1px solid var(--border);padding-top:16px;">
              <h4 style="margin:0 0 12px;font-size:0.88rem;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.05em;">Mute / Unmute User</h4>
              <div style="${S.form}">
                <div style="${S.formGroup}">
                  <label style="${S.formLabel}" for="adm-chat-user">Username</label>
                  <input id="adm-chat-user" type="text" placeholder="Enter username…" style="${S.formInput}" />
                </div>
                <div style="display:flex;gap:10px;">
                  <button id="adm-chat-mute-btn" style="${S.submitBtn}">Mute User</button>
                  <button id="adm-chat-unmute-btn" style="${S.smallBtn}">Unmute User</button>
                </div>
                <div id="adm-chat-result" style="display:none;${S.resultBox}"></div>
              </div>
            </div>
            <div style="margin-top:18px;">
              <h4 style="margin:0 0 10px;font-size:0.88rem;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.05em;">
                Currently Muted (${muted.length})
              </h4>
              ${muted.length === 0
                ? `<p style="color:var(--text-dim);font-size:0.85rem;">No users currently muted.</p>`
                : `<div style="display:flex;flex-wrap:wrap;gap:8px;">${muted.map(u =>
                    `<span style="background:rgba(248,113,113,0.12);border:1px solid rgba(248,113,113,0.35);color:var(--loss);border-radius:7px;padding:4px 10px;font-size:0.8rem;font-weight:700;">${u}</span>`
                  ).join("")}</div>`}
            </div>
          </div>
        `;
        const r = pane.querySelector("#adm-chat-result");
        pane.querySelector("#adm-chat-mute-btn").addEventListener("click", async () => {
          const username = pane.querySelector("#adm-chat-user").value.trim();
          if (!username) { UI.toast("Enter a username.", "loss"); return; }
          try {
            await Api.post("/admin/chat/mute", { username });
            r.style.display = "block"; r.style.color = "var(--win)"; r.textContent = `✅ ${username} muted.`;
            loadChatMod();
          } catch (err) { r.style.display = "block"; r.style.color = "var(--loss)"; r.textContent = err.message; }
        });
        pane.querySelector("#adm-chat-unmute-btn").addEventListener("click", async () => {
          const username = pane.querySelector("#adm-chat-user").value.trim();
          if (!username) { UI.toast("Enter a username.", "loss"); return; }
          try {
            await Api.post("/admin/chat/unmute", { username });
            r.style.display = "block"; r.style.color = "var(--win)"; r.textContent = `✅ ${username} unmuted.`;
            loadChatMod();
          } catch (err) { r.style.display = "block"; r.style.color = "var(--loss)"; r.textContent = err.message; }
        });
      } catch (err) {
        pane.innerHTML = `<div style="color:var(--loss);padding:20px;">${err.message}</div>`;
      }
    }

    // ── Scratch Tickets ────────────────────────────────────────────────────────
    async function loadScratch() {
      const pane = container.querySelector("#adm-pane-scratch");
      if (!pane) return;
      pane.innerHTML = `<div style="color:var(--text-dim);padding:40px 20px;text-align:center;">⏳ Loading…</div>`;
      try {
        const data = await Api.get("/admin/scratch/stats");
        pane.innerHTML = `
          <div style="${S.sectionCard}">
            <h3 style="${S.sectionTitle}">🎟️ Scratch Ticket Stats</h3>
            <div style="${S.statsGrid}">
              <div style="${S.statBox}">
                <div style="${S.sbLabel}">Tickets Sold</div>
                <div style="${S.sbValue}">${(data.totalSold || 0).toLocaleString()}</div>
              </div>
              <div style="${S.statBox}">
                <div style="${S.sbLabel}">Total Wagered</div>
                <div style="${S.sbValue}">${chips(data.totalWagered || 0)}</div>
              </div>
              <div style="${S.statBox}">
                <div style="${S.sbLabel}">Total Won (Payouts)</div>
                <div style="${S.sbValue}">${chips(data.totalPaidOut || 0)}</div>
              </div>
              <div style="${S.statBox}">
                <div style="${S.sbLabel}">Net Revenue</div>
                <div style="${S.sbValue};color:${(data.revenue || 0) >= 0 ? "var(--win)" : "var(--loss)"};">
                  ${chips(data.revenue || 0)}
                </div>
              </div>
            </div>
          </div>
        `;
      } catch (err) {
        pane.innerHTML = `<div style="color:var(--loss);padding:20px;">${err.message}</div>`;
      }
    }

    // ── Prize Draws ────────────────────────────────────────────────────────────
    async function loadPrizes() {
      const pane = container.querySelector("#adm-pane-prizes");
      if (!pane) return;
      pane.innerHTML = `<div style="color:var(--text-dim);padding:40px 20px;text-align:center;">⏳ Loading…</div>`;
      try {
        const data = await Api.get("/admin/prizes");
        const prizes = data.prizes || [];
        pane.innerHTML = `
          <div style="${S.sectionCard}">
            <h3 style="${S.sectionTitle}">🎁 Prize Draws (${prizes.length})</h3>
            <div style="${S.tableWrap};margin-bottom:20px;">
              <table style="${S.table}">
                <thead><tr>
                  <th style="${S.th}">Name</th>
                  <th style="${S.th}">Prize (chips)</th>
                  <th style="${S.th}">Created</th>
                  <th style="${S.th}">Winner</th>
                  <th style="${S.th}">Action</th>
                </tr></thead>
                <tbody>
                  ${prizes.length === 0
                    ? `<tr><td colspan="5" style="${S.td};color:var(--text-dim);text-align:center;">No prizes created yet</td></tr>`
                    : prizes.map(p => `
                      <tr>
                        <td style="${S.td};font-weight:700;">${p.name}</td>
                        <td style="${S.td}">${chips(p.chipAmount * 100)}</td>
                        <td style="${S.td};color:var(--text-dim);">${fmtDate(p.createdAt)}</td>
                        <td style="${S.td};">
                          ${p.winner
                            ? `<span style="color:var(--win);font-weight:700;">🏆 ${p.winner.username}</span><br><span style="color:var(--text-dim);font-size:0.75rem;">${fmtDate(p.drawnAt)}</span>`
                            : `<span style="color:var(--text-dim);">—</span>`}
                        </td>
                        <td style="${S.td};">
                          ${p.winner
                            ? `<span style="color:var(--text-dim);font-size:0.78rem;">Drawn</span>`
                            : `<button class="adm-prize-draw-btn" data-id="${p.id}" data-name="${p.name}" style="${S.greenBtn}">🎲 Draw Winner</button>`}
                        </td>
                      </tr>`).join("")}
                </tbody>
              </table>
            </div>
            <div style="border-top:1px solid var(--border);padding-top:18px;">
              <h4 style="margin:0 0 12px;font-size:0.88rem;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.05em;">Create New Prize</h4>
              <div style="${S.form}">
                <div style="${S.formGroup}">
                  <label style="${S.formLabel}" for="adm-prize-name">Prize Name</label>
                  <input id="adm-prize-name" type="text" placeholder="e.g. Weekend Jackpot" style="${S.formInput}" />
                </div>
                <div style="${S.formGroup}">
                  <label style="${S.formLabel}" for="adm-prize-chips">Chip Amount</label>
                  <input id="adm-prize-chips" type="number" min="0" placeholder="e.g. 1000" style="${S.formInput}" />
                </div>
                <div>
                  <button id="adm-prize-create-btn" style="${S.submitBtn}">Create Prize</button>
                </div>
                <div id="adm-prize-result" style="display:none;${S.resultBox}"></div>
              </div>
            </div>
          </div>
        `;

        pane.querySelectorAll(".adm-prize-draw-btn").forEach(btn => {
          btn.addEventListener("click", async () => {
            const id = btn.getAttribute("data-id");
            const name = btn.getAttribute("data-name");
            if (!confirm(`Draw a random winner for "${name}"? The winner will receive the chips immediately.`)) return;
            btn.disabled = true; btn.textContent = "Drawing…";
            try {
              const result = await Api.post(`/admin/prizes/${id}/draw`, {});
              UI.toast(`🏆 Winner: ${result.prize.winner.username}!`, "info");
              loadPrizes();
            } catch (err) {
              UI.toast(err.message, "loss");
              btn.disabled = false; btn.textContent = "🎲 Draw Winner";
            }
          });
        });

        const r = pane.querySelector("#adm-prize-result");
        pane.querySelector("#adm-prize-create-btn").addEventListener("click", async () => {
          const btn = pane.querySelector("#adm-prize-create-btn");
          const name = pane.querySelector("#adm-prize-name").value.trim();
          const chipAmount = Number(pane.querySelector("#adm-prize-chips").value);
          if (!name) { UI.toast("Enter a prize name.", "loss"); return; }
          btn.disabled = true; btn.textContent = "Creating…";
          try {
            await Api.post("/admin/prizes/create", { name, chipAmount });
            r.style.display = "block"; r.style.color = "var(--win)"; r.textContent = "✅ Prize created.";
            loadPrizes();
          } catch (err) {
            r.style.display = "block"; r.style.color = "var(--loss)"; r.textContent = err.message;
            btn.disabled = false; btn.textContent = "Create Prize";
          }
        });
      } catch (err) {
        pane.innerHTML = `<div style="color:var(--loss);padding:20px;">${err.message}</div>`;
      }
    }

    // ── Subscriptions ──────────────────────────────────────────────────────────
    async function loadSubscriptions() {
      const pane = container.querySelector("#adm-pane-subscriptions");
      if (!pane) return;

      async function render() {
        pane.innerHTML = `<div style="color:var(--text-dim);padding:40px 20px;text-align:center;">⏳ Loading subscriptions…</div>`;
        try {
          const [pendingData, allData] = await Promise.all([
            Api.get("/admin/subscriptions/pending"),
            Api.get("/admin/subscriptions"),
          ]);

          const pending = pendingData.users || [];
          const all = allData.users || [];

          function tierBadge(tier) {
            if (!tier) return `<span style="color:var(--text-dim);font-size:0.78rem;">None</span>`;
            const t = PATREON_TIER_INFO[tier] || { label: tier, c: "#9ca3af" };
            return `<span style="color:${t.c};font-weight:700;font-size:0.78rem;">${t.label}</span>`;
          }

          function approvalStatus(u) {
            if (!u.isApproved) return `<span style="color:var(--loss);font-weight:700;font-size:0.78rem;">⏳ Pending</span>`;
            const expiry = u.approvedUntil ? new Date(u.approvedUntil) : null;
            if (expiry && expiry < new Date()) return `<span style="color:var(--loss);font-weight:700;font-size:0.78rem;">⚠️ Expired</span>`;
            const daysLeft = expiry ? Math.ceil((expiry - Date.now()) / 86400000) : null;
            return `<span style="color:var(--win);font-weight:700;font-size:0.78rem;">✅ Active${daysLeft !== null ? ` (${daysLeft}d left)` : ""}</span>`;
          }

          pane.innerHTML = `
            <div style="${S.sectionCard}">
              <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:16px;">
                <h3 style="${S.sectionTitle};margin:0;">⏳ Pending Approvals (${pending.length})</h3>
                <button id="adm-sub-revoke-expired" style="${S.redBtn}">Revoke All Expired</button>
              </div>
              ${pending.length === 0
                ? `<p style="color:var(--text-dim);font-size:0.88rem;">No pending requests.</p>`
                : `<div style="${S.tableWrap}">
                  <table style="${S.table}">
                    <thead><tr>
                      <th style="${S.th}">Username</th>
                      <th style="${S.th}">Patreon</th>
                      <th style="${S.th}">Registered</th>
                      <th style="${S.th}">Tier</th>
                      <th style="${S.th}">Days</th>
                      <th style="${S.th}">Approve</th>
                    </tr></thead>
                    <tbody>
                      ${pending.map(u => `
                        <tr>
                          <td style="${S.td};font-weight:700;color:var(--accent-2);">${u.username}</td>
                          <td style="${S.td};font-style:italic;color:var(--text-dim);">${u.patreonUsername || "—"}</td>
                          <td style="${S.td};color:var(--text-dim);">${fmtDate(u.createdAt)}</td>
                          <td style="${S.td};">
                            <select class="adm-sub-tier" data-id="${u.id}" style="${S.rankSelect}">
                              ${Object.entries(PATREON_TIER_INFO).map(([k,v]) => `<option value="${k}">${v.label}</option>`).join("")}
                            </select>
                          </td>
                          <td style="${S.td};">
                            <input class="adm-sub-days" data-id="${u.id}" type="number" value="31" min="1" max="365"
                              style="${S.rankSelect};width:60px;" />
                          </td>
                          <td style="${S.td};">
                            <button class="adm-sub-approve" data-id="${u.id}" style="${S.greenBtn}">✅ Approve</button>
                          </td>
                        </tr>`).join("")}
                    </tbody>
                  </table>
                </div>`}
            </div>

            <div style="${S.sectionCard}">
              <h3 style="${S.sectionTitle}">🔑 All Subscriptions</h3>
              <div style="${S.tableWrap}">
                <table style="${S.table}">
                  <thead><tr>
                    <th style="${S.th}">Username</th>
                    <th style="${S.th}">Patreon</th>
                    <th style="${S.th}">Tier</th>
                    <th style="${S.th}">Status</th>
                    <th style="${S.th}">Expires</th>
                    <th style="${S.th}">Actions</th>
                  </tr></thead>
                  <tbody>
                    ${all.map(u => `
                      <tr>
                        <td style="${S.td};font-weight:700;color:var(--accent-2);">${u.username}</td>
                        <td style="${S.td};color:var(--text-dim);">${u.patreonUsername || "—"}</td>
                        <td style="${S.td};">${tierBadge(u.patreonTier)}</td>
                        <td style="${S.td};">${approvalStatus(u)}</td>
                        <td style="${S.td};color:var(--text-dim);">${u.approvedUntil ? new Date(u.approvedUntil).toLocaleDateString() : "—"}</td>
                        <td style="${S.td};">
                          <div style="display:flex;gap:6px;flex-wrap:wrap;">
                            ${!u.isApproved
                              ? `<button class="adm-sub-approve-quick" data-id="${u.id}" style="${S.greenBtn}">Approve 31d</button>`
                              : `<button class="adm-sub-extend" data-id="${u.id}" style="${S.smallBtn}">+31d</button>`}
                            ${u.isApproved
                              ? `<button class="adm-sub-revoke" data-id="${u.id}" style="${S.redBtn}">Revoke</button>`
                              : ""}
                          </div>
                        </td>
                      </tr>`).join("")}
                  </tbody>
                </table>
              </div>
            </div>
          `;

          // Approve pending user
          pane.querySelectorAll(".adm-sub-approve").forEach(btn => {
            btn.addEventListener("click", async () => {
              const id = btn.dataset.id;
              const tier = pane.querySelector(`.adm-sub-tier[data-id="${id}"]`).value;
              const days = Number(pane.querySelector(`.adm-sub-days[data-id="${id}"]`).value) || 31;
              btn.disabled = true; btn.textContent = "…";
              try {
                await Api.post(`/admin/subscriptions/${id}/approve`, { patreonTier: tier, daysValid: days });
                UI.toast("User approved!", "win");
                render();
              } catch (err) {
                UI.toast(err.message || "Failed.", "loss");
                btn.disabled = false; btn.textContent = "✅ Approve";
              }
            });
          });

          // Quick approve (31d default bronze)
          pane.querySelectorAll(".adm-sub-approve-quick").forEach(btn => {
            btn.addEventListener("click", async () => {
              btn.disabled = true; btn.textContent = "…";
              try {
                await Api.post(`/admin/subscriptions/${btn.dataset.id}/approve`, { patreonTier: "bronze_patron", daysValid: 31 });
                UI.toast("Approved for 31 days!", "win");
                render();
              } catch (err) {
                UI.toast(err.message || "Failed.", "loss");
                btn.disabled = false; btn.textContent = "Approve 31d";
              }
            });
          });

          // Extend subscription
          pane.querySelectorAll(".adm-sub-extend").forEach(btn => {
            btn.addEventListener("click", async () => {
              btn.disabled = true; btn.textContent = "…";
              try {
                await Api.post(`/admin/subscriptions/${btn.dataset.id}/approve`, { patreonTier: "bronze_patron", daysValid: 31 });
                UI.toast("Extended by 31 days!", "win");
                render();
              } catch (err) {
                UI.toast(err.message || "Failed.", "loss");
                btn.disabled = false; btn.textContent = "+31d";
              }
            });
          });

          // Revoke subscription
          pane.querySelectorAll(".adm-sub-revoke").forEach(btn => {
            btn.addEventListener("click", async () => {
              if (!confirm("Revoke this user's subscription?")) return;
              btn.disabled = true; btn.textContent = "…";
              try {
                await Api.post(`/admin/subscriptions/${btn.dataset.id}/revoke`, {});
                UI.toast("Subscription revoked.", "info");
                render();
              } catch (err) {
                UI.toast(err.message || "Failed.", "loss");
                btn.disabled = false; btn.textContent = "Revoke";
              }
            });
          });

          // Revoke all expired
          const revokeExpiredBtn = pane.querySelector("#adm-sub-revoke-expired");
          if (revokeExpiredBtn) {
            revokeExpiredBtn.addEventListener("click", async () => {
              if (!confirm("Revoke all expired subscriptions?")) return;
              revokeExpiredBtn.disabled = true; revokeExpiredBtn.textContent = "Working…";
              try {
                const r = await Api.post("/admin/subscriptions/revoke-expired", {});
                UI.toast(`Revoked ${r.revoked} expired subscriptions.`, "info");
                render();
              } catch (err) {
                UI.toast(err.message || "Failed.", "loss");
                revokeExpiredBtn.disabled = false; revokeExpiredBtn.textContent = "Revoke All Expired";
              }
            });
          }
        } catch (err) {
          pane.innerHTML = `<div style="color:var(--loss);padding:20px;">${err.message}</div>`;
        }
      }

      render();
    }

    buildSkeleton();
  }

  return { render };
})();
