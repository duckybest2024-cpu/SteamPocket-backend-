const WildCardsGame = (() => {
  /* ── Card string parsing ──────────────────────────────────────── */
  // Card string format: "7R"=7Red, "SG"=SkipGreen, "R2B"=Draw2Blue, "WW"=Wild, "W4"=Wild4
  const COLOR_CODE = { R: "R", G: "G", B: "B", Y: "Y" };
  const COLOR_HEX  = { R: "#e53935", G: "#43a047", B: "#1e88e5", Y: "#f9a825" };
  const COLOR_NAME = { R: "Red", G: "Green", B: "Blue", Y: "Yellow" };

  function parseCard(str) {
    if (!str || str === "??") return null;
    if (str === "WW") return { type: "wild",  color: null };
    if (str === "W4") return { type: "wild4", color: null };
    // Draw 2: "R2R", "R2G", "R2B", "R2Y"
    if (str.startsWith("R2") && str.length === 3) return { type: "draw2",   color: str[2], value: null };
    // Skip: "SX" where X is color
    if (str.startsWith("S")  && str.length === 2) return { type: "skip",    color: str[1], value: null };
    // Reverse: "RVX" — but our backend uses "R2X" for draw2 so reverse would be different
    // Actually looking at the spec: "R2B" = Draw Two Blue. Let's handle single-letter specials too
    // Number: "7R", "0G", etc — digit first then color
    if (str.length === 2 && /[0-9]/.test(str[0])) return { type: "number", color: str[1], value: str[0] };
    // Fallback for reverse if it appears as e.g. "VR" (not in spec but guard anyway)
    if (str.length === 2 && str[0] === "V") return { type: "reverse", color: str[1], value: null };
    return { type: "unknown", color: null, value: str };
  }

  function isWild(cardStr) { return cardStr === "WW" || cardStr === "W4"; }

  function cardLabel(p) {
    if (!p) return "?";
    if (p.type === "number")  return p.value;
    if (p.type === "skip")    return "⊘";
    if (p.type === "reverse") return "⇄";
    if (p.type === "draw2")   return "+2";
    if (p.type === "wild")    return "W";
    if (p.type === "wild4")   return "W+4";
    return "?";
  }

  function cardTitle(p) {
    if (!p) return "";
    const c = p.color ? (COLOR_NAME[p.color] || p.color) + " " : "";
    if (p.type === "number")  return c + p.value;
    if (p.type === "skip")    return c + "Skip";
    if (p.type === "reverse") return c + "Reverse";
    if (p.type === "draw2")   return c + "Draw 2";
    if (p.type === "wild")    return "Wild";
    if (p.type === "wild4")   return "Wild Draw 4";
    return p.value || "";
  }

  function cardHTML(cardStr, opts = {}) {
    const { small = false, faceDown = false, clickable = false, highlight = false, dimmed = false } = opts;
    const w = small ? 38 : 62;
    const h = small ? 54 : 90;
    const fs = small ? "0.7rem" : "1.15rem";
    const br = "8px";

    if (faceDown || cardStr === "??") {
      return `<div style="
        width:${w}px;height:${h}px;border-radius:${br};
        background:linear-gradient(135deg,#1e3a5f 25%,#1a2f4e 75%);
        border:2px solid #2d4a5a;
        display:flex;align-items:center;justify-content:center;
        font-size:${fs};color:#4d7fa8;user-select:none;flex-shrink:0;">
        <span style="font-size:${small ? "0.9rem" : "1.4rem"}">🂠</span>
      </div>`;
    }

    const p = parseCard(cardStr);
    if (!p) return "";

    const wildCard = p.type === "wild" || p.type === "wild4";

    const bg = wildCard
      ? "#111"
      : (p.color ? `${COLOR_HEX[p.color]}22` : "#fff");
    const fg = wildCard ? "#fff" : (p.color ? COLOR_HEX[p.color] : "#333");

    let borderStyle;
    if (highlight) {
      borderStyle = `3px solid #f59e0b`;
    } else if (wildCard) {
      borderStyle = `2px solid transparent`;
    } else {
      borderStyle = `2px solid ${p.color ? COLOR_HEX[p.color] : "#888"}`;
    }

    const opacity   = dimmed ? "0.45" : "1";
    const cursor    = clickable ? "pointer" : "default";
    const label     = cardLabel(p);
    const title     = cardTitle(p);
    const colorTag  = !wildCard && p.color && !small
      ? `<span style="font-size:0.55rem;letter-spacing:0.05em;text-transform:uppercase;opacity:0.7;margin-top:2px">${COLOR_NAME[p.color] || p.color}</span>`
      : "";

    const wildBg = wildCard
      ? `background:linear-gradient(#111,#111) padding-box, linear-gradient(135deg,#e53935,#f9a825,#43a047,#1e88e5) border-box;border:2px solid transparent;`
      : `background:${bg};border:${borderStyle};`;

    const shadow = highlight
      ? "0 0 0 2px #f59e0b, 0 2px 8px rgba(0,0,0,0.4)"
      : "0 2px 4px rgba(0,0,0,0.2)";

    const hover = clickable
      ? `onmouseover="this.style.transform='translateY(-6px)';this.style.boxShadow='0 6px 16px rgba(0,0,0,0.4)'"
         onmouseout="this.style.transform='translateY(0)';this.style.boxShadow='${shadow}'"`
      : "";

    return `<div title="${title}" style="
      width:${w}px;height:${h}px;border-radius:${br};
      ${wildBg}
      display:flex;flex-direction:column;align-items:center;justify-content:center;
      font-size:${fs};font-weight:800;color:${fg};
      cursor:${cursor};user-select:none;opacity:${opacity};
      box-shadow:${shadow};
      transition:transform 0.12s,box-shadow 0.12s;flex-shrink:0;"
      ${hover}>
      <span style="line-height:1">${label}</span>
      ${colorTag}
    </div>`;
  }

  /* ── Main render ─────────────────────────────────────────────── */
  function renderBoard(container, socket, room, myUserId) {
    /* Inject styles once */
    if (!document.getElementById("wildcards-styles")) {
      const style = document.createElement("style");
      style.id = "wildcards-styles";
      style.textContent = `
        .wc-root { display:flex;flex-direction:column;height:100%;min-height:0;gap:12px;padding:12px;box-sizing:border-box; }
        .wc-table { background:var(--bg-card);border:1px solid var(--border);border-radius:14px;padding:14px;position:relative; }
        .wc-players { display:flex;gap:8px;flex-wrap:wrap;justify-content:center; }
        .wc-player-slot {
          background:rgba(15,33,46,0.85);
          border:2px solid #2d4a5a;border-radius:10px;padding:8px 12px;
          text-align:center;min-width:80px;font-size:0.78rem;transition:border-color 0.2s,box-shadow 0.2s;
        }
        .wc-player-slot.active-turn {
          border-color:#00e701;
          box-shadow:0 0 0 2px rgba(0,231,1,0.3),0 0 18px rgba(0,231,1,0.18);
        }
        .wc-center { display:flex;align-items:center;justify-content:center;gap:20px;padding:16px 0;flex-wrap:wrap; }
        .wc-draw-btn {
          background:var(--bg-elev);border:2px solid var(--border);border-radius:10px;padding:10px 18px;
          color:var(--text);font-weight:700;font-size:0.9rem;cursor:pointer;transition:border-color 0.15s,background 0.15s;
          display:flex;flex-direction:column;align-items:center;gap:4px;font-family:inherit;
        }
        .wc-draw-btn:hover:not(:disabled) { border-color:var(--accent);background:var(--bg-hover); }
        .wc-draw-btn:disabled { opacity:0.4;cursor:not-allowed; }
        .wc-hand {
          display:flex;gap:6px;flex-wrap:wrap;justify-content:center;padding:10px;
          background:var(--bg-elev);border:1px solid var(--border);border-radius:12px;min-height:110px;align-items:flex-end;
        }
        .wc-hand-label { font-size:0.72rem;color:var(--text-dim);text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px; }
        .wc-color-modal {
          position:fixed;inset:0;background:rgba(0,0,0,0.8);display:flex;align-items:center;
          justify-content:center;z-index:9999;backdrop-filter:blur(4px);
        }
        .wc-color-modal-box {
          background:var(--bg-card);border:1px solid var(--border);border-radius:16px;
          padding:24px;text-align:center;max-width:320px;width:90%;
          box-shadow:0 8px 32px rgba(0,0,0,0.5);
        }
        .wc-color-choices { display:flex;gap:12px;justify-content:center;margin-top:16px;flex-wrap:wrap; }
        .wc-color-btn {
          width:64px;height:64px;border-radius:12px;border:3px solid transparent;cursor:pointer;
          font-size:0.78rem;font-weight:700;color:#fff;text-shadow:0 1px 3px rgba(0,0,0,0.6);
          transition:transform 0.12s,box-shadow 0.12s;
        }
        .wc-color-btn:hover { transform:scale(1.12);box-shadow:0 4px 16px rgba(0,0,0,0.5); }
        .wc-turn-bar {
          display:flex;align-items:center;justify-content:space-between;font-size:0.8rem;
          padding:8px 12px;background:var(--bg-elev);border-radius:8px;border:1px solid var(--border);
          transition:border-color 0.2s;
        }
        .wc-dir-indicator { font-size:1.4rem;transition:transform 0.4s; }
        .wc-card-count-badge {
          display:inline-flex;align-items:center;justify-content:center;
          min-width:20px;height:20px;border-radius:10px;background:#e53935;
          color:#fff;font-size:0.65rem;font-weight:700;padding:0 4px;
        }
        @media(max-width:480px) {
          .wc-center { gap:12px;padding:10px 0; }
          .wc-hand { gap:4px;padding:8px; }
        }
      `;
      document.head.appendChild(style);
    }

    /* State — populated from room.gameState on bg:room-update */
    let state = room.gameState || {};
    let pendingCard = null;

    /* Resolve username from userId using room.players */
    function getUsername(userId) {
      const rp = (room.players || []).find(p => (p.userId || p.id || p._id) === userId);
      return rp ? (rp.username || rp.name || userId) : userId;
    }

    /* Root markup */
    container.innerHTML = `<div class="wc-root" id="wc-root">
      <div class="wc-turn-bar" id="wc-turn-bar">
        <span id="wc-turn-text">Waiting…</span>
        <span id="wc-dir-label" style="font-size:0.72rem;color:var(--text-dim)"></span>
        <span class="wc-dir-indicator" id="wc-dir">↻</span>
      </div>
      <div class="wc-table">
        <div class="wc-players" id="wc-players"></div>
        <div class="wc-center" id="wc-center"></div>
      </div>
      <div>
        <div class="wc-hand-label">Your Hand</div>
        <div class="wc-hand" id="wc-hand"></div>
      </div>
    </div>`;

    const turnBar   = document.getElementById("wc-turn-bar");
    const turnText  = document.getElementById("wc-turn-text");
    const dirLabel  = document.getElementById("wc-dir-label");
    const dirEl     = document.getElementById("wc-dir");
    const playersEl = document.getElementById("wc-players");
    const centerEl  = document.getElementById("wc-center");
    const handEl    = document.getElementById("wc-hand");

    /* ── Helpers ─────────────────────────────────────────────────── */
    function isMyTurn() { return state.currentPlayer === myUserId; }

    /* ── Turn bar ────────────────────────────────────────────────── */
    function renderTurnBar() {
      const cp = state.currentPlayer;
      const myTurn = isMyTurn();
      if (!cp) {
        turnText.textContent = "Waiting…";
        turnBar.style.borderColor = "var(--border)";
        return;
      }
      turnText.textContent = myTurn ? "Your turn!" : `${getUsername(cp)}'s turn`;
      turnText.style.color = myTurn ? "var(--accent)" : "var(--text)";
      turnBar.style.borderColor = myTurn ? "var(--accent)" : "var(--border)";
      const dir = state.direction;
      dirEl.textContent = dir === -1 ? "↺" : "↻";
      dirLabel.textContent = dir === -1 ? "Counter-clockwise" : "Clockwise";
    }

    /* ── Other players ───────────────────────────────────────────── */
    function renderPlayers() {
      const players = state.players || [];
      const hands   = state.hands || {};
      const others  = players.filter(uid => uid !== myUserId);

      if (!others.length) {
        playersEl.innerHTML = `<div style="color:var(--text-dim);font-size:0.82rem;padding:8px">No other players yet</div>`;
        return;
      }

      playersEl.innerHTML = others.map(uid => {
        const isActive = uid === state.currentPlayer;
        const cardCount = (hands[uid] || []).length;
        const name = getUsername(uid);

        // Show up to 5 face-down cards, then a count badge
        const maxShow = 5;
        const shown   = Math.min(cardCount, maxShow);
        const extra   = cardCount - shown;

        const cardMinis = Array.from({ length: shown }, () =>
          cardHTML("??", { small: true, faceDown: true })
        ).join("") + (extra > 0 ? `<span class="wc-card-count-badge">+${extra}</span>` : "");

        return `<div class="wc-player-slot ${isActive ? "active-turn" : ""}">
          <div style="font-weight:700;color:${isActive ? "var(--accent)" : "var(--text)"};margin-bottom:4px;
            max-width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${name}</div>
          <div style="display:flex;gap:2px;justify-content:center;flex-wrap:wrap;align-items:center;margin-bottom:4px">
            ${cardMinis}
          </div>
          <div style="font-size:0.7rem;color:var(--text-dim)">${cardCount} card${cardCount !== 1 ? "s" : ""}</div>
        </div>`;
      }).join("");
    }

    /* ── Center (discard + color + deck) ────────────────────────── */
    function renderCenter() {
      const myTurn      = isMyTurn();
      const discardTop  = state.discardTop || null;
      const chosenColor = state.color || null;
      const deckCount   = (state.deck || []).length;

      // Color indicator — for wild cards the active color is separate
      const colorHex  = chosenColor ? (COLOR_HEX[chosenColor] || "#888") : "#555";
      const colorName = chosenColor ? (COLOR_NAME[chosenColor] || chosenColor) : "—";

      centerEl.innerHTML = `
        <div style="text-align:center">
          <div style="font-size:0.68rem;color:var(--text-dim);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px">Discard</div>
          ${discardTop
            ? cardHTML(discardTop)
            : `<div style="width:62px;height:90px;border-radius:8px;border:2px dashed var(--border);display:flex;align-items:center;justify-content:center;color:var(--text-dim)">?</div>`
          }
        </div>
        <div style="text-align:center">
          <div style="font-size:0.68rem;color:var(--text-dim);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px">Active Color</div>
          <div style="width:44px;height:44px;border-radius:8px;background:${colorHex};
            border:3px solid rgba(255,255,255,0.2);box-shadow:0 2px 10px rgba(0,0,0,0.4);
            margin:0 auto 4px;"></div>
          <div style="font-size:0.72rem;font-weight:600;color:${colorHex}">${colorName}</div>
        </div>
        <div style="text-align:center">
          <div style="font-size:0.68rem;color:var(--text-dim);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px">Draw Pile</div>
          <button class="wc-draw-btn" id="wc-draw-btn" ${!myTurn ? "disabled" : ""}>
            <span style="font-size:1.8rem">🂠</span>
            <span>${deckCount} cards</span>
          </button>
        </div>`;

      document.getElementById("wc-draw-btn")?.addEventListener("click", () => {
        if (!isMyTurn()) return;
        socket.emit("bg:move", { roomId: room.id, move: { type: "draw" } });
      });
    }

    /* ── Hand ────────────────────────────────────────────────────── */
    function renderHand() {
      const hands  = state.hands || {};
      const myHand = hands[myUserId] || [];

      if (!myHand.length) {
        handEl.innerHTML = `<div style="color:var(--text-dim);font-size:0.85rem;padding:16px">No cards in hand</div>`;
        return;
      }

      const myTurn     = isMyTurn();
      const discardTop = state.discardTop || null;
      const color      = state.color || null;

      handEl.innerHTML = myHand.map((cardStr, idx) => {
        const canPlay = myTurn && isPlayable(cardStr, discardTop, color);
        return `<div data-idx="${idx}" class="wc-hand-card" style="cursor:${canPlay ? "pointer" : "default"}">
          ${cardHTML(cardStr, { clickable: canPlay, dimmed: myTurn && !canPlay, highlight: canPlay })}
        </div>`;
      }).join("");

      handEl.querySelectorAll(".wc-hand-card").forEach(el => {
        const idx     = parseInt(el.dataset.idx, 10);
        const cardStr = myHand[idx];
        const canPlay = myTurn && isPlayable(cardStr, discardTop, color);
        if (!canPlay) return;
        el.addEventListener("click", () => handlePlayCard(cardStr));
      });
    }

    /* ── Playability check ───────────────────────────────────────── */
    function isPlayable(cardStr, discardTopStr, activeColor) {
      if (!discardTopStr) return true;
      if (isWild(cardStr)) return true;  // wilds always playable

      const card    = parseCard(cardStr);
      const discard = parseCard(discardTopStr);
      if (!card || !discard) return false;

      // Match active color (important after a wild is played)
      if (activeColor && card.color === activeColor) return true;

      // Match discard color
      if (card.color && discard.color && card.color === discard.color) return true;

      // Match type (skip on skip, draw2 on draw2, number on same number)
      if (card.type === discard.type) {
        if (card.type === "number") return card.value === discard.value;
        return true; // skip/reverse/draw2 match by type
      }

      return false;
    }

    /* ── Play card ───────────────────────────────────────────────── */
    function handlePlayCard(cardStr) {
      if (!isMyTurn()) return;
      if (isWild(cardStr)) {
        pendingCard = cardStr;
        showColorChooser();
      } else {
        socket.emit("bg:move", { roomId: room.id, move: { type: "play", card: cardStr, chosenColor: null } });
      }
    }

    /* ── Color chooser modal ─────────────────────────────────────── */
    function showColorChooser() {
      const existing = document.getElementById("wc-color-modal");
      if (existing) existing.remove();

      const p = parseCard(pendingCard);
      const modal = document.createElement("div");
      modal.id = "wc-color-modal";
      modal.className = "wc-color-modal";
      modal.innerHTML = `
        <div class="wc-color-modal-box">
          <div style="font-size:1rem;font-weight:700;margin-bottom:4px">Choose a Color</div>
          <div style="font-size:0.82rem;color:var(--text-dim)">Playing: <strong>${cardTitle(p)}</strong></div>
          <div class="wc-color-choices">
            ${[["R","Red"],["G","Green"],["B","Blue"],["Y","Yellow"]].map(([code, name]) => `
              <button class="wc-color-btn" data-color="${code}"
                style="background:${COLOR_HEX[code]};box-shadow:0 2px 8px ${COLOR_HEX[code]}66"
                title="${name}">${name}</button>
            `).join("")}
          </div>
          <button style="margin-top:16px;background:transparent;border:1px solid var(--border);color:var(--text-dim);
            padding:6px 16px;border-radius:8px;cursor:pointer;font-size:0.8rem;font-family:inherit"
            id="wc-cancel-color">Cancel</button>
        </div>`;

      document.body.appendChild(modal);

      modal.querySelectorAll(".wc-color-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          const chosenColor = btn.dataset.color;
          modal.remove();
          socket.emit("bg:move", { roomId: room.id, move: { type: "play", card: pendingCard, chosenColor } });
          pendingCard = null;
        });
      });

      document.getElementById("wc-cancel-color")?.addEventListener("click", () => {
        modal.remove();
        pendingCard = null;
      });
    }

    /* ── Full render ─────────────────────────────────────────────── */
    function refreshGameUI(newState) {
      state = newState;
      renderTurnBar();
      renderPlayers();
      renderCenter();
      renderHand();
    }

    function fullRender() {
      renderTurnBar();
      renderPlayers();
      renderCenter();
      renderHand();
    }

    /* ── Socket events ───────────────────────────────────────────── */
    socket.on("bg:room-update", (updatedRoom) => {
      // Keep room reference fresh for player name lookups
      if (updatedRoom.players) room.players = updatedRoom.players;
      const newState = updatedRoom.gameState;
      if (!newState) return;
      refreshGameUI(newState);
    });

    socket.on("bg:error", (msg) => {
      const text = typeof msg === "string" ? msg : msg.message;
      UI.toast(text, "loss");
    });

    /* Initial render */
    fullRender();

    /* Cleanup */
    return () => {
      const modal = document.getElementById("wc-color-modal");
      if (modal) modal.remove();
    };
  }

  return { renderBoard };
})();
