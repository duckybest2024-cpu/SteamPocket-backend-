/* GrilledCoin — App shell with Stake-inspired sidebar layout */
const App = (() => {
  const state = { id: null, username: null, nickname: null, rank: "free", balance: 0, bank: 0, fairness: null, isAdmin: false, isApproved: false, patreonUsername: null, patreonTier: null };

  const NAV = [
    {
      section: "Home",
      items: [
        { key: "lobby",       icon: "🏠", label: "Lobby",         mod: () => LobbyGame },
      ],
    },
    {
      section: "Originals",
      items: [
        { key: "crash",       icon: "🚀", label: "Crash",        mod: () => CrashGame },
        { key: "dice",        icon: "🎲", label: "Dice",          mod: () => DiceGame },
        { key: "limbo",       icon: "📈", label: "Limbo",         mod: () => LimboGame },
        { key: "mines",       icon: "💣", label: "Mines",         mod: () => MinesGame },
        { key: "plinko",      icon: "🔵", label: "Plinko",        mod: () => PlinkoGame },
        { key: "wheel",       icon: "🎡", label: "Wheel",         mod: () => WheelGame },
        { key: "keno",        icon: "🎯", label: "Keno",          mod: () => KenoGame },
        { key: "hilo",        icon: "↕️",  label: "Hi-Lo",         mod: () => HiloGame },
        { key: "tower",       icon: "🗼", label: "Tower",         mod: () => TowerGame },
      ],
    },
    {
      section: "Table Games",
      items: [
        { key: "roulette",    icon: "🎡", label: "Roulette",      mod: () => RouletteGame },
        { key: "blackjack",   icon: "🃏", label: "Blackjack",     mod: () => BlackjackGame },
        { key: "baccarat",    icon: "🎴", label: "Baccarat",      mod: () => BaccaratGame },
        { key: "videopoker",  icon: "🃏", label: "Video Poker",   mod: () => VideoPokerGame },
      ],
    },
    {
      section: "Slots",
      items: [
        { key: "slots",       icon: "🎰", label: "Slots",         mod: () => SlotsGame },
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
        { key: "download", icon: "📲", label: "Get the App",   mod: () => DownloadGame },
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

    if (_adsCfg) renderAdSlots(_adsCfg);
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

  function showVerifyCodeUI(email, devCode) {
    const errorEl = document.getElementById("auth-error");
    errorEl.innerHTML = `
      <div style="text-align:left;line-height:1.7;">
        <strong>📧 Verify your email</strong><br/>
        Enter the 6-digit code we sent to ${email ? `<strong>${email}</strong>` : "your email"}.
        ${devCode ? `<div style="margin:8px 0;padding:8px 10px;background:var(--bg-elev);border:1px dashed var(--accent-2);border-radius:8px;font-size:0.82rem;">
          ⚠️ Email isn't set up yet — here's your code directly: <strong style="letter-spacing:2px;">${devCode}</strong>
        </div>` : ""}
        <div style="display:flex;gap:8px;margin:10px 0;">
          <input id="verify-code-input" type="text" inputmode="numeric" maxlength="6" placeholder="123456"
            style="flex:1;min-width:0;padding:9px 12px;border-radius:8px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-size:1rem;letter-spacing:3px;text-align:center;" />
          <button id="verify-code-submit" style="background:var(--accent);color:#071c10;border:none;padding:9px 18px;border-radius:8px;font-weight:700;cursor:pointer;white-space:nowrap;">Verify</button>
        </div>
        <button id="resend-btn" style="background:transparent;border:1px solid var(--border);color:var(--text-dim);padding:6px 14px;border-radius:8px;cursor:pointer;font-size:0.85rem;">Resend code</button>
        <div id="resend-result" style="margin-top:8px;font-size:0.82rem;"></div>
      </div>`;
    errorEl.classList.remove("hidden");
    errorEl.style.color = "var(--text)";

    const codeInput = document.getElementById("verify-code-input");
    const submitBtn = document.getElementById("verify-code-submit");

    async function submitCode() {
      const code = codeInput.value.trim();
      if (!code) return;
      submitBtn.disabled = true; submitBtn.textContent = "Verifying…";
      try {
        const data = await Api.post("/auth/verify-email-code", { code });
        UI.toast("✅ Email verified!", "win");
        if (data.user && data.user.isApproved === false) {
          showPendingApproval(data.user);
        } else {
          await enterApp();
        }
      } catch (err) {
        submitBtn.disabled = false; submitBtn.textContent = "Verify";
        UI.toast(err.message || "Invalid code.", "loss");
      }
    }

    submitBtn.addEventListener("click", submitCode);
    codeInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); submitCode(); }
    });

    document.getElementById("resend-btn").addEventListener("click", async () => {
      const btn = document.getElementById("resend-btn");
      const resultEl = document.getElementById("resend-result");
      btn.disabled = true; btn.textContent = "Sending…";
      try {
        const data = await Api.post("/auth/resend-verification", {});
        resultEl.innerHTML = data.devCode
          ? `Email isn't set up yet — here's your code directly: <strong style="letter-spacing:2px;">${data.devCode}</strong>`
          : "New code sent! Check your email.";
      } catch (err) {
        resultEl.textContent = err.message || "Failed to resend.";
      } finally {
        setTimeout(() => { btn.disabled = false; btn.textContent = "Resend code"; }, 1500);
      }
    });
  }

  function wireAuthForms() {
    UI.wireAllPasswordToggles(document.getElementById("login-form"));
    UI.wireAllPasswordToggles(document.getElementById("register-form"));

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
        if (data.needsEmailVerification || (data.user && data.user.emailVerified === false)) {
          showVerifyCodeUI(data.user && data.user.email, data.devCode);
        } else if (data.pendingApproval || (data.user && data.user.isApproved === false)) {
          showPendingApproval(data.user || {});
        } else {
          await enterApp();
        }
      } catch (err) {
        showError(err.message);
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
          if (data.user && data.user.emailVerified === false) {
            showVerifyCodeUI(data.user.email, data.devCode);
          } else if (data.user && data.user.isApproved === false) {
            showPendingApproval(data.user);
          } else {
            UI.toast("Welcome to GrilledCoin! Here's 1,000 free chips to get started.", "win");
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
    if (params.get("checkout") === "success") {
      history.replaceState({}, "", "/");
      await refreshAccount();
      UI.toast("💳 Payment received! Chips added.", "win");
      mount("lobby");
    } else if (params.get("checkout") === "cancel") {
      history.replaceState({}, "", "/");
      UI.toast("Payment cancelled.", "info");
      mount("lobby");
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

  // ── Google integrations (Analytics, AdSense, Sign-In) ──────
  // IDs are admin-configurable (Admin Panel → Controls → Google Integrations)
  // and served back publicly via GET /config — none of them are secrets.
  let _adsCfg = null;

  async function loadGoogleIntegrations() {
    let cfg = {};
    try { cfg = await fetch("/config").then((r) => r.json()); } catch { return; }
    _adsCfg = cfg;

    if (cfg.ga_measurement_id) {
      const s = document.createElement("script");
      s.async = true;
      s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(cfg.ga_measurement_id)}`;
      document.head.appendChild(s);
      window.dataLayer = window.dataLayer || [];
      window.gtag = window.gtag || function gtag() { window.dataLayer.push(arguments); };
      window.gtag("js", new Date());
      window.gtag("config", cfg.ga_measurement_id);
    }

    if (cfg.adsense_publisher_id) {
      const s = document.createElement("script");
      s.async = true;
      s.crossOrigin = "anonymous";
      s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(cfg.adsense_publisher_id)}`;
      s.onload = () => {
        renderAdSlots(cfg);
        // Auto ads: lets Google place extra ads on its own (anchor banner
        // pinned to the screen edge, full-screen interstitials between page
        // navigations) on top of the manual slots above.
        try {
          (window.adsbygoogle = window.adsbygoogle || []).push({
            google_ad_client: cfg.adsense_publisher_id,
            enable_page_level_ads: true,
          });
        } catch { /* blocked by adblock, etc. */ }
      };
      document.head.appendChild(s);
    }

    if (cfg.google_client_id) {
      const s = document.createElement("script");
      s.src = "https://accounts.google.com/gsi/client";
      s.async = true;
      s.defer = true;
      s.onload = () => {
        if (!window.google || !window.google.accounts) return;
        window.google.accounts.id.initialize({
          client_id: cfg.google_client_id,
          callback: handleGoogleSignIn,
        });
        const wrap = document.getElementById("google-signin-wrap");
        if (wrap) window.google.accounts.id.renderButton(wrap, { theme: "outline", size: "large", width: 280 });
      };
      document.head.appendChild(s);
    }
  }

  // Fills any configured ad slot containers with a real <ins class="adsbygoogle">
  // unit and requests an ad for it. Slot IDs are admin-configurable (Admin
  // Panel → Controls → Google Integrations) — a slot with no ID stays empty.
  function renderAdSlots(cfg) {
    const slots = {
      "ad-slot-auth": cfg.adsense_slot_auth,
      "ad-slot-top": cfg.adsense_slot_top,
      "ad-slot-sidebar": cfg.adsense_slot_sidebar,
      "ad-slot-footer": cfg.adsense_slot_footer,
      "ad-slot-lobby": cfg.adsense_slot_lobby,
    };
    Object.entries(slots).forEach(([elId, slotId]) => {
      if (!slotId) return;
      const host = document.getElementById(elId);
      if (!host || host.querySelector("ins.adsbygoogle")) return;
      const ins = document.createElement("ins");
      ins.className = "adsbygoogle";
      ins.style.display = "block";
      ins.dataset.adClient = cfg.adsense_publisher_id;
      ins.dataset.adSlot = slotId;
      ins.dataset.adFormat = "auto";
      ins.dataset.fullWidthResponsive = "true";
      host.appendChild(ins);
      try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch { /* blocked by adblock, etc. */ }
    });
  }

  async function handleGoogleSignIn(response) {
    const errorEl = document.getElementById("auth-error");
    errorEl.classList.add("hidden");
    try {
      const data = await Api.post("/auth/google", { idToken: response.credential });
      Api.setToken(data.token);
      if (data.pendingApproval || (data.user && data.user.isApproved === false)) {
        showPendingApproval(data.user || {});
      } else {
        await enterApp();
      }
    } catch (err) {
      errorEl.textContent = err.message || "Google sign-in failed.";
      errorEl.classList.remove("hidden");
    }
  }

  async function init() {
    wireAuthForms();
    wireTopbar();
    loadGoogleIntegrations();

    if (Api.getToken()) {
      try {
        const { user } = await Api.me();
        if (user.emailVerified === false) {
          showScreen("auth");
          showVerifyCodeUI(user.email);
          return;
        }
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
