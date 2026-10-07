import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import ThemePreview from "./ThemePreview";
import { DEFAULT_THEME_TOKENS } from "./themeBuilder";

describe("ThemePreview learning path", () => {
  test("renders the real step nodes with the theme's learning-path colors", () => {
    render(
      <ThemePreview
        name="Garden"
        tokens={{
          primary: "#18816a",
          learningPathNodeCurrent: "#ff0000",
          learningPathFooterSurface: "#00ff00",
        }}
      />,
    );
    const path = screen.getByLabelText("Learning path preview");
    expect(path.style.getPropertyValue("--color-learning-path-node-current")).toBe("#ff0000");
    expect(path.style.getPropertyValue("--color-learning-path-footer-surface")).toBe("#00ff00");
    expect(path.style.getPropertyValue("--color-learning-path-node-completed")).toBe(
      DEFAULT_THEME_TOKENS.learningPathNodeCompleted,
    );
    expect(
      screen.getByRole("button", { name: /Step 2: Practice together\. Current step/ }),
    ).toHaveClass("bg-learning-path-node-current");
    expect(path.innerHTML).not.toMatch(/#eac66e|#f1ab2d/i);
  });

  test("current steps follow the theme's primary color when the token is missing, like the live page", () => {
    render(<ThemePreview name="Garden" tokens={{ primary: "#18816a", surfaceApp: "#f2fcfa" }} />);
    const path = screen.getByLabelText("Learning path preview");
    expect(path.style.getPropertyValue("--color-learning-path-node-current")).toBe("#18816a");
    expect(path.style.getPropertyValue("--color-learning-path-node-completed")).toBe("#f2fcfa");
  });
});
