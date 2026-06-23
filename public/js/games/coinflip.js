const CoinflipGame = (() => {
  function fmtChips(cents) {
    return (Math.floor(cents / 100)).toLocaleString() + " 🪙";
  }

  function render(container, accountState) {
    let socket = null;
    let myChallengeId = null;
    let challenges = [];
    let recentResults = [];

    container.innerHTML = `
      <div class="game-layout">
        <aside class="bet-panel">
          <div class="bp-tabs">
            <button class="bp-tab active">Manual</button>
            <button class="bp-tab">Auto</button>
          </div>
          <div>
            <div class="bp-label">Bet Amount (chips)</div>
            <div class="bp-input-row">
              <input type="number" id="cf-amount" value="10" min="1" step="1" />
              <button id="cf-half" class="quick-btn">&frac12;</button>
              <button id="cf-dbl" class="quick-btn">2&times;</button>
            </div>
          </div>
          <div style="font-size:0.82rem;color:var(--text-dim);line-height:1.5">
            Create a challenge and wait for another player to join. Winner takes <strong style="color:var(--win)">1.98&times;</strong> the bet. You can cancel before someone joins.
          </div>
          <hr class="bp-divider" />
          <div id="cf-status" style="font-size:0.8rem;color:var(--text-dim)">Connecting…</div>
          <button id="cf-create-btn" class="play-btn" disabled>Connecting…</button>
          <button id="cf-cancel-btn" class="play-btn danger" style="display:none">Cancel My Challenge</button>
          <div id="cf-result" class="result-banner"></div>
        </aside>
        <div class="game-canvas">
          <div class="cf-coin-scene">
            <div class="cf-coin-glow" id="cf-coin-glow">
              <div class="cf-coin" id="cf-coin">
                <div class="coin-face coin-face-front">
                  <div class="coin-ring"></div>H
                </div>
                <div class="coin-face coin-face-back">
                  <div class="coin-ring"></div>T
                </div>
              </div>
            </div>
          </div>
          <style>
            .cf-coin-scene { perspective: 700px; display: flex; justify-content: center; padding: 8px 0 2px; }
            .cf-coin-glow { transition: filter 0.3s ease; }
            .cf-coin-glow.win-state  { filter: drop-shadow(0 0 16px #34d399); }
            .cf-coin-glow.loss-state { filter: drop-shadow(0 0 16px #ef4444); }
            .cf-coin {
              width: 100px; height: 100px;
              position: relative;
              transform-style: preserve-3d;
              transform: rotateY(0deg);
              transition: transform 0.5s ease;
            }
            .cf-coin::before {
              content: "";
              position: absolute;
              inset: -4px;
              border-radius: 50%;
              background: repeating-conic-gradient(from 0deg, #e8b73a 0deg 6deg, #a3760f 6deg 12deg);
              z-index: -1;
              box-shadow: 0 4px 10px rgba(0,0,0,0.5);
            }
            .cf-coin.show-tails { transform: rotateY(180deg); }
            .cf-coin.flipping { animation: cf-coin-spin 0.9s cubic-bezier(0.3,0.6,0.3,1); }
            @keyframes cf-coin-spin {
              0%   { transform: rotateY(0deg)    translateY(0); }
              20%  { transform: rotateY(360deg)  translateY(-26px); }
              50%  { transform: rotateY(900deg)  translateY(-10px); }
              80%  { transform: rotateY(1500deg) translateY(-4px); }
              100% { transform: rotateY(1800deg) translateY(0); }
            }
            .coin-face {
              position: absolute;
              inset: 0;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              backface-visibility: hidden;
              transform: translateZ(1px);
              font-family: Georgia, serif;
              font-weight: 800;
              font-size: 2.3rem;
              color: #6b4a10;
              text-shadow: 0 1px 0 rgba(255,255,255,0.5), 0 -1px 0 rgba(0,0,0,0.2);
              background: radial-gradient(circle at 32% 28%, #fff6d2 0%, #f0c244 35%, #c8941f 72%, #8a6212 100%);
              border: 3px solid #c8941f;
              box-shadow:
                inset 0 0 0 4px rgba(255,255,255,0.22),
                inset 0 -8px 14px rgba(0,0,0,0.25),
                0 4px 10px rgba(0,0,0,0.45);
            }
            .coin-face-back { transform: rotateY(180deg) translateZ(1px); }
            .coin-ring {
              position: absolute;
              inset: 7px;
              border-radius: 50%;
              border: 2px solid rgba(255,255,255,0.35);
              pointer-events: none;
            }
          </style>
          <div style="background:var(--bg-elev);border:1px solid var(--border);border-radius:10px;padding:14px">
            <div style="font-size:0.78rem;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:var(--text-dim);margin-bottom:10px">Open Challenges (<span id="cf-challenge-count">0</span>)</div>
            <div id="cf-challenges-list"></div>
          </div>
          <div style="background:var(--bg-elev);border:1px solid var(--border);border-radius:10px;padding:14px">
            <div style="font-size:0.78rem;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:var(--text-dim);margin-bottom:10px">Recent Results</div>
            <div id="cf-results-list"></div>
          </div>
        </div>
      </div>`;

    const els = {
      status:         container.querySelector("#cf-status"),
      amount:         container.querySelector("#cf-amount"),
      half:           container.querySelector("#cf-half"),
      dbl:            container.querySelector("#cf-dbl"),
      createBtn:      container.querySelector("#cf-create-btn"),
      cancelBtn:      container.querySelector("#cf-cancel-btn"),
      result:         container.querySelector("#cf-result"),
      challengeCount: container.querySelector("#cf-challenge-count"),
      challengesList: container.querySelector("#cf-challenges-list"),
      resultsList:    container.querySelector("#cf-results-list"),
      coin:           container.querySelector("#cf-coin"),
      coinGlow:       container.querySelector("#cf-coin-glow"),
    };

    function flipCoin(won) {
      if (!els.coin) return;
      els.coinGlow.classList.remove("win-state", "loss-state");
      els.coin.classList.remove("flipping", "show-tails");
      void els.coin.offsetWidth; // restart animation
      els.coin.classList.add("flipping");
      setTimeout(() => {
        els.coin.classList.remove("flipping");
        els.coin.classList.toggle("show-tails", !won);
        els.coinGlow.classList.add(won ? "win-state" : "loss-state");
      }, 900);
    }

    els.half.addEventListener("click", () => {
      els.amount.value = Math.max(1, Math.floor(Number(els.amount.value) * 0.5));
    });
    els.dbl.addEventListener("click", () => {
      els.amount.value = Math.floor(Number(els.amount.value) * 2);
    });
    container.querySelectorAll(".bp-tab").forEach(t =>
      t.addEventListener("click", function() {
        container.querySelectorAll(".bp-tab").forEach(x => x.classList.remove("active"));
        this.classList.add("active");
      })
    );

    function setStatus(text) {
      if (els.status) els.status.textContent = text;
    }

    function renderChallenges() {
      if (!els.challengesList) return;
      els.challengeCount.textContent = String(challenges.length);
      if (!challenges.length) {
        els.challengesList.innerHTML = `<div style="color:var(--text-dim);font-size:0.85rem;text-align:center;padding:16px 0">No open challenges — be the first!</div>`;
        return;
      }
      els.challengesList.innerHTML = challenges.map(c => {
        const isMine = c.id === myChallengeId;
        const isMe = c.creatorName === accountState.username;
        const nameTag = isMe
          ? `<strong style="color:var(--accent-2)">${c.creatorName} (you)</strong>`
          : `<strong>${c.creatorName}</strong>`;
        const actionBtn = isMine
          ? `<button class="cf-cancel-inline quick-btn" data-id="${c.id}" style="color:var(--loss);border-color:rgba(248,113,113,0.5)">Cancel</button>`
          : `<button class="cf-join-btn" data-id="${c.id}" style="background:linear-gradient(135deg,#34d399,#10b981);color:#071a10;border:none;border-radius:8px;padding:7px 16px;font-weight:700;font-size:0.82rem;cursor:pointer">Join</button>`;
        return `<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border)">
          <div style="flex:1;font-size:0.88rem">${nameTag} · ${fmtChips(c.amount)}</div>
          ${actionBtn}
        </div>`;
      }).join("");

      els.challengesList.querySelectorAll(".cf-join-btn").forEach(btn => {
        btn.addEventListener("click", () => joinChallenge(btn.dataset.id));
      });
      els.challengesList.querySelectorAll(".cf-cancel-inline").forEach(btn => {
        btn.addEventListener("click", () => cancelChallenge(btn.dataset.id));
      });
    }

    function renderResults() {
      if (!els.resultsList) return;
      if (!recentResults.length) {
        els.resultsList.innerHTML = `<div style="color:var(--text-dim);font-size:0.85rem;text-align:center;padding:12px 0">No flips yet.</div>`;
        return;
      }
      els.resultsList.innerHTML = recentResults.slice(0, 10).map(r => {
        return `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border);font-size:0.85rem">
          <span style="flex:1">${r.creatorName} vs ${r.joinerName} · ${fmtChips(r.amount)}</span>
          <span style="color:var(--win);font-weight:800">🏆 ${r.winnerName}</span>
        </div>`;
      }).join("");
    }

    function setMyChallenge(id) {
      myChallengeId = id;
      if (id) {
        els.createBtn.style.display = "none";
        els.cancelBtn.style.display = "";
      } else {
        els.createBtn.style.display = "";
        els.cancelBtn.style.display = "none";
      }
    }

    function showResult(text, type) {
      if (!els.result) return;
      els.result.className = `result-banner ${type}`;
      els.result.textContent = text;
    }

    function createChallenge() {
      const chips = Number(els.amount.value);
      if (!chips || chips <= 0) { UI.toast("Enter a bet amount.", "loss"); return; }
      const amount = Math.round(chips * 100);
      els.createBtn.disabled = true;
      socket.emit("create_challenge", { amount }, (resp) => {
        els.createBtn.disabled = false;
        if (resp?.error) { UI.toast(resp.error, "loss"); return; }
        setMyChallenge(resp.challengeId);
        UI.toast("Challenge created! Waiting for opponent…", "info");
      });
    }

    function cancelChallenge(id) {
      const cid = id || myChallengeId;
      if (!cid) return;
      els.cancelBtn.disabled = true;
      socket.emit("cancel_challenge", { challengeId: cid }, (resp) => {
        els.cancelBtn.disabled = false;
        if (resp?.error) { UI.toast(resp.error, "loss"); return; }
        setMyChallenge(null);
        App.refreshAccount();
        UI.toast("Challenge cancelled. Chips refunded.", "info");
      });
    }

    function joinChallenge(id) {
      socket.emit("join_challenge", { challengeId: id }, (resp) => {
        if (resp?.error) { UI.toast(resp.error, "loss"); return; }
        const won = resp.winnerName === accountState.username;
        App.refreshAccount();
        flipCoin(won);
        if (won) {
          showResult(`🏆 You won! +${fmtChips(resp.payout)}`, "win");
          UI.toast(`Coinflip: You beat ${resp.creatorName}! +${fmtChips(resp.payout)}`, "win");
        } else {
          showResult(`💀 You lost. ${resp.winnerName} wins this flip.`, "loss");
          UI.toast(`Coinflip: ${resp.winnerName} wins this one.`, "loss");
        }
      });
    }

    els.createBtn.addEventListener("click", createChallenge);
    els.cancelBtn.addEventListener("click", () => cancelChallenge(null));

    const token = Api.getToken ? Api.getToken() : null;
    socket = io("/coinflip", { auth: { token } });

    socket.on("connect", () => setStatus("Connected · Real-time updates active"));
    socket.on("disconnect", () => setStatus("Disconnected — reconnecting…"));

    socket.on("state", (data) => {
      challenges = data.challenges || [];
      recentResults = data.recentResults || [];
      renderChallenges();
      renderResults();
      els.createBtn.disabled = false;
      els.createBtn.textContent = "Create Challenge";
    });

    socket.on("challenge_created", (c) => {
      challenges = challenges.filter(x => x.id !== c.id);
      challenges.unshift(c);
      renderChallenges();
    });

    socket.on("challenge_cancelled", ({ id }) => {
      challenges = challenges.filter(c => c.id !== id);
      if (myChallengeId === id) setMyChallenge(null);
      renderChallenges();
    });

    socket.on("challenge_result", (r) => {
      challenges = challenges.filter(c => c.id !== r.id);
      renderChallenges();

      recentResults.unshift({
        id: r.id,
        creatorName: r.creatorName,
        joinerName: r.joinerName,
        winnerName: r.winnerName,
        amount: r.amount,
        serverSeedHash: r.serverSeedHash,
        createdAt: Date.now(),
      });
      recentResults = recentResults.slice(0, 20);
      renderResults();

      if (myChallengeId === r.id) {
        setMyChallenge(null);
        App.refreshAccount();
        const won = r.winnerName === accountState.username;
        flipCoin(won);
        if (won) {
          showResult(`🏆 ${r.joinerName} joined your challenge — you won! +${fmtChips(r.payout)}`, "win");
          UI.toast(`Coinflip: You beat ${r.joinerName}! +${fmtChips(r.payout)}`, "win");
        } else {
          showResult(`💀 ${r.joinerName} joined your challenge and won.`, "loss");
          UI.toast(`Coinflip: ${r.joinerName} beat you.`, "loss");
        }
      }
    });

    return () => {
      if (socket) { socket.disconnect(); socket = null; }
    };
  }

  return { render };
})();
