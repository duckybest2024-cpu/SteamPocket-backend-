const RaffleGame = (() => {
  function render(container, state) {
    let socket = null;
    let nextDrawAt = Date.now() + 300_000;
    let timerInterval = null;
    let myTickets = [];

    container.innerHTML = `
      <div class="game-layout">
        <aside class="bet-panel">
          <div class="bp-tabs">
            <button class="bp-tab active">Manual</button>
            <button class="bp-tab">Auto</button>
          </div>
          <div>
            <div class="bp-label">Number of Tickets</div>
            <div class="bp-input-row">
              <input id="rf-count" type="number" value="5" min="1" max="100" />
              <button id="rf-less" class="quick-btn">−5</button>
              <button id="rf-more" class="quick-btn">+5</button>
            </div>
          </div>
          <div style="font-size:0.82rem;color:var(--text-dim);line-height:1.5">
            Buy tickets — every 5 minutes a winner is drawn. More tickets = better odds!
          </div>
          <hr class="bp-divider" />
          <button id="rf-buy" class="play-btn">Buy Tickets (<span id="rf-price-label">10 🪙</span> each)</button>
          <div id="rf-result" class="result-banner"></div>
        </aside>
        <div class="game-canvas">
          <div class="stat-boxes">
            <div class="stat-box">
              <span class="sb-label">Ticket Price</span>
              <span class="sb-value" id="rf-price" style="color:var(--gold)">10 🪙</span>
            </div>
            <div class="stat-box">
              <span class="sb-label">Tickets Sold</span>
              <span class="sb-value" id="rf-total">0</span>
            </div>
            <div class="stat-box">
              <span class="sb-label">Draw In</span>
              <span class="sb-value" id="rf-countdown" style="color:var(--accent)">—</span>
            </div>
          </div>
          <div id="rf-my-tickets" style="background:var(--bg-elev);border:1px solid var(--border);border-radius:10px;padding:12px;font-size:0.85rem;color:var(--text-dim)">
            You have no tickets this round yet.
          </div>
          <div>
            <div style="font-size:0.75rem;color:var(--text-dim);margin-bottom:6px;text-transform:uppercase;letter-spacing:.06em">Recent Winners</div>
            <div id="rf-history" style="display:flex;flex-direction:column;gap:4px"></div>
          </div>
        </div>
      </div>`;

    const priceEl = container.querySelector("#rf-price");
    const priceLabelEl = container.querySelector("#rf-price-label");
    const totalEl = container.querySelector("#rf-total");
    const cdEl = container.querySelector("#rf-countdown");
    const countEl = container.querySelector("#rf-count");
    const buyBtn = container.querySelector("#rf-buy");
    const myTicketsEl = container.querySelector("#rf-my-tickets");
    const resultEl = container.querySelector("#rf-result");
    const historyEl = container.querySelector("#rf-history");

    container.querySelector("#rf-less").addEventListener("click", () => {
      countEl.value = Math.max(1, Number(countEl.value) - 5);
    });
    container.querySelector("#rf-more").addEventListener("click", () => {
      countEl.value = Math.min(100, Number(countEl.value) + 5);
    });
    container.querySelectorAll(".bp-tab").forEach(t =>
      t.addEventListener("click", function() {
        container.querySelectorAll(".bp-tab").forEach(x => x.classList.remove("active"));
        this.classList.add("active");
      })
    );

    function startTimer() {
      if (timerInterval) clearInterval(timerInterval);
      timerInterval = setInterval(() => {
        const rem = Math.max(0, Math.ceil((nextDrawAt - Date.now()) / 1000));
        const m = Math.floor(rem / 60);
        const s = rem % 60;
        cdEl.textContent = `${m}:${String(s).padStart(2, "0")}`;
        if (rem === 0) { clearInterval(timerInterval); cdEl.textContent = "🎰"; }
      }, 1000);
    }

    socket = io("/raffle", { auth: { token: Api.getToken() } });

    socket.on("state", ({ tickets, nextDrawAt: nda, ticketPrice, history }) => {
      nextDrawAt = nda;
      totalEl.textContent = tickets;
      const priceChips = ticketPrice / 100;
      priceEl.textContent = priceChips + " 🪙";
      priceLabelEl.textContent = priceChips + " 🪙";
      startTimer();
      renderHistory(history);
    });

    socket.on("tickets_ok", ({ count, ticketNums }) => {
      myTickets = [...myTickets, ...ticketNums];
      myTicketsEl.innerHTML = `<span style="color:var(--text)">Your tickets this round: </span>${myTickets.map((n) => `<span style="background:var(--accent);color:white;border-radius:4px;padding:2px 7px;margin:2px;display:inline-block;font-size:0.8rem">#${n}</span>`).join("")}`;
      buyBtn.disabled = false;
      App.refreshAccount();
    });

    socket.on("draw_result", ({ winner, winnerTicket, prize, totalTickets }) => {
      const isWinner = winner === state.username;
      resultEl.className = "result-banner " + (isWinner ? "win" : "loss");
      resultEl.innerHTML = isWinner
        ? `🏟️ YOUR ticket #${winnerTicket} was drawn! +${(prize/100).toLocaleString()} chips 🏆`
        : `🏟️ Ticket #${winnerTicket} (${winner}) wins ${(prize/100).toLocaleString()} chips from ${totalTickets} tickets`;
      if (isWinner) App.refreshAccount();
      myTickets = [];
      myTicketsEl.textContent = "You have no tickets this round yet.";
    });

    socket.on("error", (msg) => { UI.toast(msg, "loss"); buyBtn.disabled = false; });

    buyBtn.addEventListener("click", () => {
      const count = parseInt(countEl.value, 10);
      if (!count || count < 1 || count > 100) return UI.toast("1-100 tickets per purchase", "loss");
      buyBtn.disabled = true;
      socket.emit("buy_tickets", { count });
    });

    function renderHistory(history) {
      historyEl.innerHTML = (history || []).map((h) =>
        `<div style="display:flex;justify-content:space-between;background:var(--bg-elev);border:1px solid var(--border);border-radius:8px;padding:6px 10px;font-size:0.82rem">
          <span><strong>${h.winner}</strong></span>
          <span style="color:var(--gold)">+${(h.prize/100).toLocaleString()} 🪙</span>
          <span style="color:var(--text-dim)">${h.tickets} tickets</span>
        </div>`
      ).join("");
    }

    return () => { if (socket) socket.disconnect(); if (timerInterval) clearInterval(timerInterval); };
  }

  return { render };
})();
