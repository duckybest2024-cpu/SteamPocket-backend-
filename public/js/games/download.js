const DownloadGame = (() => {
  function render(container) {
    container.innerHTML = `
      <style>
        .dl-wrap { padding: 24px; max-width: 800px; }
        .dl-hero {
          background: linear-gradient(135deg, #0f212e 0%, #1a0a33 60%, #0f2140 100%);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 36px 32px;
          margin-bottom: 24px;
          display: flex;
          align-items: center;
          gap: 28px;
          flex-wrap: wrap;
        }
        .dl-hero-icon { font-size: 4rem; flex-shrink: 0; }
        .dl-hero-text h2 { font-size: 1.6rem; font-weight: 800; margin: 0 0 6px; }
        .dl-hero-text p { color: var(--text-dim); margin: 0; font-size: 0.95rem; line-height: 1.5; }
        .dl-btn {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          margin-top: 18px;
          padding: 14px 28px;
          background: linear-gradient(135deg, #34d399, #10b981);
          color: #071a10;
          font-weight: 700;
          font-size: 1rem;
          border: none;
          border-radius: 12px;
          cursor: pointer;
          text-decoration: none;
          transition: filter 0.15s;
        }
        .dl-btn:hover { filter: brightness(1.1); }
        .dl-features {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
          gap: 14px;
          margin-bottom: 24px;
        }
        .dl-feature {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 18px;
        }
        .dl-feature-icon { font-size: 1.6rem; margin-bottom: 8px; }
        .dl-feature-title { font-weight: 700; margin-bottom: 4px; }
        .dl-feature-desc { font-size: 0.82rem; color: var(--text-dim); line-height: 1.4; }
        .dl-steps {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 22px;
          margin-bottom: 24px;
        }
        .dl-steps h3 { margin: 0 0 16px; font-size: 1rem; font-weight: 800; }
        .dl-step {
          display: flex;
          gap: 14px;
          align-items: flex-start;
          margin-bottom: 14px;
        }
        .dl-step:last-child { margin-bottom: 0; }
        .dl-step-num {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: rgba(52,211,153,0.2);
          border: 1px solid rgba(52,211,153,0.5);
          color: var(--win);
          font-weight: 800;
          font-size: 0.85rem;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .dl-step-text { font-size: 0.9rem; color: var(--text-dim); line-height: 1.5; }
        .dl-step-text strong { color: var(--text); }
        .dl-req {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 22px;
        }
        .dl-req h3 { margin: 0 0 12px; font-size: 1rem; font-weight: 800; }
        .dl-req ul { margin: 0; padding-left: 18px; color: var(--text-dim); font-size: 0.9rem; line-height: 1.8; }
        .dl-note {
          margin-top: 18px;
          padding: 12px 16px;
          background: rgba(240,194,68,0.08);
          border: 1px solid rgba(240,194,68,0.3);
          border-radius: 10px;
          font-size: 0.83rem;
          color: var(--gold);
        }
        .dl-mobile-hero { background: linear-gradient(135deg, #0f212e 0%, #0a2e22 60%, #0f2140 100%); }
        .dl-mobile-platforms {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-top: 14px;
        }
        .dl-mobile-chip {
          padding: 5px 12px;
          background: rgba(255,255,255,0.06);
          border: 1px solid var(--border);
          border-radius: 20px;
          font-size: 0.78rem;
          color: var(--text-dim);
        }
        .dl-ios-steps {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 22px;
          margin-bottom: 24px;
        }
        .dl-ios-steps h3 { margin: 0 0 16px; font-size: 1rem; font-weight: 800; }
        .dl-installed-badge {
          margin-top: 18px;
          padding: 12px 16px;
          background: rgba(52,211,153,0.1);
          border: 1px solid rgba(52,211,153,0.4);
          border-radius: 10px;
          font-size: 0.9rem;
          color: var(--win);
          font-weight: 700;
        }
      </style>

      <div class="dl-wrap">
        <div class="dl-hero dl-mobile-hero">
          <div class="dl-hero-icon">📱</div>
          <div class="dl-hero-text">
            <h2>GrilledCoin — Mobile App</h2>
            <p>Install GrilledCoin straight to your home screen — it opens full-screen
            like a real app, with its own icon, no address bar.</p>
            <div id="dl-mobile-action"></div>
            <div class="dl-mobile-platforms">
              <span class="dl-mobile-chip">🤖 Android (Samsung, Xiaomi, Redmi, Pixel, OnePlus...)</span>
              <span class="dl-mobile-chip"> iOS (iPhone &amp; iPad, via Safari)</span>
            </div>
          </div>
        </div>

        <div id="dl-ios-instructions"></div>

        <div class="dl-hero">
          <div class="dl-hero-icon">🖥️</div>
          <div class="dl-hero-text">
            <h2>GrilledCoin — Desktop App</h2>
            <p>GrilledCoin in its own native desktop window — no browser tabs,
            no address bar. Works on Windows, macOS and Linux.</p>
            <a class="dl-btn" href="/downloads/GrilledCoin-Windows.zip" id="dl-download-btn" download="GrilledCoin-Windows.zip">
              ⬇️ Download GrilledCoin (.zip)
            </a>
          </div>
        </div>

        <div class="dl-features">
          <div class="dl-feature">
            <div class="dl-feature-icon">🪟</div>
            <div class="dl-feature-title">Its Own Window</div>
            <div class="dl-feature-desc">A clean, distraction-free app window — no browser tabs or address bar.</div>
          </div>
          <div class="dl-feature">
            <div class="dl-feature-icon">💻</div>
            <div class="dl-feature-title">Cross-Platform</div>
            <div class="dl-feature-desc">One download runs on Windows, macOS and Linux.</div>
          </div>
          <div class="dl-feature">
            <div class="dl-feature-icon">🔄</div>
            <div class="dl-feature-title">Same Account</div>
            <div class="dl-feature-desc">Connects to the live servers, so your chips and progress are exactly the same as on the web.</div>
          </div>
          <div class="dl-feature">
            <div class="dl-feature-icon">🎮</div>
            <div class="dl-feature-title">All Games Included</div>
            <div class="dl-feature-desc">Every game on the web version works in the desktop app.</div>
          </div>
        </div>

        <div class="dl-steps">
          <h3>📋 How to Install</h3>
          <div class="dl-step">
            <div class="dl-step-num">1</div>
            <div class="dl-step-text">
              <strong>Download the app</strong> — Click the button above to download
              <code>GrilledCoin-Windows.zip</code>.
            </div>
          </div>
          <div class="dl-step">
            <div class="dl-step-num">2</div>
            <div class="dl-step-text">
              <strong>Extract it</strong> — Right-click the zip and choose "Extract All...", then
              open the extracted folder. (You can't run the app from inside the zip view.)
            </div>
          </div>
          <div class="dl-step">
            <div class="dl-step-num">3</div>
            <div class="dl-step-text">
              <strong>Run the launcher</strong> — Double-click <code>START.bat</code> (Windows) or
              <code>START.command</code> (Mac/Linux). If Node.js isn't installed, it's installed for
              you automatically — just run the launcher once more when it asks.
            </div>
          </div>
          <div class="dl-step">
            <div class="dl-step-num">4</div>
            <div class="dl-step-text">
              <strong>Log in</strong> — Sign in with the same GrilledCoin account you use on the web.
            </div>
          </div>
        </div>

        <div class="dl-req">
          <h3>System Requirements</h3>
          <ul>
            <li>Windows 10/11, macOS, or Linux (64-bit)</li>
            <li>4 GB RAM minimum (8 GB recommended)</li>
            <li>Internet connection (connects to the live GrilledCoin servers)</li>
          </ul>
          <div class="dl-note">
            ⚠️ Windows SmartScreen may warn about the launcher script — click "More info" → "Run anyway".
            The launcher only installs Node.js/Electron and opens the GrilledCoin window.
          </div>
        </div>
      </div>
    `;

    const dlBtn = container.querySelector("#dl-download-btn");
    dlBtn.addEventListener("click", () => {
      UI.toast("Download starting — extract the zip, then run START.bat", "info");
    });

    renderMobileInstall(container);
  }

  function isStandalone() {
    return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  }

  function isIOS() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1); // iPadOS reports as Mac
  }

  function renderMobileInstall(container) {
    const actionEl = container.querySelector("#dl-mobile-action");
    const iosEl = container.querySelector("#dl-ios-instructions");
    if (!actionEl || !iosEl) return;

    if (isStandalone()) {
      actionEl.innerHTML = `<div class="dl-installed-badge">✅ Already installed — you're running the installed app right now!</div>`;
      return;
    }

    if (window.__pwaInstallEvent) {
      actionEl.innerHTML = `<button class="dl-btn" id="dl-pwa-install-btn">📲 Install App</button>`;
      actionEl.querySelector("#dl-pwa-install-btn").addEventListener("click", async () => {
        const evt = window.__pwaInstallEvent;
        if (!evt) return;
        evt.prompt();
        const choice = await evt.userChoice.catch(() => null);
        if (choice && choice.outcome === "accepted") {
          UI.toast("Installing GrilledCoin...", "success");
          window.__pwaInstallEvent = null;
          renderMobileInstall(container);
        }
      });
      return;
    }

    if (isIOS()) {
      iosEl.innerHTML = `
        <div class="dl-ios-steps">
          <h3>📋 Install on iPhone / iPad</h3>
          <div class="dl-step">
            <div class="dl-step-num">1</div>
            <div class="dl-step-text">Open this site in <strong>Safari</strong> (not Chrome — Apple requires Safari for this).</div>
          </div>
          <div class="dl-step">
            <div class="dl-step-num">2</div>
            <div class="dl-step-text">Tap the <strong>Share</strong> button (square with an arrow pointing up).</div>
          </div>
          <div class="dl-step">
            <div class="dl-step-num">3</div>
            <div class="dl-step-text">Scroll down and tap <strong>Add to Home Screen</strong>, then tap <strong>Add</strong>.</div>
          </div>
        </div>`;
      return;
    }

    // Android/desktop browser that hasn't fired beforeinstallprompt yet (e.g. Firefox, or criteria not met)
    actionEl.innerHTML = `<button class="dl-btn" id="dl-pwa-fallback-btn">📲 How to Install</button>`;
    actionEl.querySelector("#dl-pwa-fallback-btn").addEventListener("click", () => {
      UI.toast("Open the browser menu (⋮) and tap \"Install app\" or \"Add to Home screen\"", "info");
    });
  }

  return { render };
})();
