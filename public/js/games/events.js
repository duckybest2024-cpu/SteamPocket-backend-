const EventsGame = (() => {
  function fmtChips(cents) {
    return Math.floor(cents / 100).toLocaleString() + " 🪙";
  }
  function escHtml(str) {
    return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  }

  const HOST_TIERS = ["gold_patron","platinum_patron","diamond_patron","netherite_patron"];

  function canHost(state) {
    return !!(state.isAdmin || HOST_TIERS.includes(state.patreonTier));
  }

  function render(container, state) {
    let events = [];
    let myEvents = [];

    container.innerHTML = `
      <div class="game-layout">
        <aside class="bet-panel">
          ${canHost(state) ? `
          <div>
            <div class="bp-label">Host an Event</div>
            <div style="display:flex;flex-direction:column;gap:8px">
              <input id="ev-title" placeholder="Event title" style="padding:8px;background:var(--bg);border:1px solid var(--border);border-radius:8px;color:var(--text);width:100%;box-sizing:border-box" />
              <textarea id="ev-desc" placeholder="Description (optional)" rows="2" style="padding:8px;background:var(--bg);border:1px solid var(--border);border-radius:8px;color:var(--text);width:100%;box-sizing:border-box;resize:none;font-family:inherit"></textarea>
              <div class="bp-label">Entry Fee (chips, 0 = free)</div>
              <div class="bp-input-row">
                <input id="ev-fee" type="number" value="0" min="0" step="1" />
                <button class="quick-btn" id="ev-fee-half">½</button>
                <button class="quick-btn" id="ev-fee-dbl">2×</button>
              </div>
              <div class="bp-label">Max Players</div>
              <input id="ev-max" type="number" value="20" min="2" style="padding:8px;background:var(--bg);border:1px solid var(--border);border-radius:8px;color:var(--text);width:100%;box-sizing:border-box" />
            </div>
          </div>
          <button id="ev-create-btn" class="play-btn">Create Event</button>
          <hr class="bp-divider" />
          <div id="ev-host-earnings" style="font-size:0.82rem;color:var(--win);text-align:center"></div>
          ` : `
          <div style="font-size:0.82rem;color:var(--text-dim);line-height:1.6">
            <strong style="color:var(--accent-2)">Gold Patron</strong> or higher can host events and earn a cut of every entry fee!<br/><br/>
            Join open events below to compete for chip prizes.
          </div>
          <hr class="bp-divider" />
          `}
          <button id="ev-refresh-btn" class="quick-btn" style="width:100%;text-align:center;margin-top:auto">🔄 Refresh</button>
        </aside>
        <div class="game-canvas">
          ${canHost(state) ? `
          <div style="background:var(--bg-elev);border:1px solid var(--border);border-radius:10px;padding:14px">
            <div style="font-size:0.78rem;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:var(--text-dim);margin-bottom:10px">My Events</div>
            <div id="ev-my-list"><div style="color:var(--text-dim);font-size:0.85rem;text-align:center;padding:12px 0">No events hosted yet.</div></div>
          </div>
          ` : ""}
          <div style="background:var(--bg-elev);border:1px solid var(--border);border-radius:10px;padding:14px">
            <div style="font-size:0.78rem;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:var(--text-dim);margin-bottom:10px">Open Events (<span id="ev-count">0</span>)</div>
            <div id="ev-list"><div style="color:var(--text-dim);font-size:0.85rem;text-align:center;padding:12px 0">No open events right now.</div></div>
          </div>
        </div>
      </div>`;

    const feeEl = container.querySelector("#ev-fee");
    if (feeEl) {
      container.querySelector("#ev-fee-half")?.addEventListener("click", () => {
        feeEl.value = Math.max(0, Math.floor(Number(feeEl.value) * 0.5));
      });
      container.querySelector("#ev-fee-dbl")?.addEventListener("click", () => {
        feeEl.value = Math.floor(Number(feeEl.value) * 2);
      });
    }

    function renderEvents() {
      const listEl = container.querySelector("#ev-list");
      const countEl = container.querySelector("#ev-count");
      if (countEl) countEl.textContent = String(events.length);
      if (!listEl) return;
      if (!events.length) {
        listEl.innerHTML = `<div style="color:var(--text-dim);font-size:0.85rem;text-align:center;padding:12px 0">No open events right now.</div>`;
        return;
      }
      listEl.innerHTML = events.map(ev => {
        const isJoined = ev.participants?.some(p => p.username === state.username);
        const isMine = ev.hostName === state.username;
        const spots = ev.maxPlayers - (ev.participants?.length || 0);
        return `<div style="padding:12px 0;border-bottom:1px solid var(--border)">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
            <div style="flex:1;min-width:0">
              <div style="font-weight:700;font-size:0.95rem">${escHtml(ev.title)}</div>
              <div style="font-size:0.8rem;color:var(--text-dim);margin-top:2px">by ${escHtml(ev.hostName)} · ${ev.entryFee > 0 ? fmtChips(ev.entryFee) + " entry" : "Free"} · ${spots} spot${spots !== 1 ? "s" : ""} left</div>
              ${ev.description ? `<div style="font-size:0.8rem;color:var(--text-dim);margin-top:4px">${escHtml(ev.description)}</div>` : ""}
              <div style="font-size:0.8rem;color:var(--win);margin-top:4px">🏆 Prize pool: ${fmtChips(ev.prizePool)}</div>
            </div>
            <div style="flex-shrink:0;display:flex;flex-direction:column;gap:4px">
              ${isMine
                ? `<button class="ev-complete-btn quick-btn" data-id="${ev.id}" style="color:var(--win);border-color:var(--win)">Pick Winner</button>
                   <button class="ev-cancel-btn quick-btn" data-id="${ev.id}" style="color:var(--loss);border-color:rgba(248,113,113,0.5)">Cancel</button>`
                : isJoined
                  ? `<span style="color:var(--win);font-size:0.85rem;font-weight:700">✅ Joined</span>`
                  : `<button class="ev-join-btn" data-id="${ev.id}" style="background:linear-gradient(135deg,#34d399,#10b981);color:#071a10;border:none;border-radius:8px;padding:7px 16px;font-weight:700;font-size:0.82rem;cursor:pointer">Join</button>`}
            </div>
          </div>
        </div>`;
      }).join("");

      listEl.querySelectorAll(".ev-join-btn").forEach(btn => btn.addEventListener("click", () => joinEvent(btn.dataset.id)));
      listEl.querySelectorAll(".ev-complete-btn").forEach(btn => btn.addEventListener("click", () => completeEvent(btn.dataset.id)));
      listEl.querySelectorAll(".ev-cancel-btn").forEach(btn => btn.addEventListener("click", () => cancelEvent(btn.dataset.id)));
    }

    function renderMyEvents() {
      const myListEl = container.querySelector("#ev-my-list");
      if (!myListEl) return;
      if (!myEvents.length) {
        myListEl.innerHTML = `<div style="color:var(--text-dim);font-size:0.85rem;text-align:center;padding:12px 0">No events hosted yet.</div>`;
        return;
      }
      let totalEarned = 0;
      myListEl.innerHTML = myEvents.map(ev => {
        totalEarned += ev.hostEarned || 0;
        const statusColor = ev.status === "completed" ? "var(--win)" : ev.status === "cancelled" ? "var(--loss)" : "var(--accent)";
        return `<div style="padding:8px 0;border-bottom:1px solid var(--border);font-size:0.85rem">
          <div style="display:flex;justify-content:space-between">
            <strong>${escHtml(ev.title)}</strong>
            <span style="color:${statusColor}">${ev.status}</span>
          </div>
          <div style="color:var(--text-dim);margin-top:2px">${ev.participants?.length || 0} players · Earned: ${fmtChips(ev.hostEarned || 0)} · Prize: ${fmtChips(ev.prizePool)}</div>
          ${ev.winnerName ? `<div style="color:var(--win);margin-top:2px">🏆 ${escHtml(ev.winnerName)}</div>` : ""}
        </div>`;
      }).join("");
      const earningsEl = container.querySelector("#ev-host-earnings");
      if (earningsEl && totalEarned > 0) earningsEl.textContent = `💰 Total earned: ${fmtChips(totalEarned)}`;
    }

    async function loadEvents() {
      try {
        const data = await Api.get("/events");
        events = data.events || [];
        renderEvents();
      } catch { UI.toast("Failed to load events", "loss"); }
    }

    async function loadMyEvents() {
      if (!canHost(state)) return;
      try {
        const data = await Api.get("/events/my");
        myEvents = data.events || [];
        renderMyEvents();
      } catch {}
    }

    async function joinEvent(id) {
      try {
        await Api.post(`/events/${id}/join`, {});
        UI.toast("Joined event!", "win");
        App.refreshAccount();
        await loadEvents();
      } catch (err) { UI.toast(err.message || "Failed to join", "loss"); }
    }

    async function completeEvent(id) {
      try {
        const result = await Api.post(`/events/${id}/complete`, {});
        UI.toast(`🏆 ${result.winnerName} wins ${fmtChips(result.prizePool)}!`, "win");
        App.refreshAccount();
        await Promise.all([loadEvents(), loadMyEvents()]);
      } catch (err) { UI.toast(err.message || "Failed to complete", "loss"); }
    }

    async function cancelEvent(id) {
      if (!confirm("Cancel this event and refund all participants?")) return;
      try {
        await Api.delete(`/events/${id}`);
        UI.toast("Event cancelled. Participants refunded.", "info");
        App.refreshAccount();
        await Promise.all([loadEvents(), loadMyEvents()]);
      } catch (err) { UI.toast(err.message || "Failed to cancel", "loss"); }
    }

    const createBtn = container.querySelector("#ev-create-btn");
    if (createBtn) {
      createBtn.addEventListener("click", async () => {
        const title = container.querySelector("#ev-title")?.value?.trim();
        const description = container.querySelector("#ev-desc")?.value?.trim() || "";
        const entryFee = Math.round(Number(container.querySelector("#ev-fee")?.value || "0") * 100);
        const maxPlayers = Number(container.querySelector("#ev-max")?.value || "20");
        if (!title) return UI.toast("Enter an event title", "loss");
        createBtn.disabled = true;
        try {
          await Api.post("/events", { title, description, entryFee, maxPlayers });
          UI.toast("Event created!", "win");
          container.querySelector("#ev-title").value = "";
          container.querySelector("#ev-desc").value = "";
          container.querySelector("#ev-fee").value = "0";
          await Promise.all([loadEvents(), loadMyEvents()]);
        } catch (err) {
          UI.toast(err.message || "Failed to create event", "loss");
        } finally {
          createBtn.disabled = false;
        }
      });
    }

    container.querySelector("#ev-refresh-btn")?.addEventListener("click", () => { loadEvents(); loadMyEvents(); });

    loadEvents();
    loadMyEvents();
  }

  return { render };
})();
