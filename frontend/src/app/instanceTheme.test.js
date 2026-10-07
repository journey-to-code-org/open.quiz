import { afterEach, describe, expect, it, vi } from "vitest";
import {
  applyInstanceTheme,
  getColorModeState,
  getRuntimeTheme,
  resolveRuntimeAssetUrl,
  setColorModePreference,
} from "./instanceTheme";

describe("runtime instance theme", () => {
  afterEach(() => {
    document.documentElement.removeAttribute("style");
    document.documentElement.removeAttribute("data-color-mode");
    document.querySelector('link[rel="icon"]')?.remove();
    localStorage.clear();
    setColorModePreference(null);
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("applies the runtime allowlisted tokens and asset URLs", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          theme: {
            id: "garden",
            name: "Garden",
            version: "1.0.0",
            tokens: { primary: "#18816a", fontBody: '"Poppins", sans-serif', unknown: "url(evil)" },
            assets: {
              logo: "/api/v1/assets/logo",
              progressBar: "/api/v1/assets/marker",
              progressFrame: "/api/v1/assets/frame",
              avatars: { guide: { url: "/api/v1/assets/guide" } },
            },
          },
        }),
      }),
    );

    await applyInstanceTheme();

    expect(document.documentElement.style.getPropertyValue("--instance-primary")).toBe("#18816a");
    expect(document.documentElement.style.getPropertyValue("--instance-font-body")).toBe(
      '"Poppins", sans-serif',
    );
    expect(document.documentElement.style.getPropertyValue("--instance-unknown")).toBe("");
    expect(getRuntimeTheme().assets.logo).toBe("/api/v1/assets/logo");
    expect(getRuntimeTheme().assets.progressBar).toBe("/api/v1/assets/marker");
    expect(getRuntimeTheme().assets.progressFrame).toBe("/api/v1/assets/frame");
    expect(getRuntimeTheme().assets.avatars.guide.url).toBe("/api/v1/assets/guide");
    expect(resolveRuntimeAssetUrl("/api/v1/assets/logo", "https://api.example.test")).toBe(
      "https://api.example.test/api/v1/assets/logo",
    );
  });

  it("keeps environment styling when the public theme request fails", async () => {
    vi.stubEnv("VITE_THEME_PRIMARY", "#315f9e");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    await applyInstanceTheme();

    expect(document.documentElement.style.getPropertyValue("--instance-primary")).toBe("#315f9e");
    expect(getRuntimeTheme()).toBeNull();
  });

  it("paints the dark palette and keeps fonts from the light tokens", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          colorMode: { default: "dark", showToggle: true, togglePosition: "footer" },
          theme: {
            tokens: { primary: "#18816a", fontBody: '"Poppins", sans-serif' },
            darkTokens: { primary: "#3cc9a5", fontBody: "serif" },
          },
        }),
      }),
    );

    await applyInstanceTheme();

    const root = document.documentElement;
    expect(root.dataset.colorMode).toBe("dark");
    expect(root.style.colorScheme).toBe("dark");
    expect(root.style.getPropertyValue("--instance-primary")).toBe("#3cc9a5");
    expect(root.style.getPropertyValue("--instance-font-body")).toBe('"Poppins", sans-serif');
    expect(getColorModeState()).toMatchObject({
      mode: "dark",
      settings: { default: "dark", togglePosition: "footer" },
    });

    setColorModePreference("light");
    expect(root.dataset.colorMode).toBe("light");
    expect(root.style.getPropertyValue("--instance-primary")).toBe("#18816a");
    expect(localStorage.getItem("openquiz:color-mode")).toBe("light");

    setColorModePreference(null);
    expect(root.dataset.colorMode).toBe("dark");
    expect(localStorage.getItem("openquiz:color-mode")).toBeNull();
  });

  it("ignores a learner preference when the admin hides the toggle", async () => {
    localStorage.setItem("openquiz:color-mode", "dark");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ colorMode: { default: "light", showToggle: false }, theme: null }),
      }),
    );
    setColorModePreference("dark");

    await applyInstanceTheme();

    expect(document.documentElement.dataset.colorMode).toBe("light");
  });
});
