const ArcadeGame = (() => {
  const GAMES = [
    { id: "claw_classic",  name: "Claw Machine Classic",  emoji: "🎮", desc: "Drop the claw and grab a prize!",            color: "#fbbf24", anim: "claw" },
    { id: "claw_deluxe",   name: "Claw Crane Deluxe",     emoji: "🦾", desc: "Precision claw with X/Y positioning",        color: "#60a5fa", anim: "claw" },
    { id: "capsule_gacha", name: "Capsule Gacha",          emoji: "💊", desc: "Turn the dial for a random capsule",         color: "#f472b6", anim: "spin" },
    { id: "magic_egg",     name: "Magic Egg Drop",         emoji: "🥚", desc: "Drop magic eggs and land on prizes",         color: "#86efac", anim: "drop" },
    { id: "fantasy_star",  name: "Fantasy Star Ball",      emoji: "⭐", desc: "Themed ball machine with star prizes",       color: "#fde68a", anim: "spin" },
    { id: "ticket_blaster",name: "Ticket Blaster",         emoji: "🎯", desc: "Shoot targets to win chip tickets",          color: "#f87171", anim: "burst" },
    { id: "stacker",       name: "Stacker",                emoji: "📦", desc: "Stack blocks perfectly for the jackpot",     color: "#93c5fd", anim: "stack" },
    { id: "basketball",    name: "Basketball Toss",        emoji: "🏀", desc: "Shoot hoops for chip prizes",                color: "#fb923c", anim: "arc" },
    { id: "whack_mole",    name: "Whack-a-Mole",           emoji: "🐹", desc: "Whack moles as fast as you can!",            color: "#a78bfa", anim: "pop" },
    { id: "fishing",       name: "Fishing Frenzy",         emoji: "🎣", desc: "Cast your line and reel in prizes",          color: "#38bdf8", anim: "drop" },
    { id: "lucky_punch",   name: "Lucky Punch",            emoji: "👊", desc: "Hit the target with perfect timing",         color: "#fb7185", anim: "meter" },
    { id: "coin_pusher",   name: "Coin Pusher",            emoji: "🪙", desc: "Push coins off the ledge to collect",        color: "#d97706", anim: "drop" },
    { id: "prize_ladder",  name: "Prize Ladder",           emoji: "🪜", desc: "Stop the indicator at the right rung",       color: "#c084fc", anim: "meter" },
    { id: "crane_master",  name: "Crane Master",           emoji: "🏗️", desc: "Precision crane targeting challenge",        color: "#4ade80", anim: "claw" },
    { id: "egg_machine",   name: "Magic Egg Machine",      emoji: "🪄", desc: "Mystery egg machine with surprise prizes",   color: "#e879f9", anim: "spin" },
  ];

  const PRIZE_TIERS = [
    { label: "Miss / No prize",  payout: "—",      color: "var(--text-dim)" },
    { label: "Consolation",      payout: "0.5×",   color: "#60a5fa" },
    { label: "Base prize",       payout: "1×",     color: "#a3e635" },
    { label: "Good prize",       payout: "2–3×",   color: "#a78bfa" },
    { label: "Big prize! 🎁",    payout: "4–8×",   color: "#fbbf24" },
    { label: "JACKPOT! 🏆",      payout: "10–12×", color: "#34d399" },
  ];

  function render(container, accountState) {
    renderLobby(container, accountState);
    HowToPlay.addButton(container, "arcade");
    return () => {};
  }

  /* ── Lobby ─────────────────────────────────────────── */

  function renderLobby(container, accountState) {
    container.innerHTML = `
      <div class="game-panel" style="padding:0">
        <div style="padding:20px 20px 12px">
          <h2 style="margin:0 0 4px;font-size:1.3rem">🕹️ Arcade</h2>
          <p style="margin:0;color:var(--text-dim);font-size:0.82rem">15 prize machine games — classic arcade fun with real chip prizes!</p>
        </div>
        <div class="arcade-lobby-grid">
          ${GAMES.map(g => `
            <div class="arcade-card" data-id="${g.id}" style="--ac:${g.color}">
              <div class="arcade-card-emoji">${g.emoji}</div>
              <div class="arcade-card-name">${g.name}</div>
              <div class="arcade-card-desc">${g.desc}</div>
              <div class="arcade-card-play">Play →</div>
            </div>
          `).join("")}
        </div>
      </div>
    `;

    container.querySelectorAll(".arcade-card").forEach(card => {
      card.addEventListener("click", () => renderGame(container, accountState, card.dataset.id));
    });
  }

  /* ── Game screen ────────────────────────────────────── */

  function renderGame(container, accountState, gameId) {
    const game = GAMES.find(g => g.id === gameId);
    if (!game) return renderLobby(container, accountState);

    let playing = false;

    container.innerHTML = `
      <div class="game-panel">
        <div class="game-layout">

          <!-- LEFT: Bet panel -->
          <aside class="bet-panel">
            <button id="arcade-back" class="play-btn secondary-play" style="font-size:0.85rem">← Back to Arcade</button>

            <div class="bp-field">
              <div class="bp-label">Bet Amount</div>
              <div class="bp-input-row">
                <input type="number" id="arcade-amount" value="10" min="0.01" step="0.01" />
                <button class="quick-btn" id="arcade-half">½</button>
                <button class="quick-btn" id="arcade-dbl">2×</button>
              </div>
            </div>

            <div style="background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:10px 12px">
              <div class="bp-label" style="margin-bottom:6px">Prize Table</div>
              ${PRIZE_TIERS.map(t => `
                <div style="display:flex;justify-content:space-between;align-items:center;padding:2px 0">
                  <span style="font-size:0.75rem;color:var(--text-dim)">${t.label}</span>
                  <span style="font-size:0.75rem;font-weight:700;color:${t.color}">${t.payout}</span>
                </div>
              `).join("")}
            </div>

            <button class="play-btn" id="arcade-play">${game.emoji} Play</button>
          </aside>

          <!-- RIGHT: Game canvas -->
          <div class="game-canvas">
            <div class="arcade-visual" id="arcade-visual" data-anim="${game.anim}" style="--ac:${game.color}">
              ${buildVisualHTML(game)}
            </div>
            <div id="arcade-result" class="result-banner"></div>
          </div>
        </div>
      </div>
    `;

    /* ── Wire controls ─────────────────────────────────── */

    container.querySelector("#arcade-back").addEventListener("click", () => renderLobby(container, accountState));

    const amtEl = container.querySelector("#arcade-amount");
    container.querySelector("#arcade-half").addEventListener("click", () => {
      amtEl.value = Math.max(0.01, Math.floor(Number(amtEl.value) * 50) / 100).toFixed(2);
    });
    container.querySelector("#arcade-dbl").addEventListener("click", () => {
      amtEl.value = (Math.floor(Number(amtEl.value) * 200) / 100).toFixed(2);
    });

    const playBtn    = container.querySelector("#arcade-play");
    const visualEl   = container.querySelector("#arcade-visual");
    const resultEl   = container.querySelector("#arcade-result");
    const mainEmoji  = container.querySelector(".av-main-emoji");
    const statusLine = container.querySelector(".av-status");

    playBtn.addEventListener("click", async () => {
      if (playing) return;
      const dollars = Number(amtEl.value);
      if (!dollars || dollars <= 0) return UI.toast("Enter a bet amount.", "loss");
      const amount = Math.round(dollars * 100);

      playing = true;
      playBtn.disabled = true;
      resultEl.className = "result-banner";

      // Start animation
      visualEl.setAttribute("data-state", "playing");
      if (statusLine) statusLine.textContent = "Playing…";

      try {
        const res = await Api.post(`/arcade/${gameId}/play`, { amount });

        const isWin  = res.result === "win";
        const mult   = res.multiplier;
        const payout = res.payout;

        // Determine result emoji
        let rEmoji = game.emoji;
        if (mult === 0) rEmoji = "😢";
        else if (mult < 1) rEmoji = "🎀";
        else if (mult < 2) rEmoji = "🧸";
        else if (mult < 4) rEmoji = "🎁";
        else if (mult < 8) rEmoji = "⭐";
        else if (mult < 12) rEmoji = "🌟";
        else rEmoji = "🏆";

        // Show result
        visualEl.setAttribute("data-state", isWin ? "win" : "loss");
        if (mainEmoji) mainEmoji.textContent = rEmoji;
        if (statusLine) statusLine.textContent = res.label;

        resultEl.className = `result-banner show ${isWin ? "win" : "loss"}`;
        if (isWin) {
          const chipsWon = (payout / 100).toFixed(2);
          resultEl.innerHTML = `<strong>${res.label}</strong> — Won <strong>${chipsWon} chips</strong> (${mult}×)`;
        } else {
          resultEl.innerHTML = `<strong>${res.label}</strong> — Better luck next time!`;
        }

        accountState.balance = res.balance;
        UI.setBalance(res.balance);

        if (res.leveledUp) UI.toast(`Level up! You're now Level ${res.level} 🎉`, "win");

        // Reset after 2.5s
        setTimeout(() => {
          if (container.querySelector("#arcade-visual")) {
            visualEl.setAttribute("data-state", "idle");
            if (mainEmoji) mainEmoji.textContent = game.emoji;
            if (statusLine) statusLine.textContent = game.name;
          }
        }, 2500);

      } catch (err) {
        visualEl.setAttribute("data-state", "idle");
        if (statusLine) statusLine.textContent = game.name;
        UI.toast(err.message || "Game error — try again", "loss");
      } finally {
        playing = false;
        playBtn.disabled = false;
      }
    });
  }

  /* ── Per-game visual HTML ───────────────────────────── */

  function buildVisualHTML(game) {
    switch (game.anim) {

      case "claw":
        return `
          <div class="av-claw-machine">
            <div class="av-claw-arm">
              <div class="av-claw-cable"></div>
              <div class="av-claw-head">🦾</div>
            </div>
            <div class="av-claw-prizes">
              🧸 🐻 🎁 🏆 🧸 🐻 🎀 🌟 🎁 🧸 🐻 🎁
            </div>
            <div class="av-claw-glass"></div>
          </div>
          <div class="av-main-emoji" style="display:none">${game.emoji}</div>
          <div class="av-status">${game.name}</div>
        `;

      case "spin":
        return `
          <div class="av-spin-dial">
            <div class="av-spin-ring"></div>
            <div class="av-spin-inner">
              <div class="av-main-emoji">${game.emoji}</div>
            </div>
          </div>
          <div class="av-status">${game.name}</div>
        `;

      case "drop":
        return `
          <div class="av-drop-zone">
            <div class="av-drop-item av-main-emoji">${game.emoji}</div>
            <div class="av-drop-platform">
              <span>🎁</span><span>💰</span><span>⭐</span><span>🏆</span><span>💫</span>
            </div>
          </div>
          <div class="av-status">${game.name}</div>
        `;

      case "burst":
        return `
          <div class="av-burst-zone">
            <div class="av-burst-target">🎯</div>
            <div class="av-burst-particles" id="av-particles"></div>
            <div class="av-main-emoji" style="position:absolute;bottom:12px;font-size:2rem">${game.emoji}</div>
          </div>
          <div class="av-status">${game.name}</div>
        `;

      case "stack":
        return `
          <div class="av-stack-zone">
            <div class="av-stack-blocks">
              <div class="av-block" style="--d:0s">📦</div>
              <div class="av-block" style="--d:0.1s">📦</div>
              <div class="av-block" style="--d:0.2s">📦</div>
            </div>
            <div class="av-main-emoji">${game.emoji}</div>
          </div>
          <div class="av-status">${game.name}</div>
        `;

      case "arc":
        return `
          <div class="av-arc-zone">
            <div class="av-hoop">🏀</div>
            <div class="av-ball av-main-emoji">🏀</div>
          </div>
          <div class="av-status">${game.name}</div>
        `;

      case "pop":
        return `
          <div class="av-mole-grid">
            ${[...Array(9)].map((_, i) => `<div class="av-mole-hole" data-i="${i}"><span class="av-mole">🐹</span></div>`).join("")}
          </div>
          <div class="av-main-emoji" style="display:none">${game.emoji}</div>
          <div class="av-status">${game.name}</div>
        `;

      case "meter":
        return `
          <div class="av-meter-zone">
            <div class="av-meter-bar">
              <div class="av-meter-fill" id="av-meter-fill"></div>
              <div class="av-meter-needle" id="av-meter-needle"></div>
            </div>
            <div class="av-meter-labels">
              <span>0</span><span>25</span><span>50</span><span>75</span><span>100</span>
            </div>
            <div class="av-main-emoji">${game.emoji}</div>
          </div>
          <div class="av-status">${game.name}</div>
        `;

      default:
        return `
          <div class="av-main-emoji">${game.emoji}</div>
          <div class="av-status">${game.name}</div>
        `;
    }
  }

  return { render };
})();
