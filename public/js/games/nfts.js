const NFTsGame = (() => {
  const RARITY_COLOR = { common: "#9ca3af", uncommon: "#34d399", rare: "#60a5fa", epic: "#a78bfa", legendary: "#f59e0b" };
  const RARITY_LABEL = { common: "Common", uncommon: "Uncommon", rare: "Rare", epic: "Epic", legendary: "Legendary" };

  function render(container, state) {
    container.innerHTML = `
      <div class="game-panel" style="max-width:900px">
        <div id="nft-tabs" style="display:flex;gap:6px;margin-bottom:16px;flex-wrap:wrap">
          <button class="nft-tab secondary-btn active" data-tab="collection">🖼️ My Collection</button>
          <button class="nft-tab secondary-btn" data-tab="draw">🎨 Draw NFT</button>
          <button class="nft-tab secondary-btn" data-tab="inbox">📥 Incoming Trades</button>
          <button class="nft-tab secondary-btn" data-tab="sent">📤 Sent Trades</button>
          <button class="nft-tab secondary-btn" data-tab="create">💱 New Trade</button>
        </div>

        <!-- COLLECTION TAB -->
        <div id="nft-tab-collection">
          <div id="nft-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px"></div>
          <div id="nft-empty" style="display:none;text-align:center;padding:40px;color:var(--text-dim)">
            <div style="font-size:3rem">🎯</div>
            <div style="margin-top:8px">No NFTs yet — win big or draw one!</div>
            <div style="font-size:0.82rem;margin-top:4px">Try: 10x multiplier (Silver Coin), Win Jackpot (Jackpot Trophy), Level 5 (Bronze Star)…</div>
          </div>
        </div>

        <!-- DRAW TAB -->
        <div id="nft-tab-draw" style="display:none">
          <div style="display:flex;gap:16px;flex-wrap:wrap;align-items:flex-start">
            <!-- Canvas area -->
            <div style="flex:1;min-width:300px">
              <div style="background:var(--bg-elev);border:1px solid var(--border);border-radius:12px;padding:12px">
                <div id="nft-draw-toolbar" style="display:flex;align-items:center;gap:8px;margin-bottom:10px;flex-wrap:wrap">
                  <button id="draw-tool-brush" class="draw-tool-btn active" title="Brush">✏️</button>
                  <button id="draw-tool-eraser" class="draw-tool-btn" title="Eraser">🧹</button>
                  <div style="width:1px;height:24px;background:var(--border)"></div>
                  <div id="draw-colors" style="display:flex;gap:4px;flex-wrap:wrap">
                    ${["#ffffff","#000000","#ef4444","#f97316","#eab308","#22c55e","#06b6d4","#3b82f6","#8b5cf6","#ec4899","#a16207","#6b7280"].map(c =>
                      `<button class="color-swatch" data-color="${c}" style="background:${c};width:22px;height:22px;border-radius:4px;border:2px solid transparent;cursor:pointer;flex-shrink:0" title="${c}"></button>`
                    ).join("")}
                  </div>
                  <div style="width:1px;height:24px;background:var(--border)"></div>
                  <div style="display:flex;align-items:center;gap:6px">
                    <span style="font-size:0.75rem;color:var(--text-dim)">Size</span>
                    <input id="draw-size" type="range" min="2" max="40" value="8" style="width:80px;accent-color:var(--accent)" />
                    <span id="draw-size-label" style="font-size:0.75rem;color:var(--text-dim);min-width:24px">8px</span>
                  </div>
                  <div style="width:1px;height:24px;background:var(--border)"></div>
                  <button id="draw-import-btn" class="secondary-btn" style="padding:4px 10px;font-size:0.8rem" title="Import a photo from your device">📷 Import Photo</button>
                  <input id="draw-import-input" type="file" accept="image/*" style="display:none" />
                  <button id="draw-undo" class="secondary-btn" style="padding:4px 10px;font-size:0.8rem">↩ Undo</button>
                  <button id="draw-clear" class="secondary-btn" style="padding:4px 10px;font-size:0.8rem">🗑 Clear</button>
                </div>
                <div style="position:relative;display:inline-block;border:2px solid var(--border);border-radius:8px;overflow:hidden;cursor:crosshair;touch-action:none">
                  <canvas id="nft-draw-canvas" width="400" height="400" style="display:block;max-width:100%;background:#1a1a2e"></canvas>
                  <div id="draw-cursor-preview" style="position:absolute;border-radius:50%;border:2px solid rgba(255,255,255,0.7);pointer-events:none;transform:translate(-50%,-50%);display:none"></div>
                </div>
              </div>
            </div>

            <!-- Mint panel -->
            <div style="width:240px;flex-shrink:0">
              <div style="background:var(--bg-elev);border:1px solid var(--border);border-radius:12px;padding:16px;display:flex;flex-direction:column;gap:12px">
                <h3 style="margin:0">Mint Your NFT</h3>
                <div>
                  <div style="font-size:0.75rem;color:var(--text-dim);text-transform:uppercase;margin-bottom:4px">NFT Name</div>
                  <input id="draw-nft-name" type="text" maxlength="40" placeholder="My Masterpiece" style="width:100%;box-sizing:border-box" />
                </div>
                <div>
                  <div style="font-size:0.75rem;color:var(--text-dim);text-transform:uppercase;margin-bottom:4px">Description</div>
                  <input id="draw-nft-desc" type="text" maxlength="200" placeholder="A one-of-a-kind creation" style="width:100%;box-sizing:border-box" />
                </div>
                <div style="background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:10px">
                  <div style="font-size:0.72rem;color:var(--text-dim);margin-bottom:6px">Preview</div>
                  <canvas id="nft-draw-preview" width="160" height="160" style="display:block;width:100%;border-radius:4px;background:#1a1a2e"></canvas>
                </div>
                <button id="draw-mint-btn" class="primary-btn">🪄 Mint NFT (Free)</button>
                <div id="draw-mint-result" style="font-size:0.82rem;text-align:center"></div>
              </div>
            </div>
          </div>
        </div>

        <!-- INBOX TAB -->
        <div id="nft-tab-inbox" style="display:none">
          <div id="nft-inbox-list" style="display:flex;flex-direction:column;gap:8px"></div>
        </div>

        <!-- SENT TAB -->
        <div id="nft-tab-sent" style="display:none">
          <div id="nft-sent-list" style="display:flex;flex-direction:column;gap:8px"></div>
        </div>

        <!-- CREATE TRADE TAB -->
        <div id="nft-tab-create" style="display:none">
          <div style="background:var(--bg-elev);border:1px solid var(--border);border-radius:12px;padding:16px">
            <h3 style="margin:0 0 12px">Create Trade Offer</h3>
            <div style="display:flex;flex-direction:column;gap:10px">
              <div>
                <div style="font-size:0.75rem;color:var(--text-dim);text-transform:uppercase;margin-bottom:4px">To Player (username)</div>
                <input id="trade-to" type="text" placeholder="e.g. player123" style="width:100%;box-sizing:border-box" />
              </div>
              <div style="display:flex;gap:10px">
                <div style="flex:1">
                  <div style="font-size:0.75rem;color:var(--text-dim);text-transform:uppercase;margin-bottom:4px">You Offer (chips)</div>
                  <input id="trade-offer-chips" type="number" value="0" min="0" style="width:100%;box-sizing:border-box" />
                </div>
                <div style="flex:1">
                  <div style="font-size:0.75rem;color:var(--text-dim);text-transform:uppercase;margin-bottom:4px">You Want (chips)</div>
                  <input id="trade-req-chips" type="number" value="0" min="0" style="width:100%;box-sizing:border-box" />
                </div>
              </div>
              <div>
                <div style="font-size:0.75rem;color:var(--text-dim);text-transform:uppercase;margin-bottom:4px">Message (optional)</div>
                <input id="trade-msg" type="text" maxlength="200" placeholder="Optional message to recipient" style="width:100%;box-sizing:border-box" />
              </div>
              <button id="trade-submit" class="primary-btn">Send Trade Offer</button>
              <div id="trade-result" style="font-size:0.85rem;margin-top:4px"></div>
            </div>
          </div>
        </div>
      </div>`;

    // ── Tab switching ─────────────────────────────────────────────
    const TABS = ["collection", "draw", "inbox", "sent", "create"];
    document.querySelectorAll(".nft-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        document.querySelectorAll(".nft-tab").forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");
        const name = tab.dataset.tab;
        TABS.forEach((t) => {
          document.getElementById(`nft-tab-${t}`).style.display = t === name ? "" : "none";
        });
        if (name === "inbox") loadInbox();
        if (name === "sent") loadSent();
        if (name === "collection") loadCollection();
      });
    });

    // ── Collection ─────────────────────────────────────────────────
    const POWER_ICONS = {
      chips_bonus: "💰", xp_bonus: "⭐", jackpot_entry: "🎰", free_spin: "🎡",
      multiplier_boost: "✖️", cashback: "🔄", bank_bonus: "🏦",
      double_chips: "2️⃣", lucky_draw: "🎲", vip_chips: "👑",
    };

    async function loadCollection() {
      const gridEl = document.getElementById("nft-grid");
      const emptyEl = document.getElementById("nft-empty");
      try {
        const { nfts } = await Api.get("/nfts/collection");
        if (!nfts.length) { gridEl.innerHTML = ""; emptyEl.style.display = ""; return; }
        emptyEl.style.display = "none";
        gridEl.innerHTML = nfts.map((nft) => {
          const color = RARITY_COLOR[nft.rarity] || "#9ca3af";
          let parsedDesc = null;
          let power = null;
          let isUsed = nft.category && nft.category.endsWith("_used");
          try { parsedDesc = JSON.parse(nft.description); power = parsedDesc?.power; } catch {}
          const visual = nft.customImage
            ? `<img src="${nft.customImage}" alt="${nft.name}" style="width:80px;height:80px;object-fit:contain;border-radius:6px;margin-bottom:6px" />`
            : `<div style="font-size:2.5rem;margin-bottom:6px">${nft.emoji}</div>`;
          const powerBadge = power && !isUsed
            ? `<div style="margin:4px 0;padding:3px 8px;border-radius:8px;font-size:0.68rem;font-weight:700;background:rgba(167,139,250,0.15);border:1px solid rgba(167,139,250,0.4);color:#c4b5fd;display:inline-block">${POWER_ICONS[power.type] || "⚡"} ${power.label}</div>`
            : isUsed ? `<div style="font-size:0.68rem;color:#6b7280;margin:2px 0">✓ Power used</div>` : "";
          const useBtn = power && !isUsed
            ? `<button class="nft-coll-use-btn" data-id="${nft.id}" style="width:100%;margin-top:6px;padding:7px;background:linear-gradient(135deg,#7c3aed,#5b21b6);border:none;border-radius:8px;color:#fff;font-size:0.78rem;font-weight:700;cursor:pointer;">⚡ Use Power</button>`
            : "";
          return `<div style="background:var(--bg-elev);border:2px solid ${color};border-radius:12px;padding:12px;text-align:center;transition:transform 0.15s" onmouseover="this.style.transform='scale(1.03)'" onmouseout="this.style.transform=''">
            ${visual}
            <div style="font-weight:700;font-size:0.88rem;margin-bottom:2px">${nft.name}</div>
            <div style="font-size:0.72rem;color:${color};font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">${RARITY_LABEL[nft.rarity] || nft.rarity}</div>
            ${powerBadge}
            <div style="font-size:0.72rem;color:var(--text-dim)">${parsedDesc?.desc || nft.description}</div>
            ${useBtn}
          </div>`;
        }).join("");

        // Wire use-power buttons
        gridEl.querySelectorAll(".nft-coll-use-btn").forEach(btn => {
          btn.addEventListener("click", async () => {
            const nftId = btn.dataset.id;
            btn.disabled = true;
            btn.textContent = "Activating…";
            try {
              const r = await Api.post(`/nftmarket/use/${nftId}`);
              if (r.balance !== undefined) UI.setBalance(r.balance * 100);
              UI.toast(`⚡ ${r.effect}`, "win");
              loadCollection();
            } catch (e) {
              btn.disabled = false;
              btn.textContent = "⚡ Use Power";
              UI.toast(e.message || "Failed to use power", "loss");
            }
          });
        });
      } catch (e) {
        gridEl.innerHTML = `<div style="color:var(--text-dim)">Failed to load collection</div>`;
      }
    }

    // ── Drawing canvas ──────────────────────────────────────────────
    (function initCanvas() {
      const canvas = document.getElementById("nft-draw-canvas");
      const preview = document.getElementById("nft-draw-preview");
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      const pctx = preview.getContext("2d");

      // State
      let tool = "brush";
      let color = "#ffffff";
      let size = 8;
      let drawing = false;
      let lastX = 0, lastY = 0;
      const undoStack = [];
      const MAX_UNDO = 30;

      function saveUndo() {
        undoStack.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
        if (undoStack.length > MAX_UNDO) undoStack.shift();
      }

      function syncPreview() {
        pctx.clearRect(0, 0, preview.width, preview.height);
        pctx.drawImage(canvas, 0, 0, preview.width, preview.height);
      }

      // Fill background
      ctx.fillStyle = "#1a1a2e";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      syncPreview();

      // Tool buttons
      document.getElementById("draw-tool-brush").addEventListener("click", function() {
        tool = "brush";
        document.querySelectorAll(".draw-tool-btn").forEach(b => b.classList.remove("active"));
        this.classList.add("active");
      });
      document.getElementById("draw-tool-eraser").addEventListener("click", function() {
        tool = "eraser";
        document.querySelectorAll(".draw-tool-btn").forEach(b => b.classList.remove("active"));
        this.classList.add("active");
      });

      // Color swatches
      document.querySelectorAll(".color-swatch").forEach((swatch) => {
        swatch.addEventListener("click", () => {
          document.querySelectorAll(".color-swatch").forEach(s => s.style.borderColor = "transparent");
          swatch.style.borderColor = "#ffffff";
          color = swatch.dataset.color;
          if (tool === "eraser") {
            tool = "brush";
            document.querySelectorAll(".draw-tool-btn").forEach(b => b.classList.remove("active"));
            document.getElementById("draw-tool-brush").classList.add("active");
          }
        });
      });
      // Select first color
      document.querySelector(".color-swatch").style.borderColor = "#ffffff";

      // Size slider
      const sizeSlider = document.getElementById("draw-size");
      const sizeLabel = document.getElementById("draw-size-label");
      sizeSlider.addEventListener("input", () => {
        size = parseInt(sizeSlider.value);
        sizeLabel.textContent = size + "px";
        updateCursorPreview(null);
      });

      // Cursor preview dot
      const cursorEl = document.getElementById("draw-cursor-preview");
      function updateCursorPreview(e) {
        if (!cursorEl || !e) return;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        cursorEl.style.width = (size / scaleX) + "px";
        cursorEl.style.height = (size / scaleX) + "px";
        cursorEl.style.left = (e.clientX - rect.left) + "px";
        cursorEl.style.top = (e.clientY - rect.top) + "px";
        cursorEl.style.display = "";
      }
      canvas.addEventListener("mousemove", updateCursorPreview);
      canvas.addEventListener("mouseleave", () => { if (cursorEl) cursorEl.style.display = "none"; });

      // Undo / Clear
      document.getElementById("draw-undo").addEventListener("click", () => {
        if (!undoStack.length) return;
        ctx.putImageData(undoStack.pop(), 0, 0);
        syncPreview();
      });
      document.getElementById("draw-clear").addEventListener("click", () => {
        saveUndo();
        ctx.fillStyle = "#1a1a2e";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        syncPreview();
      });

      // Photo import — opens file picker and draws selected image onto canvas
      const importBtn = document.getElementById("draw-import-btn");
      const importInput = document.getElementById("draw-import-input");
      if (importBtn && importInput) {
        importBtn.addEventListener("click", () => importInput.click());
        importInput.addEventListener("change", () => {
          const file = importInput.files[0];
          if (!file) return;
          if (!file.type.startsWith("image/")) {
            UI.toast("Please select an image file (PNG, JPG, WEBP, etc.)", "loss");
            return;
          }
          if (file.size > 5 * 1024 * 1024) {
            UI.toast("Image too large — max 5 MB", "loss");
            return;
          }
          const reader = new FileReader();
          reader.onload = (ev) => {
            const img = new Image();
            img.onload = () => {
              saveUndo();
              // Fill background then draw image centered and scaled to fit 400×400
              ctx.fillStyle = "#1a1a2e";
              ctx.fillRect(0, 0, canvas.width, canvas.height);
              const scale = Math.min(canvas.width / img.width, canvas.height / img.height);
              const drawW = img.width * scale;
              const drawH = img.height * scale;
              const drawX = (canvas.width - drawW) / 2;
              const drawY = (canvas.height - drawH) / 2;
              ctx.drawImage(img, drawX, drawY, drawW, drawH);
              syncPreview();
              UI.toast("Photo imported — draw on top or mint directly!", "win");
            };
            img.src = ev.target.result;
          };
          reader.readAsDataURL(file);
          importInput.value = ""; // allow re-selecting same file
        });
      }

      // Draw helpers
      function getPos(e) {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        if (e.touches) {
          return {
            x: (e.touches[0].clientX - rect.left) * scaleX,
            y: (e.touches[0].clientY - rect.top) * scaleY,
          };
        }
        return {
          x: (e.clientX - rect.left) * scaleX,
          y: (e.clientY - rect.top) * scaleY,
        };
      }

      function startDraw(e) {
        e.preventDefault();
        drawing = true;
        saveUndo();
        const pos = getPos(e);
        lastX = pos.x; lastY = pos.y;
        ctx.globalCompositeOperation = tool === "eraser" ? "destination-out" : "source-over";
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = size;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.beginPath();
        ctx.arc(lastX, lastY, size / 2, 0, Math.PI * 2);
        ctx.fill();
        syncPreview();
      }

      function doDraw(e) {
        e.preventDefault();
        if (!drawing) return;
        const pos = getPos(e);
        ctx.globalCompositeOperation = tool === "eraser" ? "destination-out" : "source-over";
        ctx.strokeStyle = color;
        ctx.lineWidth = size;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.beginPath();
        ctx.moveTo(lastX, lastY);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
        lastX = pos.x; lastY = pos.y;
        syncPreview();
      }

      function endDraw(e) {
        if (e) e.preventDefault();
        drawing = false;
        ctx.globalCompositeOperation = "source-over";
      }

      canvas.addEventListener("mousedown", startDraw);
      canvas.addEventListener("mousemove", doDraw);
      canvas.addEventListener("mouseup", endDraw);
      canvas.addEventListener("mouseleave", endDraw);
      canvas.addEventListener("touchstart", startDraw, { passive: false });
      canvas.addEventListener("touchmove", doDraw, { passive: false });
      canvas.addEventListener("touchend", endDraw, { passive: false });

      // Mint button
      document.getElementById("draw-mint-btn").addEventListener("click", async () => {
        const name = document.getElementById("draw-nft-name").value.trim();
        const description = document.getElementById("draw-nft-desc").value.trim();
        const resultEl = document.getElementById("draw-mint-result");
        const mintBtn = document.getElementById("draw-mint-btn");

        if (!name) { resultEl.style.color = "var(--loss)"; resultEl.textContent = "Please enter a name for your NFT"; return; }

        const imageData = canvas.toDataURL("image/png");
        mintBtn.disabled = true;
        resultEl.style.color = "var(--text-dim)";
        resultEl.textContent = "Minting…";

        try {
          await Api.post("/nfts/mint-drawing", { name, description, imageData });
          resultEl.style.color = "var(--win)";
          resultEl.textContent = "✅ NFT minted! Check your collection.";
          document.getElementById("draw-nft-name").value = "";
          document.getElementById("draw-nft-desc").value = "";
          UI.toast("NFT minted: " + name, "win");
        } catch (e) {
          resultEl.style.color = "var(--loss)";
          resultEl.textContent = e.message || "Mint failed";
        }
        mintBtn.disabled = false;
      });
    })();

    // ── Inbox ──────────────────────────────────────────────────────
    async function loadInbox() {
      const listEl = document.getElementById("nft-inbox-list");
      try {
        const { offers } = await Api.get("/nfts/trade/inbox");
        if (!offers.length) { listEl.innerHTML = '<div style="color:var(--text-dim);text-align:center;padding:20px">No pending trade offers</div>'; return; }
        listEl.innerHTML = offers.map((o) => renderOffer(o, true)).join("");
        listEl.querySelectorAll(".accept-btn").forEach((btn) => {
          btn.addEventListener("click", async () => {
            btn.disabled = true;
            try {
              await Api.post(`/nfts/trade/${btn.dataset.id}/accept`, {});
              UI.toast("Trade accepted!", "win");
              loadInbox();
              App.refreshAccount();
            } catch (e) { UI.toast(e.message, "loss"); btn.disabled = false; }
          });
        });
        listEl.querySelectorAll(".decline-btn").forEach((btn) => {
          btn.addEventListener("click", async () => {
            btn.disabled = true;
            try {
              await Api.post(`/nfts/trade/${btn.dataset.id}/decline`, {});
              UI.toast("Trade declined", "info");
              loadInbox();
            } catch (e) { UI.toast(e.message, "loss"); btn.disabled = false; }
          });
        });
      } catch (e) {
        listEl.innerHTML = `<div style="color:var(--text-dim)">Failed to load</div>`;
      }
    }

    // ── Sent ───────────────────────────────────────────────────────
    async function loadSent() {
      const listEl = document.getElementById("nft-sent-list");
      try {
        const { offers } = await Api.get("/nfts/trade/sent");
        if (!offers.length) { listEl.innerHTML = '<div style="color:var(--text-dim);text-align:center;padding:20px">No sent trade offers</div>'; return; }
        listEl.innerHTML = offers.map((o) => renderOffer(o, false)).join("");
        listEl.querySelectorAll(".cancel-btn").forEach((btn) => {
          btn.addEventListener("click", async () => {
            btn.disabled = true;
            try {
              await Api.post(`/nfts/trade/${btn.dataset.id}/decline`, {});
              UI.toast("Trade cancelled", "info");
              loadSent();
            } catch (e) { UI.toast(e.message, "loss"); btn.disabled = false; }
          });
        });
      } catch (e) {
        listEl.innerHTML = `<div style="color:var(--text-dim)">Failed to load</div>`;
      }
    }

    function renderOffer(o, isIncoming) {
      const other = isIncoming ? o.from : o.to;
      const statusColor = { pending: "var(--accent)", accepted: "var(--win)", declined: "var(--loss)", cancelled: "var(--text-dim)" }[o.status] || "var(--text-dim)";
      return `<div style="background:var(--bg-elev);border:1px solid var(--border);border-radius:10px;padding:12px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <div style="font-weight:700">${isIncoming ? "From" : "To"}: ${other.username} <span style="font-size:0.75rem;color:var(--text-dim)">(${other.rank})</span></div>
          <span style="font-size:0.75rem;font-weight:700;color:${statusColor};text-transform:uppercase">${o.status}</span>
        </div>
        <div style="font-size:0.83rem;color:var(--text-dim)">
          ${o.offeredChips ? `Offering: <span style="color:var(--gold)">${(o.offeredChips/100).toLocaleString()} 🪙</span>` : ""}
          ${o.requestedChips ? ` · Wants: <span style="color:var(--gold)">${(o.requestedChips/100).toLocaleString()} 🪙</span>` : ""}
          ${o.message ? `<div style="margin-top:4px;font-style:italic">"${o.message}"</div>` : ""}
        </div>
        ${o.status === "pending" ? `<div style="display:flex;gap:6px;margin-top:8px">
          ${isIncoming ? `<button class="primary-btn accept-btn" data-id="${o.id}" style="flex:1">Accept</button>` : ""}
          <button class="secondary-btn ${isIncoming ? "decline-btn" : "cancel-btn"}" data-id="${o.id}" style="flex:1">${isIncoming ? "Decline" : "Cancel"}</button>
        </div>` : ""}
      </div>`;
    }

    // ── Trade create ───────────────────────────────────────────────
    document.getElementById("trade-submit").addEventListener("click", async () => {
      const toUsername = document.getElementById("trade-to").value.trim();
      const offeredChips = Math.round(Number(document.getElementById("trade-offer-chips").value) * 100);
      const requestedChips = Math.round(Number(document.getElementById("trade-req-chips").value) * 100);
      const message = document.getElementById("trade-msg").value.trim();
      const tradeResult = document.getElementById("trade-result");
      const btn = document.getElementById("trade-submit");

      if (!toUsername) return UI.toast("Enter a username", "loss");
      btn.disabled = true;
      try {
        await Api.post("/nfts/trade/offer", { toUsername, offeredChips, requestedChips, message: message || undefined });
        tradeResult.style.color = "var(--win)";
        tradeResult.textContent = "✅ Trade offer sent!";
        document.getElementById("trade-to").value = "";
        document.getElementById("trade-offer-chips").value = "0";
        document.getElementById("trade-req-chips").value = "0";
        document.getElementById("trade-msg").value = "";
      } catch (e) {
        tradeResult.style.color = "var(--loss)";
        tradeResult.textContent = e.message;
      }
      btn.disabled = false;
    });

    loadCollection();
  }

  return { render };
})();
