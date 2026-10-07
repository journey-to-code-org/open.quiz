import { getTrailGeometry } from "./trailGeometry";

const VINE_LEAF =
  "M -6 -9 C -11 -8 -15 -10 -18 -14 L -13 -15 L -16 -21 L -10 -19 L -8 -26 L -4 -20 L 1 -24 L 0 -17 L 6 -17 C 3 -12 -1 -9 -6 -9 Z";
const DECORATION_SIZE = 28;

const strokeStyles = {
  dashed: { strokeWidth: 3, strokeDasharray: "10 9" },
  dotted: { strokeWidth: 5.5, strokeDasharray: "0 12" },
  solid: { strokeWidth: 4 },
};

function decorationPositions(count) {
  if (count <= 0) return [];
  if (count === 2) return [0.34, 0.68];
  return Array.from({ length: count }, (_, index) => (index + 1) / (count + 1));
}

function VineLeaf({ x, y, angle, index, scale }) {
  const flipped = index % 2 === 1;
  return (
    <g
      transform={`translate(${x} ${y}) rotate(${angle + (flipped ? 6 : -5)}) scale(${scale} ${
        flipped ? -scale : scale
      })`}
      fill="var(--trail-line)"
      data-trail-decoration="leaf"
    >
      <path
        d="M 0 0 C -2 -4 -4 -7 -6 -10"
        fill="none"
        stroke="var(--trail-line)"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d={VINE_LEAF}
        opacity="0.88"
        stroke="var(--trail-line)"
        strokeWidth="0.75"
        strokeLinejoin="round"
      />
      <path
        d="M -6 -10 L -7 -20 M -7 -15 L -12 -18 M -7 -16 L -2 -20"
        fill="none"
        stroke="var(--trail-surface)"
        strokeWidth="0.8"
        strokeLinecap="round"
        opacity="0.55"
      />
    </g>
  );
}

function TrailLine({ path, style }) {
  if (style === "vine") {
    return (
      <>
        <path
          d={path}
          stroke="var(--trail-line)"
          strokeWidth="6"
          strokeLinecap="round"
          opacity="0.12"
        />
        <path d={path} stroke="var(--trail-line)" strokeWidth="2.25" strokeLinecap="round" />
      </>
    );
  }
  if (style === "double") {
    return (
      <>
        <path d={path} stroke="var(--trail-line)" strokeWidth="9" strokeLinecap="round" />
        <path d={path} stroke="var(--trail-surface)" strokeWidth="4" strokeLinecap="round" />
      </>
    );
  }
  return (
    <path
      d={path}
      stroke="var(--trail-line)"
      strokeLinecap="round"
      {...(strokeStyles[style] || strokeStyles.dashed)}
    />
  );
}

/**
 * Draws the connectors between learning path nodes. Segment points are already trimmed so
 * the trail stops short of each node circle. Decoration images are drawn pointing "up" in
 * their artwork and rotated to face along the trail.
 */
export default function LearningPathTrail({
  segments,
  width,
  height,
  style = "dashed",
  decorationCount = null,
  decorationImage = null,
  lineColor = "var(--color-learning-path-line)",
  surfaceColor = "var(--color-learning-path-surface)",
  className = "pointer-events-none absolute inset-0 h-full w-full overflow-visible",
}) {
  const count = decorationCount ?? (style === "vine" || decorationImage ? 2 : 0);
  const positions = decorationPositions(count);

  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox={`0 0 ${width} ${height}`}
      fill="none"
      data-trail-style={style}
      style={{ "--trail-line": lineColor, "--trail-surface": surfaceColor }}
    >
      {segments.map((segment, index) => {
        const geometry = getTrailGeometry(segment.points, index);
        return (
          <g key={segment.key}>
            <TrailLine path={geometry.path} style={style} />
            {positions.map((t, decorationIndex) => {
              const point = geometry.pointAt(t);
              if (decorationImage) {
                return (
                  <image
                    key={t}
                    href={decorationImage}
                    x={-DECORATION_SIZE / 2}
                    y={-DECORATION_SIZE / 2}
                    width={DECORATION_SIZE}
                    height={DECORATION_SIZE}
                    preserveAspectRatio="xMidYMid meet"
                    transform={`translate(${point.x} ${point.y}) rotate(${geometry.angle + 90})`}
                    data-trail-decoration="image"
                  />
                );
              }
              if (style !== "vine") return null;
              const scale =
                positions.length > 1
                  ? 0.78 + (0.14 * decorationIndex) / (positions.length - 1)
                  : 0.85;
              return (
                <VineLeaf
                  key={t}
                  x={point.x}
                  y={point.y}
                  angle={geometry.angle}
                  index={decorationIndex}
                  scale={scale}
                />
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}
