/* Private messages (1-on-1 DMs) over the /chat socket. */
const MessagesGame = (() => {
  let socket = null;
  let _container = null;
  let _myName = null;
  let activeWith = null;
  let listenersBound = false;

  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function el(id) { return _container && _container.querySelector(id); }

  function renderThreads(threads) {
    const host = el("#dm-threads");
    if (!host) return;
    if (!threads.length) {
      host.innerHTML = `<p style="color:var(--text-dim);font-size:0.88rem;padding:8px 0;">No conversations yet. Enter a username above to start one.</p>`;
      return;
    }
    host.innerHTML = threads.map((t) => `
      <div class="dm-thread-row" data-user="${esc(t.name)}" style="display:flex;justify-content:space-between;gap:10px;padding:10px 12px;border:1px solid var(--border);border-radius:10px;margin-bottom:8px;cursor:pointer;background:var(--bg-elev);">
        <span style="font-weight:700;">${esc(t.name)}</span>
        <span style="color:var(--text-dim);font-size:0.82rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:55%;">${esc(t.last)}</span>
      </div>`).join("");
    host.querySelectorAll(".dm-thread-row").forEach((row) => {
      row.addEventListener("click", () => openThread(row.dataset.user));
    });
  }

  function renderMessages(messages) {
    const box = el("#dm-messages");
    if (!box) return;
    box.innerHTML = messages.map((m) => {
      const mine = m.fromName && _myName && m.fromName.toLowerCase() === _myName.toLowerCase();
      return `<div style="display:flex;justify-content:${mine ? "flex-end" : "flex-start"};margin-bottom:6px;">
        <div style="max-width:75%;padding:8px 12px;border-radius:12px;font-size:0.9rem;background:${mine ? "linear-gradient(135deg,#f3c14b,#d8a32a)" : "var(--bg-elev)"};color:${mine ? "#2a1c00" : "var(--text)"};">${esc(m.message)}</div>
      </div>`;
    }).join("");
    box.scrollTop = box.scrollHeight;
  }

  function openThread(username) {
    if (!username) return;
    activeWith = username;
    const pane = el("#dm-thread");
    if (pane) pane.style.display = "";
    const header = el("#dm-thread-header");
    if (header) header.textContent = `💬 ${username}`;
    const box = el("#dm-messages");
    if (box) box.innerHTML = `<p style="color:var(--text-dim);">Loading…</p>`;
    socket.emit("dm:history", { withUsername: username });
  }

  function send() {
    const input = el("#dm-input");
    if (!input || !activeWith) return;
    const message = input.value.trim();
    if (!message) return;
    socket.emit("dm:send", { toUsername: activeWith, message });
    input.value = "";
  }

  function bindSocket() {
    if (listenersBound) return;
    listenersBound = true;
    socket.on("dm:threads", (d) => renderThreads((d && d.threads) || []));
    socket.on("dm:history", (d) => {
      if (!activeWith || (d.withUsername && d.withUsername.toLowerCase() !== activeWith.toLowerCase())) {
        if (d.withUsername) activeWith = d.withUsername; // server canonicalised the name
      }
      renderMessages((d && d.messages) || []);
    });
    socket.on("dm:message", (m) => {
      const partner = (m.fromName && _myName && m.fromName.toLowerCase() === _myName.toLowerCase()) ? m.toName : m.fromName;
      if (activeWith && partner && partner.toLowerCase() === activeWith.toLowerCase()) {
        const box = el("#dm-messages");
        if (box) { renderMessagesAppend(m); }
      } else if (window.UI && UI.toast) {
        UI.toast(`💬 New message from ${m.fromName}`, "info");
      }
      socket.emit("dm:threads"); // refresh the list
    });
    socket.on("dm:error", (e) => { if (window.UI && UI.toast) UI.toast((e && e.error) || "Message failed", "loss"); });
  }

  function renderMessagesAppend(m) {
    const box = el("#dm-messages");
    if (!box) return;
    const mine = m.fromName && _myName && m.fromName.toLowerCase() === _myName.toLowerCase();
    const div = document.createElement("div");
    div.style.cssText = `display:flex;justify-content:${mine ? "flex-end" : "flex-start"};margin-bottom:6px;`;
    div.innerHTML = `<div style="max-width:75%;padding:8px 12px;border-radius:12px;font-size:0.9rem;background:${mine ? "linear-gradient(135deg,#f3c14b,#d8a32a)" : "var(--bg-elev)"};color:${mine ? "#2a1c00" : "var(--text)"};">${esc(m.message)}</div>`;
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
  }

  function render(container, accountState) {
    _container = container;
    _myName = accountState && accountState.username;
    if (!socket) socket = io("/chat", { auth: { token: Api.getToken() } });

    container.innerHTML = `
      <div class="game-panel" style="max-width:760px;margin:0 auto;">
        <h2 style="margin:0 0 14px;">💬 Messages</h2>
        <div style="display:flex;gap:8px;margin-bottom:16px;">
          <input id="dm-new-user" placeholder="Username to message…" autocapitalize="off" autocorrect="off" style="flex:1;" />
          <button id="dm-new-btn" class="primary-btn">Open</button>
        </div>
        <div id="dm-threads"></div>
        <div id="dm-thread" style="display:none;margin-top:16px;border-top:1px solid var(--border);padding-top:14px;">
          <div id="dm-thread-header" style="font-weight:800;margin-bottom:10px;"></div>
          <div id="dm-messages" style="height:300px;overflow-y:auto;padding:8px;background:var(--bg);border:1px solid var(--border);border-radius:10px;margin-bottom:10px;"></div>
          <div style="display:flex;gap:8px;">
            <input id="dm-input" placeholder="Type a message…" style="flex:1;" />
            <button id="dm-send" class="primary-btn">Send</button>
          </div>
        </div>
      </div>`;

    bindSocket();
    socket.emit("dm:threads");

    el("#dm-new-btn").addEventListener("click", () => {
      const u = el("#dm-new-user").value.trim();
      if (u) openThread(u);
    });
    el("#dm-new-user").addEventListener("keydown", (e) => { if (e.key === "Enter") el("#dm-new-btn").click(); });
    el("#dm-send").addEventListener("click", send);
    el("#dm-input").addEventListener("keydown", (e) => { if (e.key === "Enter") send(); });
  }

  return { render };
})();
