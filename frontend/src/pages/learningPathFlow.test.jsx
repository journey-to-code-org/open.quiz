import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LearningPathPage from "./LearningPathPage";
import * as api from "../services/api";

const mockAuth = { isAuthenticated: true };

// Mock authentication so the page always starts with a signed-in learner.
vi.mock("../context/AuthContext", () => ({
  useAuthContext: () => mockAuth,
}));

// Mock the lesson APIs so these tests can control the progress and lesson data.
vi.mock("../services/api", () => ({
  getLesson: vi.fn(),
  getLessonModules: vi.fn(),
  getLessonProgress: vi.fn(),
}));

// Use one small module so the tests can focus on step status and navigation.
const moduleData = {
  id: "cashFlow",
  title: "Cash Flow",
  lessons: [
    {
      id: "1.1",
      title: "Budget basics",
      learningGoal: "Understand budgets.",
      microLessons: [
        {
          id: "1.1.1",
          title: "Start here",
          microLessonContent: [{ type: "paragraph", text: "Begin with a plan." }],
        },
        {
          id: "1.1.2",
          title: "Keep going",
          microLessonContent: [{ type: "paragraph", text: "Track your expenses." }],
        },
        {
          id: "1.1.3",
          title: "Finish strong",
          microLessonContent: [{ type: "paragraph", text: "Review your progress." }],
        },
      ],
    },
  ],
};

describe("learning path page", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock scrollIntoView since it is not available in the test browser environment.
    HTMLElement.prototype.scrollIntoView = vi.fn();

    api.getLessonModules.mockResolvedValue({
      modules: [{ id: "cashFlow", firstLessonId: "1.1" }],
    });

    // Start with the first step completed and the second step as the learner's current position.
    api.getLessonProgress.mockResolvedValue({
      currentModule: "cashFlow",
      currentLessonId: "1.1",
      currentMicroLessonId: "1.1.2",
      completedMicroLessons: ["1.1.1"],
      isModuleCompleted: false,
    });

    // Return the lesson structure without making a real API request.
    api.getLesson.mockResolvedValue({ moduleData });
  });

  it("loads progress and marks completed, current, and locked learning steps", async () => {
    render(
      <MemoryRouter initialEntries={["/learn"]}>
        <Routes>
          <Route path="/learn" element={<LearningPathPage />} />
        </Routes>
      </MemoryRouter>,
    );

    // Wait for the learning path to finish loading before checking step states.
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Step 1: Start here/i })).toBeInTheDocument();
    });

    // Each step announces its own state so learners know what is done, current, and still locked.
    expect(
      screen.getByRole("button", { name: /Step 1: Start here\. Completed step/i }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: /Step 2: Keep going\. Current step/i }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: /Step 3: Finish strong\. Locked step/i }),
    ).toBeVisible();
    expect(
      screen.getByText("Tap a step to peek at what is inside before you start."),
    ).toBeInTheDocument();
    expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "center",
      inline: "nearest",
    });
  });

  it("does not mark the trail complete when only its final step is complete", async () => {
    api.getLessonProgress.mockResolvedValueOnce({
      currentModule: "cashFlow",
      currentLessonId: "1.1",
      currentMicroLessonId: "1.1.3",
      completedMicroLessons: ["1.1.3"],
      completedLessons: [],
      isModuleCompleted: false,
    });

    render(
      <MemoryRouter initialEntries={["/learn"]}>
        <Routes>
          <Route path="/learn" element={<LearningPathPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole("progressbar", { name: "Module progress" })).toHaveAttribute(
      "aria-valuenow",
      "0",
    );
    expect(screen.getAllByText("Keep going")).toHaveLength(2);
    expect(screen.queryByText("Module complete")).not.toBeInTheDocument();
  });

  it("shows step details in the note and navigates to the selected lesson", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/learn"]}>
        <Routes>
          <Route path="/learn" element={<LearningPathPage />} />
          <Route path="/learn/:moduleId/:lessonId" element={<SelectedLesson />} />
        </Routes>
      </MemoryRouter>,
    );

    // Choose the learner's current step from the path.
    const currentNode = await screen.findByRole("button", { name: /Step 2: Keep going/i });
    await user.click(currentNode);

    // The note should preview the step before the learner commits to it.
    expect(screen.getByRole("heading", { name: "Keep going" })).toBeInTheDocument();
    expect(screen.getByText("Understand budgets.")).toBeInTheDocument();
    expect(screen.getByText("Track your expenses.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Continue this step" }));

    // Starting from the note should open the lesson and use the expected API data.
    expect(screen.getByText("Selected lesson: 1.1.2")).toBeInTheDocument();
    expect(api.getLessonProgress).toHaveBeenCalledWith("cashFlow");
    expect(api.getLesson).toHaveBeenCalledWith("cashFlow", "1.1");
  });

  it("explains why a locked step cannot be started yet", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/learn"]}>
        <Routes>
          <Route path="/learn" element={<LearningPathPage />} />
        </Routes>
      </MemoryRouter>,
    );

    const lockedNode = await screen.findByRole("button", { name: /Step 3: Finish strong/i });
    await user.click(lockedNode);

    expect(
      screen.getByText("Finish the earlier steps on the trail to unlock this one."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Locked for now" })).toBeDisabled();
  });
});

function SelectedLesson() {
  const location = useLocation();
  return <div>Selected lesson: {location.state?.microLessonId}</div>;
}
