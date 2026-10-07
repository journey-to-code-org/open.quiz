import { describe, expect, it } from "vitest";
import {
  DEFAULT_COLOR_MODE_SETTINGS,
  normalizeColorModeSettings,
  resolveColorMode,
} from "./colorMode";

describe("color mode", () => {
  it("normalizes unknown settings to the defaults", () => {
    expect(normalizeColorModeSettings(null)).toEqual(DEFAULT_COLOR_MODE_SETTINGS);
    expect(
      normalizeColorModeSettings({ default: "sepia", showToggle: "yes", togglePosition: "top" }),
    ).toEqual(DEFAULT_COLOR_MODE_SETTINGS);
    expect(
      normalizeColorModeSettings({
        default: "system",
        showToggle: false,
        togglePosition: "bottom-left",
      }),
    ).toEqual({ default: "system", showToggle: false, togglePosition: "bottom-left" });
  });

  it("resolves the learner choice, site default, and device setting", () => {
    const site = { ...DEFAULT_COLOR_MODE_SETTINGS, default: "system" };
    expect(resolveColorMode(site, null, true)).toBe("dark");
    expect(resolveColorMode(site, null, false)).toBe("light");
    expect(resolveColorMode(site, "light", true)).toBe("light");
    expect(resolveColorMode({ ...site, showToggle: false }, "light", true)).toBe("dark");
    expect(resolveColorMode({ ...site, default: "dark" }, null, false)).toBe("dark");
  });
});
