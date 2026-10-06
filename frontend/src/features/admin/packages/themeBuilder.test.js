import { describe, expect, it } from "vitest";
import {
  DEFAULT_THEME_TOKENS,
  PALETTES,
  SHAPE_PRESETS,
  buildThemePackage,
  contrastRatio,
  contrastWarnings,
  createThemeId,
  shapeSvg,
} from "./themeBuilder";

const PNG = "data:image/png;base64,iVBORw0KGgo=";

describe("themeBuilder", () => {
  it("creates safe, unique package IDs", () => {
    expect(createThemeId("My Ocean Theme!", 36)).toBe("custom-my-ocean-theme-10");
    expect(createThemeId("   ", 1)).toBe("custom-theme-1");
    expect(createThemeId("x".repeat(200), 1).length).toBeLessThanOrEqual(80);
  });

  it("measures WCAG contrast", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 0);
    expect(contrastRatio("#fff", "#ffffff")).toBeCloseTo(1, 5);
    expect(contrastWarnings(DEFAULT_THEME_TOKENS)).toEqual([]);
    expect(contrastWarnings({ ...DEFAULT_THEME_TOKENS, onPrimary: "#3060a0" })[0]).toMatch(
      /Text on primary buttons/,
    );
  });

  it("only uses supported palette tokens", () => {
    for (const palette of PALETTES) {
      for (const [token, value] of Object.entries(palette.tokens)) {
        expect(Object.hasOwn(DEFAULT_THEME_TOKENS, token)).toBe(true);
        expect(value).toMatch(/^#[\da-f]{6}$/i);
      }
    }
  });

  it("renders every shape preset as an SVG", () => {
    for (const shape of SHAPE_PRESETS) {
      const svg = shapeSvg(shape.id, { fill: "#ff0000", line: "#000000", accent: "#00ff00" });
      expect(svg).toMatch(/^<svg [^>]*viewBox="0 0 256 256">.*<\/svg>$/);
      expect(svg).toContain("#ff0000");
    }
  });

  it("builds a valid theme package with image slots and avatars", () => {
    const pkg = buildThemePackage({
      id: "custom-test-1",
      name: " Test ",
      tokens: DEFAULT_THEME_TOKENS,
      trail: { style: "dotted", decorationCount: null },
      images: { progressBar: PNG, answerCorrect: PNG, logo: null },
      avatars: [{ key: "guide", name: "Guide", data: PNG }],
    });
    expect(pkg.package).toEqual({ id: "custom-test-1", name: "Test", version: "1.0.0" });
    expect(pkg.theme.trail).toEqual({ style: "dotted" });
    expect(pkg.theme.assets).toEqual({
      progressBar: "theme.progressBar",
      answerCorrect: "theme.answerCorrect",
      avatars: [{ key: "guide", name: "Guide", assetKey: "avatar.guide" }],
    });
    expect(pkg.assets.map((asset) => asset.filename)).toEqual([
      "theme.progressBar.png",
      "theme.answerCorrect.png",
      "avatar.guide.png",
    ]);
  });

  it("includes the app name and landing page only when provided", () => {
    const base = { id: "custom-test-2", name: "Test", tokens: DEFAULT_THEME_TOKENS };
    expect(buildThemePackage(base).theme).not.toHaveProperty("appName");
    expect(buildThemePackage(base).theme).not.toHaveProperty("landing");
    const landing = { hero: { heading: "Hi", body: "There", showAvatars: false } };
    const pkg = buildThemePackage({ ...base, appName: "  My   Garden ", landing });
    expect(pkg.theme.appName).toBe("My Garden");
    expect(pkg.theme.landing).toEqual(landing);
    expect(() => buildThemePackage({ ...base, appName: "x".repeat(61) })).toThrow(/60/);
  });
  it("rejects images that are not package-safe", () => {
    expect(() =>
      buildThemePackage({
        id: "custom-test-1",
        name: "Test",
        tokens: {},
        images: { logo: "data:image/svg+xml;base64,PHN2Zz4=" },
      }),
    ).toThrow(/PNG, JPEG, or WebP/);
  });
});
