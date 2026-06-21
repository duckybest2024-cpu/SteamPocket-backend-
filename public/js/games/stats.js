const StatsGame = (() => {
  const GAME_ICONS = {
    dice:"🎲", mines:"💣", plinko:"🪂", limbo:"🎯", crash:"🚀",
    roulette:"🎡", blackjack:"🃏", slots:"🎰", hilo:"🃏", keno:"🟡",
    baccarat:"🎴", videopoker:"♠️", wheel:"🎡", tower:"🗼",
  };

  function icon(game) { return GAME_ICONS[game] || "🎮"; }

  function money(cents) {
    const chips = cents / 100;
    if (Math.abs(chips) >= 1000000) return (chips / 1000000).toFixed(1) + "M";
    if (Math.abs(chips) >= 1000) return (chips / 1000).toFixed(1) + "K";
    return chips.toFixed(2);
  }

  function pct(n) { return n.toFixed(1) + "%"; }

  function statCard(label, value, sub, color) {
    return `
      <div class="stats-card">
        <div class="sc-label">${label}</div>
        <div class="sc-value" style="color:${color || "var(--text)"}">${value}</div>
        ${sub ? `<div class="sc-sub">${sub}</div>` : ""}
      </div>`;
  }

  function gameRow(game, gs) {
    const wr = gs.bets > 0 ? ((gs.wins / gs.bets) * 100).toFixed(1) : "0.0";
    const net = gs.payout - gs.wagered;
    const netColor = net >= 0 ? "var(--win)" : "var(--loss)";
    return `
      <tr class="sg-row">
        <td><span class="game-tag">${icon(game)} ${game}</span></td>
        <td>${gs.bets}</td>
        <td>${gs.wins} / ${gs.bets - gs.wins}</td>
        <td>${wr}%</td>
        <td>${money(gs.wagered)}</td>
        <td style="color:${netColor};font-weight:700">${net >= 0 ? "+" : ""}${money(net)}</td>
      </tr>`;
  }

  function betRow(b) {
    const isWin = b.result === "win";
    const net = b.payout - b.amount;
    return `
      <tr>
        <td><span class="game-tag">${icon(b.game)} ${b.game}</span></td>
        <td>${money(b.amount)}</td>
        <td style="color:${isWin ? "var(--win)" : "var(--loss)"};font-weight:700">
          ${isWin ? "+" : ""}${money(net)}
        </td>
        <td>${b.multiplier.toFixed(2)}×</td>
        <td style="color:${isWin ? "var(--win)" : "var(--loss)"}">${isWin ? "WIN" : "LOSS"}</td>
        <td style="color:var(--text-dim);font-size:0.75rem">${new Date(b.createdAt).toLocaleDateString()}</td>
      </tr>`;
  }

  function render(container, accountState) {
    container.innerHTML = `
      <div class="stats-page">
        <div class="stats-hero">
          <div class="hero-avatar">${(accountState.username || "?")[0].toUpperCase()}</div>
          <div class="hero-info">
            <div class="hero-name">${accountState.username}</div>
            <div class="hero-rank">Level ${accountState.level || 1} · ${accountState.rank || "newcomer"}</div>
          </div>
        </div>

        <div id="stats-loading" style="text-align:center;padding:40px;color:var(--text-dim)">Loading stats…</div>
        <div id="stats-content" style="display:none"></div>
      </div>
    `;

    Api.get("/stats/me").then((data) => {
      const { stats, recentBets } = data;
      const netColor = stats.netProfit >= 0 ? "var(--win)" : "var(--loss)";
      const netSign = stats.netProfit >= 0 ? "+" : "";

      const gameRows = Object.entries(stats.gameStats)
        .sort((a, b) => b[1].bets - a[1].bets)
        .map(([g, gs]) => gameRow(g, gs))
        .join("") || `<tr><td colspan="6" style="text-align:center;color:var(--text-dim);padding:20px">No game history yet</td></tr>`;

      const recentRows = recentBets.map(betRow).join("")
        || `<tr><td colspan="6" style="text-align:center;color:var(--text-dim);padding:20px">No bets yet</td></tr>`;

      document.getElementById("stats-loading").style.display = "none";
      const content = document.getElementById("stats-content");
      content.style.display = "";
      content.innerHTML = `
        <div class="stats-grid">
          ${statCard("Total Bets", stats.totalBets.toLocaleString(), null, null)}
          ${statCard("Win Rate", pct(stats.winRate), `${stats.wins}W / ${stats.losses}L`, stats.winRate >= 50 ? "var(--win)" : "var(--loss)")}
          ${statCard("Total Wagered", money(stats.totalWagered) + " chips", null, null)}
          ${statCard("Net Profit", netSign + money(stats.netProfit) + " chips", null, netColor)}
          ${statCard("Best Win", stats.bestWin ? money(stats.bestWin.payout) + " chips" : "—", stats.bestWin ? `${stats.bestWin.multiplier.toFixed(2)}× on ${stats.bestWin.game}` : null, "var(--gold)")}
          ${statCard("Top Multiplier", stats.biggestMultiplier ? stats.biggestMultiplier.multiplier.toFixed(2) + "×" : "—", stats.biggestMultiplier ? `on ${stats.biggestMultiplier.game}` : null, "var(--gold)")}
          ${statCard("Favorite Game", stats.favoriteGame ? icon(stats.favoriteGame) + " " + stats.favoriteGame : "—", stats.favoriteGame ? `${stats.gameStats[stats.favoriteGame]?.bets || 0} bets` : null, null)}
          ${statCard("Total Chips", money(data.user.balance + data.user.bank) + " chips", `${money(data.user.balance)} in wallet`, null)}
        </div>

        <h3 class="stats-section-title">Stats by Game</h3>
        <div class="table-wrap">
          <table class="stats-table">
            <thead><tr>
              <th>Game</th><th>Bets</th><th>W / L</th><th>Win Rate</th><th>Wagered</th><th>Net</th>
            </tr></thead>
            <tbody>${gameRows}</tbody>
          </table>
        </div>

        <h3 class="stats-section-title">Recent Bets</h3>
        <div class="table-wrap">
          <table class="stats-table">
            <thead><tr>
              <th>Game</th><th>Bet</th><th>Net</th><th>Multiplier</th><th>Result</th><th>Date</th>
            </tr></thead>
            <tbody>${recentRows}</tbody>
          </table>
        </div>
      `;
    }).catch(() => {
      document.getElementById("stats-loading").textContent = "Failed to load stats.";
    });
  }

  return { render };
})();
