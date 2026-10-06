import { useMemo, useSyncExternalStore } from "react";
import { DEFAULT_TRAIL, getAppName, getRuntimeLanding, getRuntimeTheme } from "./instanceTheme";
import { INSTANCE_THEME_UPDATED_EVENT } from "./instanceTheme";
import { resolveLanding } from "./landingContent";

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
    progressFrame: runtimeAssets.progressFrame || null,
    trailDecoration: runtimeAssets.trailDecoration || null,
    answerCorrect: runtimeAssets.answerCorrect || null,
    answerIncorrect: runtimeAssets.answerIncorrect || null,
    avatars: runtimeAssets.avatars || {},
  };
}

export function useInstanceAssets() {
  useSyncExternalStore(subscribeToTheme, getRuntimeTheme, getRuntimeTheme);
  return getInstanceAssets();
}

export function useInstanceTrail() {
  const theme = useSyncExternalStore(subscribeToTheme, getRuntimeTheme, getRuntimeTheme);
  return theme?.trail || DEFAULT_TRAIL;
}

export function useAppName() {
  return useSyncExternalStore(subscribeToTheme, getAppName, getAppName);
}

export function useLanding() {
  const landing = useSyncExternalStore(subscribeToTheme, getRuntimeLanding, getRuntimeLanding);
  return useMemo(() => resolveLanding(landing), [landing]);
}
