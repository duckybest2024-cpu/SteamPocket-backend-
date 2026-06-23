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
            <h2>GrilledCoin — Windows App</h2>
            <p>The full casino experience as a native Windows desktop application.<br>
            No browser needed — the server runs locally on your machine.</p>
            <a class="dl-btn" href="#" id="dl-download-btn">
              ⬇️ Download for Windows (.exe)
            </a>
          </div>
        </div>

        <div class="dl-features">
          <div class="dl-feature">
            <div class="dl-feature-icon">⚡</div>
            <div class="dl-feature-title">Faster Performance</div>
            <div class="dl-feature-desc">Runs the server locally — zero network latency on game calls.</div>
          </div>
          <div class="dl-feature">
            <div class="dl-feature-icon">📦</div>
            <div class="dl-feature-title">Self-Contained</div>
            <div class="dl-feature-desc">No Node.js or setup required. Single .exe installer does everything.</div>
          </div>
          <div class="dl-feature">
            <div class="dl-feature-icon">🔒</div>
            <div class="dl-feature-title">Local Database</div>
            <div class="dl-feature-desc">Your account and chips are stored in %APPDATA% — private and persistent.</div>
          </div>
          <div class="dl-feature">
            <div class="dl-feature-icon">🎮</div>
            <div class="dl-feature-title">All Games Included</div>
            <div class="dl-feature-desc">Every game available on the web version works in the desktop app.</div>
          </div>
        </div>

        <div class="dl-steps">
          <h3>📋 How to Install</h3>
          <div class="dl-step">
            <div class="dl-step-num">1</div>
            <div class="dl-step-text">
              <strong>Download the installer</strong> — Click the button above to download
              <code>GrilledCoin Setup 1.0.0.exe</code>
            </div>
          </div>
          <div class="dl-step">
            <div class="dl-step-num">2</div>
            <div class="dl-step-text">
              <strong>Run the installer</strong> — Double-click the .exe and follow the install wizard.
              Windows SmartScreen may warn you — click "More info" → "Run anyway".
            </div>
          </div>
          <div class="dl-step">
            <div class="dl-step-num">3</div>
            <div class="dl-step-text">
              <strong>Launch the app</strong> — Open GrilledCoin from the Start Menu or desktop shortcut.
              The server starts automatically on first launch (takes ~5 seconds).
            </div>
          </div>
          <div class="dl-step">
            <div class="dl-step-num">4</div>
            <div class="dl-step-text">
              <strong>Create an account</strong> — Register a new local account. Your data is stored only on this machine.
            </div>
          </div>
        </div>

        <div class="dl-req">
          <h3>System Requirements</h3>
          <ul>
            <li>Windows 10 or Windows 11 (64-bit)</li>
            <li>4 GB RAM minimum (8 GB recommended)</li>
            <li>200 MB free disk space</li>
            <li>Internet connection not required after installation</li>
          </ul>
          <div class="dl-note">
            ⚠️ The desktop app uses a separate local database — your web account and local account are independent.
            Chips and progress do not sync between the web and desktop versions.
          </div>
        </div>
      </div>
    `;

    const dlBtn = container.querySelector("#dl-download-btn");
    dlBtn.addEventListener("click", (e) => {
      e.preventDefault();
      UI.toast("Build the Windows installer with: cd windows-app && npm install && npm run dist:win", "info");
    });
  }

  return { render };
})();
