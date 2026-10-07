import { describe, expect, it } from "vitest";
import { loadContentPackage } from "./index";

describe("content package loader", () => {
  it("loads registered packages from their package directory", async () => {
    const introductionPackage = await loadContentPackage("openquiz-introduction");

    expect(introductionPackage.lessonBlockRenderers.characterIntro).toBeTypeOf("function");
    expect(introductionPackage.characterImages).toHaveProperty("nova");
    expect(introductionPackage.characterImages).toHaveProperty("kit");
  });

  it("returns null for an unknown package ID", async () => {
    await expect(loadContentPackage("missing-package")).resolves.toBeNull();
  });
});
