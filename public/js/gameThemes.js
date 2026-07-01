// Shared cosmetic skin system used by every game. Themes only override CSS
// colour variables (and an optional emoji/symbol set) — game math/rules never change.
const GameThemes = (() => {
  const VAR_KEYS = ["--bg", "--bg-card", "--bg-elev", "--accent", "--accent-d", "--win", "--loss", "--gold", "--border"];

  const THEMES = [
    { id: "classic",  name: "Classic",        icon: "🎰", vars: {} },
    { id: "neon",     name: "Neon Cyber",      icon: "🌃", vars: {
      "--bg": "#0a0118", "--bg-card": "#150726", "--bg-elev": "#1f0d38", "--border": "#3a1a5c",
      "--accent": "#ff2bd6", "--accent-d": "#c400a3", "--win": "#00f0ff", "--loss": "#ff2b54", "--gold": "#ffe600",
    } },
    { id: "egyptian", name: "Egyptian Gold",   icon: "🏺", vars: {
      "--bg": "#1a1206", "--bg-card": "#2b1d0d", "--bg-elev": "#3a2814", "--border": "#5c4322",
      "--accent": "#d4af37", "--accent-d": "#b8941f", "--win": "#2ecc71", "--loss": "#c0392b", "--gold": "#ffd700",
    } },
    { id: "pirate",   name: "Pirate Treasure", icon: "🏴‍☠️", vars: {
      "--bg": "#0c1b1f", "--bg-card": "#16282d", "--bg-elev": "#1f363c", "--border": "#335258",
      "--accent": "#2a9d8f", "--accent-d": "#1f7a6f", "--win": "#43aa8b", "--loss": "#d62828", "--gold": "#e9c46a",
    } },
    { id: "space",    name: "Space Odyssey",   icon: "🪐", vars: {
      "--bg": "#08081a", "--bg-card": "#12122e", "--bg-elev": "#1a1a42", "--border": "#2e2e5c",
      "--accent": "#7c4dff", "--accent-d": "#5e35d1", "--win": "#00e5ff", "--loss": "#ff5252", "--gold": "#ffd54f",
    } },
    { id: "halloween", name: "Halloween",      icon: "🎃", vars: {
      "--bg": "#0d0510", "--bg-card": "#1a0a20", "--bg-elev": "#261030", "--border": "#4a1f5c",
      "--accent": "#ff7518", "--accent-d": "#d65f0f", "--win": "#7cfc00", "--loss": "#ff1744", "--gold": "#ffae00",
    } },
    { id: "christmas", name: "Christmas",      icon: "🎄", vars: {
      "--bg": "#06140d", "--bg-card": "#0c2417", "--bg-elev": "#133420", "--border": "#1f5034",
      "--accent": "#c0392b", "--accent-d": "#962d22", "--win": "#2ecc71", "--loss": "#e74c3c", "--gold": "#f1c40f",
    } },
    { id: "jungle",   name: "Jungle Safari",   icon: "🌴", vars: {
      "--bg": "#0c1707", "--bg-card": "#16270d", "--bg-elev": "#203713", "--border": "#355420",
      "--accent": "#6fbf3a", "--accent-d": "#559c2a", "--win": "#8bc34a", "--loss": "#c0392b", "--gold": "#e0a83a",
    } },
    { id: "royal",    name: "Royal Luxury",    icon: "👑", vars: {
      "--bg": "#0e0814", "--bg-card": "#1c1228", "--bg-elev": "#2a1c3c", "--border": "#43275c",
      "--accent": "#a855f7", "--accent-d": "#8b3ce0", "--win": "#34d399", "--loss": "#ef4444", "--gold": "#ffd700",
    } },
    { id: "retro",    name: "Retro Arcade",    icon: "🕹️", vars: {
      "--bg": "#120024", "--bg-card": "#1f0040", "--bg-elev": "#2d0060", "--border": "#4b0082",
      "--accent": "#ff00de", "--accent-d": "#cc00b2", "--win": "#00ffea", "--loss": "#ff3864", "--gold": "#ffe700",
    } },
  ];

  function get(themeId) {
    return THEMES.find((t) => t.id === themeId) || THEMES[0];
  }

  function getSaved(gameKey) {
    // Per-game choice wins; otherwise fall back to the global default theme.
    return localStorage.getItem(`gc_theme_${gameKey}`) || getGlobal();
  }

  function save(gameKey, themeId) {
    localStorage.setItem(`gc_theme_${gameKey}`, themeId);
  }

  // ── Global / default theme (set from Settings, applies app-wide) ──────────
  function getGlobal() {
    return localStorage.getItem("gc_theme_default") || "classic";
  }

  function setGlobal(themeId) {
    localStorage.setItem("gc_theme_default", themeId);
    // Clear per-game overrides so the chosen theme applies everywhere.
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith("gc_theme_") && k !== "gc_theme_default") localStorage.removeItem(k);
    }
  }

  // Apply a theme's CSS variables to the whole app (document root).
  function applyGlobal(themeId) {
    const theme = get(themeId);
    const root = document.documentElement;
    VAR_KEYS.forEach((k) => root.style.removeProperty(k));
    Object.entries(theme.vars).forEach(([k, v]) => root.style.setProperty(k, v));
    root.dataset.theme = themeId;
  }

  // Applies a theme's CSS variable overrides to the nearest .game-layout
  // element inside `container` (falls back to `container` itself).
  function apply(container, themeId) {
    const theme = get(themeId);
    const target = container.querySelector(".game-layout") || container;
    VAR_KEYS.forEach((k) => target.style.removeProperty(k));
    Object.entries(theme.vars).forEach(([k, v]) => target.style.setProperty(k, v));
    target.dataset.theme = themeId;
  }

  function renderPicker(/* gameKey, currentThemeId */) {
    // The per-game theme row was moved into Settings → 🎨 Theme (one global
    // skin for the whole app), so games no longer render their own picker.
    return "";
  }

  // Wires click handlers for a picker rendered with `renderPicker`, applying
  // the chosen theme immediately and persisting it for next visit.
  function wirePicker(container, gameKey, onChange) {
    const picker = container.querySelector(`.theme-picker[data-game="${gameKey}"]`);
    if (!picker) return;
    picker.querySelectorAll(".theme-swatch").forEach((btn) => {
      btn.addEventListener("click", () => {
        const themeId = btn.dataset.theme;
        save(gameKey, themeId);
        apply(container, themeId);
        picker.querySelectorAll(".theme-swatch").forEach((b) => b.classList.toggle("active", b === btn));
        if (onChange) onChange(themeId);
      });
    });
  }

  // Convenience: render + apply + wire in one call. Call this once near the
  // end of a game's render(), after container.innerHTML has been set.
  function init(container, gameKey) {
    const saved = getSaved(gameKey);
    apply(container, saved);
    wirePicker(container, gameKey);
  }

  return { THEMES, get, getSaved, save, apply, renderPicker, wirePicker, init, getGlobal, setGlobal, applyGlobal };
})();
