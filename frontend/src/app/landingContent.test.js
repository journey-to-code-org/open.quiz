import { describe, expect, it } from "vitest";
import { DEFAULT_LANDING, resolveLanding, toPortableLanding } from "./landingContent";
import { getRouteTitle } from "./router/routes";

describe("landing content", () => {
  it("falls back to the default landing page", () => {
    expect(resolveLanding(null)).toEqual(DEFAULT_LANDING);
  });

  it("merges each section with the defaults", () => {
    const landing = resolveLanding({
      hero: { heading: "  Grow daily  ", showAvatars: false },
      faq: { items: [] },
      steps: { heading: "Steps", items: [{ title: "One" }, { title: " ", body: " " }] },
    });
    expect(landing.hero).toEqual({
      heading: "Grow daily",
      body: DEFAULT_LANDING.hero.body,
      showAvatars: false,
    });
    expect(landing.benefits).toEqual(DEFAULT_LANDING.benefits);
    expect(landing.steps).toEqual({ heading: "Steps", items: [{ title: "One", body: "" }] });
    expect(landing.faq).toEqual({ heading: DEFAULT_LANDING.faq.heading, items: [] });
  });

  it("drops empty optional fields from portable landing pages", () => {
    const portable = toPortableLanding({
      benefits: { heading: "Why", items: [{ title: "Fast", body: "Quick" }] },
    });
    expect(portable.benefits.items).toEqual([{ title: "Fast", body: "Quick" }]);
  });
});

describe("route titles", () => {
  it("uses the app name for the home page and as a suffix elsewhere", () => {
    expect(getRouteTitle("/", "Sprout")).toBe("Sprout");
    expect(getRouteTitle("/login", "Sprout")).toMatch(/^.+ \S Sprout$/);
  });
});
