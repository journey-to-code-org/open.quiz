import { useEffect, useRef, useState } from "react";
import ProgressBar from "../../../shared/ProgressBar/ProgressBar.component";
import LessonGuideCharacter from "../../learn/LessonGuideCharacter/LessonGuideCharacter.component";
import LearningPathTrail from "../../learn/LearningPathTrail/LearningPathTrail.component";
import AnswerMark from "../../learn/Quiz/AnswerMark/AnswerMark.component";
import LearningPathNode from "../../learn/LearningPathNode/LearningPathNode.component";
import { DEFAULT_DARK_THEME_TOKENS, DEFAULT_THEME_TOKENS } from "./themeBuilder";

const LIGHT_NEUTRALS = {
  50: "#f4faf8",
  100: "#e3ece9",
  200: "#cedcd8",
  300: "#b4c7c2",
  400: "#91a9a3",
  500: "#6a847e",
  600: "#4e6660",
  700: "#263e39",
  800: "#061e19",
};
const DARK_NEUTRAL_MIX = {
  50: 4,
  100: 8,
  200: 16,
  300: 24,
  400: 45,
  500: 60,
  600: 75,
  700: 88,
  800: 95,
};

// Mirrors the neutral scale in styles/theme.css so the preview matches the live site in either mode.
function neutralVariables(tokens, dark) {
  return Object.fromEntries(
    Object.keys(LIGHT_NEUTRALS).map((step) => [
      `--color-neutral-${step}`,
      dark
        ? `color-mix(in srgb, ${tokens.foreground} ${DARK_NEUTRAL_MIX[step]}%, ${tokens.surfaceApp})`
        : LIGHT_NEUTRALS[step],
    ]),
  );
}

const previewProperties = {
  primary: "--preview-primary",
  primaryHover: "--preview-primary-hover",
  accent: "--preview-accent",
  heading: "--preview-heading",
  foreground: "--preview-foreground",
  surfaceApp: "--preview-surface",
  surfaceRaised: "--preview-raised",
  fontHeading: "--preview-font-heading",
  fontBody: "--preview-font-body",
};

const colorProperties = {
  primary: "--color-primary",
  primaryHover: "--color-primary-hover",
  primaryAlt: "--color-primary-alt",
  accent: "--color-accent",
  success: "--color-success",
  heading: "--color-heading",
  foreground: "--color-foreground",
  onPrimary: "--color-on-primary",
  surfaceApp: "--color-surface-app",
  surfaceRaised: "--color-surface-raised",
  surfaceInset: "--color-surface-inset",
  progressStart: "--color-progress-start",
  progressEnd: "--color-progress-end",
  progressNearStart: "--color-progress-near-start",
  progressNearEnd: "--color-progress-near-end",
  progressCompleteStart: "--color-progress-complete-start",
  progressCompleteEnd: "--color-progress-complete-end",
  fontHeading: "--font-heading",
  fontBody: "--font-body",
};

const PATH_WIDTH = 288;
const NODE_SPACING = 140;
const NODE_RADIUS = 36;
const TRAIL_GAP = 45;
const PREVIEW_STEPS = [
  { status: "completed", title: "Meet the basics", left: 0.5 },
  { status: "current", title: "Practice together", left: 0.7 },
  { status: "locked", title: "Try it yourself", left: 0.3 },
];

function learningPathVariables(tokens) {
  const values = {
    "--color-learning-path-surface": tokens.learningPathSurface,
    "--color-learning-path-text": tokens.learningPathText,
    "--color-learning-path-heading": tokens.learningPathHeading,
    "--color-learning-path-muted": tokens.learningPathMuted,
    "--color-learning-path-label": tokens.learningPathLabel,
    "--color-learning-path-divider": tokens.learningPathDivider,
    "--color-learning-path-line": tokens.learningPathLine,
    "--color-learning-path-footer-surface": tokens.learningPathFooterSurface,
    "--color-learning-path-footer-border": tokens.learningPathFooterBorder,
    "--color-learning-path-node-completed": tokens.learningPathNodeCompleted || tokens.surfaceApp,
    "--color-learning-path-node-current": tokens.learningPathNodeCurrent || tokens.primary,
    "--color-learning-path-node-border": tokens.learningPathNodeBorder,
    "--color-learning-path-button": tokens.primary,
    "--color-learning-path-button-hover": tokens.primaryHover,
  };
  return Object.fromEntries(Object.entries(values).filter(([, value]) => value));
}

/** Mirrors LearningPathPage with the same node component and color tokens. */
function PreviewLearningPath({ trail, decorationImage, tokens }) {
  const centers = PREVIEW_STEPS.map((step, index) => ({
    x: step.left * PATH_WIDTH,
    y: index * NODE_SPACING + NODE_RADIUS,
  }));
  const segments = centers.slice(0, -1).map((start, index) => {
    const end = centers[index + 1];
    const length = Math.hypot(end.x - start.x, end.y - start.y);
    const ux = (end.x - start.x) / length;
    const uy = (end.y - start.y) / length;
    return {
      key: `segment-${index}`,
      points: {
        x1: start.x + ux * TRAIL_GAP,
        y1: start.y + uy * TRAIL_GAP,
        x2: end.x - ux * TRAIL_GAP,
        y2: end.y - uy * TRAIL_GAP,
      },
    };
  });
  const height = PREVIEW_STEPS.length * NODE_SPACING + 24;
  const frameRef = useRef(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame || typeof ResizeObserver === "undefined") return undefined;
    // Shrink the fixed-size path to fit narrow columns instead of clipping it.
    const observer = new ResizeObserver(([entry]) => {
      const width = entry.contentRect.width;
      if (width > 0) setScale(Math.min(1, width / PATH_WIDTH));
    });
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);
  return (
    <div
      className="overflow-hidden rounded-md bg-learning-path-surface text-learning-path-text"
      style={learningPathVariables(tokens)}
      aria-label="Learning path preview"
    >
      <div className="px-3 pt-4">
        <div className="rounded-2xl border border-primary/20 bg-surface-raised/70 px-3 py-3 text-center">
          <p className="text-[0.6rem] font-bold uppercase tracking-[0.2em] text-primary">
            Learning path
          </p>
          <p className="font-heading text-lg font-bold text-learning-path-heading">Module title</p>
          <p className="text-xs text-learning-path-muted">Secondary text</p>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <div className="h-px flex-1 bg-learning-path-divider" />
          <span className="text-sm font-semibold text-learning-path-heading">Steps</span>
          <div className="h-px flex-1 bg-learning-path-divider" />
        </div>
      </div>
      <div ref={frameRef} className="mt-3 px-1" style={{ height: height * scale }}>
        <div
          className="relative left-1/2 origin-top"
          style={{
            width: PATH_WIDTH,
            height,
            transform: `translateX(-50%) scale(${scale})`,
          }}
        >
          <LearningPathTrail
            segments={segments}
            width={PATH_WIDTH}
            height={height}
            style={trail?.style || "dashed"}
            decorationCount={trail?.decorationCount ?? null}
            decorationImage={decorationImage}
            className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
          />
          {PREVIEW_STEPS.map((step, index) => (
            <LearningPathNode
              key={step.title}
              node={{ microLessonId: `preview-${index}`, microLessonTitle: step.title }}
              status={step.status}
              stepNumber={index + 1}
              style={{
                left: `${step.left * 100}%`,
                top: index * NODE_SPACING,
                transform: "translateX(-50%)",
              }}
            />
          ))}
        </div>
      </div>
      <div className="flex items-center justify-end border-t border-learning-path-footer-border bg-learning-path-footer-surface px-3 py-2">
        <span className="inline-block rounded-lg bg-learning-path-button px-4 py-1.5 text-sm font-semibold text-on-primary">
          Continue
        </span>
      </div>
    </div>
  );
}

/**
 * Renders a self-contained sample of a theme without changing the live site theme.
 * All image values are already-resolved URLs (data URLs or asset URLs).
 */
export default function ThemePreview({
  name,
  tokens: themeTokens = {},
  trail,
  logo = null,
  progressBar = null,
  progressFrame = null,
  trailDecoration = null,
  answerCorrect = null,
  answerIncorrect = null,
  guideAvatar = null,
  guideName = "",
  colorMode = "light",
}) {
  const dark = colorMode === "dark";
  const defaults = dark
    ? { ...DEFAULT_THEME_TOKENS, ...DEFAULT_DARK_THEME_TOKENS }
    : DEFAULT_THEME_TOKENS;
  // Missing tokens fall back to the built-in defaults, which is what activation would show.
  const tokens = {
    ...defaults,
    ...themeTokens,
    learningPathNodeCompleted:
      themeTokens.learningPathNodeCompleted ||
      themeTokens.surfaceApp ||
      defaults.learningPathNodeCompleted,
    learningPathNodeCurrent:
      themeTokens.learningPathNodeCurrent ||
      themeTokens.primary ||
      defaults.learningPathNodeCurrent,
  };
  const style = { ...neutralVariables(tokens, dark), colorScheme: colorMode };
  for (const [token, property] of Object.entries(previewProperties)) {
    if (typeof tokens[token] === "string") style[property] = tokens[token];
  }
  for (const [token, property] of Object.entries(colorProperties)) {
    if (typeof tokens[token] === "string") style[property] = tokens[token];
  }
  return (
    <div className="space-y-3 rounded-md border border-neutral-200 p-4" aria-label="Theme preview">
      <div className="flex items-center gap-3">
        {logo ? (
          <img
            src={logo}
            alt=""
            className={`h-10 max-w-32 object-contain ${dark ? "hue-rotate-180 invert" : ""}`}
          />
        ) : null}
        <h3 className="font-heading text-lg font-bold text-heading">{name}</h3>
      </div>
      <div
        className="space-y-6 rounded-md bg-[var(--preview-surface,#f5f7fa)] p-4 font-body"
        data-color-mode={colorMode}
        style={style}
      >
        <ProgressBar
          variant="illustrated"
          illustration="quiz"
          value={35}
          label="Preview learning progress"
          themeAssets={{ progressBar, progressFrame }}
          imageWrapperClassName="mx-auto max-w-xs"
        />
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <h4
              className="font-bold text-[var(--preview-heading,#213c60)]"
              style={{ fontFamily: "var(--preview-font-heading, inherit)" }}
            >
              A short lesson
            </h4>
            <p
              className="text-sm text-[var(--preview-foreground,#263244)]"
              style={{ fontFamily: "var(--preview-font-body, inherit)" }}
            >
              Practice one idea at a time.
            </p>
            <button
              type="button"
              className="rounded-md bg-[var(--preview-primary,#315f9e)] px-3 py-2 text-sm font-semibold"
              style={{ color: tokens.onPrimary || "#ffffff" }}
            >
              Continue
            </button>
            <div className="rounded-md bg-[var(--preview-raised,#ffffff)] p-3 text-sm text-[var(--preview-foreground,#263244)]">
              Raised card surface
            </div>
            <div className="flex items-center gap-4 text-sm text-[var(--preview-foreground,#263244)]">
              <span className="flex items-center gap-2">
                <AnswerMark correct imageSrc={answerCorrect} className="h-10 w-10" />
                Correct
              </span>
              <span className="flex items-center gap-2">
                <AnswerMark correct={false} imageSrc={answerIncorrect} className="h-10 w-10" />
                Incorrect
              </span>
            </div>
          </div>
          <PreviewLearningPath trail={trail} decorationImage={trailDecoration} tokens={tokens} />
        </div>
        <LessonGuideCharacter
          imageSrc={guideAvatar}
          imageAlt={guideName || ""}
          bubbleText="Let's keep going."
        >
          <p className="text-center text-[var(--preview-foreground,#263244)]">
            {guideName || "Your guide"} helps learners practice one idea at a time.
          </p>
        </LessonGuideCharacter>
      </div>
    </div>
  );
}
