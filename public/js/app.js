/* Casino Aurelius — App shell with Stake-inspired sidebar layout */
const App = (() => {
  const state = { id: null, username: null, nickname: null, rank: "free", balance: 0, bank: 0, fairness: null, isAdmin: false, isApproved: false, patreonUsername: null, patreonTier: null };
  let _lowBalanceToastShown = false;

  const NAV = [
    {
      section: "Home",
      items: [
        { key: "lobby",       icon: "🏠", label: "Lobby",         mod: () => LobbyGame },
      ],
    },
    {
      section: "Casino",
      items: [
        { key: "crash",       icon: "🚀", label: "Crash",        mod: () => CrashGame },
        { key: "dice",        icon: "🎲", label: "Dice",          mod: () => DiceGame },
        { key: "limbo",       icon: "📈", label: "Limbo",         mod: () => LimboGame },
        { key: "mines",       icon: "💣", label: "Mines",         mod: () => MinesGame },
        { key: "plinko",      icon: "🔵", label: "Plinko",        mod: () => PlinkoGame },
        { key: "roulette",    icon: "🎡", label: "Roulette",      mod: () => RouletteGame },
        { key: "blackjack",   icon: "🃏", label: "Blackjack",     mod: () => BlackjackGame },
        { key: "slots",       icon: "🎰", label: "Slots",         mod: () => SlotsGame },
        { key: "keno",        icon: "🎯", label: "Keno",          mod: () => KenoGame },
        { key: "wheel",       icon: "🎡", label: "Wheel",         mod: () => WheelGame },
        { key: "baccarat",    icon: "🎴", label: "Baccarat",      mod: () => BaccaratGame },
        { key: "hilo",        icon: "↕️",  label: "Hi-Lo",         mod: () => HiloGame },
        { key: "videopoker",  icon: "🃏", label: "Video Poker",   mod: () => VideoPokerGame },
        { key: "tower",       icon: "🗼", label: "Tower",         mod: () => TowerGame },
      ],
    },
    {
      section: "Multiplayer",
      items: [
        { key: "coinflip",    icon: "🪙", label: "Coinflip",         mod: () => CoinflipGame },
        { key: "jackpot",     icon: "🏆", label: "Jackpot",          mod: () => JackpotGame },
        { key: "horserace",   icon: "🏇", label: "Horse Race",       mod: () => HorseRaceGame },
        { key: "battledice",  icon: "⚔️",  label: "Battle Dice",      mod: () => BattleDiceGame },
        { key: "rps",         icon: "✊", label: "Rock Paper Scissors", mod: () => RPSGame },
        { key: "raffle",      icon: "🎟️", label: "Raffle",           mod: () => RaffleGame },
        { key: "bingo",       icon: "🎱", label: "Bingo",            mod: () => BingoGame },
        { key: "multiroulette", icon: "🌀", label: "Multi Roulette", mod: () => MultiRouletteGame },
        { key: "poker",       icon: "♠️", label: "Poker",            mod: () => PokerGame },
      ],
    },
    {
      section: "Arcade",
      items: [
        { key: "arcade",      icon: "🕹️", label: "Arcade",            mod: () => ArcadeGame },
      ],
    },
    {
      section: "Board Games",
      items: [
        { key: "boardgames",  icon: "♟️", label: "Board Games",      mod: () => BoardGamesGame },
      ],
    },
    {
      section: "Events",
      items: [
        { key: "events", icon: "🎪", label: "Events", mod: () => EventsGame },
      ],
    },
    {
      section: "Community",
      items: [
        { key: "chat",     icon: "💬", label: "Chat",          mod: () => ChatGame },
        { key: "scratch",  icon: "🎟️", label: "Scratch Cards", mod: () => ScratchGame },
        { key: "download", icon: "🖥️", label: "PC App",        mod: () => DownloadGame },
      ],
    },
    {
      section: "NFT & Trading",
      items: [
        { key: "nfts",        icon: "🖼️", label: "NFT Collection",   mod: () => NFTsGame },
        { key: "nftmarket",   icon: "🏪", label: "NFT Marketplace",  mod: () => NFTMarketGame },
        { key: "cases",       icon: "📦", label: "Cases",             mod: () => CasesGame },
      ],
    },
    {
      section: "Account",
      items: [
        { key: "chipshop",    icon: "🏦", label: "Chip Shop",         mod: () => ChipShopGame },
        { key: "stats",       icon: "📊", label: "My Stats",          mod: () => StatsGame },
        { key: "leaderboard", icon: "🏆", label: "Leaderboard",       mod: () => LeaderboardGame },
        { key: "friends",     icon: "👥", label: "Friends",           mod: () => FriendsGame },
        { key: "settings",    icon: "⚙️", label: "Settings",          mod: () => SettingsGame },
      ],
    },
  ];

  const ADMIN_ITEM = { key: "admin", icon: "🔧", label: "Admin Panel", mod: () => AdminGame };
  let allItems = NAV.flatMap((s) => s.items);

  let activeCleanup = null;
  let activeKey = null;

  // ── Sidebar ────────────────────────────────────────────────

  function buildSidebar() {
    const nav = document.getElementById("sidebar-nav");
    nav.innerHTML = "";

    const sections = [...NAV];
    if (state.isAdmin || state.rank === "owner") {
      const acct = sections.find((s) => s.section === "Account");
      if (acct && !acct.items.find((i) => i.key === "admin")) {
        acct.items.unshift(ADMIN_ITEM);
      }
    }

    allItems = sections.flatMap((s) => s.items);

    for (const section of sections) {
      const sec = document.createElement("div");
      sec.className = "nav-section";

      const title = document.createElement("div");
      title.className = "nav-section-title";
      title.textContent = section.section;
      sec.appendChild(title);

      for (const item of section.items) {
        const btn = document.createElement("button");
        btn.className = "nav-item" + (item.key === activeKey ? " active" : "");
        btn.dataset.key = item.key;
        btn.innerHTML = `<span class="nav-item-icon">${item.icon}</span><span class="nav-item-label">${item.label}</span>`;
        btn.addEventListener("click", () => { mount(item.key); closeSidebar(); });
        sec.appendChild(btn);
      }

      nav.appendChild(sec);
    }
  }

  function updateActiveNav(key) {
    document.querySelectorAll(".nav-item").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.key === key);
    });
  }

  // ── Sidebar open/close ─────────────────────────────────────

  function openSidebar() {
    document.getElementById("sidebar").classList.add("open");
    document.getElementById("sidebar-overlay").classList.add("open");
  }

  function closeSidebar() {
    document.getElementById("sidebar").classList.remove("open");
    document.getElementById("sidebar-overlay").classList.remove("open");
  }

  // ── Sidebar search ─────────────────────────────────────────

  function wireSearch() {
    document.getElementById("sidebar-search").addEventListener("input", (e) => {
      const q = e.target.value.toLowerCase().trim();
      document.querySelectorAll(".nav-item").forEach((btn) => {
        const label = btn.querySelector(".nav-item-label")?.textContent.toLowerCase() ?? "";
        btn.style.display = (!q || label.includes(q)) ? "" : "none";
      });
      document.querySelectorAll(".nav-section-title").forEach((title) => {
        const sec = title.parentElement;
        const anyVisible = [...sec.querySelectorAll(".nav-item")].some((b) => b.style.display !== "none");
        title.style.display = anyVisible ? "" : "none";
      });
    });
  }

  // ── Mount a game ───────────────────────────────────────────

  function mount(key) {
    if (activeKey === key) { return; }
    if (activeCleanup) { try { activeCleanup(); } catch { /**/ } activeCleanup = null; }

    activeKey = key;
    updateActiveNav(key);

    // Update topbar breadcrumb
    const item = allItems.find((i) => i.key === key);
    const label = item ? `${item.icon} ${item.label}` : key;
    const bc = document.getElementById("topbar-breadcrumb");
    if (bc) bc.textContent = label;

    const container = document.getElementById("game-area");
    container.innerHTML = "";

    if (!item) return;
    try {
      const mod = item.mod();
      activeCleanup = mod.render(container, state) || null;
    } catch (err) {
      console.error("Mount error:", err);
      container.innerHTML = `<div class="game-panel"><p style="color:var(--loss)">Failed to load ${label}</p></div>`;
    }
  }

  // ── Account sync ───────────────────────────────────────────

  async function refreshAccount() {
    const { user } = await Api.me();
    state.id = user.id;
    state.username = user.username;
    state.nickname = user.nickname ?? null;
    state.rank = user.rank ?? "newcomer";
    state.balance = user.balance;
    state.bank = user.bank ?? 0;
    state.fairness = user.fairness;
    state.isAdmin = user.isAdmin ?? false;
    state.isApproved = user.isApproved ?? true;
    state.patreonUsername = user.patreonUsername ?? null;
    state.patreonTier = user.patreonTier ?? null;

    // Sidebar balance
    const balEl = document.getElementById("balance-amount");
    if (balEl) balEl.textContent = Math.floor(state.balance / 100).toLocaleString() + " 🪙";

    // Topbar balance
    const tbEl = document.getElementById("topbar-balance");
    if (tbEl) tbEl.textContent = Math.floor(state.balance / 100).toLocaleString();

    // Subscription tier badge
    const tierEl = document.getElementById("sb-tier-row");
    if (tierEl) {
      const TIER_LABELS = {
        bronze_patron: "🥉 Bronze Patron",
        silver_patron: "🥈 Silver Patron",
        gold_patron: "🥇 Gold Patron",
        platinum_patron: "💠 Platinum Patron",
        diamond_patron: "💎 Diamond Patron",
        netherite_patron: "⚫ Netherite Patron",
      };
      tierEl.textContent = state.patreonTier
        ? (TIER_LABELS[state.patreonTier] || state.patreonTier)
        : (state.isApproved ? "✅ Active" : "🔒 No Subscription");
    }

    if (state.balance <= 1000 && !_lowBalanceToastShown) {
      _lowBalanceToastShown = true;
      setTimeout(() => UI.toast("⚡ Low balance — visit 🏦 Chip Shop to buy more chips!", "info"), 800);
    }

    return user;
  }

  // ── Auth screens ───────────────────────────────────────────

  function showScreen(name) {
    document.getElementById("auth-screen").classList.toggle("hidden", name !== "auth");
    document.getElementById("pending-screen").classList.toggle("hidden", name !== "pending");
    document.getElementById("app-screen").classList.toggle("hidden", name !== "app");
  }

  function showPendingApproval(user) {
    const el = document.getElementById("pending-patreon-name");
    if (el) el.textContent = user.patreonUsername || "Not provided";
    showScreen("pending");
  }

  function showVerifyEmailUI(email, verificationLink) {
    const errorEl = document.getElementById("auth-error");
    errorEl.innerHTML = `
      <div style="text-align:left;line-height:1.7;">
        <strong>📧 One more step — verify your email</strong><br/>
        ${verificationLink
          ? `<a href="${verificationLink}" style="display:inline-block;margin:10px 0;background:var(--accent);color:#071c10;padding:9px 20px;border-radius:8px;text-decoration:none;font-weight:700;">✅ Click here to verify</a><br/>`
          : `A link was sent to <strong>${email}</strong>.<br/>`}
        After verifying, come back and log in.
        <br/><br/>
        <button id="resend-btn" style="background:transparent;border:1px solid var(--border);color:var(--text-dim);padding:6px 14px;border-radius:8px;cursor:pointer;font-size:0.85rem;">Get a new link</button>
        <div id="resend-result" style="margin-top:8px;font-size:0.82rem;"></div>
      </div>`;
    errorEl.classList.remove("hidden");
    errorEl.style.color = "var(--text)";

    document.getElementById("resend-btn").addEventListener("click", async () => {
      const btn = document.getElementById("resend-btn");
      const resultEl = document.getElementById("resend-result");
      btn.disabled = true; btn.textContent = "Sending…";
      try {
        const data = await Api.post("/auth/resend-verification", { email });
        btn.textContent = "Sent!";
        if (data.verificationLink) {
          resultEl.innerHTML = `<a href="${data.verificationLink}" style="color:var(--accent);font-weight:700;">Click here to verify →</a>`;
        } else {
          resultEl.textContent = "Link sent! Check your email.";
        }
      } catch (err) {
        btn.textContent = "Get a new link";
        btn.disabled = false;
        UI.toast(err.message || "Failed to resend.", "loss");
      }
    });
  }

  function wireAuthForms() {
    // Tab switching
    document.querySelectorAll(".auth-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        document.querySelectorAll(".auth-tab").forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");
        const isLogin = tab.dataset.tab === "login";
        document.getElementById("login-form").classList.toggle("hidden", !isLogin);
        document.getElementById("register-form").classList.toggle("hidden", isLogin);
        const err = document.getElementById("auth-error");
        err.classList.add("hidden");
        err.style.color = "";
      });
    });

    function showError(message) {
      const err = document.getElementById("auth-error");
      err.innerHTML = "";
      err.textContent = message;
      err.style.color = "";
      err.classList.remove("hidden");
    }

    document.getElementById("login-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      document.getElementById("auth-error").classList.add("hidden");
      const fd = new FormData(e.target);
      try {
        const data = await Api.login({ identifier: fd.get("identifier"), password: fd.get("password") });
        Api.setToken(data.token);
        if (data.pendingApproval || (data.user && data.user.isApproved === false)) {
          showPendingApproval(data.user || {});
        } else {
          await enterApp();
        }
      } catch (err) {
        if (err.emailNotVerified) showVerifyEmailUI(err.email, null);
        else showError(err.message);
      }
    });

    document.getElementById("register-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      document.getElementById("auth-error").classList.add("hidden");
      const fd = new FormData(e.target);
      const emailVal = fd.get("email");
      try {
        const data = await Api.register({
          username: (fd.get("username") || "").trim(),
          email: (emailVal || "").trim(),
          password: fd.get("password") || "",
          patreonUsername: (fd.get("patreonUsername") || "").trim() || null,
        });
        if (data.token) {
          Api.setToken(data.token);
          if (data.user && data.user.isApproved === false) {
            showPendingApproval(data.user);
          } else {
            UI.toast("Welcome to GrilledCoin! Visit Chip Shop to buy chips.", "win");
            await enterApp();
          }
        }
      } catch (err) {
        showError(err.message);
      }
    });
  }

  async function enterApp() {
    showScreen("app");
    await refreshAccount();
    buildSidebar();
    wireSearch();

    const params = new URLSearchParams(window.location.search);
    if (params.get("emailVerified") === "ok") {
      history.replaceState({}, "", "/");
      UI.toast("✅ Email verified! Welcome.", "win");
    } else if (params.get("emailVerified") === "expired") {
      history.replaceState({}, "", "/");
      UI.toast("⚠️ Verification link expired. Request a new one.", "info");
    } else if (params.get("emailVerified") === "error") {
      history.replaceState({}, "", "/");
      UI.toast("❌ Invalid verification link.", "loss");
    }

    if (params.get("checkout") === "success") {
      history.replaceState({}, "", "/");
      await refreshAccount();
      UI.toast("💳 Payment received! Chips added.", "win");
      mount("chipshop");
    } else if (params.get("checkout") === "cancel") {
      history.replaceState({}, "", "/");
      UI.toast("Payment cancelled.", "info");
      mount("chipshop");
    } else {
      mount("lobby");
    }

    // Engagement system
    if (typeof Engagement !== "undefined") {
      setTimeout(() => Engagement.checkDailyBonus(state), 1500);
      Engagement.jackpotTicker.start(50000);
    }
  }

  function wireTopbar() {
    document.getElementById("logout-btn").addEventListener("click", () => {
      Api.setToken(null);
      if (activeCleanup) { try { activeCleanup(); } catch { /**/ } }
      activeCleanup = null;
      activeKey = null;
      showScreen("auth");
    });

    const pendingLogout = document.getElementById("pending-logout-btn");
    if (pendingLogout) {
      pendingLogout.addEventListener("click", () => {
        Api.setToken(null);
        showScreen("auth");
      });
    }

    document.getElementById("menu-toggle").addEventListener("click", openSidebar);
    document.getElementById("sidebar-close").addEventListener("click", closeSidebar);
    document.getElementById("sidebar-overlay").addEventListener("click", closeSidebar);
  }

  async function init() {
    wireAuthForms();
    wireTopbar();

    if (Api.getToken()) {
      try {
        const { user } = await Api.me();
        if (user.isApproved === false) {
          showPendingApproval(user);
          return;
        }
        await enterApp();
        return;
      } catch { Api.setToken(null); }
    }
    showScreen("auth");
  }

  return { state, refreshAccount, init };
})();

document.addEventListener("DOMContentLoaded", () => App.init());
