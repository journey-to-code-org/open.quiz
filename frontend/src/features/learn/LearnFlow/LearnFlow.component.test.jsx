import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi, beforeEach } from "vitest";

import LearnFlow from "./LearnFlow.component";

// Keep the progress requests mocked so these tests can focus on LearnFlow behavior.
const completeLessonMock = vi.fn(() => Promise.resolve({}));
const completeMicroLessonMock = vi.fn(() => Promise.resolve({}));
const updateLessonProgressMock = vi.fn(() => Promise.resolve({}));
const restartLessonProgressMock = vi.fn(() => Promise.resolve({}));
const instanceAssetsMock = vi.fn(() => ({ avatars: {} }));
const currentQuestionMock = vi.fn(() => null);

vi.mock("../../../app/instanceAssets", () => ({
  useInstanceAssets: () => instanceAssetsMock(),
}));

// Mock the quiz hook since these regression tests do not need to run through a real quiz.
vi.mock("../../../hooks/useQuiz", () => ({
  useQuiz: () => ({
    questionIndex: 0,
    currentQuestion: currentQuestionMock(),
    selectedChoiceIds: [],
    review: false,
    status: "idle",
    answers: {},
    errorMessage: "",
    begin: vi.fn(),
    goToNextQuestion: vi.fn(),
    checkAnswer: vi.fn(),
    submit: vi.fn(),
    reset: vi.fn(),
  }),
}));

vi.mock("../../../utils/quizFeedbackPreference", () => ({
  getQuizFeedbackPreference: () => "immediate",
}));

vi.mock("../../../utils/quizScoring", () => ({
  aggregateLessonScore: () => ({ percentage: 100, passed: true }),
}));

// Route progress calls through shared mocks so we can check what LearnFlow sends to the API.
vi.mock("../../../services/api", () => ({
  completeMicroLesson: (...args) => completeMicroLessonMock(...args),
  completeLesson: (...args) => completeLessonMock(...args),
  updateLessonProgress: (...args) => updateLessonProgressMock(...args),
  restartLessonProgress: (...args) => restartLessonProgressMock(...args),
  resolveAssetUrl: (url) => url,
}));

vi.mock("../Quiz/encouragingCopy", () => ({
  getQuizCompletionPhrase: () => "Nice work",
  getQuizCompletionWord: () => "Great",
  getAllCaughtUpPhrase: () => "All caught up",
}));

// Replace child components with simple versions so these tests stay focused on LearnFlow.
vi.mock("../Quiz/Quiz.component", () => ({
  default: () => <div>Quiz</div>,
}));

vi.mock("../Quiz/QuizReview/QuizReview.component", () => ({
  default: () => <div>Quiz Review</div>,
}));

vi.mock("../../../shared/Button/Button.component", () => ({
  default: ({ children, onClick, disabled, loading, as: Component = "button", to }) => (
    <Component onClick={onClick} disabled={disabled || loading} to={to}>
      {children}
    </Component>
  ),
}));

vi.mock("../../../shared/Card/Card.component", () => ({
  default: ({ children }) => <div>{children}</div>,
}));

vi.mock("../../../shared/ProgressBar/ProgressBar.component", () => ({
  default: () => <div>Progress Bar</div>,
}));

vi.mock("../Lesson/Lesson.component", () => ({
  default: ({ title, characterImage, characterAlt }) => (
    <div>
      {title || "Lesson Body"}
      {characterImage ? <img src={characterImage} alt={characterAlt} /> : null}
    </div>
  ),
}));

// Use a small two-step lesson so resume and restart behavior is easy to control.
const baseLearnData = {
  id: "1.1",
  moduleId: "cashFlow",
  moduleTitle: "Budgeting and Cash Flow Basics",
  title: "What is Cash Flow and a Budget?",
  module: "cashFlow",
  learningGoal: "Understand budgeting basics",
  lessonSteps: [
    {
      id: "1.1.1",
      title: "Step One",
      content: [{ type: "paragraph", text: "One" }],
    },
    {
      id: "1.1.2",
      title: "Step Two",
      content: [{ type: "paragraph", text: "Two" }],
    },
  ],
  questions: [],
  passThreshold: 70,
  nextLessonId: "1.2",
};

// Keep the common LearnFlow setup in one place so each test only needs to pass what changes.
function renderLearnFlow(props = {}) {
  return render(
    <MemoryRouter>
      <LearnFlow
        learnData={baseLearnData}
        characterImages={{ beaver: "/beaver.png" }}
        guideImage="/guide.png"
        csrfToken="csrf-token"
        {...props}
      />
    </MemoryRouter>,
  );
}

describe("LearnFlow regressions", () => {
  beforeEach(() => {
    // Clear previous progress calls so each test starts with fresh mocks.
    completeLessonMock.mockReset();
    completeLessonMock.mockResolvedValue({});
    completeMicroLessonMock.mockReset();
    completeMicroLessonMock.mockResolvedValue({});
    updateLessonProgressMock.mockClear();
    restartLessonProgressMock.mockClear();
    instanceAssetsMock.mockReturnValue({ avatars: {} });
    currentQuestionMock.mockReturnValue(null);
  });

  it("does not let a quiz character override the current lesson character", () => {
    currentQuestionMock.mockReturnValue({ id: "question", characterId: "ramona" });
    instanceAssetsMock.mockReturnValue({
      avatars: {
        abigail: { name: "Abigail", url: "/abigail.webp" },
        ramona: { name: "Ramona", url: "/ramona.webp" },
      },
    });
    renderLearnFlow({
      learnData: {
        ...baseLearnData,
        lessonSteps: [{ id: "intro", characterId: "abigail", content: [] }],
      },
    });
    expect(screen.getByRole("img", { name: "Abigail" })).toHaveAttribute("src", "/abigail.webp");
    expect(screen.queryByRole("img", { name: "Ramona" })).not.toBeInTheDocument();
  });

  it("uses active theme artwork for content characters instead of bundled or module images", () => {
    instanceAssetsMock.mockReturnValue({
      avatars: { abigail: { name: "Custom Abigail", url: "/theme-abigail.webp" } },
    });
    renderLearnFlow({
      characterImages: { abigail: "/bundled-abigail.webp" },
      learnData: {
        ...baseLearnData,
        module: { characters: [{ characterId: "abigail", imagePath: "/module-abigail.webp" }] },
        lessonSteps: [{ id: "intro", characterId: "abigail", content: [] }],
      },
    });
    expect(screen.getByRole("img", { name: "Custom Abigail" })).toHaveAttribute(
      "src",
      "/theme-abigail.webp",
    );
  });

  it("uses the reserved guide avatar when content has no character", () => {
    instanceAssetsMock.mockReturnValue({
      avatars: { guide: { name: "Custom guide", url: "/theme-guide.webp" } },
    });
    renderLearnFlow();
    expect(screen.getByRole("img", { name: "Custom guide" })).toHaveAttribute(
      "src",
      "/theme-guide.webp",
    );
  });

  it("preserves module character artwork when the theme has no matching avatar", () => {
    renderLearnFlow({
      learnData: {
        ...baseLearnData,
        module: {
          characters: [
            { characterId: "abigail", name: "Abigail", imagePath: "/module-abigail.webp" },
          ],
        },
        lessonSteps: [{ id: "intro", characterId: "abigail", content: [] }],
      },
    });
    expect(screen.getByRole("img", { name: "Abigail" })).toHaveAttribute(
      "src",
      "/module-abigail.webp",
    );
  });

  it("shows resume banner only when resuming from saved progress on mount", () => {
    // Start the learner on the second step to represent a resumed lesson.
    renderLearnFlow({
      savedProgress: {
        currentLessonId: "1.1",
        currentMicroLessonId: "1.1.2",
        currentChunkIndex: 0,
      },
    });

    expect(screen.getByText('Welcome Back! Resuming "Step Two"')).toBeInTheDocument();
  });

  it("opens the micro-lesson selected from the learning path", () => {
    renderLearnFlow({
      selectedMicroLessonId: "1.1.1",
      savedProgress: {
        currentLessonId: "1.1",
        currentMicroLessonId: "1.1.2",
        currentChunkIndex: 0,
      },
    });

    expect(screen.getByText("Step One")).toBeInTheDocument();
  });

  it("does not show resume banner on a fresh start", () => {
    // With no saved progress, the lesson should behave like a new visit.
    renderLearnFlow({ savedProgress: null });

    expect(screen.queryByText(/Welcome Back! Resuming/)).not.toBeInTheDocument();
  });

  it("renders Start Over when a resumed session is away from lesson start", () => {
    // Resume on the second step so the learner has something to restart.
    renderLearnFlow({
      savedProgress: {
        currentLessonId: "1.1",
        currentMicroLessonId: "1.1.2",
        currentChunkIndex: 0,
      },
    });

    expect(screen.getByRole("button", { name: "Start Over" })).toBeInTheDocument();
  });

  it("calls restart endpoint with moduleId and csrfToken when Start Over is clicked", async () => {
    const user = userEvent.setup();

    renderLearnFlow({
      savedProgress: {
        currentLessonId: "1.1",
        currentMicroLessonId: "1.1.2",
        currentChunkIndex: 0,
      },
    });

    // Restart the resumed lesson and make sure the expected values are sent to the API.
    await user.click(screen.getByRole("button", { name: "Start Over" }));

    await waitFor(() => {
      expect(restartLessonProgressMock).toHaveBeenCalledWith({
        moduleId: "cashFlow",
        csrfToken: "csrf-token",
      });
    });
  });

  it("syncs lesson progress with lesson, micro-lesson, and chunk", async () => {
    // Resume from a saved step so LearnFlow has progress that needs to be synced.
    renderLearnFlow({
      savedProgress: {
        currentLessonId: "1.1",
        currentMicroLessonId: "1.1.2",
        currentChunkIndex: 0,
      },
    });

    // The saved position should be synced with all of the values needed by the backend.
    await waitFor(() => {
      expect(updateLessonProgressMock).toHaveBeenCalledWith({
        moduleId: "cashFlow",
        lessonId: "1.1",
        microLessonId: "1.1.2",
        currentChunkIndex: 0,
        csrfToken: "csrf-token",
      });
    });
  });

  it("advances when micro-lesson completion persistence fails", async () => {
    const user = userEvent.setup();
    completeMicroLessonMock.mockRejectedValueOnce(new Error("Request failed"));

    renderLearnFlow();

    await user.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() => {
      expect(screen.getByText("Step Two")).toBeInTheDocument();
    });
  });

  it("persists a finished lesson so dashboard progress can refresh", async () => {
    const user = userEvent.setup();
    renderLearnFlow();

    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(screen.getByRole("button", { name: "Finish lesson" }));

    await waitFor(() => {
      expect(completeLessonMock).toHaveBeenCalledWith({
        moduleId: "cashFlow",
        lessonId: "1.1",
        csrfToken: "csrf-token",
      });
    });
  });

  it("waits for lesson completion to save before linking to the next lesson", async () => {
    const user = userEvent.setup();
    const completion = Promise.withResolvers();
    completeLessonMock.mockReturnValueOnce(completion.promise);
    renderLearnFlow();

    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(screen.getByRole("button", { name: "Finish lesson" }));

    expect(screen.queryByRole("link", { name: "Continue" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Saving progress…" })).toBeDisabled();

    await act(async () => completion.resolve({}));
    expect(screen.getByRole("link", { name: "Continue" })).toHaveAttribute(
      "href",
      "/learn/cashFlow/1.2",
    );
  });

  it("links to the dashboard after saving the final lesson", async () => {
    const user = userEvent.setup();
    renderLearnFlow({ learnData: { ...baseLearnData, nextLessonId: null } });

    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(screen.getByRole("button", { name: "Finish lesson" }));

    expect(await screen.findByRole("link", { name: "Continue" })).toHaveAttribute(
      "href",
      "/dashboard",
    );
  });

  it("waits for final lesson persistence when the context CSRF token is unavailable", async () => {
    const user = userEvent.setup();
    const completion = Promise.withResolvers();
    completeLessonMock.mockReturnValueOnce(completion.promise);
    renderLearnFlow({ csrfToken: undefined, learnData: { ...baseLearnData, nextLessonId: null } });

    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(screen.getByRole("button", { name: "Finish lesson" }));

    expect(screen.queryByRole("link", { name: "Continue" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Saving progress…" })).toBeDisabled();

    await act(async () => completion.resolve({}));
    expect(screen.getByRole("link", { name: "Continue" })).toHaveAttribute("href", "/dashboard");
  });

  it("shows completion errors and retries saving before enabling the next lesson", async () => {
    const user = userEvent.setup();
    completeLessonMock.mockRejectedValueOnce(new Error("Could not save progress."));
    renderLearnFlow();

    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(screen.getByRole("button", { name: "Finish lesson" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not save progress.");
    expect(screen.queryByRole("link", { name: "Continue" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Retry saving" }));

    expect(await screen.findByRole("link", { name: "Continue" })).toHaveAttribute(
      "href",
      "/learn/cashFlow/1.2",
    );
    expect(completeLessonMock).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
