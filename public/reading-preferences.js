(() => {
  "use strict";

  const STORAGE_KEY = "tjdft-dashboard:reading-preferences:v1";
  const DEFAULTS = Object.freeze({
    appearance: "light",
    readingMode: false,
    textScale: "normal",
    reduceMotion: false,
  });
  const APPEARANCES = new Set(["system", "light", "dark", "sepia"]);
  const TEXT_SCALES = new Set(["small", "normal", "large"]);
  const THEME_COLORS = { dark: "#0b1620", sepia: "#f3ede2", light: "#f4f8fa" };
  let memoryPreferences = { ...DEFAULTS };

  function normalize(value) {
    const candidate = value && typeof value === "object" ? value : {};
    return {
      appearance: APPEARANCES.has(candidate.appearance) ? candidate.appearance : DEFAULTS.appearance,
      readingMode: candidate.readingMode === true,
      textScale: TEXT_SCALES.has(candidate.textScale) ? candidate.textScale : DEFAULTS.textScale,
      reduceMotion: candidate.reduceMotion === true,
    };
  }

  function read() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      const next = normalize(raw ? JSON.parse(raw) : DEFAULTS);
      memoryPreferences = next;
      return { ...next };
    } catch {
      return { ...memoryPreferences };
    }
  }

  function resolvedAppearance(appearance) {
    if (appearance !== "system") return appearance;
    return window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ? "dark" : "light";
  }

  function apply(value) {
    const next = normalize(value);
    const resolved = resolvedAppearance(next.appearance);
    const root = document.documentElement;
    root.dataset.appearance = next.appearance;
    root.dataset.colorMode = resolved;
    root.dataset.readingMode = String(next.readingMode);
    root.dataset.textScale = next.textScale;
    root.dataset.reduceMotion = String(next.reduceMotion);
    const themeColor = document.querySelector('meta[name="theme-color"]');
    if (themeColor) themeColor.setAttribute("content", THEME_COLORS[resolved] || THEME_COLORS.light);
    root.style.colorScheme = next.appearance === "system" ? "light dark" : resolved;
    return next;
  }

  function write(value) {
    const next = apply(value);
    memoryPreferences = next;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Private browsing can deny storage; this session remains usable.
    }
    window.dispatchEvent(new CustomEvent("tjdft-reading-preferences-change", { detail: next }));
    return next;
  }

  window.TJDFTReadingPreferences = { key: STORAGE_KEY, defaults: { ...DEFAULTS }, read, write, apply };
  apply(read());
  window.addEventListener("tjdft-reading-preferences-change", (event) => {
    apply(normalize(event.detail));
  });
  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY) return;
    const next = read();
    apply(next);
  });
  window.matchMedia?.("(prefers-color-scheme: dark)")?.addEventListener?.("change", () => {
    const current = read();
    if (current.appearance === "system") apply(current);
  });
})();
