import { useSyncExternalStore } from "react";
import { getRuntimeTheme } from "./instanceTheme";
import { INSTANCE_THEME_UPDATED_EVENT } from "./instanceTheme";

function subscribeToTheme(callback) {
  window.addEventListener(INSTANCE_THEME_UPDATED_EVENT, callback);
  return () => window.removeEventListener(INSTANCE_THEME_UPDATED_EVENT, callback);
}

export function getInstanceAssets() {
  const runtimeAssets = getRuntimeTheme()?.assets || {};
  return {
    logo: runtimeAssets.logo || import.meta.env.VITE_APP_LOGO_URL?.trim() || null,
    hero: runtimeAssets.hero || import.meta.env.VITE_APP_HERO_IMAGE_URL?.trim() || null,
    progressBar: runtimeAssets.progressBar || null,
    avatars: runtimeAssets.avatars || {},
  };
}

export function useInstanceAssets() {
  useSyncExternalStore(subscribeToTheme, getRuntimeTheme, getRuntimeTheme);
  return getInstanceAssets();
}
