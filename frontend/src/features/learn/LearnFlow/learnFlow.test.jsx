import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LearnFlow from "./LearnFlow.component";
import * as api from "../../../services/api";

// Mock the quiz and progress API functions so the tests do not make real requests.
vi.mock("../../../services/api", () => ({
  checkQuizAnswer: vi.fn().mockResolvedValue({
    isCorrect: true,
    correctChoiceIds: ["a"],
    explanation: "Cash flow describes money moving in and out.",
  }),
  completeLesson: vi.fn().mockResolvedValue({}),
  startQuiz: vi.fn(),
  submitQuiz: vi.fn(),
  restartLessonProgress: vi.fn(),
  updateLessonProgress: vi.fn(),
}));

vi.mock("../Quiz/encouragingCopy", () => ({
  getEncouragingPhrase: () => "Keep going",
  getEncouragingWord: () => "Nice answer",
  getQuizCompletionPhrase: (passed) =>
    passed ? "You passed this quiz." : "Keep practicing and try again.",
  getQuizCompletionWord: (passed) => (passed ? "Excellent" : "Try again"),
  getAllCaughtUpPhrase: () => "You are all caught up.",
}));

// Use a small lesson with one step and one question so the test can focus on the basic learn flow.
const learnData = {
  id: "1.1",
  moduleId: "cashFlow",
  moduleTitle: "Cash Flow",
  title: "What is Cash Flow?",
  learningGoal: "Understand the basics of cash flow.",
  passThreshold: 0.7,
  nextLessonId: null,
  module: {},
  lessonSteps: [
    {
      id: "1.1.1",
      title: "Cash flow basics",
      content: [
        { id: "paragraph-0", type: "paragraph", text: "Cash flow is money moving in and out." },
      ],
    },
  ],
  questions: [
    {
      id: "question-1",
      lessonStepId: "1.1.1",
      prompt: "What does cash flow describe?",
      type: "singleChoice",
      choices: [
        { id: "a", label: "Money moving in and out" },
        { id: "b", label: "A type of bank account" },
      ],
      correctChoiceIds: ["a"],
      explanation: "Cash flow describes money moving in and out.",
    },
  ],
};

describe("learn flow", () => {
  beforeEach(() => {
    // Start each test with no saved lesson state or previous mock calls.
    window.localStorage.clear();
    vi.clearAllMocks();
  });

  it("advances from lesson content into a quiz and gives immediate answer feedback", async () => {
    const user = userEvent.setup();

    // Render the lesson in read-only mode so this test only focuses on navigation and quiz feedback.
    render(
      <MemoryRouter>
        <LearnFlow learnData={learnData} characterImages={{}} guideImage="guide.png" isReadOnly />
      </MemoryRouter>,
    );

    expect(screen.getByText("Cash flow is money moving in and out.")).toBeInTheDocument();

    // Move from the lesson content into its quick check question.
    await user.click(screen.getByRole("button", { name: "Quick check" }));
    expect(screen.getByText("What does cash flow describe?")).toBeInTheDocument();

    // Choose the correct answer and submit it for immediate feedback.
    await user.click(screen.getByRole("radio", { name: /Money moving in and out/i }));
    await user.click(screen.getByRole("button", { name: "Check answer" }));

    expect(screen.getByText("Correct")).toBeInTheDocument();
    expect(screen.getByText(/Cash flow describes money moving in and out\./)).toBeInTheDocument();
  });

  it("shows the passed score and registration call-to-action after a preview quiz", async () => {
    const user = userEvent.setup();

    // Render the lesson as a preview so finishing the quiz leads to the registration prompt.
    render(
      <MemoryRouter>
        <LearnFlow learnData={learnData} characterImages={{}} guideImage="guide.png" isReadOnly />
      </MemoryRouter>,
    );

    // Complete the quick check with the correct answer and open the results.
    await user.click(screen.getByRole("button", { name: "Quick check" }));
    await user.click(screen.getByRole("radio", { name: /Money moving in and out/i }));
    await user.click(screen.getByRole("button", { name: "Check answer" }));
    await user.click(screen.getByRole("button", { name: "View results" }));

    // A passing preview should show the score and encourage the visitor to register.
    expect(screen.getByText(/Score: 100% — Pass/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Excellent" })).toBeInTheDocument();
    expect(screen.getByText("You passed this quiz.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Register to keep learning" })).toHaveAttribute(
      "href",
      "/register",
    );
  });

  it("lets a learner retry a failed final quiz", async () => {
    const user = userEvent.setup();
    api.updateLessonProgress.mockResolvedValue({});
    api.checkQuizAnswer.mockResolvedValueOnce({
      isCorrect: false,
      correctChoiceIds: ["a"],
      explanation: "Cash flow describes money moving in and out.",
    });
    api.startQuiz.mockResolvedValue({ attemptId: "attempt-1" });
    api.submitQuiz.mockResolvedValueOnce({ score: 0, passed: false, missed: ["question-1"] });

    render(
      <MemoryRouter>
        <LearnFlow
          learnData={learnData}
          characterImages={{}}
          guideImage="guide.png"
          csrfToken="csrf-1"
        />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "Quick check" }));
    await user.click(screen.getByRole("radio", { name: /A type of bank account/i }));
    await user.click(screen.getByRole("button", { name: "Check answer" }));
    await user.click(screen.getByRole("button", { name: "View results" }));

    expect(await screen.findByRole("button", { name: "Try quiz again" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Try quiz again" }));

    expect(screen.getByText("What does cash flow describe?")).toBeInTheDocument();
    expect(api.startQuiz).toHaveBeenCalledTimes(2);
  });

  it("uses checked-answer feedback when reviewing a redacted public question", async () => {
    const user = userEvent.setup();
    const redactedLearnData = {
      ...learnData,
      questions: learnData.questions.map((question) => ({
        ...question,
        correctChoiceIds: [],
        explanation: undefined,
      })),
    };

    render(
      <MemoryRouter>
        <LearnFlow
          learnData={redactedLearnData}
          characterImages={{}}
          guideImage="guide.png"
          isReadOnly
        />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "Quick check" }));
    await user.click(screen.getByRole("radio", { name: /Money moving in and out/i }));
    await user.click(screen.getByRole("button", { name: "Check answer" }));
    await user.click(screen.getByRole("button", { name: "View results" }));
    await user.click(screen.getByRole("button", { name: "Review Answers" }));

    expect(screen.getByRole("img", { name: "Correct answer" })).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "Incorrect answer" })).not.toBeInTheDocument();
    expect(
      screen.getByText(/Explanation: Cash flow describes money moving in and out/),
    ).toBeInTheDocument();
  });

  it("uses submitted feedback for end-of-quiz review", async () => {
    const user = userEvent.setup();
    const redactedLearnData = {
      ...learnData,
      questions: learnData.questions.map((question) => ({
        ...question,
        correctChoiceIds: [],
        explanation: undefined,
      })),
    };

    window.localStorage.setItem("openquiz-quiz-feedback-preference", "end");
    api.updateLessonProgress.mockResolvedValue({});
    api.startQuiz.mockResolvedValue({ attemptId: "attempt-1" });
    api.submitQuiz.mockResolvedValue({
      score: 100,
      passed: true,
      missed: [],
      reviews: [
        {
          questionId: "question-1",
          isCorrect: true,
          correctChoiceIds: ["a"],
          explanation: "Cash flow describes money moving in and out.",
        },
      ],
    });

    render(
      <MemoryRouter>
        <LearnFlow
          learnData={redactedLearnData}
          characterImages={{}}
          guideImage="guide.png"
          csrfToken="csrf-1"
        />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "Quick check" }));
    await user.click(screen.getByRole("radio", { name: /Money moving in and out/i }));
    await user.click(screen.getByRole("button", { name: "View results" }));
    await user.click(screen.getByRole("button", { name: "Review Answers" }));

    expect(api.checkQuizAnswer).not.toHaveBeenCalled();
    expect(screen.getByRole("img", { name: "Correct answer" })).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "Incorrect answer" })).not.toBeInTheDocument();
    expect(
      screen.getByText(/Explanation: Cash flow describes money moving in and out/),
    ).toBeInTheDocument();
  });

  it("syncs progress and submits the quiz for an authenticated learner", async () => {
    const user = userEvent.setup();

    // Mock the lesson progress and quiz requests so the test can focus on the full learner flow.
    api.updateLessonProgress.mockResolvedValue({});
    api.startQuiz.mockResolvedValue({ attemptId: "attempt-1" });
    api.submitQuiz.mockResolvedValue({ score: 100, passed: true, missed: [] });

    render(
      <MemoryRouter>
        <LearnFlow
          learnData={learnData}
          characterImages={{}}
          guideImage="guide.png"
          csrfToken="csrf-1"
        />
      </MemoryRouter>,
    );

    // Complete the quick check with the correct answer and open the results.
    await user.click(screen.getByRole("button", { name: "Quick check" }));
    await user.click(screen.getByRole("radio", { name: /Money moving in and out/i }));
    await user.click(screen.getByRole("button", { name: "Check answer" }));
    await user.click(screen.getByRole("button", { name: "View results" }));

    // The learner's lesson progress should be saved before finishing the quiz flow.
    expect(api.updateLessonProgress).toHaveBeenCalledWith({
      moduleId: "cashFlow",
      lessonId: "1.1",
      microLessonId: "1.1.1",
      currentChunkIndex: 0,
      csrfToken: "csrf-1",
    });

    // Starting the quiz should create the attempt used when the answers are submitted.
    expect(api.startQuiz).toHaveBeenCalledWith({
      moduleId: "cashFlow",
      microLessonId: "1.1.1",
      csrfToken: "csrf-1",
    });

    // Submit the selected answer with the attempt ID returned when the quiz started.
    expect(api.submitQuiz).toHaveBeenCalledWith("1.1.1", {
      attemptId: "attempt-1",
      moduleId: "cashFlow",
      answers: { "question-1": ["a"] },
      csrfToken: "csrf-1",
    });

    expect(screen.getByText(/Score: 100% — Pass/)).toBeInTheDocument();
  });

  it("stays on the quiz when submitting the answers fails", async () => {
    const user = userEvent.setup();

    api.updateLessonProgress.mockResolvedValue({});
    api.startQuiz.mockResolvedValue({ attemptId: "attempt-1" });
    api.submitQuiz.mockRejectedValue(new Error("Unable to save quiz attempt."));

    render(
      <MemoryRouter>
        <LearnFlow
          learnData={learnData}
          characterImages={{}}
          guideImage="guide.png"
          csrfToken="csrf-1"
        />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "Quick check" }));
    await user.click(screen.getByRole("radio", { name: /Money moving in and out/i }));
    await user.click(screen.getByRole("button", { name: "Check answer" }));
    await user.click(screen.getByRole("button", { name: "View results" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Unable to save quiz attempt.");
    expect(screen.queryByText(/Score: .*Fail/)).not.toBeInTheDocument();
    expect(screen.getByText("What does cash flow describe?")).toBeInTheDocument();
  });
});
