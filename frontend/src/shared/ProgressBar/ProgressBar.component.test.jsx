import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ProgressBar from "./ProgressBar.component";

vi.mock("../../app/instanceAssets", () => ({
  useInstanceAssets: () => ({
    progressBar: "/flower.webp",
    progressFrame: "/frame.webp",
  }),
}));

describe("illustrated progress artwork", () => {
  it("keeps the frame and moving marker separate and tracks progress", () => {
    const { container, rerender } = render(
      <ProgressBar variant="illustrated" illustration="quiz" value={25} />,
    );
    const frame = container.querySelector('img[src="/frame.webp"]');
    const marker = container.querySelector('img[src="/flower.webp"]');
    expect(frame).toBeInTheDocument();
    expect(marker).toBeInTheDocument();
    expect(marker.parentElement.style.left).toBe("25%");
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "25");

    rerender(<ProgressBar variant="illustrated" illustration="quiz" value={150} />);
    expect(marker.parentElement.style.left).toBe("100%");
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuetext", "100%");
  });

  it("uses a large moving star and built-in frame when a preview has no artwork", () => {
    const { container, rerender } = render(
      <ProgressBar variant="illustrated" illustration="quiz" value={0} themeAssets={{}} />,
    );
    expect(container.querySelectorAll("img")).toHaveLength(1);
    expect(container.querySelector('img[src="/flower.webp"]')).not.toBeInTheDocument();
    expect(container.querySelector('img[src="/frame.webp"]')).not.toBeInTheDocument();
    const star = container.querySelector('svg[viewBox="0 0 128 128"]');
    expect(star).toBeInTheDocument();
    expect(star.parentElement).toHaveClass("min-w-[4.25rem]", "sm:w-[24%]");
    expect(star.parentElement.style.left).toBe("0%");
    rerender(<ProgressBar variant="illustrated" illustration="quiz" value={75} themeAssets={{}} />);
    expect(star.parentElement.style.left).toBe("75%");
  });

  it.each([
    [0, "progress-start", "progress-near-start", 0],
    [70, "progress-start", "progress-near-start", 0],
    [81, "progress-start", "progress-near-start", 50],
    [92, "progress-start", "progress-near-start", 100],
    [96, "progress-near-start", "progress-complete-start", 50],
    [100, "progress-near-start", "progress-complete-start", 100],
  ])("interpolates the track colors at %s%%", (value, start, end, amount) => {
    const { container } = render(
      <ProgressBar variant="illustrated" illustration="quiz" value={value} />,
    );
    const background = container.querySelector('[style*="background"]').style.background;
    expect(background).toContain(`var(--color-${start})`);
    expect(background).toContain(`var(--color-${end}) ${amount}%`);
  });

  it("uses a custom marker with the built-in frame when no frame is supplied", () => {
    const { container } = render(
      <ProgressBar
        variant="illustrated"
        illustration="quiz"
        value={50}
        themeAssets={{ progressBar: "/custom-guide.png" }}
      />,
    );
    expect(container.querySelectorAll("img")).toHaveLength(2);
    expect(container.querySelector('img[src="/custom-guide.png"]')).toBeInTheDocument();
    expect(container.querySelector('img[src="/frame.webp"]')).not.toBeInTheDocument();
  });

  it("does not change linear or circular progress when artwork is active", () => {
    const { rerender } = render(<ProgressBar value={50} />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "50");
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    rerender(<ProgressBar value={75} variant="circular" />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuetext", "75%");
  });
});
