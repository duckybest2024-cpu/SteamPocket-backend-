const LobbyGame = (() => {
  const FEATURED = [
    { key: "crash",      icon: "🚀", label: "Crash",        desc: "Ride the multiplier",    gradient: "linear-gradient(135deg,#1a1a2e,#16213e)" },
    { key: "dice",       icon: "🎲", label: "Dice",          desc: "Classic provably fair",  gradient: "linear-gradient(135deg,#0f3460,#16213e)" },
    { key: "mines",      icon: "💣", label: "Mines",         desc: "Avoid the bombs",        gradient: "linear-gradient(135deg,#1a2a1a,#0f3460)" },
    { key: "plinko",     icon: "🔵", label: "Plinko",        desc: "Drop the ball",          gradient: "linear-gradient(135deg,#2d1b69,#11998e)" },
    { key: "blackjack",  icon: "🃏", label: "Blackjack",     desc: "Beat the dealer",        gradient: "linear-gradient(135deg,#1a0533,#2d1b69)" },
    { key: "roulette",   icon: "🎡", label: "Roulette",      desc: "Spin the wheel",         gradient: "linear-gradient(135deg,#1a0000,#4a0000)" },
    { key: "slots",      icon: "🎰", label: "Slots",         desc: "Lucky reels",            gradient: "linear-gradient(135deg,#1a1200,#4a3500)" },
    { key: "limbo",      icon: "📈", label: "Limbo",         desc: "How high can you go?",   gradient: "linear-gradient(135deg,#001a1a,#004444)" },
    { key: "hilo",       icon: "↕️",  label: "Hi-Lo",         desc: "Higher or lower?",       gradient: "linear-gradient(135deg,#1a001a,#440044)" },
    { key: "keno",       icon: "🎯", label: "Keno",          desc: "Pick your numbers",      gradient: "linear-gradient(135deg,#1a0a00,#4a2000)" },
    { key: "wheel",      icon: "🎡", label: "Wheel",         desc: "Spin for prizes",        gradient: "linear-gradient(135deg,#0a1a00,#204a00)" },
    { key: "baccarat",   icon: "🎴", label: "Baccarat",      desc: "Player vs Banker",       gradient: "linear-gradient(135deg,#001a10,#004430)" },
    { key: "videopoker", icon: "🃏", label: "Video Poker",   desc: "5-card draw",            gradient: "linear-gradient(135deg,#1a0a1a,#3a1a3a)" },
    { key: "tower",      icon: "🗼", label: "Tower",         desc: "Climb the tower",        gradient: "linear-gradient(135deg,#0a0a1a,#1a1a4a)" },
    { key: "coinflip",   icon: "🪙", label: "Coinflip",      desc: "Heads or tails?",        gradient: "linear-gradient(135deg,#1a1000,#3a2a00)" },
    { key: "jackpot",    icon: "🏆", label: "Jackpot",       desc: "Win the big pot",        gradient: "linear-gradient(135deg,#1a0505,#4a1010)" },
    { key: "cases",      icon: "📦", label: "Cases",         desc: "Unbox NFTs",             gradient: "linear-gradient(135deg,#051a1a,#104040)" },
    { key: "nfts",       icon: "🖼️", label: "NFT Collection", desc: "Your digital assets",  gradient: "linear-gradient(135deg,#0a0519,#2a1050)" },
  ];

  function render(container) {
    container.innerHTML = `
      <style>
        .lobby-wrap { padding: 20px; max-width: 1100px; }
        .lobby-hero {
          background: linear-gradient(135deg, #0f212e 0%, #1a0533 50%, #0f3460 100%);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 36px 32px;
          margin-bottom: 28px;
          position: relative;
          overflow: hidden;
        }
        .lobby-hero::before {
          content: '';
          position: absolute;
          inset: 0;
          background: radial-gradient(ellipse at 70% 50%, rgba(52,211,153,0.12) 0%, transparent 60%);
          pointer-events: none;
        }
        .lobby-hero-title {
          font-size: 2rem;
          font-weight: 800;
          color: #fff;
          margin: 0 0 8px 0;
          position: relative;
        }
        .lobby-hero-sub {
          color: var(--text-dim);
          font-size: 1rem;
          position: relative;
          margin-bottom: 20px;
        }
        .lobby-hero-stats {
          display: flex;
          gap: 24px;
          flex-wrap: wrap;
          position: relative;
        }
        .lhs-item {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .lhs-label {
          font-size: 0.7rem;
          color: var(--text-dim);
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }
        .lhs-value {
          font-size: 1.15rem;
          font-weight: 700;
          color: var(--win);
        }
        .lobby-section-title {
          font-size: 0.8rem;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: var(--text-dim);
          font-weight: 700;
          margin-bottom: 14px;
        }
        .lobby-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
          gap: 12px;
          margin-bottom: 28px;
        }
        .lobby-card {
          border-radius: 14px;
          padding: 20px 16px;
          cursor: pointer;
          border: 1px solid rgba(255,255,255,0.07);
          transition: transform 0.2s, border-color 0.2s, box-shadow 0.2s;
          position: relative;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 6px;
          min-height: 110px;
        }
        .lobby-card::after {
          content: '';
          position: absolute;
          inset: 0;
          background: rgba(255,255,255,0);
          transition: background 0.2s;
        }
        .lobby-card:hover {
          transform: translateY(-3px);
          border-color: rgba(52,211,153,0.4);
          box-shadow: 0 8px 24px rgba(0,0,0,0.4);
        }
        .lobby-card:hover::after {
          background: rgba(255,255,255,0.04);
        }
        .lc-icon { font-size: 2rem; line-height: 1; }
        .lc-name { font-size: 0.9rem; font-weight: 700; color: #fff; }
        .lc-desc { font-size: 0.73rem; color: rgba(255,255,255,0.55); line-height: 1.3; }
        .lobby-promo {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-bottom: 28px;
        }
        .lobby-promo-card {
          border-radius: 14px;
          border: 1px solid var(--border);
          padding: 18px;
          background: var(--bg-card);
          cursor: pointer;
          transition: border-color 0.2s, transform 0.2s;
          display: flex;
          align-items: center;
          gap: 14px;
        }
        .lobby-promo-card:hover { border-color: var(--accent); transform: translateY(-2px); }
        .lpc-icon { font-size: 2.2rem; flex-shrink: 0; }
        .lpc-title { font-size: 0.9rem; font-weight: 700; margin-bottom: 4px; }
        .lpc-desc { font-size: 0.75rem; color: var(--text-dim); }
        @media (max-width: 600px) {
          .lobby-hero { padding: 24px 18px; }
          .lobby-hero-title { font-size: 1.5rem; }
          .lobby-grid { grid-template-columns: repeat(3, 1fr); gap: 8px; }
          .lobby-promo { grid-template-columns: 1fr; }
          .lobby-card { min-height: 90px; padding: 14px 12px; }
          .lc-icon { font-size: 1.6rem; }
        }
      </style>
      <div class="lobby-wrap">

        <div class="lobby-hero">
          <div class="lobby-hero-title">🎰 GrilledCoin</div>
          <div class="lobby-hero-sub">Provably fair · 99% RTP · Real-time multiplayer</div>
          <div class="lobby-hero-stats">
            <div class="lhs-item">
              <div class="lhs-label">Games Available</div>
              <div class="lhs-value">20+</div>
            </div>
            <div class="lhs-item">
              <div class="lhs-label">RTP</div>
              <div class="lhs-value">99%</div>
            </div>
            <div class="lhs-item">
              <div class="lhs-label">Min Bet</div>
              <div class="lhs-value">1 🪙</div>
            </div>
            <div class="lhs-item">
              <div class="lhs-label">NFT Collections</div>
              <div class="lhs-value">10</div>
            </div>
          </div>
        </div>

        <div class="lobby-promo">
          <div class="lobby-promo-card" data-nav="cases">
            <div class="lpc-icon">📦</div>
            <div>
              <div class="lpc-title">Open Cases</div>
              <div class="lpc-desc">Unbox exclusive NFTs with special powers. Starter cases from 50 🪙</div>
            </div>
          </div>
          <div class="lobby-promo-card" data-nav="chipshop">
            <div class="lpc-icon">🏦</div>
            <div>
              <div class="lpc-title">Chip Bank</div>
              <div class="lpc-desc">Cash chips out to your bank, move them back to the table, or redeem a promo code.</div>
            </div>
          </div>
          <div class="lobby-promo-card" data-nav="download">
            <div class="lpc-icon">🖥️</div>
            <div>
              <div class="lpc-title">Play on PC</div>
              <div class="lpc-desc">Download the Windows desktop app — play offline with no browser needed.</div>
            </div>
          </div>
          <div class="lobby-promo-card" data-nav="scratch">
            <div class="lpc-icon">🎟️</div>
            <div>
              <div class="lpc-title">Scratch Cards</div>
              <div class="lpc-desc">50 different ticket types. Instant wins from 5 🪙.</div>
            </div>
          </div>
        </div>

        <div class="lobby-section-title">All Games</div>
        <div class="lobby-grid" id="lobby-game-grid">
          ${FEATURED.map(g => `
            <div class="lobby-card" data-nav="${g.key}" style="background:${g.gradient}">
              <div class="lc-icon">${g.icon}</div>
              <div class="lc-name">${g.label}</div>
              <div class="lc-desc">${g.desc}</div>
            </div>
          `).join("")}
        </div>

      </div>`;

    container.querySelectorAll("[data-nav]").forEach(el => {
      el.addEventListener("click", () => {
        const key = el.dataset.nav;
        // Trigger the app's mount via the sidebar nav item click
        const navBtn = document.querySelector(`.nav-item[data-key="${key}"]`);
        if (navBtn) navBtn.click();
      });
    });
  }

  return { render };
})();
