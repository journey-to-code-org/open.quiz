export const COLOR_MODES = ["light", "dark", "system"];
export const COLOR_MODE_TOGGLE_POSITIONS = ["header", "footer", "bottom-right", "bottom-left"];
export const DEFAULT_COLOR_MODE_SETTINGS = Object.freeze({
  default: "light",
  showToggle: true,
  togglePosition: "header",
});

const PREFERENCE_KEY = "openquiz:color-mode";
const SITE_SETTINGS_KEY = "openquiz:site-color-mode";

export function normalizeColorModeSettings(value) {
  const source = value && typeof value === "object" ? value : {};
  return {
    default: COLOR_MODES.includes(source.default)
      ? source.default
      : DEFAULT_COLOR_MODE_SETTINGS.default,
    showToggle:
      typeof source.showToggle === "boolean"
        ? source.showToggle
        : DEFAULT_COLOR_MODE_SETTINGS.showToggle,
    togglePosition: COLOR_MODE_TOGGLE_POSITIONS.includes(source.togglePosition)
      ? source.togglePosition
      : DEFAULT_COLOR_MODE_SETTINGS.togglePosition,
  };
}

export function resolveColorMode(settings, preference, prefersDark) {
  const choice = settings.showToggle && preference ? preference : settings.default;
  if (choice === "system") return prefersDark ? "dark" : "light";
  return choice === "dark" ? "dark" : "light";
}

function storage() {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function readColorModePreference() {
  const value = storage()?.getItem(PREFERENCE_KEY);
  return value === "light" || value === "dark" ? value : null;
}

export function writeColorModePreference(mode) {
  const store = storage();
  if (!store) return;
  try {
    if (mode === "light" || mode === "dark") store.setItem(PREFERENCE_KEY, mode);
    else store.removeItem(PREFERENCE_KEY);
  } catch {
    // Storage can be unavailable in private browsing; the choice still applies for this visit.
  }
}

export function readCachedColorModeSettings() {
  try {
    const raw = storage()?.getItem(SITE_SETTINGS_KEY);
    return raw ? normalizeColorModeSettings(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function cacheColorModeSettings(settings) {
  try {
    storage()?.setItem(SITE_SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Caching only avoids a flash of the wrong mode on the next visit.
  }
}

export function prefersDarkColorScheme() {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
}
