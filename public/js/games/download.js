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
      </style>

      <div class="dl-wrap">
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
              <code>GrilledCoin-Windows.zip</code>, then unzip it anywhere.
            </div>
          </div>
          <div class="dl-step">
            <div class="dl-step-num">2</div>
            <div class="dl-step-text">
              <strong>Install Node.js</strong> (one time) — Grab the free LTS build from
              <code>nodejs.org</code> if you don't already have it.
            </div>
          </div>
          <div class="dl-step">
            <div class="dl-step-num">3</div>
            <div class="dl-step-text">
              <strong>Run the launcher</strong> — Double-click <code>START.bat</code> (Windows) or
              <code>START.command</code> (Mac/Linux). The first launch sets things up in about a minute.
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
            <li>Node.js 18 or newer (free, one-time install)</li>
            <li>4 GB RAM minimum (8 GB recommended)</li>
            <li>Internet connection (connects to the live GrilledCoin servers)</li>
          </ul>
          <div class="dl-note">
            ⚠️ Windows SmartScreen may warn about the launcher script — click "More info" → "Run anyway".
            The launcher only installs Electron and opens the GrilledCoin window.
          </div>
        </div>
      </div>
    `;

    const dlBtn = container.querySelector("#dl-download-btn");
    dlBtn.addEventListener("click", () => {
      UI.toast("Download starting — unzip it and run START.bat", "info");
    });
  }

  return { render };
})();
