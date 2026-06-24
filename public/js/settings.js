const SettingsGame = (() => {
  const RANK_INFO = {
    bronze:   { label: "Bronze",      color: "#cd7f32", bg: "rgba(205,127,50,0.15)" },
    silver:   { label: "Silver",      color: "#c0c0c0", bg: "rgba(192,192,192,0.15)" },
    gold:     { label: "Gold",        color: "#ffd700", bg: "rgba(255,215,0,0.15)" },
    platinum: { label: "Platinum",    color: "#b9f2ff", bg: "rgba(185,242,255,0.15)" },
    diamond:  { label: "Diamond",     color: "#00e5ff", bg: "rgba(0,229,255,0.15)" },
    owner:    { label: "👑 Owner",    color: "#a855f7", bg: "rgba(168,85,247,0.15)" },
  };

  const S = {
    page: `max-width:560px;`,
    section: `
      background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);
      padding:22px;margin-bottom:14px;
    `,
    sectionTitle: `margin:0 0 16px;font-size:1rem;font-weight:800;color:var(--text);`,
    form: `display:flex;flex-direction:column;gap:12px;`,
    label: `
      font-size:0.7rem;color:var(--text-dim);text-transform:uppercase;
      letter-spacing:0.05em;margin-bottom:4px;display:block;
    `,
    input: `
      background:var(--bg-elev);border:1px solid var(--border);color:var(--text);
      padding:10px 14px;border-radius:10px;font-size:0.92rem;width:100%;box-sizing:border-box;
    `,
    btn: `
      background:linear-gradient(135deg,var(--accent),#8b5cf6);color:white;
      border:none;border-radius:10px;padding:11px 22px;font-weight:700;
      font-size:0.92rem;cursor:pointer;width:fit-content;transition:filter 0.15s;
    `,
    note: `font-size:0.75rem;color:var(--text-dim);margin:4px 0 0;`,
  };

  function rankBadgeHTML(rank) {
    const r = RANK_INFO[rank] || RANK_INFO.bronze;
    return `<span style="padding:4px 12px;border-radius:999px;font-size:0.8rem;font-weight:700;
      color:${r.color};background:${r.bg};border:1px solid ${r.color}40;">${r.label}</span>`;
  }

  function render(container, accountState) {
    function rebuild() {
      const rank = (accountState.username || "").toLowerCase() === "ditol21" ? "owner" : (accountState.rank || "bronze");
      const displayName = accountState.nickname || accountState.username;

      const hasEngagement = typeof Engagement !== "undefined";
      const soundEnabled = hasEngagement ? Engagement.isSoundEnabled() : true;
      const soundVolume = hasEngagement ? Engagement.getSoundVolume() : 0.7;
      const browserNotifEnabled = hasEngagement ? Engagement.isBrowserNotifEnabled() : false;
      const toastEnabled = typeof UI !== "undefined" ? UI.isToastEnabled() : true;
      const langs = (typeof HowToPlay !== "undefined" && HowToPlay.LANGS) || { en: "🇬🇧 EN" };
      const currentLang = typeof HowToPlay !== "undefined" ? HowToPlay.getLang() : "en";

      container.innerHTML = `
        <div style="${S.page}">
          <div style="${S.section}">
            <h3 style="${S.sectionTitle}">Your Account</h3>
            <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
              <div>
                <div style="font-size:1.15rem;font-weight:800;">${displayName}</div>
                ${accountState.nickname
                  ? `<div style="font-size:0.82rem;color:var(--text-dim);">@${accountState.username}</div>`
                  : ""}
                <div style="margin-top:8px;">${rankBadgeHTML(rank)}</div>
              </div>
            </div>
          </div>

          <div style="${S.section}">
            <h3 style="${S.sectionTitle}">Nickname</h3>
            <div style="${S.form}">
              <div>
                <label style="${S.label}">Display name shown to others</label>
                <input id="s-nickname" type="text" style="${S.input}"
                  placeholder="Leave blank to use your username"
                  value="${accountState.nickname || ""}" maxlength="30" autocomplete="off" />
                <p style="${S.note}">1–30 characters. Clears if left blank.</p>
              </div>
              <button type="button" id="s-nickname-btn" style="${S.btn}">Save Nickname</button>
            </div>
          </div>

          <div style="${S.section}">
            <h3 style="${S.sectionTitle}">Change Username</h3>
            <div style="${S.form}">
              <div>
                <label style="${S.label}">New Username</label>
                <input id="s-newuser" type="text" style="${S.input}"
                  placeholder="${accountState.username}" maxlength="20"
                  autocomplete="off" />
                <p style="${S.note}">3–20 chars · letters, numbers, underscore only.</p>
              </div>
              <button type="button" id="s-username-btn" style="${S.btn}">Change Username</button>
            </div>
          </div>

          <div style="${S.section}">
            <h3 style="${S.sectionTitle}">Change Password</h3>
            <div style="${S.form}">
              <div>
                <label style="${S.label}">Current Password</label>
                <input id="s-cur-pw" type="password" style="${S.input}"
                  autocomplete="current-password" />
              </div>
              <div>
                <label style="${S.label}">New Password</label>
                <input id="s-new-pw" type="password" style="${S.input}"
                  placeholder="8+ characters" autocomplete="new-password" />
              </div>
              <button type="button" id="s-pw-btn" style="${S.btn}">Change Password</button>
            </div>
          </div>

          <div style="${S.section}">
            <h3 style="${S.sectionTitle}">🔊 Sound</h3>
            <div style="${S.form}">
              <label style="display:flex;align-items:center;gap:10px;cursor:pointer;">
                <input id="s-sound-enabled" type="checkbox" style="width:18px;height:18px;" ${soundEnabled ? "checked" : ""} />
                <span style="color:var(--text);font-size:0.92rem;">Enable sound effects</span>
              </label>
              <div>
                <label style="${S.label}">Volume</label>
                <div style="display:flex;align-items:center;gap:12px;">
                  <input id="s-sound-volume" type="range" min="0" max="100" step="1"
                    value="${Math.round(soundVolume * 100)}" style="flex:1;" />
                  <span id="s-sound-volume-val" style="color:var(--text-dim);font-size:0.85rem;min-width:34px;text-align:right;">${Math.round(soundVolume * 100)}%</span>
                </div>
              </div>
            </div>
          </div>

          <div style="${S.section}">
            <h3 style="${S.sectionTitle}">🌐 Language</h3>
            <div style="${S.form}">
              <div>
                <label style="${S.label}">Tutorials &amp; How to Play language</label>
                <select id="s-language" style="${S.input}">
                  ${Object.entries(langs).map(([code, label]) =>
                    `<option value="${code}" ${code === currentLang ? "selected" : ""}>${label}</option>`).join("")}
                </select>
                <p style="${S.note}">Applies to the "How to Play" guides for every game.</p>
              </div>
            </div>
          </div>

          <div style="${S.section}">
            <h3 style="${S.sectionTitle}">🔔 Notifications</h3>
            <div style="${S.form}">
              <label style="display:flex;align-items:center;gap:10px;cursor:pointer;">
                <input id="s-notif-toast" type="checkbox" style="width:18px;height:18px;" ${toastEnabled ? "checked" : ""} />
                <span style="color:var(--text);font-size:0.92rem;">In-app toast notifications</span>
              </label>
              <label style="display:flex;align-items:center;gap:10px;cursor:pointer;">
                <input id="s-notif-browser" type="checkbox" style="width:18px;height:18px;" ${browserNotifEnabled ? "checked" : ""} />
                <span style="color:var(--text);font-size:0.92rem;">Browser notifications for big wins (when tab isn't focused)</span>
              </label>
              <p id="s-notif-permission-note" style="${S.note}"></p>
            </div>
          </div>
        </div>
      `;

      async function save(body, successMsg) {
        try {
          const data = await Api.patch("/settings", body);
          if (data.user) {
            accountState.username = data.user.username;
            accountState.nickname = data.user.nickname;
            accountState.rank = data.user.rank;
            await App.refreshAccount();
          }
          UI.toast(successMsg, "win");
          return true;
        } catch (err) {
          UI.toast(err.message || "Failed to save.", "loss");
          return false;
        }
      }

      container.querySelector("#s-nickname-btn").addEventListener("click", async () => {
        const val = container.querySelector("#s-nickname").value.trim();
        const ok = await save({ nickname: val || null }, val ? "Nickname saved!" : "Nickname removed.");
        if (ok) rebuild();
      });

      container.querySelector("#s-username-btn").addEventListener("click", async () => {
        const val = container.querySelector("#s-newuser").value.trim();
        if (!val) { UI.toast("Enter a new username.", "loss"); return; }
        if (val === accountState.username) { UI.toast("That's already your username.", "info"); return; }
        const ok = await save({ newUsername: val }, "Username changed!");
        if (ok) rebuild();
      });

      container.querySelector("#s-pw-btn").addEventListener("click", async () => {
        const cur = container.querySelector("#s-cur-pw").value;
        const nw = container.querySelector("#s-new-pw").value;
        if (!cur || !nw) { UI.toast("Fill in both password fields.", "loss"); return; }
        const ok = await save({ currentPassword: cur, newPassword: nw }, "Password changed!");
        if (ok) {
          container.querySelector("#s-cur-pw").value = "";
          container.querySelector("#s-new-pw").value = "";
        }
      });

      container.querySelector("#s-sound-enabled").addEventListener("change", (e) => {
        if (hasEngagement) Engagement.setSoundEnabled(e.target.checked);
      });

      const volumeSlider = container.querySelector("#s-sound-volume");
      const volumeVal = container.querySelector("#s-sound-volume-val");
      volumeSlider.addEventListener("input", (e) => {
        const pct = Number(e.target.value);
        volumeVal.textContent = `${pct}%`;
        if (hasEngagement) Engagement.setSoundVolume(pct / 100);
      });

      container.querySelector("#s-language").addEventListener("change", (e) => {
        if (typeof HowToPlay !== "undefined") HowToPlay.setLang(e.target.value);
        UI.toast("Language preference saved.", "win");
      });

      container.querySelector("#s-notif-toast").addEventListener("change", (e) => {
        if (typeof UI !== "undefined") UI.setToastEnabled(e.target.checked);
        if (e.target.checked) UI.toast("Toast notifications enabled.", "info");
      });

      const browserNotifNote = container.querySelector("#s-notif-permission-note");
      function renderPermissionNote() {
        if (!("Notification" in window)) {
          browserNotifNote.textContent = "Your browser doesn't support notifications.";
        } else if (Notification.permission === "denied") {
          browserNotifNote.textContent = "Notifications are blocked in your browser settings.";
        } else {
          browserNotifNote.textContent = "";
        }
      }
      renderPermissionNote();

      container.querySelector("#s-notif-browser").addEventListener("change", async (e) => {
        if (!hasEngagement) return;
        if (e.target.checked) {
          const permission = await Engagement.requestNotifPermission();
          if (permission !== "granted") {
            e.target.checked = false;
            Engagement.setBrowserNotifEnabled(false);
            renderPermissionNote();
            UI.toast("Allow notifications in your browser to enable this.", "loss");
            return;
          }
        }
        Engagement.setBrowserNotifEnabled(e.target.checked);
        renderPermissionNote();
      });
    }

    rebuild();
  }

  return { render };
})();
