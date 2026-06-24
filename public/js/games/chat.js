/* GrilledCoin — Group Chat */
const ChatGame = (() => {
  const RANK_COLORS = {
    bronze:   "#cd7f32",
    silver:   "#c0c0c0",
    gold:     "#ffd700",
    platinum: "#b9f2ff",
    diamond:  "#00e5ff",
    owner:    "#a855f7",
  };

  const ROOMS = [
    { key: "general",     label: "General",      icon: "💬", desc: "Talk about anything" },
    { key: "vip",         label: "VIP",           icon: "💎", desc: "For VIP patrons" },
    { key: "highrollers", label: "High Rollers",  icon: "🎩", desc: "Big bets, big talk" },
    { key: "offtopic",    label: "Off Topic",     icon: "🎈", desc: "Anything goes" },
    { key: "sports",      label: "Sports",        icon: "⚽", desc: "Game day chatter" },
  ];

  const S = {
    panel: `background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:20px;`,
    layout: `display:flex;gap:16px;flex-wrap:wrap;height:calc(100vh - 170px);min-height:440px;`,
    left: `flex:0 0 200px;min-width:160px;display:flex;flex-direction:column;gap:8px;`,
    right: `flex:2;min-width:280px;display:flex;flex-direction:column;gap:0;background:var(--bg-elev);border:1px solid var(--border);border-radius:14px;overflow:hidden;box-shadow:0 4px 18px rgba(0,0,0,0.18);`,
    sectionTitle: `font-size:0.78rem;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-dim);margin:0 0 8px;padding-left:2px;`,
    roomBtnBase: `width:100%;display:flex;align-items:center;gap:10px;text-align:left;padding:10px 12px;border-radius:10px;cursor:pointer;font-size:0.88rem;font-weight:600;transition:background 0.15s,border-color 0.15s,transform 0.1s;`,
    roomIcon: `font-size:1.1rem;line-height:1;flex-shrink:0;`,
    roomTextWrap: `display:flex;flex-direction:column;gap:1px;overflow:hidden;`,
    roomDesc: `font-size:0.7rem;font-weight:500;opacity:0.7;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;`,
    headerBar: `padding:14px 18px;background:linear-gradient(135deg,var(--bg-card),var(--bg-elev));border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px;`,
    headerIcon: `font-size:1.3rem;`,
    headerTitle: `font-weight:800;font-size:1rem;color:var(--text);`,
    headerSub: `font-size:0.76rem;color:var(--text-dim);`,
    statusPill: `margin-left:auto;display:flex;align-items:center;gap:6px;font-size:0.76rem;padding:4px 10px;border-radius:20px;background:var(--bg);`,
    messagesArea: `flex:1;overflow-y:auto;padding:16px 18px;display:flex;flex-direction:column;gap:12px;`,
    avatar: (color) => `width:32px;height:32px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:0.85rem;font-weight:800;color:#0b0e14;background:${color};box-shadow:0 0 0 2px ${color}33;`,
    msgRow: (own) => `display:flex;gap:10px;max-width:78%;align-self:${own ? "flex-end" : "flex-start"};flex-direction:${own ? "row-reverse" : "row"};`,
    bubbleWrap: `display:flex;flex-direction:column;gap:3px;min-width:0;`,
    msgHeader: (own) => `display:flex;align-items:baseline;gap:8px;${own ? "justify-content:flex-end;" : ""}`,
    msgName: (color) => `font-size:0.78rem;font-weight:800;color:${color};`,
    msgTime: `font-size:0.68rem;color:var(--text-dim);`,
    bubble: (own) => `font-size:0.88rem;line-height:1.4;color:var(--text);padding:9px 13px;border-radius:14px;word-break:break-word;background:${own ? "linear-gradient(135deg,var(--accent),#10b981)" : "var(--bg)"};color:${own ? "#06160d" : "var(--text)"};border:1px solid ${own ? "transparent" : "var(--border)"};border-${own ? "top-right" : "top-left"}-radius:4px;`,
    inputRow: `display:flex;gap:10px;padding:14px 16px;border-top:1px solid var(--border);background:var(--bg-card);`,
    inputBox: `flex:1;background:var(--bg);border:1px solid var(--border);border-radius:24px;padding:11px 18px;color:var(--text);font-size:0.9rem;outline:none;transition:border-color 0.15s,box-shadow 0.15s;`,
    sendBtn: `padding:0 22px;background:linear-gradient(135deg,#34d399,#10b981);color:#071a10;border:none;border-radius:24px;font-weight:800;font-size:0.88rem;cursor:pointer;white-space:nowrap;transition:filter 0.15s,transform 0.1s;`,
    statusDot: (connected) => `width:8px;height:8px;border-radius:50%;background:${connected ? "#34d399" : "#f87171"};display:inline-block;${connected ? "box-shadow:0 0 0 3px rgba(52,211,153,0.25);" : ""}`,
  };

  function relativeTime(timestamp) {
    const diff = Math.floor((Date.now() - timestamp) / 1000);
    if (diff < 5)  return "just now";
    if (diff < 60) return diff + "s ago";
    const m = Math.floor(diff / 60);
    if (m < 60)   return m + "m ago";
    const h = Math.floor(m / 60);
    if (h < 24)   return h + "h ago";
    return Math.floor(h / 24) + "d ago";
  }

  function escHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function render(container, accountState) {
    let socket = null;
    let currentRoom = "general";
    let connected = false;
    let timestampTimer = null;
    const myUsername = accountState?.username ?? null;

    function renderMessage(msg) {
      const color = RANK_COLORS[msg.rank] ?? RANK_COLORS.bronze;
      const isOwn = myUsername && msg.username === myUsername;
      const initial = (msg.username || "?").charAt(0).toUpperCase();

      const div = document.createElement("div");
      div.style.cssText = S.msgRow(isOwn);
      div.innerHTML = `
        <span style="${S.avatar(color)}">${initial}</span>
        <div style="${S.bubbleWrap}">
          <div style="${S.msgHeader(isOwn)}">
            <span style="${S.msgName(color)}">${escHtml(msg.username)}</span>
            <span style="${S.msgTime}" data-ts="${msg.timestamp}">${relativeTime(msg.timestamp)}</span>
          </div>
          <div style="${S.bubble(isOwn)}">${escHtml(msg.message)}</div>
        </div>
      `;
      return div;
    }

    container.innerHTML = `
      <div class="game-panel" style="${S.panel}">
        <h2 style="margin:0 0 16px;font-size:1.3rem;">💬 Chat</h2>
        <div style="${S.layout}">

          <!-- LEFT: room list -->
          <div style="${S.left}">
            <p style="${S.sectionTitle}">Rooms</p>
            <div id="chat-room-list" style="display:flex;flex-direction:column;gap:6px;"></div>
          </div>

          <!-- RIGHT: chat panel -->
          <div style="${S.right}">
            <div style="${S.headerBar}" id="chat-header-bar"></div>

            <!-- messages -->
            <div id="chat-messages" style="${S.messagesArea}"></div>

            <!-- input -->
            <div style="${S.inputRow}">
              <input id="chat-input" type="text" maxlength="300" placeholder="Type a message…" style="${S.inputBox}" />
              <button id="chat-send-btn" style="${S.sendBtn}">Send ➤</button>
            </div>
          </div>

        </div>
      </div>
    `;

    const roomList    = document.getElementById("chat-room-list");
    const headerBar    = document.getElementById("chat-header-bar");
    const messagesEl  = document.getElementById("chat-messages");
    const inputEl     = document.getElementById("chat-input");
    const sendBtn     = document.getElementById("chat-send-btn");

    inputEl.addEventListener("focus", () => { inputEl.style.borderColor = "var(--accent)"; });
    inputEl.addEventListener("blur",  () => { inputEl.style.borderColor = "var(--border)"; });
    sendBtn.addEventListener("mouseenter", () => { sendBtn.style.filter = "brightness(1.1)"; });
    sendBtn.addEventListener("mouseleave", () => { sendBtn.style.filter = "none"; });

    function buildHeaderBar() {
      const room = ROOMS.find(r => r.key === currentRoom);
      headerBar.innerHTML = `
        <span style="${S.headerIcon}">${room?.icon ?? "💬"}</span>
        <div>
          <div style="${S.headerTitle}">${room?.label ?? currentRoom}</div>
          <div style="${S.headerSub}">${room?.desc ?? ""}</div>
        </div>
        <span style="${S.statusPill}" id="chat-status-pill">
          <span id="chat-status-dot" style="${S.statusDot(false)}"></span>
          <span id="chat-status-text" style="color:var(--text-dim);">Connecting…</span>
        </span>
      `;
    }

    // Build room buttons
    function buildRoomButtons() {
      roomList.innerHTML = "";
      for (const r of ROOMS) {
        const active = r.key === currentRoom;
        const btn = document.createElement("button");
        btn.style.cssText = S.roomBtnBase + (active
          ? `background:var(--accent);border:1px solid var(--accent);color:#071c10;`
          : `background:var(--bg-elev);border:1px solid var(--border);color:var(--text);`);
        btn.innerHTML = `
          <span style="${S.roomIcon}">${r.icon}</span>
          <span style="${S.roomTextWrap}">
            <span>${r.label}</span>
            <span style="${S.roomDesc}">${r.desc}</span>
          </span>
        `;
        if (!active) {
          btn.addEventListener("mouseenter", () => { btn.style.borderColor = "var(--accent)"; });
          btn.addEventListener("mouseleave", () => { btn.style.borderColor = "var(--border)"; });
        }
        btn.addEventListener("click", () => {
          if (r.key === currentRoom) return;
          switchRoom(r.key);
        });
        roomList.appendChild(btn);
      }
    }

    function setStatus(isConnected, text) {
      connected = isConnected;
      const dot = document.getElementById("chat-status-dot");
      const txt = document.getElementById("chat-status-text");
      if (dot) dot.style.cssText = S.statusDot(isConnected);
      if (txt) {
        txt.textContent = text;
        txt.style.color = isConnected ? "var(--win)" : "var(--text-dim)";
      }
    }

    function appendMessage(msg) {
      const el = renderMessage(msg);
      messagesEl.appendChild(el);
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    function clearMessages() {
      messagesEl.innerHTML = "";
    }

    function showNotice(text) {
      const notice = document.createElement("div");
      notice.className = "chat-notice";
      notice.style.cssText = "color:var(--text-dim);font-size:0.85rem;text-align:center;padding:20px;";
      notice.textContent = text;
      messagesEl.appendChild(notice);
    }

    function switchRoom(roomKey) {
      currentRoom = roomKey;
      buildRoomButtons();
      buildHeaderBar();
      setStatus(connected, connected ? "Connected" : "Connecting…");
      const roomLabel = ROOMS.find(r => r.key === roomKey)?.label ?? roomKey;
      clearMessages();
      showNotice(`Switching to ${roomLabel}…`);
      if (socket && connected) {
        socket.emit("chat:join", { room: roomKey });
      }
    }

    function sendMessage() {
      const text = inputEl.value.trim();
      if (!text || !socket || !connected) return;
      socket.emit("chat:send", { message: text, room: currentRoom });
      inputEl.value = "";
    }

    sendBtn.addEventListener("click", sendMessage);
    inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    buildRoomButtons();
    buildHeaderBar();

    // Connect Socket.IO
    const token = Api.getToken();
    socket = io("/chat", { auth: { token } });

    socket.on("connect", () => {
      setStatus(true, "Connected");
      socket.emit("chat:join", { room: currentRoom });
    });

    socket.on("disconnect", () => {
      setStatus(false, "Disconnected — reconnecting…");
    });

    socket.on("connect_error", () => {
      setStatus(false, "Connection failed");
    });

    socket.on("chat:history", ({ room, messages }) => {
      if (room !== currentRoom) return;
      clearMessages();
      if (messages.length === 0) {
        showNotice("No messages yet — say hello!");
      } else {
        for (const msg of messages) {
          appendMessage(msg);
        }
      }
    });

    socket.on("chat:message", (msg) => {
      if (msg.room !== currentRoom) return;
      // Remove "no messages"/"switching" placeholder if present
      const placeholder = messagesEl.querySelector(".chat-notice");
      if (placeholder) placeholder.remove();
      appendMessage(msg);
    });

    socket.on("chat:error", ({ error }) => {
      if (typeof UI !== "undefined" && UI.toast) {
        UI.toast(error, "loss");
      }
    });

    // Refresh relative timestamps every 30s
    timestampTimer = setInterval(() => {
      messagesEl.querySelectorAll("[data-ts]").forEach(el => {
        const ts = Number(el.dataset.ts);
        if (ts) el.textContent = relativeTime(ts);
      });
    }, 30000);

    // Cleanup
    return function cleanup() {
      if (timestampTimer) clearInterval(timestampTimer);
      if (socket) socket.disconnect();
      socket = null;
    };
  }

  return { render };
})();
