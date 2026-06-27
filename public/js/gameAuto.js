/**
 * Shared Auto-bet wiring for the single-action games (Dice, Limbo, Plinko,
 * Keno, Slots, Wheel, etc.). It turns the existing Manual/Auto tabs and the
 * play button into a working auto-runner so a game module just needs to hand
 * over its single-play function.
 *
 * Usage from a game's render():
 *   GameAuto.setup(container, {
 *     playBtn: els.betBtn,          // the main play/roll/spin button
 *     play: async () => { ... },    // performs ONE bet; throw to abort the batch
 *   });
 *
 * The game must NOT also bind its own click handler on playBtn — this owns it.
 */
const GameAuto = (() => {
  function setup(container, opts) {
    const playBtn = opts.playBtn;
    const play = opts.play;
    if (!playBtn || typeof play !== "function") return;

    const tabs = opts.tabs || container.querySelectorAll(".bp-tab");
    const manualLabel = opts.manualLabel || playBtn.textContent || "Bet";

    // Inject the "number of bets" box just above the play button.
    const autoWrap = document.createElement("div");
    autoWrap.className = "bp-field";
    autoWrap.style.display = "none";
    autoWrap.innerHTML =
      '<div class="bp-label">Number of Bets (0 = until stopped)</div>' +
      '<input type="number" class="ga-auto-count" value="10" min="0" step="1" />';
    if (playBtn.parentNode) playBtn.parentNode.insertBefore(autoWrap, playBtn);
    const countInput = autoWrap.querySelector(".ga-auto-count");

    let autoMode = false;
    let running = false;
    let busy = false;

    tabs.forEach((t) => {
      t.addEventListener("click", function () {
        if (running) return; // don't switch modes mid-run
        tabs.forEach((x) => x.classList.remove("active"));
        this.classList.add("active");
        autoMode = /auto/i.test(this.id || "") || /auto/i.test(this.textContent || "");
        autoWrap.style.display = autoMode ? "" : "none";
        playBtn.textContent = autoMode ? "Start Auto" : manualLabel;
      });
    });

    async function runAuto() {
      if (running) { running = false; return; } // second click = stop
      const target = Math.max(0, Math.floor(Number(countInput.value) || 0)); // 0 = endless
      running = true;
      playBtn.textContent = "Stop";
      playBtn.classList.add("danger");
      tabs.forEach((t) => (t.style.pointerEvents = "none"));
      let done = 0;
      try {
        while (running && (target === 0 || done < target)) {
          await play();
          done++;
          if (running && (target === 0 || done < target)) {
            await new Promise((r) => setTimeout(r, 500));
          }
        }
      } catch (e) {
        // Stop the batch on any error (e.g. insufficient balance) — play() toasts.
      }
      running = false;
      playBtn.textContent = "Start Auto";
      playBtn.classList.remove("danger");
      tabs.forEach((t) => (t.style.pointerEvents = ""));
    }

    playBtn.addEventListener("click", async () => {
      if (autoMode) return runAuto();
      if (busy) return;
      busy = true;
      try { await play(); } catch (e) { /* play() already toasts */ }
      busy = false;
    });
  }

  return { setup };
})();
