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
    { key: "general",     label: "General" },
    { key: "vip",         label: "VIP" },
    { key: "highrollers", label: "High Rollers" },
    { key: "offtopic",    label: "Off Topic" },
    { key: "sports",      label: "Sports" },
  ];

  const S = {
    panel: `background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:24px;`,
    layout: `display:flex;gap:18px;flex-wrap:wrap;height:calc(100vh - 180px);min-height:400px;`,
    left: `flex:0 0 180px;min-width:140px;display:flex;flex-direction:column;gap:8px;`,
    right: `flex:2;min-width:280px;display:flex;flex-direction:column;gap:0;background:var(--bg-elev);border:1px solid var(--border);border-radius:12px;overflow:hidden;`,
    sectionTitle: `font-size:0.82rem;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-dim);margin:0 0 10px;`,
    roomBtn: `width:100%;text-align:left;padding:10px 14px;background:var(--bg-elev);border:1px solid var(--border);border-radius:10px;color:var(--text);cursor:pointer;font-size:0.88rem;font-weight:600;transition:background 0.15s,border-color 0.15s;`,
    roomBtnActive: `width:100%;text-align:left;padding:10px 14px;background:var(--accent);border:1px solid var(--accent);border-radius:10px;color:#071c10;cursor:pointer;font-size:0.88rem;font-weight:700;`,
    statusBar: `padding:10px 16px;background:var(--bg-card);border-bottom:1px solid var(--border);display:flex;align-items:center;gap:8px;font-size:0.82rem;`,
    messagesArea: `flex:1;overflow-y:auto;padding:14px 16px;display:flex;flex-direction:column;gap:8px;`,
    msgRow: `display:flex;flex-direction:column;gap:2px;`,
    msgHeader: `display:flex;align-items:center;gap:8px;`,
    msgBadge: `font-size:0.75rem;font-weight:800;padding:2px 8px;border-radius:20px;`,
    msgTime: `font-size:0.72rem;color:var(--text-dim);`,
    msgText: `font-size:0.9rem;color:var(--text);padding-left:4px;word-break:break-word;`,
    inputRow: `display:flex;gap:8px;padding:12px 16px;border-top:1px solid var(--border);background:var(--bg-card);`,
    sendBtn: `padding:10px 18px;background:linear-gradient(135deg,#34d399,#10b981);color:#071a10;border:none;border-radius:8px;font-weight:700;font-size:0.88rem;cursor:pointer;white-space:nowrap;`,
    statusDot: (connected) => `width:8px;height:8px;border-radius:50%;background:${connected ? "#34d399" : "#f87171"};display:inline-block;`,
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

  function renderMessage(msg) {
    const color = RANK_COLORS[msg.rank] ?? RANK_COLORS.bronze;
    const div = document.createElement("div");
    div.style.cssText = S.msgRow;
    div.innerHTML = `
      <div style="${S.msgHeader}">
        <span style="${S.msgBadge}background:${color}22;color:${color};border:1px solid ${color}44;">${escHtml(msg.username)}</span>
        <span style="${S.msgTime}" data-ts="${msg.timestamp}">${relativeTime(msg.timestamp)}</span>
      </div>
      <div style="${S.msgText}">${escHtml(msg.message)}</div>
    `;
    return div;
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

    container.innerHTML = `
      <div class="game-panel" style="${S.panel}">
        <h2 style="margin:0 0 18px;font-size:1.3rem;">💬 Chat</h2>
        <div style="${S.layout}">

          <!-- LEFT: room list -->
          <div style="${S.left}">
            <p style="${S.sectionTitle}">Rooms</p>
            <div id="chat-room-list" style="display:flex;flex-direction:column;gap:6px;"></div>
          </div>

          <!-- RIGHT: chat panel -->
          <div style="${S.right}">
            <!-- status bar -->
            <div style="${S.statusBar}" id="chat-status-bar">
              <span id="chat-status-dot" style="${S.statusDot(false)}"></span>
              <span id="chat-status-text" style="color:var(--text-dim);">Connecting…</span>
            </div>

            <!-- messages -->
            <div id="chat-messages" style="${S.messagesArea}"></div>

            <!-- input -->
            <div style="${S.inputRow}">
              <input id="chat-input" type="text" maxlength="300" placeholder="Type a message…"
                style="flex:1;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:10px 14px;color:var(--text);font-size:0.9rem;" />
              <button id="chat-send-btn" style="${S.sendBtn}">Send</button>
            </div>
          </div>

        </div>
      </div>
    `;

    const roomList    = document.getElementById("chat-room-list");
    const messagesEl  = document.getElementById("chat-messages");
    const statusDot   = document.getElementById("chat-status-dot");
    const statusText  = document.getElementById("chat-status-text");
    const inputEl     = document.getElementById("chat-input");
    const sendBtn     = document.getElementById("chat-send-btn");

    // Build room buttons
    function buildRoomButtons() {
      roomList.innerHTML = "";
      for (const r of ROOMS) {
        const btn = document.createElement("button");
        btn.style.cssText = r.key === currentRoom ? S.roomBtnActive : S.roomBtn;
        btn.textContent = r.label;
        btn.addEventListener("click", () => {
          if (r.key === currentRoom) return;
          switchRoom(r.key);
        });
        roomList.appendChild(btn);
      }
    }

    function setStatus(isConnected, text) {
      connected = isConnected;
      statusDot.style.cssText = S.statusDot(isConnected);
      statusText.textContent = text;
      statusText.style.color = isConnected ? "var(--win)" : "var(--text-dim)";
    }

    function appendMessage(msg) {
      const el = renderMessage(msg);
      messagesEl.appendChild(el);
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    function clearMessages() {
      messagesEl.innerHTML = "";
    }

    function showSwitching(roomLabel) {
      clearMessages();
      const notice = document.createElement("div");
      notice.style.cssText = "color:var(--text-dim);font-size:0.85rem;text-align:center;padding:20px;";
      notice.textContent = `Switching to ${roomLabel}…`;
      messagesEl.appendChild(notice);
    }

    function switchRoom(roomKey) {
      currentRoom = roomKey;
      buildRoomButtons();
      const roomLabel = ROOMS.find(r => r.key === roomKey)?.label ?? roomKey;
      showSwitching(roomLabel);
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
        const notice = document.createElement("div");
        notice.style.cssText = "color:var(--text-dim);font-size:0.85rem;text-align:center;padding:20px;";
        notice.textContent = "No messages yet — say hello!";
        messagesEl.appendChild(notice);
      } else {
        for (const msg of messages) {
          appendMessage(msg);
        }
      }
    });

    socket.on("chat:message", (msg) => {
      if (msg.room !== currentRoom) return;
      // Remove "no messages" placeholder if present
      const placeholder = messagesEl.querySelector("div[style*='text-align:center']");
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
