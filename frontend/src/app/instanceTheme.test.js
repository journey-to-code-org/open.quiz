import { afterEach, describe, expect, it, vi } from "vitest";
import { applyInstanceTheme, getRuntimeTheme, resolveRuntimeAssetUrl } from "./instanceTheme";

describe("runtime instance theme", () => {
  afterEach(() => {
    document.documentElement.removeAttribute("style");
    document.querySelector('link[rel="icon"]')?.remove();
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
});
