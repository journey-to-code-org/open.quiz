import progressBarFrame from "../../assets/progress-bar.svg";
import { useInstanceAssets } from "../../app/instanceAssets";

// Colors used by the standard progress bars
const toneStyles = {
  primary: {
    linearFill: "bg-primary",
    circularRing: "text-primary",
  },
  success: {
    linearFill: "bg-success",
    circularRing: "text-success",
  },
  warning: {
    linearFill: "bg-warning",
    circularRing: "text-warning",
  },
  danger: {
    linearFill: "bg-danger",
    circularRing: "text-danger",
  },
};

// Sizes used by the circular progress bar
const circularSizes = {
  sm: 56,
  md: 76,
  lg: 96,
};

// Keeps a number between a minimum and maximum value
function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export default function ProgressBar({
  value,
  min = 0,
  max = 100,
  variant = "linear",
  size = "md",
  tone = "primary",
  showValue = false,
  label,
  illustration,
  imageSrc,
  imageAlt = "",
  imageWrapperClassName = "",
  imageClassName = "",
  className = "",
}) {
  const progressArtwork = useInstanceAssets().progressBar || progressBarFrame;
  // Make sure min, max, and value are valid numbers
  const safeMin = Number.isFinite(min) ? min : 0;

  const safeMax = Number.isFinite(max) && max > safeMin ? max : 100;

  const safeValue = Number.isFinite(value) ? value : safeMin;

  // Keep the value inside the allowed range
  const progressValue = clamp(safeValue, safeMin, safeMax);

  // Convert the current value to a percentage
  const percent = ((progressValue - safeMin) / (safeMax - safeMin)) * 100;

  const roundedPercent = Math.round(percent);

  // Accessibility and styling values
  const progressLabel = label || "Progress";
  const selectedTone = toneStyles[tone] || toneStyles.primary;

  const progressBarProps = {
    role: "progressbar",
    "aria-label": progressLabel,
    "aria-valuemin": safeMin,
    "aria-valuemax": safeMax,
    "aria-valuenow": progressValue,
    "aria-valuetext": `${roundedPercent}%`,
  };

  // --------------------------------------------------
  // Illustrated progress bar
  // --------------------------------------------------

  if (variant === "illustrated") {
    const isQuiz = illustration === "quiz";

    // Quiz illustrated progress bar
    if (isQuiz) {
      const markerLeft = `${clamp(percent, 0, 100)}%`;

      return (
        <div className={`w-full ${className}`.trim()}>
          <div {...progressBarProps}>
            <div className={`relative ${imageWrapperClassName}`.trim()}>
              <div className="relative mx-auto my-6 w-full max-w-md overflow-visible sm:my-0">
                {/* Colored background behind the frame */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 rounded-full transition-[background] duration-500 ease-out"
                  style={{
                    background:
                      "linear-gradient(90deg, var(--color-primary), var(--color-primary-alt))",
                  }}
                />

                {/* Progress bar frame */}
                <img
                  src={progressArtwork}
                  alt=""
                  aria-hidden="true"
                  className={`relative mx-auto w-full ${imageClassName}`.trim()}
                />

                {/* Moving progress marker */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-y-[8%] left-[4%] right-[8%]"
                >
                  <div className="pointer-events-none absolute inset-x-[4%] bottom-[92%] h-0 overflow-visible max-[360px]:bottom-[104%] sm:bottom-[80%]">
                    <span
                      className="absolute left-0 block h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-white bg-accent shadow-md transition-[left] duration-500 ease-out"
                      style={{ left: markerLeft }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Regular illustrated progress bar
    const displayedImageAlt = imageAlt || progressLabel;

    return (
      <div className={`w-full ${className}`.trim()}>
        <div {...progressBarProps}>
          <div className={`relative ${imageWrapperClassName}`.trim()}>
            {imageSrc ? (
              <img src={imageSrc} alt={displayedImageAlt} className={imageClassName} />
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  // --------------------------------------------------
  // Circular progress bar
  // --------------------------------------------------

  if (variant === "circular") {
    const circleSize = circularSizes[size] || circularSizes.md;

    const strokeWidth = 8;
    const radius = (circleSize - strokeWidth) / 2;

    const circumference = 2 * Math.PI * radius;

    const progressOffset = circumference - (percent / 100) * circumference;

    return (
      <div
        {...progressBarProps}
        className={`relative inline-flex items-center justify-center ${className}`.trim()}
        style={{
          width: circleSize,
          height: circleSize,
        }}
      >
        <svg width={circleSize} height={circleSize} viewBox={`0 0 ${circleSize} ${circleSize}`}>
          {/* Background circle */}
          <circle
            cx={circleSize / 2}
            cy={circleSize / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-neutral-200"
          />

          {/* Progress circle */}
          <circle
            cx={circleSize / 2}
            cy={circleSize / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={progressOffset}
            transform={`rotate(-90 ${circleSize / 2} ${circleSize / 2})`}
            className={selectedTone.circularRing}
          />
        </svg>

        <span className="absolute text-sm font-semibold text-heading">{roundedPercent}%</span>
      </div>
    );
  }

  // --------------------------------------------------
  // Standard linear progress bar
  // --------------------------------------------------

  return (
    <div className={`w-full ${className}`.trim()}>
      <div className="flex items-center gap-3">
        <div
          {...progressBarProps}
          className="h-2.5 w-full overflow-hidden rounded-lg bg-neutral-200"
        >
          <div
            className={`h-full rounded-lg transition-[width] duration-300 ${selectedTone.linearFill}`}
            style={{
              width: `${percent}%`,
            }}
          />
        </div>

        {showValue ? (
          <span className="text-sm font-semibold text-heading">{roundedPercent}%</span>
        ) : null}
      </div>
    </div>
  );
}
