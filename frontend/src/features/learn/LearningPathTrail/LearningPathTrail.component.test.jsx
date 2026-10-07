import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import LearningPathTrail from "./LearningPathTrail.component";
import { getTrailGeometry } from "./trailGeometry";

const segments = [
  { key: "a-b", points: { x1: 0, y1: 0, x2: 100, y2: 0 } },
  { key: "b-c", points: { x1: 100, y1: 0, x2: 100, y2: 100 } },
];

const renderTrail = (props) =>
  render(<LearningPathTrail segments={segments} width={200} height={200} {...props} />);

describe("LearningPathTrail", () => {
  it("draws leafy vines with two leaves per connector", () => {
    const { container } = renderTrail({ style: "vine" });
    expect(container.querySelector("svg")).toHaveAttribute("data-trail-style", "vine");
    expect(container.querySelectorAll('[data-trail-decoration="leaf"]')).toHaveLength(4);
  });

  it("draws an undecorated dashed trail by default", () => {
    const { container } = renderTrail({});
    const paths = container.querySelectorAll("path");
    expect(paths).toHaveLength(2);
    expect(paths[0]).toHaveAttribute("stroke-dasharray", "10 9");
    expect(container.querySelectorAll("[data-trail-decoration]")).toHaveLength(0);
  });

  it("repeats a decoration image the configured number of times", () => {
    const { container } = renderTrail({
      style: "dotted",
      decorationImage: "/paw.png",
      decorationCount: 3,
    });
    const images = container.querySelectorAll('[data-trail-decoration="image"]');
    expect(images).toHaveLength(6);
    expect(images[0]).toHaveAttribute("href", "/paw.png");
  });

  it("can turn off vine leaves", () => {
    const { container } = renderTrail({ style: "vine", decorationCount: 0 });
    expect(container.querySelectorAll("[data-trail-decoration]")).toHaveLength(0);
  });

  it("curves alternate connectors in opposite directions", () => {
    const first = getTrailGeometry(segments[0].points, 0).pointAt(0.5);
    const second = getTrailGeometry(segments[0].points, 1).pointAt(0.5);
    expect(first.y).toBeGreaterThan(0);
    expect(second.y).toBeLessThan(0);
  });
});
