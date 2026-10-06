export function getTrailGeometry(points, index) {
  const xDistance = points.x2 - points.x1;
  const yDistance = points.y2 - points.y1;
  const length = Math.hypot(xDistance, yDistance) || 1;
  const curveDirection = index % 2 === 0 ? 1 : -1;
  const curve = Math.min(18, length * 0.12) * curveDirection;
  const normalX = (-yDistance / length) * curve;
  const normalY = (xDistance / length) * curve;

  return {
    path: `M ${points.x1} ${points.y1} C ${points.x1 + xDistance * 0.3 + normalX} ${
      points.y1 + yDistance * 0.3 + normalY
    }, ${points.x1 + xDistance * 0.7 + normalX} ${
      points.y1 + yDistance * 0.7 + normalY
    }, ${points.x2} ${points.y2}`,
    angle: (Math.atan2(yDistance, xDistance) * 180) / Math.PI,
    pointAt: (t) => ({
      x: points.x1 + xDistance * t + normalX * 0.72,
      y: points.y1 + yDistance * t + normalY * 0.72,
    }),
  };
}
