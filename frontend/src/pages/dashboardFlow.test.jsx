import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DashboardPage from "./DashboardPage";

// Use a simple authenticated user so the page renders the logged-in dashboard state.
const mockAuth = {
  user: { id: "user-123", name: "Test User" },
  isAuthenticated: true,
};

// Provide dashboard data directly so these tests can focus on what the page renders.
const mockDashboardData = {
  dashboard: {
    hero: {
      greeting: "Welcome back",
      statusText: "You are on track.",
      streak: { currentDays: 3, helperText: "Nice streak" },
      dailyGoal: { current: 1, target: 2, label: "1 / 2 lessons", isMet: false },
      primaryAction: { label: "Continue learning", href: "/learn/cashFlow/1.1" },
    },
    nextAction: {
      title: "Budgeting Basics",
      description: "Finish your next lesson to build momentum.",
      ctaLabel: "Continue",
      href: "/learn/cashFlow/1.1",
    },
    units: [
      {
        id: "unit-1",
        name: "Budgeting Basics",
        completedLessons: 1,
        totalLessons: 3,
        progressPercent: 33,
      },
    ],
    recentActivity: [{ id: "a-1", label: "Completed a lesson", timeLabel: "Today" }],
  },
  isLoading: false,
  error: "",
};

// Mock auth so the page does not depend on the real authentication flow.
vi.mock("../context/AuthContext", () => ({
  useAuthContext: () => mockAuth,
}));

// Mock the dashboard hook so the page receives predictable data for each test.
vi.mock("../hooks/useDashboardData", () => ({
  default: () => mockDashboardData,
}));

describe("dashboard page", () => {
  beforeEach(() => {
    // Clear any mock call history before each test.
    vi.clearAllMocks();
  });

  it("renders the dashboard hero, next action, and recent activity", () => {
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    // Make sure the main dashboard sections are shown from the mocked data.
    expect(screen.getByText("Welcome back")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Budgeting Basics" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Continue" })).toBeInTheDocument();
    expect(screen.getByText("Completed a lesson")).toBeInTheDocument();
    expect(screen.getByText("Today's goal")).toBeInTheDocument();
  });

  it("shows the empty state when the learner has no completed lessons", () => {
    // Replace the normal dashboard data with a learner who has not completed anything yet.
    mockDashboardData.dashboard = {
      hero: { greeting: "Welcome back", statusText: "Start now." },
      nextAction: {
        title: "Start learning",
        description: "Begin your first lesson.",
        href: "/learn",
        ctaLabel: "Begin",
      },
      units: [
        {
          id: "unit-1",
          name: "Budgeting Basics",
          completedLessons: 0,
          totalLessons: 3,
          progressPercent: 0,
        },
      ],
      recentActivity: [],
    };

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    // With no completed lessons, the learner should see the first-time dashboard state.
    expect(screen.getByText("Welcome to your progress dashboard")).toBeInTheDocument();
    expect(screen.getByText("Ready to start? Choose a lesson to begin.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Explore lessons" })).toHaveAttribute("href", "/learn");
  });
});
