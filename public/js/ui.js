/* Shared rendering helpers used by every game module. */
const UI = (() => {
  const SUIT_RED = new Set(["♥", "♦"]);
  const SYMBOL_GLYPH = {
    wild: "🌟", scatter: "🎁", crown: "👑", gem: "💎", bell: "🔔",
    clover: "🍀", horseshoe: "🧲", ace: "🅰️", king: "🇰", queen: "🇶",
  };

  function money(cents) {
    const abs = Math.abs(cents) / 100;
    const sign = cents < 0 ? "-" : "";
    const formatted = abs % 1 === 0 ? abs.toFixed(0) : abs.toFixed(2);
    return `${sign}${formatted} 🪙`;
  }

  function toast(message, kind = "info") {
    const stack = document.getElementById("toast-stack");
    const el = document.createElement("div");
    el.className = `toast ${kind}`;
    el.textContent = message;
    stack.appendChild(el);
    setTimeout(() => {
      el.style.opacity = "0";
      el.style.transition = "opacity 0.3s";
      setTimeout(() => el.remove(), 300);
    }, 3800);
  }

  function setBalance(cents) {
    const chips = Math.floor(cents / 100);
    const formatted = chips.toLocaleString();
    const balEl = document.getElementById("balance-amount");
    const tbEl = document.getElementById("topbar-balance");
    if (balEl) balEl.textContent = formatted + " 🪙";
    if (tbEl) tbEl.textContent = formatted;
  }

  function setLevel(level, xp) {
    const lvlEl = document.getElementById("user-level-label") || document.getElementById("user-level");
    if (lvlEl) lvlEl.textContent = `Level ${level}`;
    // XP curve mirrors the backend: level N needs N*1000 cumulative XP.
    let remaining = xp;
    let threshold = 1000;
    let lvl = 1;
    while (remaining >= threshold) {
      remaining -= threshold;
      lvl += 1;
      threshold = lvl * 1000;
    }
    const pct = Math.min(100, Math.round((remaining / threshold) * 100));
    const xpFill = document.getElementById("xp-fill");
    if (xpFill) xpFill.style.width = `${pct}%`;
  }

  function applyAccountUpdate(state, patch) {
    if (patch.balance !== undefined) {
      state.balance = patch.balance;
      setBalance(state.balance);
    }
    if (patch.bank !== undefined) state.bank = patch.bank;
    if (patch.level !== undefined || patch.xp !== undefined) {
      const oldLevel = state.level;
      state.level = patch.level ?? state.level;
      state.xp = patch.xp ?? state.xp;
      setLevel(state.level, state.xp);
      if (patch.level && patch.level > oldLevel && typeof Engagement !== "undefined") {
        Engagement.levelUp(state.level, state.rank);
      }
    }
    if (patch.leveledUp) toast(`🎉 Level up! You're now level ${state.level} (+${money(state.level * 500)} bonus)`, "win");

    // Engagement system hooks
    if (typeof Engagement !== "undefined" && patch.result) {
      const r = patch.result;
      const isWin = r.result === "win";
      const payout = r.payout || 0;
      const amount = r.amount || 0;
      if (isWin) {
        if (payout > amount * 3) {
          Engagement.confetti(payout > 100000 ? "jackpot" : "big");
          Engagement.sound("bigwin");
        } else {
          Engagement.sound("win");
        }
      } else {
        Engagement.sound("loss");
      }
      Engagement.streak.record(isWin);
      Engagement.feed.push({ username: "You", game: "Casino", amount: payout || amount, isWin });
    }
  }

  function cardLabel(card) {
    return { rank: card.rank, suit: card.suit, red: SUIT_RED.has(card.suit) };
  }

  const SUIT_LETTER = {"♠":"S","♥":"H","♦":"D","♣":"C"};

  function renderCard(card, faceDown = false) {
    if (faceDown) return `<img class="card-svg face-down" src="/images/card-back.png" alt="?" />`;
    const letter = SUIT_LETTER[card.suit] || "S";
    return `<img class="card-svg" src="/images/cards/${card.rank}${letter}.svg" alt="${card.rank}${card.suit}" />`;
  }

  function symbolGlyph(symbol) {
    return SYMBOL_GLYPH[symbol] || "❓";
  }

  function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "class") node.className = v;
      else if (k === "html") node.innerHTML = v;
      else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
      else node.setAttribute(k, v);
    }
    for (const child of [].concat(children)) {
      if (child == null) continue;
      node.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
    }
    return node;
  }

  function fairnessLine(fairness) {
    if (!fairness) return "";
    const nonceBit = fairness.nonce !== undefined ? ` · nonce <code>${fairness.nonce}</code>` : "";
    return `<div class="fairness-line">🔒 Provably fair — server seed hash <code>${fairness.serverSeedHash || fairness.activeServerSeedHash}</code>
      · client seed <code>${fairness.clientSeed}</code>${nonceBit}</div>`;
  }

  return { money, toast, setBalance, setLevel, applyAccountUpdate, renderCard, cardLabel, symbolGlyph, el, fairnessLine };
})();
