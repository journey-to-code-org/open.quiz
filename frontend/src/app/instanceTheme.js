import {
  cacheColorModeSettings,
  DEFAULT_COLOR_MODE_SETTINGS,
  normalizeColorModeSettings,
  prefersDarkColorScheme,
  readCachedColorModeSettings,
  readColorModePreference,
  resolveColorMode,
  writeColorModePreference,
} from "./colorMode";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").trim().replace(/\/$/, "");
const themeEnvironment = {
  VITE_THEME_PRIMARY: "--instance-primary",
  VITE_THEME_PRIMARY_HOVER: "--instance-primary-hover",
  VITE_THEME_PRIMARY_ALT: "--instance-primary-alt",
  VITE_THEME_ACCENT: "--instance-accent",
  VITE_THEME_SUCCESS: "--instance-success",
  VITE_THEME_HEADING: "--instance-heading",
  VITE_THEME_FOREGROUND: "--instance-foreground",
  VITE_THEME_SURFACE: "--instance-surface-app",
  VITE_THEME_SURFACE_RAISED: "--instance-surface-raised",
  VITE_THEME_SURFACE_INSET: "--instance-surface-inset",
  VITE_THEME_FONT_HEADING: "--instance-font-heading",
  VITE_THEME_FONT_BODY: "--instance-font-body",
  VITE_THEME_RADIUS_SM: "--instance-radius-sm",
  VITE_THEME_RADIUS_MD: "--instance-radius-md",
  VITE_THEME_RADIUS_LG: "--instance-radius-lg",
  VITE_THEME_RADIUS_PILL: "--instance-radius-pill",
};
const tokenProperties = {
  primary: "--instance-primary",
  primaryHover: "--instance-primary-hover",
  primaryAlt: "--instance-primary-alt",
  accent: "--instance-accent",
  success: "--instance-success",
  progressStart: "--instance-progress-start",
  progressEnd: "--instance-progress-end",
  progressNearStart: "--instance-progress-near-start",
  progressNearEnd: "--instance-progress-near-end",
  progressCompleteStart: "--instance-progress-complete-start",
  progressCompleteEnd: "--instance-progress-complete-end",
  heading: "--instance-heading",
  foreground: "--instance-foreground",
  onPrimary: "--instance-on-primary",
  surfaceApp: "--instance-surface-app",
  surfaceRaised: "--instance-surface-raised",
  surfaceInset: "--instance-surface-inset",
  surfaceInput: "--instance-surface-input",
  focus: "--instance-focus",
  learningPathSurface: "--instance-learning-path-surface",
  learningPathText: "--instance-learning-path-text",
  learningPathHeading: "--instance-learning-path-heading",
  learningPathLine: "--instance-learning-path-line",
  learningPathMuted: "--instance-learning-path-muted",
  learningPathLabel: "--instance-learning-path-label",
  learningPathDivider: "--instance-learning-path-divider",
  learningPathFooterSurface: "--instance-learning-path-footer-surface",
  learningPathFooterBorder: "--instance-learning-path-footer-border",
  learningPathNodeCompleted: "--instance-learning-path-node-completed",
  learningPathNodeCurrent: "--instance-learning-path-node-current",
  learningPathNodeBorder: "--instance-learning-path-node-border",
  fontHeading: "--instance-font-heading",
  fontBody: "--instance-font-body",
  fontSizeH1: "--instance-font-size-h1",
  fontSizeH2: "--instance-font-size-h2",
  fontSizeH3: "--instance-font-size-h3",
  fontSizeH4: "--instance-font-size-h4",
  fontSizeBody: "--instance-font-size-body",
  fontSizeSmall: "--instance-font-size-small",
  fontSizeCaption: "--instance-font-size-caption",
  radiusSm: "--instance-radius-sm",
  radiusMd: "--instance-radius-md",
  radiusLg: "--instance-radius-lg",
  radiusPill: "--instance-radius-pill",
};
const defaultFaviconUrl =
  typeof document === "undefined"
    ? null
    : document.querySelector('link[rel="icon"]')?.getAttribute("href") || null;
let runtimeTheme = null;
let runtimeAppName = null;
let runtimeLanding = null;
let lightTokens = {};
let darkTokens = {};
let colorModeSettings = readCachedColorModeSettings() || { ...DEFAULT_COLOR_MODE_SETTINGS };
let colorModePreference = readColorModePreference();
let colorModeState = null;
let systemListenerInstalled = false;
export const INSTANCE_THEME_UPDATED_EVENT = "openquiz:theme-updated";
export const DEFAULT_APP_NAME = import.meta.env.VITE_APP_NAME?.trim() || "open.quiz";

export function normalizeAppName(value) {
  if (typeof value !== "string") return null;
  const name = value.trim().replace(/\s+/g, " ");
  return name && name.length <= 60 ? name : null;
}

export function getAppName() {
  return runtimeAppName || DEFAULT_APP_NAME;
}

export function getRuntimeLanding() {
  return runtimeLanding;
}

export function setRuntimeSiteSettings({ appName, landing, colorMode } = {}) {
  runtimeAppName = normalizeAppName(appName);
  runtimeLanding = landing && typeof landing === "object" ? landing : null;
  if (colorMode !== undefined) setColorModeSettings(colorMode);
  if (typeof document !== "undefined") paint();
  notify();
}

function notify() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(INSTANCE_THEME_UPDATED_EVENT));
}

function isColorProperty(property) {
  return !/^--instance-(font|radius)/.test(property);
}

function safeTokens(tokens) {
  if (!tokens || typeof tokens !== "object") return {};
  return Object.fromEntries(
    Object.entries(tokens).filter(
      ([name, value]) => tokenProperties[name] && typeof value === "string" && value.length <= 120,
    ),
  );
}

function setColorModeSettings(value) {
  colorModeSettings = normalizeColorModeSettings(value);
  cacheColorModeSettings(colorModeSettings);
}

/** Applies the active palette for the resolved light/dark mode to <html>. */
function paint() {
  const root = document.documentElement;
  const mode = resolveColorMode(colorModeSettings, colorModePreference, prefersDarkColorScheme());
  const dark = mode === "dark";
  for (const property of Object.values(tokenProperties)) root.style.removeProperty(property);
  root.dataset.colorMode = mode;
  root.style.colorScheme = mode;

  for (const [environmentKey, cssProperty] of Object.entries(themeEnvironment)) {
    if (dark && isColorProperty(cssProperty)) continue;
    const value = import.meta.env[environmentKey]?.trim();
    if (value) root.style.setProperty(cssProperty, value);
  }
  for (const [name, value] of Object.entries(lightTokens)) {
    const property = tokenProperties[name];
    if (dark && isColorProperty(property)) continue;
    root.style.setProperty(property, value);
  }
  if (dark) {
    for (const [name, value] of Object.entries(darkTokens)) {
      const property = tokenProperties[name];
      if (isColorProperty(property)) root.style.setProperty(property, value);
    }
  }
  updateColorModeState(mode);
}

function updateColorModeState(mode) {
  const next = { mode, preference: colorModePreference, settings: colorModeSettings };
  if (
    !colorModeState ||
    colorModeState.mode !== next.mode ||
    colorModeState.preference !== next.preference ||
    colorModeState.settings !== next.settings
  ) {
    colorModeState = next;
  }
}

function installSystemListener() {
  if (systemListenerInstalled || typeof window?.matchMedia !== "function") return;
  const query = window.matchMedia("(prefers-color-scheme: dark)");
  if (typeof query?.addEventListener !== "function") return;
  query.addEventListener("change", () => {
    paint();
    notify();
  });
  systemListenerInstalled = true;
}

export function getColorModeState() {
  if (!colorModeState) {
    updateColorModeState(
      resolveColorMode(colorModeSettings, colorModePreference, prefersDarkColorScheme()),
    );
  }
  return colorModeState;
}

/** Stores a learner's light/dark choice; pass null to follow the site default again. */
export function setColorModePreference(mode) {
  colorModePreference = mode === "light" || mode === "dark" ? mode : null;
  writeColorModePreference(colorModePreference);
  paint();
  notify();
}

function setFavicon(url) {
  if (!url) return;
  let favicon = document.querySelector('link[rel="icon"]');
  if (!favicon) {
    favicon = document.createElement("link");
    favicon.rel = "icon";
    document.head.append(favicon);
  }
  favicon.href = resolveRuntimeAssetUrl(url);
}

export function resolveRuntimeAssetUrl(url, apiBaseUrl = API_BASE_URL) {
  if (typeof url !== "string" || !url.startsWith("/api/")) return url;
  return `${apiBaseUrl}${url}`;
}

export async function applyInstanceTheme() {
  runtimeTheme = null;
  lightTokens = {};
  darkTokens = {};
  installSystemListener();
  paint();

  setFavicon(import.meta.env.VITE_APP_FAVICON_URL?.trim() || defaultFaviconUrl);

  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/theme`, {
      credentials: "include",
      signal: AbortSignal.timeout(1500),
    });
    if (!response.ok) return;
    const payload = await response.json();
    runtimeAppName = normalizeAppName(payload?.appName);
    runtimeLanding =
      payload?.landing && typeof payload.landing === "object" ? payload.landing : null;
    setColorModeSettings(payload?.colorMode);
    const candidate = payload?.theme;
    if (!candidate || typeof candidate !== "object") return;
    lightTokens = safeTokens(candidate.tokens);
    darkTokens = safeTokens(candidate.darkTokens);
    const sourceAssets =
      candidate.assets && typeof candidate.assets === "object" ? candidate.assets : {};
    const assets = {
      ...sourceAssets,
      logo: resolveRuntimeAssetUrl(sourceAssets.logo),
      favicon: resolveRuntimeAssetUrl(sourceAssets.favicon),
      hero: resolveRuntimeAssetUrl(sourceAssets.hero),
      progressBar: resolveRuntimeAssetUrl(sourceAssets.progressBar),
      progressFrame: resolveRuntimeAssetUrl(sourceAssets.progressFrame),
      trailDecoration: resolveRuntimeAssetUrl(sourceAssets.trailDecoration),
      answerCorrect: resolveRuntimeAssetUrl(sourceAssets.answerCorrect),
      answerIncorrect: resolveRuntimeAssetUrl(sourceAssets.answerIncorrect),
      avatars: Object.fromEntries(
        Object.entries(sourceAssets.avatars || {}).map(([key, avatar]) => [
          key,
          { ...avatar, url: resolveRuntimeAssetUrl(avatar?.url) },
        ]),
      ),
    };
    runtimeTheme = {
      id: typeof candidate.id === "string" ? candidate.id : null,
      name: typeof candidate.name === "string" ? candidate.name : null,
      version: typeof candidate.version === "string" ? candidate.version : null,
      trail: normalizeTrail(candidate.trail),
      assets,
    };
    if (assets.favicon) setFavicon(assets.favicon);
  } catch {
    runtimeTheme = null;
  } finally {
    paint();
    notify();
  }
}

export const TRAIL_STYLES = ["vine", "dashed", "dotted", "solid", "double"];
export const DEFAULT_TRAIL = Object.freeze({ style: "dashed", decorationCount: null });

export function normalizeTrail(trail) {
  const style = TRAIL_STYLES.includes(trail?.style) ? trail.style : DEFAULT_TRAIL.style;
  const count = Number.isInteger(trail?.decorationCount)
    ? Math.min(Math.max(trail.decorationCount, 0), 3)
    : null;
  return { style, decorationCount: count };
}

export function getRuntimeTheme() {
  return runtimeTheme;
}
