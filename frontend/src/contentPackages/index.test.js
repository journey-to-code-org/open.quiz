import { describe, expect, it } from "vitest";
import { loadContentPackage } from "./index";

describe("content package loader", () => {
  it("loads registered packages from their package directory", async () => {
    const financePackage = await loadContentPackage("finance-literacy");

    expect(financePackage.lessonBlockRenderers["budget-summary"]).toBeTypeOf("function");
    expect(financePackage.characterImages).toHaveProperty("abigail");
  });

  it("returns null for an unknown package ID", async () => {
    await expect(loadContentPackage("missing-package")).resolves.toBeNull();
  });
});
