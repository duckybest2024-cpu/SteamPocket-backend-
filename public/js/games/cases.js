const CasesGame = (() => {
  // Rarity config
  const RARITY = {
    common:    { color: "#9ca3af", label: "Common" },
    uncommon:  { color: "#34d399", label: "Uncommon" },
    rare:      { color: "#60a5fa", label: "Rare" },
    epic:      { color: "#a78bfa", label: "Epic" },
    legendary: { color: "#f59e0b", label: "Legendary" },
    unique:    { color: "#ec4899", label: "Unique" },
  };

  function rarityColor(r) { return (RARITY[r] || RARITY.common).color; }
  function rarityLabel(r) { return (RARITY[r] || RARITY.common).label; }

  function fmtChips(n) { return Number(n).toLocaleString(); }

  // Tier badge
  function tierBadge(price) {
    if (price < 175)  return { label: "Starter",   color: "#6b7280" };
    if (price < 450)  return { label: "Standard",  color: "#2563eb" };
    if (price < 1000) return { label: "Premium",   color: "#7c3aed" };
    if (price < 4000) return { label: "Elite",     color: "#d97706" };
    return               { label: "Legendary", color: "#ec4899" };
  }

  function buildCaseCard(c) {
    const tier = tierBadge(c.priceChips);
    return `
      <div class="case-card" data-case-id="${c.id}" style="cursor:pointer">
        <div class="cc-tier-badge" style="background:${tier.color}">${tier.label}</div>
        <div class="cc-emoji">${c.emoji}</div>
        <div class="cc-name">${c.name}</div>
        <div class="cc-desc">${c.description}</div>
        <div class="cc-price">
          <span class="cc-price-icon">🪙</span>
          <span class="cc-price-val">${fmtChips(c.priceChips)}</span>
        </div>
        <div class="cc-drops">
          ${buildMiniDropBar(c.dropTable)}
        </div>
        <button class="cc-open-btn" data-case-id="${c.id}" data-price="${c.priceChips}">Open Case</button>
      </div>`;
  }

  function buildMiniDropBar(dt) {
    const order = ["common","uncommon","rare","epic","legendary","unique"];
    const total = order.reduce((s, k) => s + (dt[k] || 0), 0);
    if (!total) return "";
    const bars = order
      .filter(k => dt[k] > 0)
      .map(k => {
        const pct = ((dt[k] / total) * 100).toFixed(1);
        return `<div class="cc-drop-seg" style="width:${pct}%;background:${rarityColor(k)}" title="${rarityLabel(k)}: ${pct}%"></div>`;
      }).join("");
    return `<div class="cc-drop-bar">${bars}</div>`;
  }

  // Animated reveal spinner
  function buildRevealSpinner(nft, template) {
    const color = rarityColor(nft.rarity);
    return `
      <div class="case-reveal" style="border-color:${color}">
        <div class="cr-glow" style="background:${color}22"></div>
        <div class="cr-emoji">${nft.emoji}</div>
        <div class="cr-name">${nft.name}</div>
        <div class="cr-rarity" style="color:${color}">${rarityLabel(nft.rarity)}</div>
        <div class="cr-collection">${template?.collection || ""}</div>
        ${template?.power ? `<div class="cr-power">⚡ ${template.power.label}</div>` : ""}
        <div class="cr-desc">${template?.description || ""}</div>
      </div>`;
  }

  // Opening animation overlay
  function showOpeningOverlay(container, onDone) {
    const overlay = document.createElement("div");
    overlay.className = "case-opening-overlay";
    overlay.innerHTML = `
      <div class="coo-inner">
        <div class="coo-spinner">📦</div>
        <div class="coo-label">Opening…</div>
      </div>`;
    container.appendChild(overlay);
    return overlay;
  }

  async function openCase(caseId, container, cases) {
    const caseData = cases.find(c => c.id === caseId);
    if (!caseData) {
      UI.toast("Case not found — please refresh the page", "loss");
      return;
    }

    const overlay = showOpeningOverlay(container);

    try {
      const result = await Api.post(`/cases/${caseId}/open`);
      overlay.remove();

      if (result.balance !== undefined) UI.setBalance(result.balance * 100);

      // Show reveal modal
      const modal = document.createElement("div");
      modal.className = "case-modal-bg";
      modal.innerHTML = `
        <div class="case-modal">
          <div class="cm-header">You opened <strong>${caseData.name}</strong></div>
          ${buildRevealSpinner(result.nft, result.template)}
          <div class="cm-actions">
            <button class="primary-btn cm-keep">Keep it</button>
            <button class="secondary-btn cm-sell">Sell for ${fmtChips(Math.max(1, Math.floor((result.template?.priceChips || 0) * 0.5)))} 🪙</button>
          </div>
        </div>`;
      document.body.appendChild(modal);

      modal.querySelector(".cm-keep").addEventListener("click", () => {
        modal.remove();
        UI.toast(`Added ${result.nft.name} to your collection!`, "win");
      });

      modal.querySelector(".cm-sell").addEventListener("click", async () => {
        modal.remove();
        try {
          const sellResult = await Api.post(`/nftmarket/sell/${result.nft.id}`);
          if (sellResult.balance !== undefined) UI.setBalance(sellResult.balance * 100);
          UI.toast(`Sold ${result.nft.name} for ${fmtChips(sellResult.payoutChips)} chips!`, "win");
        } catch (e) {
          UI.toast(e.message || "Failed to sell", "loss");
        }
      });

      modal.addEventListener("click", (e) => {
        if (e.target === modal) modal.remove();
      });

    } catch (err) {
      overlay.remove();
      UI.toast(err.message || "Failed to open case", "loss");
    }
  }

  function renderCases(container, cases, filter) {
    let filtered = cases;
    if (filter && filter !== "all") {
      filtered = cases.filter(c => {
        if (filter === "starter")   return c.priceChips < 175;
        if (filter === "standard")  return c.priceChips >= 175 && c.priceChips < 450;
        if (filter === "premium")   return c.priceChips >= 450 && c.priceChips < 1000;
        if (filter === "elite")     return c.priceChips >= 1000 && c.priceChips < 4000;
        if (filter === "legendary") return c.priceChips >= 4000;
        return true;
      });
    }
    const grid = container.querySelector("#cases-grid");
    if (!grid) return;
    grid.innerHTML = filtered.map(buildCaseCard).join("") ||
      `<p style="color:var(--text-dim);text-align:center;padding:40px 0">No cases in this tier</p>`;
  }

  async function renderHistory(container) {
    const histDiv = container.querySelector("#cases-history-list");
    if (!histDiv) return;
    histDiv.innerHTML = `<p style="color:var(--text-dim)">Loading…</p>`;
    try {
      const data = await Api.get("/cases/history");
      if (!data.openings || data.openings.length === 0) {
        histDiv.innerHTML = `<p style="color:var(--text-dim);text-align:center;padding:20px 0">No case openings yet</p>`;
        return;
      }
      histDiv.innerHTML = data.openings.map(o => {
        const color = rarityColor(o.rarity);
        return `
          <div class="ch-row">
            <span class="ch-emoji">${o.emoji || "📦"}</span>
            <div class="ch-info">
              <span class="ch-name">${o.name || "Unknown NFT"}</span>
              <span class="ch-rarity" style="color:${color}">${rarityLabel(o.rarity)}</span>
            </div>
            <span class="ch-case">${o.caseId}</span>
            <span class="ch-date">${new Date(o.createdAt).toLocaleDateString()}</span>
          </div>`;
      }).join("");
    } catch (e) {
      histDiv.innerHTML = `<p style="color:var(--loss)">Failed to load history</p>`;
    }
  }

  return {
    render(container) {
      container.innerHTML = `
        <style>
          .cases-wrap { padding: 16px; }
          .cases-tabs { display:flex; gap:6px; margin-bottom:16px; flex-wrap:wrap; }
          .cases-tab { padding:7px 14px; border:1px solid var(--border); border-radius:8px; background:var(--bg-elev); color:var(--text-dim); cursor:pointer; font-size:0.83rem; font-weight:600; transition:all 0.15s; }
          .cases-tab.active, .cases-tab:hover { border-color:var(--accent); color:var(--text); }
          .cases-filter { display:flex; gap:6px; margin-bottom:16px; flex-wrap:wrap; }
          .cases-filter-btn { padding:5px 12px; border:1px solid var(--border); border-radius:20px; background:transparent; color:var(--text-dim); cursor:pointer; font-size:0.78rem; }
          .cases-filter-btn.active { background:var(--accent); color:#fff; border-color:var(--accent); }
          .cases-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(220px,1fr)); gap:14px; }
          .case-card { background:var(--bg-card); border:1px solid var(--border); border-radius:12px; padding:16px; display:flex; flex-direction:column; gap:8px; position:relative; transition:border-color 0.15s,transform 0.15s; }
          .case-card:hover { border-color:var(--accent); transform:translateY(-2px); }
          .cc-tier-badge { position:absolute; top:10px; right:10px; padding:2px 8px; border-radius:10px; font-size:0.68rem; font-weight:700; color:#fff; }
          .cc-emoji { font-size:2.8rem; text-align:center; }
          .cc-name { font-weight:700; font-size:1rem; }
          .cc-desc { font-size:0.78rem; color:var(--text-dim); line-height:1.3; }
          .cc-price { display:flex; align-items:center; gap:5px; font-weight:700; font-size:1.1rem; }
          .cc-price-icon { font-size:1rem; }
          .cc-drop-bar { display:flex; height:6px; border-radius:3px; overflow:hidden; margin-top:4px; }
          .cc-drop-seg { height:100%; }
          .cc-open-btn { margin-top:auto; width:100%; padding:10px; background:linear-gradient(135deg,#34d399,#10b981); color:#071a10; font-weight:700; border:none; border-radius:8px; cursor:pointer; transition:filter 0.15s; }
          .cc-open-btn:hover { filter:brightness(1.1); }
          /* Opening overlay */
          .case-opening-overlay { position:fixed; inset:0; background:#000a; display:flex; align-items:center; justify-content:center; z-index:900; }
          .coo-inner { text-align:center; }
          .coo-spinner { font-size:4rem; animation:case-spin 0.6s linear infinite; display:inline-block; }
          @keyframes case-spin { to { transform:rotate(360deg); } }
          .coo-label { color:#fff; font-size:1.2rem; margin-top:12px; }
          /* Reveal modal */
          .case-modal-bg { position:fixed; inset:0; background:#000b; display:flex; align-items:center; justify-content:center; z-index:1000; }
          .case-modal { background:var(--bg-card); border:1px solid var(--border); border-radius:16px; padding:28px; max-width:380px; width:90%; text-align:center; }
          .cm-header { font-size:0.85rem; color:var(--text-dim); margin-bottom:14px; }
          .case-reveal { border:2px solid var(--accent); border-radius:14px; padding:20px; position:relative; overflow:hidden; }
          .cr-glow { position:absolute; inset:0; opacity:0.3; }
          .cr-emoji { font-size:3.5rem; margin-bottom:8px; position:relative; }
          .cr-name { font-size:1.3rem; font-weight:700; position:relative; }
          .cr-rarity { font-weight:700; font-size:0.9rem; margin-top:4px; position:relative; }
          .cr-collection { font-size:0.75rem; color:var(--text-dim); position:relative; }
          .cr-power { font-size:0.8rem; color:var(--gold); font-weight:600; position:relative; margin-top:4px; }
          .cr-desc { font-size:0.78rem; color:var(--text-dim); margin-top:6px; position:relative; line-height:1.4; }
          .cm-actions { display:flex; gap:10px; margin-top:16px; }
          .cm-actions button { flex:1; }
          /* History */
          .ch-row { display:flex; align-items:center; gap:10px; padding:10px 12px; border-bottom:1px solid var(--border); }
          .ch-emoji { font-size:1.4rem; width:32px; text-align:center; flex-shrink:0; }
          .ch-info { flex:1; display:flex; flex-direction:column; gap:2px; }
          .ch-name { font-weight:600; font-size:0.88rem; }
          .ch-rarity { font-size:0.73rem; font-weight:700; }
          .ch-case { font-size:0.73rem; color:var(--text-dim); }
          .ch-date { font-size:0.73rem; color:var(--text-dim); flex-shrink:0; }
          @media(max-width:600px) { .cases-grid { grid-template-columns:1fr 1fr; } }
          @media(max-width:400px) { .cases-grid { grid-template-columns:1fr; } }
        </style>
        <div class="cases-wrap">
          <div class="cases-tabs">
            <button class="cases-tab active" data-tab="browse">Browse Cases</button>
            <button class="cases-tab" data-tab="history">My History</button>
          </div>

          <div id="cases-browse-panel">
            <div class="cases-filter">
              <button class="cases-filter-btn active" data-filter="all">All</button>
              <button class="cases-filter-btn" data-filter="starter">Starter</button>
              <button class="cases-filter-btn" data-filter="standard">Standard</button>
              <button class="cases-filter-btn" data-filter="premium">Premium</button>
              <button class="cases-filter-btn" data-filter="elite">Elite</button>
              <button class="cases-filter-btn" data-filter="legendary">Legendary</button>
            </div>
            <div id="cases-grid" class="cases-grid">
              <p style="color:var(--text-dim);padding:40px 0;text-align:center">Loading cases…</p>
            </div>
          </div>

          <div id="cases-history-panel" style="display:none">
            <div id="cases-history-list"></div>
          </div>
        </div>`;

      HowToPlay.addButton(container, "cases");

      let cases = [];
      let activeFilter = "all";

      // Tab switching
      container.querySelectorAll(".cases-tab").forEach(btn => {
        btn.addEventListener("click", () => {
          container.querySelectorAll(".cases-tab").forEach(b => b.classList.remove("active"));
          btn.classList.add("active");
          const tab = btn.dataset.tab;
          container.querySelector("#cases-browse-panel").style.display = tab === "browse" ? "" : "none";
          container.querySelector("#cases-history-panel").style.display = tab === "history" ? "" : "none";
          if (tab === "history") renderHistory(container);
        });
      });

      // Filter buttons
      container.querySelectorAll(".cases-filter-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          container.querySelectorAll(".cases-filter-btn").forEach(b => b.classList.remove("active"));
          btn.classList.add("active");
          activeFilter = btn.dataset.filter;
          renderCases(container, cases, activeFilter);
          attachOpenListeners();
        });
      });

      function attachOpenListeners() {
        container.querySelectorAll(".cc-open-btn").forEach(btn => {
          btn.addEventListener("click", (e) => {
            e.stopPropagation();
            openCase(btn.dataset.caseId, document.body, cases);
          });
        });
        container.querySelectorAll(".case-card").forEach(card => {
          card.addEventListener("click", (e) => {
            if (e.target.classList.contains("cc-open-btn")) return;
            // Could show detail — for now just open
            const btn = card.querySelector(".cc-open-btn");
            if (btn) openCase(btn.dataset.caseId, document.body, cases);
          });
        });
      }

      // Load cases
      Api.get("/cases").then(data => {
        cases = data.cases || [];
        renderCases(container, cases, activeFilter);
        attachOpenListeners();
      }).catch(() => {
        container.querySelector("#cases-grid").innerHTML =
          `<p style="color:var(--loss);text-align:center;padding:40px 0">Failed to load cases</p>`;
      });
    },
  };
})();
