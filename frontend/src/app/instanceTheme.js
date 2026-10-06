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

export function setRuntimeSiteSettings({ appName, landing } = {}) {
  runtimeAppName = normalizeAppName(appName);
  runtimeLanding = landing && typeof landing === "object" ? landing : null;
  if (typeof window !== "undefined") window.dispatchEvent(new Event(INSTANCE_THEME_UPDATED_EVENT));
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
  const root = document.documentElement;
  for (const property of Object.values(tokenProperties)) root.style.removeProperty(property);
  runtimeTheme = null;

  for (const [environmentKey, cssProperty] of Object.entries(themeEnvironment)) {
    const value = import.meta.env[environmentKey]?.trim();
    if (value) root.style.setProperty(cssProperty, value);
  }

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
    const candidate = payload?.theme;
    if (!candidate || typeof candidate !== "object") return;
    for (const [name, property] of Object.entries(tokenProperties)) {
      const value = candidate.tokens?.[name];
      if (typeof value === "string" && value.length <= 120) root.style.setProperty(property, value);
    }
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
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event(INSTANCE_THEME_UPDATED_EVENT));
    }
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
