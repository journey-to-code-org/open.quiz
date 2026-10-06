import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import LessonGuideCharacter from "./LessonGuideCharacter.component";

describe("missing lesson character artwork", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("removes a broken production image and speech-bubble pointer", () => {
    vi.stubEnv("DEV", false);
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const { container, rerender } = render(
      <LessonGuideCharacter imageSrc="/missing.png" imageAlt="Guide">
        Lesson text
      </LessonGuideCharacter>,
    );
    fireEvent.error(screen.getByRole("img", { name: "Guide" }));
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeInTheDocument();
    expect(screen.getByText("Lesson text")).toBeVisible();
    expect(log).toHaveBeenCalledWith("Lesson character image failed to load: /missing.png");
    rerender(
      <LessonGuideCharacter imageSrc="/fixed.png" imageAlt="Guide">
        Lesson text
      </LessonGuideCharacter>,
    );
    expect(screen.getByRole("img", { name: "Guide" })).toHaveAttribute("src", "/fixed.png");
  });

  it("keeps broken images visible in development", () => {
    vi.stubEnv("DEV", true);
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(<LessonGuideCharacter imageSrc="/missing.png" imageAlt="Missing guide" />);
    fireEvent.error(screen.getByRole("img", { name: "Missing guide" }));
    expect(screen.getByRole("img", { name: "Missing guide" })).toBeInTheDocument();
  });

  it("does not render an image or pointer when none is supplied", () => {
    const { container } = render(<LessonGuideCharacter>Lesson text</LessonGuideCharacter>);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeInTheDocument();
  });
});
