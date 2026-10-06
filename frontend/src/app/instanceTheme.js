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
export const INSTANCE_THEME_UPDATED_EVENT = "openquiz:theme-updated";

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

export function getRuntimeTheme() {
  return runtimeTheme;
}
