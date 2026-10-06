import ProgressBar from "../../../shared/ProgressBar/ProgressBar.component";
import LessonGuideCharacter from "../../learn/LessonGuideCharacter/LessonGuideCharacter.component";
import LearningPathTrail from "../../learn/LearningPathTrail/LearningPathTrail.component";
import AnswerMark from "../../learn/Quiz/AnswerMark/AnswerMark.component";

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
  heading: "--color-heading",
  foreground: "--color-foreground",
  onPrimary: "--color-on-primary",
  progressStart: "--color-progress-start",
  progressEnd: "--color-progress-end",
  progressNearStart: "--color-progress-near-start",
  progressNearEnd: "--color-progress-near-end",
  progressCompleteStart: "--color-progress-complete-start",
  progressCompleteEnd: "--color-progress-complete-end",
  fontHeading: "--font-heading",
  fontBody: "--font-body",
};

const TRAIL_NODES = [
  { x: 60, y: 34 },
  { x: 190, y: 104 },
  { x: 60, y: 174 },
];

function PreviewTrail({ trail, decorationImage, tokens }) {
  const segments = TRAIL_NODES.slice(0, -1).map((start, index) => {
    const end = TRAIL_NODES[index + 1];
    const length = Math.hypot(end.x - start.x, end.y - start.y);
    const padding = 30;
    const ux = (end.x - start.x) / length;
    const uy = (end.y - start.y) / length;
    return {
      key: `segment-${index}`,
      points: {
        x1: start.x + ux * padding,
        y1: start.y + uy * padding,
        x2: end.x - ux * padding,
        y2: end.y - uy * padding,
      },
    };
  });
  const surface = tokens.learningPathSurface || "#f1f5fa";
  return (
    <div
      className="relative mx-auto h-52 w-64 rounded-md"
      style={{ backgroundColor: surface }}
      aria-label="Learning path trail preview"
    >
      <LearningPathTrail
        segments={segments}
        width={256}
        height={208}
        style={trail?.style || "dashed"}
        decorationCount={trail?.decorationCount ?? null}
        decorationImage={decorationImage}
        lineColor={tokens.learningPathLine || "#34475f"}
        surfaceColor={surface}
        className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
      />
      {TRAIL_NODES.map((node, index) => (
        <span
          key={`${node.x}-${node.y}`}
          className="absolute flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 text-sm font-bold"
          style={{
            left: node.x,
            top: node.y,
            backgroundColor: index === 1 ? "#f1ab2d" : "#eac66e",
            borderColor: index === 1 ? "#000000" : "#384b66",
          }}
        >
          {index + 1}
        </span>
      ))}
    </div>
  );
}

/**
 * Renders a self-contained sample of a theme without changing the live site theme.
 * All image values are already-resolved URLs (data URLs or asset URLs).
 */
export default function ThemePreview({
  name,
  tokens = {},
  trail,
  logo = null,
  progressBar = null,
  progressFrame = null,
  trailDecoration = null,
  answerCorrect = null,
  answerIncorrect = null,
  guideAvatar = null,
  guideName = "",
}) {
  const style = {};
  for (const [token, property] of Object.entries(previewProperties)) {
    if (typeof tokens[token] === "string") style[property] = tokens[token];
  }
  if (tokens.success) style["--color-success"] = tokens.success;
  if (tokens.success) style["--color-success"] = tokens.success;
  for (const [token, property] of Object.entries(colorProperties)) {
    if (typeof tokens[token] === "string") style[property] = tokens[token];
  }
  return (
    <div className="space-y-3 rounded-md border border-neutral-200 p-4" aria-label="Theme preview">
      <div className="flex items-center gap-3">
        {logo ? <img src={logo} alt="" className="h-10 max-w-32 object-contain" /> : null}
        <h3 className="font-heading text-lg font-bold text-heading">{name}</h3>
      </div>
      <div
        className="space-y-6 rounded-md bg-[var(--preview-surface,#f5f7fa)] p-4 font-body"
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
          <PreviewTrail trail={trail} decorationImage={trailDecoration} tokens={tokens} />
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
