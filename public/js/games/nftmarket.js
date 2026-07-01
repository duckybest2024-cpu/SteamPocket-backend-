const NFTMarketGame = (() => {
  const RARITY_COLORS = {
    common: "#9ca3af",
    uncommon: "#34d399",
    rare: "#60a5fa",
    epic: "#a78bfa",
    legendary: "#f59e0b",
    unique: "#ec4899",
  };

  const RARITY_ORDER = ["unique", "legendary", "epic", "rare", "uncommon", "common"];

  const COLLECTIONS = [
    { id: "casino_royale", name: "Casino Royale" },
    { id: "lucky_charms", name: "Lucky Charms" },
    { id: "high_roller", name: "High Roller Club" },
    { id: "cosmic_casino", name: "Cosmic Casino" },
    { id: "street_kings", name: "Street Kings" },
    { id: "ancient_fortune", name: "Ancient Fortune" },
    { id: "cyberpunk", name: "Cyberpunk Chips" },
    { id: "nature_spirits", name: "Nature Spirits" },
    { id: "legends", name: "Legends Collection" },
    { id: "one_of_one", name: "1-of-1 Originals" },
  ];

  // Internal state
  let _state = {
    activeTab: "browse",
    catalog: [],
    myNfts: [],
    loading: false,
    catalogLoading: false,
    page: 1,
    pageSize: 20,
    filters: {
      q: "",
      rarity: "all",
      collection: "all",
      hasPower: false,
      sort: "rarity",
    },
  };

  let _container = null;

  function fmt(chips) {
    if (chips >= 1000000) return (chips / 1000000).toFixed(1) + "M";
    if (chips >= 1000) return (chips / 1000).toFixed(1) + "K";
    return chips.toLocaleString();
  }

  function rarityBadge(rarity) {
    const color = RARITY_COLORS[rarity] || "#9ca3af";
    return `<span style="
      display:inline-block;
      padding:2px 8px;
      border-radius:12px;
      font-size:11px;
      font-weight:700;
      text-transform:uppercase;
      letter-spacing:0.5px;
      background:${color}22;
      border:1px solid ${color};
      color:${color};
    ">${rarity}</span>`;
  }

  function powerBadge(power) {
    if (!power) return "";
    const icons = {
      chips_bonus: "💰",
      xp_bonus: "⭐",
      jackpot_entry: "🎰",
      free_spin: "🎡",
      multiplier_boost: "✖️",
      cashback: "🔄",
      bank_bonus: "🏦",
      double_chips: "2️⃣",
      lucky_draw: "🎲",
      vip_chips: "👑",
    };
    return `<span style="
      display:inline-flex;
      align-items:center;
      gap:3px;
      padding:2px 7px;
      border-radius:10px;
      font-size:11px;
      font-weight:600;
      background:rgba(167,139,250,0.15);
      border:1px solid rgba(167,139,250,0.4);
      color:#c4b5fd;
    ">${icons[power.type] || "⚡"} ${power.label}</span>`;
  }

  function supplyBadge(template) {
    if (template.supply === -1) return "";
    const remaining = template.remaining !== undefined ? template.remaining : template.supply;
    if (remaining <= 0) {
      return `<span style="
        display:inline-block;
        padding:2px 8px;
        border-radius:10px;
        font-size:11px;
        font-weight:600;
        background:rgba(239,68,68,0.15);
        border:1px solid rgba(239,68,68,0.4);
        color:#f87171;
      ">SOLD OUT</span>`;
    }
    const pct = remaining / template.supply;
    const color = pct < 0.1 ? "#f87171" : pct < 0.3 ? "#fb923c" : "#6b7280";
    return `<span style="
      display:inline-block;
      padding:2px 8px;
      border-radius:10px;
      font-size:11px;
      background:rgba(107,114,128,0.15);
      border:1px solid rgba(107,114,128,0.3);
      color:${color};
    ">${remaining.toLocaleString()} left</span>`;
  }

  function isSoldOut(template) {
    if (template.supply === -1) return false;
    const remaining = template.remaining !== undefined ? template.remaining : template.supply;
    return remaining <= 0;
  }

  function nftCardHtml(template) {
    const soldOut = isSoldOut(template);
    const rarityColor = RARITY_COLORS[template.rarity] || "#9ca3af";
    return `
      <div class="nft-card" data-template-id="${template.id}" style="
        background:var(--bg-card, #1a1a2e);
        border:1px solid ${rarityColor}33;
        border-radius:var(--radius, 12px);
        overflow:hidden;
        display:flex;
        flex-direction:column;
        transition:transform 0.15s, box-shadow 0.15s;
        position:relative;
      " onmouseenter="this.style.transform='translateY(-3px)';this.style.boxShadow='0 8px 24px ${rarityColor}22'" onmouseleave="this.style.transform='';this.style.boxShadow=''">
        <div style="
          background:linear-gradient(135deg, ${rarityColor}11, ${rarityColor}22);
          display:flex;
          align-items:center;
          justify-content:center;
          padding:20px;
          font-size:48px;
          line-height:1;
          border-bottom:1px solid ${rarityColor}22;
          min-height:90px;
        ">${template.emoji}</div>
        <div style="padding:12px;flex:1;display:flex;flex-direction:column;gap:6px;">
          <div style="font-weight:700;font-size:13px;color:var(--text,#fff);line-height:1.3;">${template.name}</div>
          <div style="font-size:11px;color:var(--text-dim,#888);">${template.collection}</div>
          <div style="display:flex;flex-wrap:wrap;gap:4px;align-items:center;">
            ${rarityBadge(template.rarity)}
            ${supplyBadge(template)}
          </div>
          ${template.power ? `<div style="margin-top:2px;">${powerBadge(template.power)}</div>` : ""}
          <div style="flex:1;"></div>
          <div style="display:flex;align-items:center;justify-content:space-between;margin-top:6px;">
            <span style="font-weight:800;font-size:15px;color:var(--gold,#f59e0b);">🪙 ${fmt(template.priceChips)}</span>
            <button
              class="nft-buy-btn"
              data-template-id="${template.id}"
              data-name="${template.name.replace(/"/g, '&quot;')}"
              data-price="${template.priceChips}"
              ${soldOut ? "disabled" : ""}
              style="
                padding:6px 14px;
                border-radius:8px;
                border:none;
                font-size:12px;
                font-weight:700;
                cursor:${soldOut ? "not-allowed" : "pointer"};
                background:${soldOut ? "rgba(107,114,128,0.3)" : "var(--accent,#6366f1)"};
                color:${soldOut ? "#6b7280" : "#fff"};
                transition:background 0.15s, opacity 0.15s;
              "
              ${soldOut ? "" : `onmouseenter="this.style.opacity='0.85'" onmouseleave="this.style.opacity='1'"`}
            >${soldOut ? "Sold Out" : "Buy"}</button>
          </div>
        </div>
      </div>
    `;
  }

  function myNftCardHtml(nft) {
    let parsedDesc = null;
    let hasPower = false;
    let isUsed = nft.category && nft.category.endsWith("_used");

    try {
      parsedDesc = JSON.parse(nft.description);
      hasPower = parsedDesc && parsedDesc.power !== null && parsedDesc.power !== undefined;
    } catch (e) {}

    const rarityColor = RARITY_COLORS[nft.rarity] || "#9ca3af";

    return `
      <div style="
        background:var(--bg-card,#1a1a2e);
        border:1px solid ${rarityColor}33;
        border-radius:var(--radius,12px);
        overflow:hidden;
        display:flex;
        align-items:center;
        gap:14px;
        padding:14px;
        transition:border-color 0.15s;
      ">
        <div style="
          font-size:36px;
          width:56px;
          height:56px;
          display:flex;
          align-items:center;
          justify-content:center;
          background:${rarityColor}18;
          border-radius:10px;
          flex-shrink:0;
        ">${nft.emoji || "❓"}</div>
        <div style="flex:1;min-width:0;">
          <div style="font-weight:700;font-size:14px;color:var(--text,#fff);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${nft.name}</div>
          <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px;align-items:center;">
            ${rarityBadge(nft.rarity)}
            ${isUsed ? `<span style="padding:2px 8px;border-radius:10px;font-size:11px;background:rgba(107,114,128,0.2);color:#6b7280;border:1px solid #374151;">Used</span>` : ""}
            ${hasPower && !isUsed ? powerBadge(parsedDesc.power) : ""}
          </div>
          ${parsedDesc && parsedDesc.desc ? `<div style="font-size:11px;color:var(--text-dim,#888);margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${parsedDesc.desc}</div>` : ""}
        </div>
        ${hasPower && !isUsed ? `
          <button
            class="nft-use-btn"
            data-nft-id="${nft.id}"
            data-power-type="${parsedDesc.power.type}"
            data-power-label="${(parsedDesc.power.label || "").replace(/"/g, '&quot;')}"
            style="
              padding:8px 14px;
              border-radius:8px;
              border:none;
              font-size:12px;
              font-weight:700;
              cursor:pointer;
              background:rgba(167,139,250,0.25);
              color:#c4b5fd;
              border:1px solid rgba(167,139,250,0.5);
              flex-shrink:0;
              white-space:nowrap;
              transition:background 0.15s;
            "
            onmouseenter="this.style.background='rgba(167,139,250,0.4)'"
            onmouseleave="this.style.background='rgba(167,139,250,0.25)'"
          >⚡ Use Power</button>
        ` : ""}
      </div>
    `;
  }

  function filterCatalog(catalog) {
    const { q, rarity, collection, hasPower, sort } = _state.filters;
    let results = [...catalog];

    if (q.trim()) {
      const query = q.toLowerCase();
      results = results.filter(
        (t) =>
          t.name.toLowerCase().includes(query) ||
          t.description.toLowerCase().includes(query) ||
          t.collection.toLowerCase().includes(query) ||
          (t.tags && t.tags.some((tag) => tag.toLowerCase().includes(query)))
      );
    }

    if (rarity !== "all") results = results.filter((t) => t.rarity === rarity);
    if (collection !== "all") results = results.filter((t) => t.collectionId === collection);
    if (hasPower) results = results.filter((t) => t.power !== null);

    if (sort === "price_asc") results.sort((a, b) => a.priceChips - b.priceChips);
    else if (sort === "price_desc") results.sort((a, b) => b.priceChips - a.priceChips);
    else {
      results.sort((a, b) => {
        const rd = RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity);
        if (rd !== 0) return rd;
        return b.priceChips - a.priceChips;
      });
    }

    return results;
  }

  async function loadCatalog() {
    _state.catalogLoading = true;
    rerender();
    try {
      const data = await Api.get("/nftmarket/catalog");
      _state.catalog = data.templates || [];
    } catch (e) {
      UI.toast("Failed to load catalog", "error");
    }
    _state.catalogLoading = false;
    rerender();
  }

  async function loadMyNfts() {
    _state.loading = true;
    rerender();
    try {
      const data = await Api.get("/nfts/collection");
      _state.myNfts = data.nfts || data || [];
    } catch (e) {
      UI.toast("Failed to load your collection", "error");
    }
    _state.loading = false;
    rerender();
  }

  async function buyNft(templateId, name, price) {
    const confirmed = window.confirm(`Buy "${name}" for ${fmt(price)} chips?`);
    if (!confirmed) return;

    try {
      const result = await Api.post("/nftmarket/buy", { templateId });
      UI.toast(`NFT purchased: ${name}! 🎉`, "win");
      if (typeof App !== "undefined" && App.refreshAccount) App.refreshAccount();
      await Promise.all([loadCatalog(), loadMyNfts()]);
    } catch (e) {
      const msg = (e && e.message) || "Purchase failed";
      UI.toast(msg, "error");
    }
  }

  async function useNftPower(nftId, powerLabel) {
    const confirmed = window.confirm(`Activate power: "${powerLabel}"? This cannot be undone.`);
    if (!confirmed) return;

    try {
      const result = await Api.post(`/nftmarket/use/${nftId}`, {});
      let msg = `Power activated! ${result.effect || ""}`;
      if (result.note) msg += ` — ${result.note}`;
      UI.toast(msg, "win");
      if (typeof App !== "undefined" && App.refreshAccount) App.refreshAccount();
      await loadMyNfts();
    } catch (e) {
      const msg = (e && e.message) || "Failed to activate power";
      UI.toast(msg, "error");
    }
  }

  function renderBrowseTab() {
    const filtered = filterCatalog(_state.catalog);
    const totalPages = Math.max(1, Math.ceil(filtered.length / _state.pageSize));
    const page = Math.min(_state.page, totalPages);
    const start = (page - 1) * _state.pageSize;
    const pageItems = filtered.slice(start, start + _state.pageSize);

    const collectionOptions = COLLECTIONS.map(
      (c) => `<option value="${c.id}" ${_state.filters.collection === c.id ? "selected" : ""}>${c.name}</option>`
    ).join("");

    const rarityOptions = ["all", "common", "uncommon", "rare", "epic", "legendary", "unique"]
      .map(
        (r) =>
          `<option value="${r}" ${_state.filters.rarity === r ? "selected" : ""}>${r === "all" ? "All Rarities" : r.charAt(0).toUpperCase() + r.slice(1)}</option>`
      )
      .join("");

    return `
      <div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:16px;align-items:center;">
        <input
          id="nft-search"
          type="text"
          placeholder="Search NFTs..."
          value="${_state.filters.q.replace(/"/g, '&quot;')}"
          style="
            flex:1;
            min-width:180px;
            padding:8px 12px;
            border-radius:8px;
            border:1px solid var(--border,#2d2d44);
            background:var(--bg-elev,#16213e);
            color:var(--text,#fff);
            font-size:13px;
            outline:none;
          "
        />
        <select id="nft-rarity-filter" style="
          padding:8px 10px;
          border-radius:8px;
          border:1px solid var(--border,#2d2d44);
          background:var(--bg-elev,#16213e);
          color:var(--text,#fff);
          font-size:13px;
          cursor:pointer;
        ">
          ${rarityOptions}
        </select>
        <select id="nft-collection-filter" style="
          padding:8px 10px;
          border-radius:8px;
          border:1px solid var(--border,#2d2d44);
          background:var(--bg-elev,#16213e);
          color:var(--text,#fff);
          font-size:13px;
          cursor:pointer;
        ">
          <option value="all" ${_state.filters.collection === "all" ? "selected" : ""}>All Collections</option>
          ${collectionOptions}
        </select>
        <select id="nft-sort" style="
          padding:8px 10px;
          border-radius:8px;
          border:1px solid var(--border,#2d2d44);
          background:var(--bg-elev,#16213e);
          color:var(--text,#fff);
          font-size:13px;
          cursor:pointer;
        ">
          <option value="rarity" ${_state.filters.sort === "rarity" ? "selected" : ""}>Sort: Rarity</option>
          <option value="price_desc" ${_state.filters.sort === "price_desc" ? "selected" : ""}>Price: High to Low</option>
          <option value="price_asc" ${_state.filters.sort === "price_asc" ? "selected" : ""}>Price: Low to High</option>
        </select>
        <label style="display:flex;align-items:center;gap:6px;font-size:13px;color:var(--text-dim,#888);cursor:pointer;white-space:nowrap;">
          <input type="checkbox" id="nft-has-power" ${_state.filters.hasPower ? "checked" : ""} style="cursor:pointer;" />
          Has Power
        </label>
      </div>

      <div style="font-size:12px;color:var(--text-dim,#888);margin-bottom:12px;">
        ${filtered.length} NFTs found
      </div>

      ${_state.catalogLoading ? `
        <div style="display:flex;justify-content:center;align-items:center;height:200px;color:var(--text-dim,#888);">
          <span style="font-size:32px;">⏳</span>
        </div>
      ` : pageItems.length === 0 ? `
        <div style="text-align:center;padding:60px 20px;color:var(--text-dim,#888);">
          <div style="font-size:48px;margin-bottom:12px;">🔍</div>
          <div style="font-size:16px;">No NFTs match your filters</div>
        </div>
      ` : `
        <div style="
          display:grid;
          grid-template-columns:repeat(auto-fill,minmax(200px,1fr));
          gap:16px;
          margin-bottom:20px;
        ">
          ${pageItems.map(nftCardHtml).join("")}
        </div>
      `}

      ${totalPages > 1 ? `
        <div style="display:flex;align-items:center;justify-content:center;gap:8px;margin-top:8px;">
          <button class="nft-page-btn" data-page="${page - 1}" ${page <= 1 ? "disabled" : ""} style="
            padding:6px 14px;border-radius:8px;border:1px solid var(--border,#2d2d44);
            background:var(--bg-elev,#16213e);color:var(--text,#fff);cursor:${page <= 1 ? "not-allowed" : "pointer"};
            opacity:${page <= 1 ? "0.4" : "1"};font-size:13px;
          ">Prev</button>
          <span style="font-size:13px;color:var(--text-dim,#888);">Page ${page} of ${totalPages}</span>
          <button class="nft-page-btn" data-page="${page + 1}" ${page >= totalPages ? "disabled" : ""} style="
            padding:6px 14px;border-radius:8px;border:1px solid var(--border,#2d2d44);
            background:var(--bg-elev,#16213e);color:var(--text,#fff);cursor:${page >= totalPages ? "not-allowed" : "pointer"};
            opacity:${page >= totalPages ? "0.4" : "1"};font-size:13px;
          ">Next</button>
        </div>
      ` : ""}
    `;
  }

  function renderMyCollectionTab() {
    if (_state.loading) {
      return `
        <div style="display:flex;justify-content:center;align-items:center;height:200px;color:var(--text-dim,#888);">
          <span style="font-size:32px;">⏳</span>
        </div>
      `;
    }

    if (_state.myNfts.length === 0) {
      return `
        <div style="text-align:center;padding:60px 20px;color:var(--text-dim,#888);">
          <div style="font-size:48px;margin-bottom:12px;">🃏</div>
          <div style="font-size:18px;font-weight:600;margin-bottom:8px;">No NFTs yet</div>
          <div style="font-size:14px;">Head to the Browse tab to get your first NFT!</div>
        </div>
      `;
    }

    return `
      <div style="font-size:12px;color:var(--text-dim,#888);margin-bottom:12px;">
        ${_state.myNfts.length} NFT${_state.myNfts.length !== 1 ? "s" : ""} in your collection
      </div>
      <div style="display:flex;flex-direction:column;gap:10px;">
        ${_state.myNfts.map(myNftCardHtml).join("")}
      </div>
    `;
  }

  function renderUsePowersTab() {
    const usableNfts = _state.myNfts.filter((nft) => {
      if (nft.category && nft.category.endsWith("_used")) return false;
      try {
        const parsed = JSON.parse(nft.description);
        return parsed && parsed.power !== null && parsed.power !== undefined;
      } catch (e) {
        return false;
      }
    });

    return `
      <div style="
        background:var(--bg-elev,#16213e);
        border:1px solid var(--border,#2d2d44);
        border-radius:var(--radius,12px);
        padding:16px;
        margin-bottom:20px;
      ">
        <div style="font-size:14px;font-weight:700;color:var(--text,#fff);margin-bottom:8px;">⚡ About NFT Powers</div>
        <div style="font-size:13px;color:var(--text-dim,#888);line-height:1.6;">
          NFT powers are one-time abilities that give you chip bonuses, XP rewards, jackpot entries, free spins, and multiplier boosts.
          Once activated, a power cannot be used again. Choose wisely!
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-top:12px;">
          <div style="padding:10px;background:rgba(245,158,11,0.1);border-radius:8px;border:1px solid rgba(245,158,11,0.2);">
            <div style="font-size:18px;margin-bottom:4px;">💰</div>
            <div style="font-size:12px;font-weight:600;color:#f59e0b;">Chips Bonus</div>
            <div style="font-size:11px;color:#888;">Instantly adds chips to your balance</div>
          </div>
          <div style="padding:10px;background:rgba(99,102,241,0.1);border-radius:8px;border:1px solid rgba(99,102,241,0.2);">
            <div style="font-size:18px;margin-bottom:4px;">⭐</div>
            <div style="font-size:12px;font-weight:600;color:#818cf8;">XP Bonus</div>
            <div style="font-size:11px;color:#888;">Boosts your XP and level progress</div>
          </div>
          <div style="padding:10px;background:rgba(239,68,68,0.1);border-radius:8px;border:1px solid rgba(239,68,68,0.2);">
            <div style="font-size:18px;margin-bottom:4px;">🎰</div>
            <div style="font-size:12px;font-weight:600;color:#f87171;">Jackpot Entry</div>
            <div style="font-size:11px;color:#888;">Enters you into the jackpot drawing</div>
          </div>
          <div style="padding:10px;background:rgba(52,211,153,0.1);border-radius:8px;border:1px solid rgba(52,211,153,0.2);">
            <div style="font-size:18px;margin-bottom:4px;">🎡</div>
            <div style="font-size:12px;font-weight:600;color:#34d399;">Free Spin</div>
            <div style="font-size:11px;color:#888;">Awards chips for a free spin</div>
          </div>
          <div style="padding:10px;background:rgba(167,139,250,0.1);border-radius:8px;border:1px solid rgba(167,139,250,0.2);">
            <div style="font-size:18px;margin-bottom:4px;">✖️</div>
            <div style="font-size:12px;font-weight:600;color:#a78bfa;">Multiplier Boost</div>
            <div style="font-size:11px;color:#888;">Multiplies your chip rewards</div>
          </div>
        </div>
      </div>

      ${_state.loading ? `
        <div style="text-align:center;padding:40px;color:var(--text-dim,#888);">⏳ Loading...</div>
      ` : usableNfts.length === 0 ? `
        <div style="text-align:center;padding:40px;color:var(--text-dim,#888);">
          <div style="font-size:36px;margin-bottom:10px;">😴</div>
          <div style="font-size:15px;">No unused powers available</div>
          <div style="font-size:13px;margin-top:6px;">Buy NFTs with powers from the Browse tab!</div>
        </div>
      ` : `
        <div style="font-size:12px;color:var(--text-dim,#888);margin-bottom:12px;">
          ${usableNfts.length} power${usableNfts.length !== 1 ? "s" : ""} ready to activate
        </div>
        <div style="display:flex;flex-direction:column;gap:10px;">
          ${usableNfts.map((nft) => myNftCardHtml(nft)).join("")}
        </div>
      `}
    `;
  }

  function renderTabs() {
    const tabs = [
      { id: "browse", label: "🛒 Browse" },
      { id: "collection", label: "🃏 My Collection" },
      { id: "powers", label: "⚡ Use Powers" },
    ];
    return `
      <div style="display:flex;gap:4px;margin-bottom:20px;border-bottom:1px solid var(--border,#2d2d44);padding-bottom:0;">
        ${tabs.map((tab) => `
          <button class="nft-tab-btn" data-tab="${tab.id}" style="
            padding:10px 18px;
            border:none;
            background:none;
            cursor:pointer;
            font-size:13px;
            font-weight:600;
            color:${_state.activeTab === tab.id ? "var(--accent,#6366f1)" : "var(--text-dim,#888)"};
            border-bottom:2px solid ${_state.activeTab === tab.id ? "var(--accent,#6366f1)" : "transparent"};
            margin-bottom:-1px;
            transition:color 0.15s, border-color 0.15s;
          ">${tab.label}</button>
        `).join("")}
      </div>
    `;
  }

  function renderContent() {
    if (_state.activeTab === "browse") return renderBrowseTab();
    if (_state.activeTab === "collection") return renderMyCollectionTab();
    if (_state.activeTab === "powers") return renderUsePowersTab();
    return "";
  }

  function rerender() {
    if (!_container) return;
    const contentEl = _container.querySelector("#nft-tab-content");
    if (contentEl) {
      contentEl.innerHTML = renderContent();
      attachContentListeners();
    }
    // Also update tab styles
    _container.querySelectorAll(".nft-tab-btn").forEach((btn) => {
      const isActive = btn.getAttribute("data-tab") === _state.activeTab;
      btn.style.color = isActive ? "var(--accent,#6366f1)" : "var(--text-dim,#888)";
      btn.style.borderBottomColor = isActive ? "var(--accent,#6366f1)" : "transparent";
    });
  }

  function attachContentListeners() {
    if (!_container) return;

    // Buy buttons
    _container.querySelectorAll(".nft-buy-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (btn.disabled) return;
        const id = btn.getAttribute("data-template-id");
        const name = btn.getAttribute("data-name");
        const price = parseInt(btn.getAttribute("data-price"), 10);
        buyNft(id, name, price);
      });
    });

    // Use power buttons
    _container.querySelectorAll(".nft-use-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const nftId = btn.getAttribute("data-nft-id");
        const powerLabel = btn.getAttribute("data-power-label");
        useNftPower(nftId, powerLabel);
      });
    });

    // Pagination
    _container.querySelectorAll(".nft-page-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (btn.disabled) return;
        const page = parseInt(btn.getAttribute("data-page"), 10);
        _state.page = page;
        rerender();
      });
    });

    // Search input
    const searchInput = _container.querySelector("#nft-search");
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        _state.filters.q = e.target.value;
        _state.page = 1;
        rerender();
      });
    }

    // Rarity filter
    const rarityFilter = _container.querySelector("#nft-rarity-filter");
    if (rarityFilter) {
      rarityFilter.addEventListener("change", (e) => {
        _state.filters.rarity = e.target.value;
        _state.page = 1;
        rerender();
      });
    }

    // Collection filter
    const collectionFilter = _container.querySelector("#nft-collection-filter");
    if (collectionFilter) {
      collectionFilter.addEventListener("change", (e) => {
        _state.filters.collection = e.target.value;
        _state.page = 1;
        rerender();
      });
    }

    // Sort
    const sortSelect = _container.querySelector("#nft-sort");
    if (sortSelect) {
      sortSelect.addEventListener("change", (e) => {
        _state.filters.sort = e.target.value;
        _state.page = 1;
        rerender();
      });
    }

    // Has power checkbox
    const hasPowerCheck = _container.querySelector("#nft-has-power");
    if (hasPowerCheck) {
      hasPowerCheck.addEventListener("change", (e) => {
        _state.filters.hasPower = e.target.checked;
        _state.page = 1;
        rerender();
      });
    }
  }

  function render(container, state) {
    _container = container;

    // Reset state on fresh render but keep catalog if we have it
    const prevCatalog = _state.catalog;
    const prevMyNfts = _state.myNfts;

    _state = {
      activeTab: "browse",
      catalog: prevCatalog,
      myNfts: prevMyNfts,
      loading: false,
      catalogLoading: false,
      page: 1,
      pageSize: 20,
      filters: {
        q: "",
        rarity: "all",
        collection: "all",
        hasPower: false,
        sort: "rarity",
      },
    };

    if (state) Object.assign(_state, state);

    container.innerHTML = `
      <div style="
        max-width:1100px;
        margin:0 auto;
        padding:16px;
        font-family:inherit;
      ">
        <div style="
          display:flex;
          align-items:center;
          justify-content:space-between;
          margin-bottom:20px;
        ">
          <h2 style="
            margin:0;
            font-size:22px;
            font-weight:800;
            color:var(--text,#fff);
            display:flex;
            align-items:center;
            gap:10px;
          ">🏪 NFT Marketplace</h2>
          <button id="nft-go-collection" style="
            padding:8px 18px;
            border-radius:8px;
            border:1px solid var(--accent,#6366f1);
            background:rgba(99,102,241,0.15);
            color:var(--accent,#818cf8);
            font-size:13px;
            font-weight:600;
            cursor:pointer;
            transition:background 0.15s;
          "
          onmouseenter="this.style.background='rgba(99,102,241,0.3)'"
          onmouseleave="this.style.background='rgba(99,102,241,0.15)'"
          >🃏 My Collection</button>
        </div>

        ${renderTabs()}

        <div id="nft-tab-content">
          ${renderContent()}
        </div>
      </div>
    `;

    // Tab switching
    container.querySelectorAll(".nft-tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const tab = btn.getAttribute("data-tab");
        _state.activeTab = tab;
        _state.page = 1;

        // Update tab styles inline
        container.querySelectorAll(".nft-tab-btn").forEach((b) => {
          const isActive = b.getAttribute("data-tab") === tab;
          b.style.color = isActive ? "var(--accent,#6366f1)" : "var(--text-dim,#888)";
          b.style.borderBottomColor = isActive ? "var(--accent,#6366f1)" : "transparent";
        });

        // Re-render content area
        const contentEl = container.querySelector("#nft-tab-content");
        if (contentEl) {
          contentEl.innerHTML = renderContent();
          attachContentListeners();
        }

        if (tab === "collection" || tab === "powers") {
          loadMyNfts();
        }
      });
    });

    // My Collection shortcut button
    const goCollectionBtn = container.querySelector("#nft-go-collection");
    if (goCollectionBtn) {
      goCollectionBtn.addEventListener("click", () => {
        _state.activeTab = "collection";
        _state.page = 1;
        container.querySelectorAll(".nft-tab-btn").forEach((b) => {
          const isActive = b.getAttribute("data-tab") === "collection";
          b.style.color = isActive ? "var(--accent,#6366f1)" : "var(--text-dim,#888)";
          b.style.borderBottomColor = isActive ? "var(--accent,#6366f1)" : "transparent";
        });
        const contentEl = container.querySelector("#nft-tab-content");
        if (contentEl) {
          contentEl.innerHTML = renderContent();
          attachContentListeners();
        }
        loadMyNfts();
      });
    }

    attachContentListeners();

    // Initial data load
    if (_state.catalog.length === 0) {
      loadCatalog();
    }
    if (_state.activeTab === "collection" || _state.activeTab === "powers") {
      loadMyNfts();
    }
  }

  return { render };
})();
