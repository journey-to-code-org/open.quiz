import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useAuthContext } from "../context/AuthContext";
import { getLesson, getLessonModules, getLessonProgress } from "../services/api";
import LearningPathNode from "../features/learn/LearningPathNode/LearningPathNode.component";
import LearningPathTrail from "../features/learn/LearningPathTrail/LearningPathTrail.component";
import { useInstanceAssets, useInstanceTrail } from "../app/instanceAssets";
import Button from "../shared/Button/Button.component";
import EmptyState from "../shared/EmptyState/EmptyState.component";
import Modal from "../shared/Modal/Modal.component";
import Skeleton from "../shared/Skeleton/Skeleton.component";

// Vertical distance between node centers, in rem.
const NODE_SPACING_REM = 8.75;

const statusCopy = {
  current: { label: "You are here", action: "Continue this step" },
  completed: { label: "Completed", action: "Review this step" },
  locked: { label: "Locked", action: "Locked for now" },
};

function getMicroLessonPreview(content = []) {
  return content
    .filter(
      (item) =>
        item.type === "paragraph" || item.type === "callout" || item.type === "characterIntro",
    )
    .map((item) => item.text.replace(/\s+/g, " ").trim())
    .slice(0, 2)
    .join(" ");
}

function LearningPathPage() {
  const navigate = useNavigate();

  const { isAuthenticated } = useAuthContext();
  const trail = useInstanceTrail();
  const { trailDecoration } = useInstanceAssets();

  const [progress, setProgress] = useState(null);
  const [currentModule, setCurrentModule] = useState(null);
  const [error, setError] = useState("");
  const [selectedStep, setSelectedStep] = useState(null);

  useEffect(() => {
    if (!isAuthenticated) {
      return undefined;
    }

    let isActive = true;

    async function loadLearningPath() {
      try {
        const modulePayload = await getLessonModules();
        const firstModuleId = modulePayload.modules?.[0]?.id;
        if (!firstModuleId) {
          if (isActive)
            setError(
              "No lesson modules have been seeded yet. Ask an admin to seed or import lessons.",
            );
          return;
        }

        const progressPayload = await getLessonProgress(firstModuleId);
        const firstLessonId =
          progressPayload.currentLessonId || modulePayload.modules[0].firstLessonId;
        if (!firstLessonId) {
          if (isActive) setError("The selected module does not contain any lessons yet.");
          return;
        }
        const lessonPayload = await getLesson(
          progressPayload.currentModule || firstModuleId,
          firstLessonId,
        );

        if (!isActive) {
          return;
        }

        setProgress(progressPayload);
        setCurrentModule(lessonPayload.moduleData);
      } catch (requestError) {
        if (!isActive) {
          return;
        }

        setError(requestError.message || "We could not load your learning path right now.");
      }
    }

    loadLearningPath();

    return () => {
      isActive = false;
    };
  }, [isAuthenticated]);

  // Build path from the module content returned by the API
  const learningPath = (currentModule?.lessons ?? []).flatMap((lesson) =>
    (lesson.microLessons ?? []).map((microLesson) => ({
      moduleId: currentModule.id,

      lessonId: lesson.id,
      lessonTitle: lesson.title,
      lessonGoal: lesson.learningGoal,
      lessonEstimatedMin: lesson.estimatedMin,

      microLessonId: microLesson.id,
      microLessonTitle: microLesson.title,
      microLessonPreview: getMicroLessonPreview(microLesson.microLessonContent),
      microLessonContentCount: microLesson.microLessonContent?.length ?? 0,
    })),
  );

  const completedMicroLessons = new Set(progress?.completedMicroLessons ?? []);
  const completedLessons = new Set(progress?.completedLessons ?? []);
  const lessonIds = (currentModule?.lessons ?? []).map((lesson) => lesson.id);

  const savedIndex = learningPath.findIndex(
    (node) => node.microLessonId === progress?.currentMicroLessonId,
  );

  // Micro-lessons without a quiz are never marked complete, so unlock the step right after the furthest completed one.
  const lastCompletedIndex = learningPath.reduce(
    (furthestIndex, node, index) =>
      completedMicroLessons.has(node.microLessonId) ? index : furthestIndex,
    -1,
  );

  const completedLessonCount = lessonIds.filter((lessonId) =>
    completedLessons.has(lessonId),
  ).length;

  const isModuleComplete =
    lessonIds.length > 0 &&
    (Boolean(progress?.isModuleCompleted) || completedLessonCount === lessonIds.length);

  const currentIndex = isModuleComplete
    ? -1
    : Math.min(Math.max(savedIndex, lastCompletedIndex + 1), learningPath.length - 1);

  const currentNode = currentIndex >= 0 ? learningPath[currentIndex] : null;
  const progressPercent = lessonIds.length
    ? Math.round((completedLessonCount / lessonIds.length) * 100)
    : 0;

  // For scrolling to the current microLesson node in the learning path
  const currentNodeRef = useRef(null);
  const hasScrolledToCurrentNodeRef = useRef(false);

  // Refs used for drawing the lines between each learning path node
  const pathContainerRef = useRef(null);
  const nodeElementsRef = useRef([]);

  // State for storing the center coordinates of each node and the size of the SVG container
  const [nodeCenters, setNodeCenters] = useState([]);
  const [svgSize, setSvgSize] = useState({
    width: 288,
    height: 29 * 16,
  });

  // Calculate the height of the learning path container based on the number of nodes
  const pathHeight = Math.max(learningPath.length * NODE_SPACING_REM + 3, 29);

  // Constants for the circle radius and the visible gap between nodes
  const circleRadius = 35;
  const visibleGap = 10;

  // Use useLayoutEffect to calculate the positions of the nodes and the size of the SVG container after the component has rendered. This ensures that we have accurate measurements for drawing the lines between nodes.
  useLayoutEffect(() => {
    function updateLayout() {
      // If the path container ref is not set, we cannot calculate the layout, so we return early.
      if (!pathContainerRef.current) {
        return;
      }
      // Get the bounding rectangle of the path container to determine its size and position on the page.
      const containerRect = pathContainerRef.current.getBoundingClientRect();

      setSvgSize({
        // Set the width and height of the SVG container based on the size of the path container and the calculated path height. If the containerRect does not provide a width or height, we use default values.
        width: containerRect.width || 288,
        height: containerRect.height || pathHeight * 16,
      });

      // Calculate the center coordinates of each node based on their bounding rectangles and the position of the path container. This allows us to draw lines between the centers of the nodes.
      const nextCenters = nodeElementsRef.current.map((nodeElement) => {
        if (!nodeElement) {
          return null;
        }
        // Measure the circle itself so the labels below it do not shift the vine anchor points.
        const circleElement = nodeElement.querySelector("[data-node-circle]") ?? nodeElement;
        const nodeRect = circleElement.getBoundingClientRect();

        // Calculate the center coordinates of the node element relative to the path container.
        return {
          x: nodeRect.left - containerRect.left + nodeRect.width / 2,

          y: nodeRect.top - containerRect.top + nodeRect.height / 2,
        };
      });
      // Update the state with the calculated center coordinates of the nodes which triggers a re-render to draw the lines between the nodes based on their new positions.
      setNodeCenters(nextCenters);
    }

    // Call updateLayout initially to set the positions of the nodes and the size of the SVG container.
    updateLayout();

    // Re-calculate the layout whenever the window is resized
    window.addEventListener("resize", updateLayout);

    return () => {
      // Clean up the event listener when the component is unmounted.
      window.removeEventListener("resize", updateLayout);
    };
  }, [pathHeight]);

  // Scroll once the asynchronously loaded current lesson has rendered.
  useEffect(() => {
    if (currentIndex < 0 || !currentNodeRef.current || hasScrolledToCurrentNodeRef.current) {
      return;
    }

    hasScrolledToCurrentNodeRef.current = true;
    currentNodeRef.current.scrollIntoView({
      behavior: "smooth",
      block: "center",
      inline: "nearest",
    });
  }, [currentIndex]);
  // Function to calculate the start and end points of the line connecting two nodes
  function getPathPoints(x1, y1, x2, y2, padding = circleRadius + visibleGap) {
    // Calculate the distance between the two points in the x and y directions
    const xDistance = x2 - x1;
    const yDistance = y2 - y1;
    // Calculate the length of the line connecting the two points using the Pythagorean theorem
    const length = Math.hypot(xDistance, yDistance) || 1;

    return {
      x1: x1 + (xDistance / length) * padding,
      y1: y1 + (yDistance / length) * padding,
      x2: x2 - (xDistance / length) * padding,
      y2: y2 - (yDistance / length) * padding,
    };
  }

  // Function to navigate to the selected lesson when a node is clicked
  function openLesson(node) {
    if (!node) {
      // If the node is null or undefined, we cannot navigate to a lesson, so we return early.
      return;
    }
    // Navigate to the lesson page using the moduleId and lessonId from the selected node
    navigate(`/learn/${node.moduleId}/${node.lessonId}`, {
      state: {
        microLessonId: node.microLessonId,
      },
    });
  }

  function startSelectedStep() {
    const step = selectedStep;
    setSelectedStep(null);
    openLesson(step?.node);
  }

  if (error) {
    const isContentEmpty =
      error.includes("No lesson modules") || error.includes("does not contain any lessons");

    if (isContentEmpty) {
      return (
        <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
          <EmptyState
            className="border-primary/20 bg-surface-inset py-16"
            icon="📚"
            title="Content coming soon"
            message="New lessons are being prepared. Check back soon for something new to explore."
          />
        </div>
      );
    }

    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <p className="text-sm font-medium text-danger">{error}</p>
      </div>
    );
  }

  if (!progress || !currentModule) {
    return <Skeleton />;
  }

  return (
    <div className="min-h-screen bg-learning-path-surface text-learning-path-text">
      <main className="mx-auto flex min-h-screen max-w-[22rem] flex-col px-4 pb-28 pt-5 sm:max-w-[24rem] sm:px-6 md:max-w-4xl lg:max-w-6xl lg:px-8">
        <div className="relative overflow-hidden rounded-[2rem] border border-primary/20 bg-white/70 px-5 pb-5 pt-7 text-center shadow-[0_18px_45px_rgba(20,73,61,0.1)] sm:px-8 md:min-h-52 md:px-48 md:py-8">
          <div className="pointer-events-none absolute -left-8 -top-8 h-28 w-28 rounded-full bg-accent/15" />
          <div className="pointer-events-none absolute -bottom-12 -right-8 h-36 w-36 rounded-full bg-circle-completed/20" />

          <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Learning path</p>
          <h1 className="mt-2 font-heading text-[2rem] font-bold leading-tight tracking-tight text-learning-path-heading sm:text-[2.5rem]">
            {currentModule.title}
          </h1>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-learning-path-muted">
            {currentModule.description || "Choose a lesson to continue learning."}
          </p>

          <div className="mx-auto mt-5 flex max-w-sm items-center gap-3 rounded-lg bg-white/80 p-3 shadow-sm">
            <div className="min-w-0 flex-1 text-left">
              <div className="flex items-center justify-between gap-3 text-xs font-semibold text-learning-path-heading">
                <span>{isModuleComplete ? "Module complete" : "Keep going"}</span>
                <span>{progressPercent}%</span>
              </div>
              <div
                role="progressbar"
                aria-label="Module progress"
                aria-valuemin="0"
                aria-valuemax="100"
                aria-valuenow={progressPercent}
                className="mt-1.5 h-2 overflow-hidden rounded-full bg-primary/15"
              >
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-7 flex items-center gap-4">
          <div className="h-px flex-1 bg-learning-path-divider" />

          <h3 className="whitespace-nowrap text-2xl font-semibold text-learning-path-heading">
            {currentModule.title}
          </h3>

          <div className="h-px flex-1 bg-learning-path-divider" />
        </div>

        <p className="mt-3 text-center text-sm leading-6 text-learning-path-muted">
          {isModuleComplete
            ? "You are all caught up. Tap any step to revisit what it covers."
            : "Tap a step to peek at what is inside before you start."}
        </p>

        <div
          ref={pathContainerRef}
          className="relative mx-auto mt-5 w-full max-w-[18rem] md:max-w-[34rem] lg:max-w-[44rem]"
          style={{ height: `${pathHeight}rem` }}
        >
          <LearningPathTrail
            segments={learningPath.slice(0, -1).flatMap((node, index) => {
              const startPoint = nodeCenters[index];
              const endPoint = nodeCenters[index + 1];
              if (!startPoint || !endPoint) return [];
              return [
                {
                  key: `${node.microLessonId}-${learningPath[index + 1].microLessonId}`,
                  points: getPathPoints(startPoint.x, startPoint.y, endPoint.x, endPoint.y),
                },
              ];
            })}
            width={svgSize.width}
            height={svgSize.height}
            style={trail.style}
            decorationCount={trail.decorationCount}
            decorationImage={trailDecoration}
          />

          {/* Rendering the learning path */}
          {learningPath.map((node, index) => {
            let status = "locked";

            if (
              isModuleComplete ||
              completedMicroLessons.has(node.microLessonId) ||
              index < currentIndex
            ) {
              status = "completed";
            }

            if (index === currentIndex) {
              status = "current";
            }

            // Move nodes left and right to create the path shape.
            let left = "clamp(28%, 30%, 32%)";

            if (index === 0) {
              left = "50%";
            } else if (index % 2 === 1) {
              left = "clamp(68%, 70%, 72%)";
            }

            const top = `${index * NODE_SPACING_REM}rem`;

            let tooltipText = "Locked step. Finish the earlier lesson first.";

            if (status === "current") {
              tooltipText = "Current step. Continue from here.";
            }

            if (status === "completed") {
              tooltipText = "Completed step. Reopen to review.";
            }

            return (
              <LearningPathNode
                key={node.microLessonId}
                node={node}
                status={status}
                stepNumber={index + 1}
                style={{
                  left,
                  top,
                  transform: "translateX(-50%)",
                }}
                tooltipText={`${node.microLessonTitle} - ${tooltipText}`}
                onSelect={() => setSelectedStep({ node, status, stepNumber: index + 1 })}
                ref={(element) => {
                  nodeElementsRef.current[index] = element;

                  if (index === currentIndex) {
                    currentNodeRef.current = element;
                  }
                }}
              />
            );
          })}
        </div>
      </main>

      <Modal
        variant="postIt"
        isOpen={Boolean(selectedStep)}
        onClose={() => setSelectedStep(null)}
        title={selectedStep?.node.microLessonTitle ?? ""}
        description={
          selectedStep
            ? `Step ${selectedStep.stepNumber} of ${learningPath.length} · ${selectedStep.node.lessonTitle}`
            : undefined
        }
        footer={
          selectedStep ? (
            <>
              <Button variant="ghost" onClick={() => setSelectedStep(null)}>
                Not now
              </Button>
              <Button
                variant="primary"
                disabled={selectedStep.status === "locked"}
                onClick={startSelectedStep}
              >
                {statusCopy[selectedStep.status].action}
              </Button>
            </>
          ) : null
        }
      >
        {selectedStep ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-post-it-fold px-3 py-1 text-caption font-semibold text-post-it-text">
                {statusCopy[selectedStep.status].label}
              </span>
              {selectedStep.node.lessonEstimatedMin ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-post-it-fold px-3 py-1 text-caption font-semibold text-post-it-text">
                  ⏱ {selectedStep.node.lessonEstimatedMin} min
                </span>
              ) : null}
              <span className="inline-flex items-center gap-1 rounded-full bg-post-it-fold px-3 py-1 text-caption font-semibold text-post-it-text">
                📄 {selectedStep.node.microLessonContentCount} sections
              </span>
            </div>

            {selectedStep.node.lessonGoal ? (
              <div>
                <p className="text-caption font-bold uppercase tracking-[0.14em] text-post-it-muted">
                  What you will learn
                </p>
                <p className="mt-1 text-small leading-6 text-post-it-text">
                  {selectedStep.node.lessonGoal}
                </p>
              </div>
            ) : null}

            {selectedStep.node.microLessonPreview ? (
              <div>
                <p className="text-caption font-bold uppercase tracking-[0.14em] text-post-it-muted">
                  Sneak peek
                </p>
                <p className="mt-1 line-clamp-5 text-small leading-6 text-post-it-text">
                  {selectedStep.node.microLessonPreview}
                </p>
              </div>
            ) : null}

            {selectedStep.status === "locked" ? (
              <p className="text-caption font-medium text-post-it-muted">
                Finish the earlier steps on the trail to unlock this one.
              </p>
            ) : null}
          </div>
        ) : null}
      </Modal>

      <footer className="sticky bottom-0 mt-6 border-t border-learning-path-footer-border bg-learning-path-footer-surface/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-[22rem] justify-end sm:max-w-[24rem] md:max-w-4xl lg:max-w-6xl">
          {isModuleComplete ? (
            <p className="text-lg font-semibold text-learning-path-heading">
              Module complete. You are all caught up!
            </p>
          ) : (
            <Button
              type="button"
              variant="primary"
              className="rounded-lg border-0 bg-learning-path-button px-8 py-3 text-lg font-semibold text-on-primary shadow-[var(--shadow-learning-path-button)] hover:bg-learning-path-button-hover"
              title={
                currentNode
                  ? `Continue to ${currentNode.microLessonTitle}`
                  : "Continue to the current lesson"
              }
              aria-label={
                currentNode
                  ? `Continue to ${currentNode.microLessonTitle}`
                  : "Continue to the current lesson"
              }
              onClick={() => openLesson(currentNode)}
            >
              Resume
            </Button>
          )}
        </div>
      </footer>
    </div>
  );
}

export default LearningPathPage;
