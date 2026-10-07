import Button from "../../../shared/Button/Button.component";

const statusVariant = {
  current: "circleCurrent",
  completed: "circleCompleted",
  locked: "circleDisabled",
};

const statusBadge = {
  current: { icon: "▶", label: "Current step" },
  completed: { icon: "✓", label: "Completed step" },
  locked: { icon: "🔒", label: "Locked step" },
};

function LearningPathNode({ node, status, stepNumber, style, tooltipText, onSelect, ref }) {
  const variant = statusVariant[status] ?? statusVariant.locked;
  const badge = statusBadge[status] ?? statusBadge.locked;

  return (
    <div ref={ref} style={style} className="absolute flex w-36 flex-col items-center md:w-44">
      <div data-node-circle className="relative">
        <Button
          variant={variant}
          className={`transition-transform hover:scale-105 ${status === "locked" ? "opacity-70 grayscale" : ""}`}
          title={tooltipText || `${node.microLessonId}: ${node.microLessonTitle}`}
          aria-label={`Step ${stepNumber}: ${node.microLessonTitle}. ${badge.label}. Open details.`}
          onClick={() => onSelect?.(node)}
        >
          <span className="text-[1.25rem] font-bold leading-none">{stepNumber}</span>
        </Button>

        <span
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border border-learning-path-node-border bg-learning-path-surface text-[0.7rem] leading-none text-learning-path-heading shadow-sm"
        >
          {badge.icon}
        </span>
      </div>

      <p className="mt-2 line-clamp-2 px-1 text-center text-[0.72rem] font-semibold leading-4 text-learning-path-label">
        {node.microLessonTitle}
      </p>

      {node.lessonEstimatedMin ? (
        <p className="text-[0.65rem] font-medium leading-4 text-learning-path-muted">
          {node.lessonEstimatedMin} min read
        </p>
      ) : null}
    </div>
  );
}

export default LearningPathNode;
