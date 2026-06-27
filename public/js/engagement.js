/* GrilledCoin — Engagement System
   IIFE module — no imports required. Exposes global `Engagement`. */
const Engagement = (() => {
  // ─── Audio Context (lazy) ─────────────────────────────────────────────────
  let _audioCtx = null;
  let soundEnabled = localStorage.getItem("casino_sound_enabled") !== "false";
  let soundVolume = parseFloat(localStorage.getItem("casino_sound_volume"));
  if (isNaN(soundVolume)) soundVolume = 0.7;

  function _getAudioCtx() {
    if (!_audioCtx) {
      try { _audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {}
    }
    return _audioCtx;
  }

  // ─── 2. Sound Effects ─────────────────────────────────────────────────────
  function sound(type) {
    if (!soundEnabled || soundVolume <= 0) return;
    const ctx = _getAudioCtx();
    if (!ctx) return;

    // Resume if suspended (browser autoplay policy)
    if (ctx.state === "suspended") ctx.resume();

    const now = ctx.currentTime;
    const vol = soundVolume;

    function playTone(freq, start, duration, type = "sine", gain = 0.3, rampDown = true) {
      try {
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        osc.connect(gainNode);
        gainNode.connect(ctx.destination);
        osc.type = type;
        osc.frequency.setValueAtTime(freq, now + start);
        gainNode.gain.setValueAtTime(gain * vol, now + start);
        if (rampDown) gainNode.gain.exponentialRampToValueAtTime(0.001, now + start + duration);
        osc.start(now + start);
        osc.stop(now + start + duration + 0.05);
      } catch (e) {}
    }

    function playNoise(start, duration, gain = 0.15) {
      try {
        const bufferSize = ctx.sampleRate * duration;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        const gainNode = ctx.createGain();
        gainNode.gain.setValueAtTime(gain * vol, now + start);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + start + duration);
        source.connect(gainNode);
        gainNode.connect(ctx.destination);
        source.start(now + start);
        source.stop(now + start + duration + 0.05);
      } catch (e) {}
    }

    switch (type) {
      case "coin":
        playTone(800, 0, 0.1, "sine", 0.3);
        break;
      case "win":
        // C-E-G ascending arpeggio
        playTone(523, 0,    0.15, "sine", 0.25); // C5
        playTone(659, 0.15, 0.15, "sine", 0.25); // E5
        playTone(784, 0.30, 0.15, "sine", 0.3);  // G5
        break;
      case "bigwin":
        // C4-E4-G4-C5 fanfare
        playTone(262, 0,    0.18, "square", 0.2); // C4
        playTone(330, 0.18, 0.18, "square", 0.2); // E4
        playTone(392, 0.36, 0.18, "square", 0.2); // G4
        playTone(523, 0.54, 0.40, "square", 0.3); // C5 (sustain)
        playTone(659, 0.70, 0.30, "sine",   0.25); // E5 flourish
        playTone(784, 0.90, 0.35, "sine",   0.3);  // G5 sustain
        break;
      case "loss":
        playTone(400, 0, 0.3, "sawtooth", 0.2, false);
        try {
          const osc = ctx.createOscillator();
          const gainNode = ctx.createGain();
          osc.connect(gainNode);
          gainNode.connect(ctx.destination);
          osc.type = "sawtooth";
          osc.frequency.setValueAtTime(400, now);
          osc.frequency.exponentialRampToValueAtTime(200, now + 0.3);
          gainNode.gain.setValueAtTime(0.2 * vol, now);
          gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
          osc.start(now);
          osc.stop(now + 0.35);
        } catch (e) {}
        break;
      case "levelup":
        // Ascending scale + sustain
        [523, 587, 659, 698, 784, 880, 988, 1047].forEach((freq, i) => {
          playTone(freq, i * 0.09, 0.15, "sine", 0.25);
        });
        playTone(1047, 0.72, 0.5, "sine", 0.35);
        break;
      case "scratch":
        playNoise(0, 0.08, 0.2);
        playNoise(0.1, 0.06, 0.15);
        playNoise(0.2, 0.08, 0.18);
        break;
      default:
        break;
    }
  }

  function setSoundEnabled(val) {
    soundEnabled = !!val;
    localStorage.setItem("casino_sound_enabled", soundEnabled ? "true" : "false");
  }

  function isSoundEnabled() { return soundEnabled; }

  function getSoundVolume() { return soundVolume; }

  function setSoundVolume(val) {
    soundVolume = Math.max(0, Math.min(1, val));
    localStorage.setItem("casino_sound_volume", String(soundVolume));
  }

  // ─── 1. Confetti ──────────────────────────────────────────────────────────
  const CONFETTI_COLORS = ["#f0c244", "#00e701", "#ffffff", "#9b59b6", "#e5463d", "#4d9fec"];

  function confetti(intensity) {
    const counts = { small: 60, big: 120, jackpot: 200 };
    const durations = { small: 1.5, big: 2.2, jackpot: 3.0 };
    const count = counts[intensity] || 60;
    const duration = durations[intensity] || 1.5;

    // For jackpot: also play a coin sound burst
    if (intensity === "jackpot") {
      sound("bigwin");
      // Extra coin pings
      [0, 0.3, 0.6, 0.9].forEach((delay) => setTimeout(() => sound("coin"), delay * 1000));
    }

    const fragment = document.createDocumentFragment();
    const particles = [];

    for (let i = 0; i < count; i++) {
      const particle = document.createElement("div");
      particle.className = "confetti-particle";

      const color = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
      const size = 6 + Math.random() * 8;
      const startX = 20 + Math.random() * 60; // percent of viewport width
      const startY = intensity === "jackpot" ? 10 + Math.random() * 20 : 20 + Math.random() * 30;
      const xDrift = (Math.random() - 0.5) * 400;
      const fallDuration = (duration * 0.6 + Math.random() * duration * 0.6).toFixed(2);
      const delay = (Math.random() * 0.5).toFixed(2);

      // Coin shape for jackpot, square/rect otherwise
      const isCircle = intensity === "jackpot" && Math.random() > 0.5;

      particle.style.cssText = `
        left: calc(${startX}vw + ${xDrift * 0.2}px);
        top: ${startY}vh;
        width: ${isCircle ? size : size * 0.6}px;
        height: ${size}px;
        background: ${color};
        border-radius: ${isCircle ? "50%" : "2px"};
        animation: confetti-fall ${fallDuration}s ${delay}s linear forwards;
        transform-origin: center center;
      `;

      // Override animation to add horizontal drift
      particle.style.animation = "none";
      fragment.appendChild(particle);
      particles.push({ el: particle, xDrift, fallDuration: parseFloat(fallDuration), delay: parseFloat(delay) });
    }

    document.body.appendChild(fragment);

    // Animate each particle with requestAnimationFrame
    particles.forEach(({ el, xDrift, fallDuration, delay }) => {
      const startTime = performance.now() + delay * 1000;
      const totalDuration = fallDuration * 1000;
      const startY = parseFloat(el.style.top);
      const startX = parseFloat(el.style.left);

      function animate(now) {
        const elapsed = now - startTime;
        if (elapsed < 0) { requestAnimationFrame(animate); return; }
        const progress = Math.min(1, elapsed / totalDuration);
        const y = startY + progress * 110; // fall ~110vh
        const x = parseFloat(el.style.left) === startX
          ? startX + xDrift * progress
          : parseFloat(el.style.left);
        const rotation = progress * 720;
        const opacity = progress > 0.7 ? 1 - (progress - 0.7) / 0.3 : 1;

        el.style.top = y + "vh";
        el.style.left = (startX + xDrift * progress) + "px";
        el.style.opacity = opacity;
        el.style.transform = `rotate(${rotation}deg)`;

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          el.remove();
        }
      }

      requestAnimationFrame(animate);
    });

    // Safety cleanup
    setTimeout(() => particles.forEach(({ el }) => el.remove()), (duration + 1) * 1000 + 600);
  }

  // ─── 3. Daily Login Bonus ─────────────────────────────────────────────────
  function checkDailyBonus(accountState) {
    const today = new Date().toISOString().slice(0, 10);
    const lastLogin = localStorage.getItem("casino_last_login");
    const streak = parseInt(localStorage.getItem("casino_login_streak") || "0", 10);

    // Determine if eligible (last login was before today)
    const eligible = !lastLogin || lastLogin < today;
    if (!eligible) return;

    // Calculate streak
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const newStreak = lastLogin === yesterday ? streak + 1 : 1;
    const chipsAmount = Math.min(500, 10 * newStreak);

    // Show full-screen bonus popup
    const overlay = document.createElement("div");
    overlay.style.cssText = `
      position: fixed; inset: 0; z-index: 10000;
      background: rgba(0,0,0,0.85);
      display: flex; align-items: center; justify-content: center;
    `;

    overlay.innerHTML = `
      <div style="
        background: #1a2c38; border: 1px solid #2d4a5a; border-radius: 16px;
        padding: 40px 48px; text-align: center; max-width: 400px; width: 90%;
        box-shadow: 0 0 60px rgba(240,194,68,0.3);
      ">
        <div style="font-size: 3rem; margin-bottom: 12px;">🎁</div>
        <h2 style="color: #f0c244; font-size: 1.6rem; margin-bottom: 8px;">Daily Bonus!</h2>
        <div style="color: #b1bad3; font-size: 0.95rem; margin-bottom: 16px;">
          Day streak: <strong style="color:#fff">${newStreak}</strong>
        </div>
        <div style="
          background: rgba(240,194,68,0.12); border: 1px solid rgba(240,194,68,0.35);
          border-radius: 12px; padding: 20px; margin-bottom: 24px;
        ">
          <div style="font-size: 2rem; font-weight: 800; color: #f0c244;">
            +${chipsAmount} 🪙
          </div>
          <div style="color: #b1bad3; font-size: 0.85rem; margin-top: 4px;">
            ${newStreak >= 10 ? "Maximum daily bonus reached!" : `${10 * (newStreak + 1)} chips tomorrow (+${10} per day)`}
          </div>
        </div>
        <button id="daily-bonus-claim" style="
          background: #f0c244; color: #071c10; border: none; border-radius: 10px;
          padding: 14px 40px; font-size: 1rem; font-weight: 800; cursor: pointer;
          width: 100%;
        ">Claim Bonus</button>
        <div id="daily-bonus-result" style="margin-top: 12px; color: #b1bad3; font-size: 0.85rem;"></div>
      </div>
    `;

    document.body.appendChild(overlay);

    const claimBtn = overlay.querySelector("#daily-bonus-claim");
    const resultEl = overlay.querySelector("#daily-bonus-result");

    claimBtn.addEventListener("click", async () => {
      claimBtn.disabled = true;
      claimBtn.textContent = "Claiming…";
      try {
        const data = await Api.post("/wallet/daily-bonus");
        // Update streak & last login in localStorage
        localStorage.setItem("casino_last_login", today);
        localStorage.setItem("casino_login_streak", String(data.streak || newStreak));

        // Update balance in state
        if (accountState && data.balance !== undefined) {
          accountState.balance = data.balance;
          if (typeof UI !== "undefined") UI.setBalance(data.balance);
        }

        resultEl.textContent = `+${data.chips} chips claimed!`;
        claimBtn.textContent = "Claimed!";

        // Celebration
        setTimeout(() => {
          confetti("big");
          sound("win");
          overlay.remove();
        }, 800);
      } catch (err) {
        const msg = err?.message || "Failed to claim bonus";
        if (msg.includes("Already claimed")) {
          // Mark as claimed locally anyway to avoid spamming
          localStorage.setItem("casino_last_login", today);
          overlay.remove();
        } else {
          resultEl.textContent = msg;
          claimBtn.disabled = false;
          claimBtn.textContent = "Try Again";
        }
      }
    });

    // Allow clicking overlay backdrop to dismiss
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) overlay.remove();
    });
  }

  // ─── 4. Live Activity Feed ────────────────────────────────────────────────
  const FAKE_NAMES = [
    "player1337", "LuckyAce", "BetMaster", "GoldenFish", "SlotKing",
    "WildCard99", "DiamondHand", "RoyalFlush", "AceHigh", "DiceWizard",
    "SpinQueen", "JackpotJoe", "BigWinner", "NeonBet", "CryptoKing",
    "NightOwl", "RiskIt", "AllIn4Life", "LuckyNumber7", "GamblerPro",
  ];
  const FAKE_GAMES = ["Slots", "Crash", "Roulette", "Mines", "Dice", "Blackjack", "Plinko", "Keno", "Limbo"];

  let _feedPanel = null;
  let _feedItems = [];
  let _fakeActivityInterval = null;

  function _getFeedPanel() {
    if (_feedPanel && document.body.contains(_feedPanel)) return _feedPanel;
    _feedPanel = document.createElement("div");
    _feedPanel.className = "live-feed-panel";
    document.body.appendChild(_feedPanel);
    return _feedPanel;
  }

  function _addFeedItem({ username, game, amount, isWin }) {
    const panel = _getFeedPanel();
    const item = document.createElement("div");
    item.className = `lf-item ${isWin ? "win" : "loss"}`;
    const amountStr = Math.floor(Math.abs(amount) / 100);
    const emoji = isWin ? "🎰" : "💸";
    const action = isWin ? "won" : "lost";
    item.textContent = `${emoji} ${username} ${action} ${amountStr} 🪙 on ${game}`;

    panel.appendChild(item);
    _feedItems.push(item);

    // Keep max 8 items
    while (_feedItems.length > 8) {
      const old = _feedItems.shift();
      old.style.opacity = "0";
      old.style.transition = "opacity 0.3s";
      setTimeout(() => old.remove(), 300);
    }

    // Auto-remove after 8 seconds
    setTimeout(() => {
      item.style.opacity = "0";
      item.style.transition = "opacity 0.5s";
      setTimeout(() => {
        item.remove();
        _feedItems = _feedItems.filter((i) => i !== item);
      }, 500);
    }, 8000);
  }

  function _startFakeActivity() {
    if (_fakeActivityInterval) return;
    _fakeActivityInterval = setInterval(() => {
      const username = FAKE_NAMES[Math.floor(Math.random() * FAKE_NAMES.length)];
      const game = FAKE_GAMES[Math.floor(Math.random() * FAKE_GAMES.length)];
      const isWin = Math.random() > 0.45;
      const amount = (50 + Math.floor(Math.random() * 950)) * 100;
      _addFeedItem({ username, game, amount, isWin });
    }, 10000 + Math.random() * 20000);
  }

  function _initFeed() {
    _getFeedPanel();
    _startFakeActivity();
  }

  const feed = {
    push({ username, game, amount, isWin }) {
      _addFeedItem({ username, game, amount, isWin });
    },
    render(containerId) {
      // This initializes the feed panel; the containerId arg is optional/legacy
      _initFeed();
    },
  };

  // Auto-start feed when document is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", _initFeed);
  } else {
    setTimeout(_initFeed, 0);
  }

  // ─── 5. Hot Streak ────────────────────────────────────────────────────────
  const STREAK_KEY = "casino_bet_streak";

  function _getStreakData() {
    try {
      return JSON.parse(localStorage.getItem(STREAK_KEY) || "[]");
    } catch { return []; }
  }

  function _setStreakData(data) {
    localStorage.setItem(STREAK_KEY, JSON.stringify(data));
  }

  const streak = {
    record(isWin) {
      const bets = _getStreakData();
      bets.push(isWin ? 1 : 0);
      if (bets.length > 10) bets.splice(0, bets.length - 10);
      _setStreakData(bets);

      const last5 = bets.slice(-5);
      const last3 = bets.slice(-3);

      // 5 wins in a row
      if (last5.length === 5 && last5.every((b) => b === 1)) {
        confetti("big");
        sound("levelup");
        _showStreakToast("🔥🔥 INCREDIBLE! 5 wins in a row! You're unstoppable!", "win");
        return;
      }

      // 3 wins in a row
      if (last3.length === 3 && last3.every((b) => b === 1) && (bets.length < 5 || bets[bets.length - 4] !== 1)) {
        sound("win");
        _showStreakToast("🔥 You're on a hot streak! 3 wins in a row!", "win");
        return;
      }

      // 3 losses in a row
      if (last3.length === 3 && last3.every((b) => b === 0)) {
        _showStreakToast("❄️ Maybe change it up? Try a different game.", "info", true);
      }
    },
    get() {
      const bets = _getStreakData();
      if (!bets.length) return { wins: 0, losses: 0, current: 0, isHot: false, isCold: false };
      let wins = 0, losses = 0, current = 0;
      let currentSign = bets[bets.length - 1]; // 1 = win, 0 = loss
      for (let i = bets.length - 1; i >= 0; i--) {
        if (bets[i] === currentSign) current++;
        else break;
      }
      wins = bets.filter((b) => b === 1).length;
      losses = bets.filter((b) => b === 0).length;
      const last3 = bets.slice(-3);
      return {
        wins, losses, current,
        isHot: last3.length === 3 && last3.every((b) => b === 1),
        isCold: last3.length === 3 && last3.every((b) => b === 0),
      };
    },
  };

  function _showStreakToast(message, kind = "info", showLobbyLink = false) {
    const stack = document.getElementById("toast-stack");
    if (!stack) { if (typeof UI !== "undefined") UI.toast(message, kind); return; }
    const el = document.createElement("div");
    el.className = `toast ${kind}`;
    el.style.cssText = "cursor:default; white-space:pre-wrap;";
    el.textContent = message;
    if (showLobbyLink) {
      el.innerHTML = `${message} <a href="#" onclick="App&&App.mount&&App.mount('lobby');return false;" style="color:var(--accent);text-decoration:underline;">Go to lobby</a>`;
    }
    stack.appendChild(el);
    setTimeout(() => {
      el.style.opacity = "0";
      el.style.transition = "opacity 0.3s";
      setTimeout(() => el.remove(), 300);
    }, 5000);
  }

  // ─── 6. Jackpot Ticker ────────────────────────────────────────────────────
  let _jackpotAmount = 50000 * 100; // in cents
  let _jackpotInterval = null;
  let _jackpotEl = null;

  function _getJackpotEl() {
    if (_jackpotEl && document.body.contains(_jackpotEl)) return _jackpotEl;
    _jackpotEl = document.getElementById("jackpot-ticker");
    return _jackpotEl;
  }

  function _renderJackpot() {
    const el = _getJackpotEl();
    if (!el) return;
    const chips = Math.floor(_jackpotAmount / 100).toLocaleString();
    el.innerHTML = `🏆 JACKPOT <strong>${chips} 🪙</strong>`;
    el.style.display = "flex";
  }

  const jackpotTicker = {
    start(initialAmount) {
      _jackpotAmount = (initialAmount || 50000) * 100;
      _renderJackpot();
      if (_jackpotInterval) clearInterval(_jackpotInterval);
      _jackpotInterval = setInterval(() => {
        // Slow increment: random 10-50 chips every 5 seconds
        _jackpotAmount += (10 + Math.floor(Math.random() * 40)) * 100;
        _renderJackpot();
      }, 5000);
    },
    update(newAmount) {
      _jackpotAmount = newAmount * 100;
      _renderJackpot();
    },
  };

  // ─── 7. Level-Up Celebration ──────────────────────────────────────────────
  // A non-blocking banner that slides in below the top bar — it never covers
  // the game or blocks taps (pointer-events: none), so play isn't interrupted.
  function levelUp(newLevel, newRank) {
    const card = document.createElement("div");
    card.style.cssText = `
      position: fixed; top: 74px; left: 50%; z-index: 10001;
      transform: translateX(-50%) translateY(-14px); opacity: 0;
      pointer-events: none;
      background: linear-gradient(135deg, #1f2a36, #11202b);
      border: 1px solid rgba(240,194,68,0.6); border-radius: 16px;
      box-shadow: 0 12px 40px rgba(0,0,0,0.5), 0 0 40px rgba(240,194,68,0.25);
      padding: 14px 26px; text-align: center; max-width: 90%;
      transition: opacity 0.4s ease, transform 0.4s ease;
    `;
    card.innerHTML = `
      <div style="font-size: 1.5rem; font-weight: 900;">⬆️ <span style="color:#f0c244;">Level Up!</span></div>
      <div style="color: #fff; font-size: 0.95rem; margin-top: 2px;">
        Reached <strong style="color:#f0c244">Level ${newLevel}</strong>${newRank ? ` · <span style="color:#b1bad3;">${newRank}</span>` : ""}
      </div>
    `;
    document.body.appendChild(card);
    requestAnimationFrame(() => {
      card.style.opacity = "1";
      card.style.transform = "translateX(-50%) translateY(0)";
    });
    confetti("big");
    sound("levelup");

    setTimeout(() => {
      card.style.opacity = "0";
      card.style.transform = "translateX(-50%) translateY(-14px)";
      setTimeout(() => card.remove(), 450);
    }, 2800);
  }

  // ─── 8. Near-Miss Effect ──────────────────────────────────────────────────
  function nearMiss(message) {
    // Flash the game area
    const gameArea = document.getElementById("game-area");
    if (gameArea) {
      const flash = document.createElement("div");
      flash.style.cssText = `
        position: absolute; inset: 0; pointer-events: none; z-index: 100;
        background: rgba(240,194,68,0.18); border-radius: 10px;
        animation: near-miss-flash 0.6s ease forwards;
      `;
      // Ensure game-area is position-relative
      const prev = gameArea.style.position;
      gameArea.style.position = "relative";
      gameArea.appendChild(flash);
      setTimeout(() => {
        flash.remove();
        if (!prev) gameArea.style.position = "";
      }, 700);
    }

    // Show near-miss toast
    const stack = document.getElementById("toast-stack");
    if (!stack) return;
    const el = document.createElement("div");
    el.className = "toast info";
    el.style.cssText = "border-color: rgba(240,194,68,0.6); color: #f0c244;";
    el.textContent = `💔 So close! ${message || ""}`;
    stack.appendChild(el);
    setTimeout(() => {
      el.style.opacity = "0";
      el.style.transition = "opacity 0.3s";
      setTimeout(() => el.remove(), 300);
    }, 3800);
  }

  // ─── 9. Browser Notifications (big wins, while tab is unfocused) ──────────
  function isBrowserNotifEnabled() {
    return localStorage.getItem("casino_notif_browser") === "true";
  }

  function setBrowserNotifEnabled(val) {
    localStorage.setItem("casino_notif_browser", val ? "true" : "false");
  }

  async function requestNotifPermission() {
    if (!("Notification" in window)) return "unsupported";
    if (Notification.permission === "granted" || Notification.permission === "denied") {
      return Notification.permission;
    }
    try { return await Notification.requestPermission(); } catch (e) { return "denied"; }
  }

  function notifyBigWin(amountText) {
    if (!isBrowserNotifEnabled()) return;
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    if (!document.hidden) return; // only nudge when the player isn't looking
    try {
      new Notification("GrilledCoin — Big Win! 🎉", { body: amountText, icon: "/images/pwa/icon-192.png" });
    } catch (e) {}
  }

  // ─── Public API ───────────────────────────────────────────────────────────
  return {
    confetti,
    sound,
    isSoundEnabled,
    setSoundEnabled,
    getSoundVolume,
    setSoundVolume,
    checkDailyBonus,
    feed,
    streak,
    jackpotTicker,
    levelUp,
    nearMiss,
    isBrowserNotifEnabled,
    setBrowserNotifEnabled,
    requestNotifPermission,
    notifyBigWin,
  };
})();
