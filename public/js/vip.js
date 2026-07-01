/**
 * VIP Lounge — a cosmetic, read-only VIP panel for VIP members.
 * Deliberately contains nothing sensitive: just the member's own stats, their
 * perks, and a top-players board. All real admin tools stay owner-only.
 */
const VipGame = (() => {
  const S = {
    page: `max-width:760px;margin:0 auto;`,
    hero: `
      background:linear-gradient(135deg,rgba(80,40,140,0.35),rgba(40,40,60,0.25));
      border:1px solid #6f5cf2;border-radius:16px;padding:24px;margin-bottom:16px;
      text-align:center;
    `,
    card: `
      background:var(--bg-card);border:1px solid var(--border);border-radius:14px;
      padding:20px;margin-bottom:14px;
    `,
    title: `margin:0 0 14px;font-size:1.05rem;font-weight:800;color:var(--text);`,
    statGrid: `display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;`,
    stat: `
      background:var(--bg-elev);border:1px solid var(--border);border-radius:12px;
      padding:14px;display:flex;flex-direction:column;gap:4px;
    `,
    statLabel: `font-size:0.68rem;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.05em;`,
    statValue: `font-size:1.2rem;font-weight:800;color:var(--gold);`,
    perk: `display:flex;align-items:center;gap:10px;padding:8px 0;font-size:0.9rem;color:var(--text);`,
    row: `display:flex;justify-content:space-between;padding:9px 12px;border-radius:10px;font-size:0.9rem;`,
    flexBtn: `
      background:linear-gradient(135deg,#a855f7,#6f5cf2);color:white;border:none;
      border-radius:10px;padding:12px 22px;font-weight:700;font-size:0.95rem;cursor:pointer;
      transition:filter 0.15s;
    `,
  };

  const money = (cents) => (window.UI && UI.money ? UI.money(cents) : `${(cents / 100).toFixed(0)} 🪙`);

  function render(container, accountState) {
    container.innerHTML = `<div style="${S.page}">
      <div style="color:var(--text-dim);padding:48px 20px;text-align:center;">⏳ Entering the VIP Lounge…</div>
    </div>`;

    Api.get("/vip/me").then((d) => {
      const s = d.stats || {};
      const tierLabel = d.tier === "owner" ? "👑 Owner" : "💎 VIP Member";
      container.innerHTML = `<div style="${S.page}">

        <div style="${S.hero}">
          <div style="font-size:2.6rem;line-height:1;margin-bottom:6px;">💎</div>
          <h2 style="margin:0 0 4px;font-size:1.4rem;font-weight:900;">VIP Lounge</h2>
          <div style="color:var(--text-dim);font-size:0.9rem;">
            ${tierLabel}${d.daysLeft != null ? ` · ${d.daysLeft} day${d.daysLeft === 1 ? "" : "s"} of membership left` : ""}
          </div>
        </div>

        <div style="${S.card}">
          <h3 style="${S.title}">📊 Your Lifetime Stats</h3>
          <div style="${S.statGrid}">
            <div style="${S.stat}"><span style="${S.statLabel}">Balance</span><span style="${S.statValue}">${money(s.balance || 0)}</span></div>
            <div style="${S.stat}"><span style="${S.statLabel}">Level</span><span style="${S.statValue}">${s.level ?? 0}</span></div>
            <div style="${S.stat}"><span style="${S.statLabel}">Total Bets</span><span style="${S.statValue}">${(s.totalBets ?? 0).toLocaleString()}</span></div>
            <div style="${S.stat}"><span style="${S.statLabel}">Total Wagered</span><span style="${S.statValue}">${money(s.totalWagered || 0)}</span></div>
            <div style="${S.stat}"><span style="${S.statLabel}">Total Won</span><span style="${S.statValue}">${money(s.totalWon || 0)}</span></div>
            <div style="${S.stat}"><span style="${S.statLabel}">Biggest Win</span><span style="${S.statValue}">${money(s.biggestWin || 0)}</span></div>
          </div>
        </div>

        <div style="${S.card}">
          <h3 style="${S.title}">🎁 Your Perks</h3>
          ${(d.perks || []).map((p) => `<div style="${S.perk}">${p}</div>`).join("")}
        </div>

        <div style="${S.card}">
          <h3 style="${S.title}">🏆 Top Players</h3>
          ${(d.topPlayers || []).map((p, i) => `
            <div style="${S.row}background:${i % 2 ? "var(--bg-elev)" : "transparent"};">
              <span><strong style="color:var(--gold);">#${p.place}</strong> &nbsp; ${escapeHtml(p.name)} <span style="color:var(--text-dim);font-size:0.78rem;">· Lv ${p.level}</span></span>
              <span style="color:var(--text-dim);">${money(p.balance)}</span>
            </div>
          `).join("")}
        </div>

        <div style="text-align:center;margin-top:6px;">
          <button id="vip-flex" style="${S.flexBtn}">✨ Flex your VIP status</button>
        </div>

      </div>`;

      const flex = container.querySelector("#vip-flex");
      if (flex) flex.addEventListener("click", () => {
        if (window.UI && UI.toast) UI.toast("💎 You flexed your VIP status on everyone!", "win");
      });
    }).catch((err) => {
      container.innerHTML = `<div style="${S.page}"><div style="${S.card}">
        <p style="color:var(--loss);">${(err && err.message) || "This lounge is for VIP members only."}</p>
      </div></div>`;
    });
  }

  function escapeHtml(str) {
    return String(str ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  return { render };
})();
