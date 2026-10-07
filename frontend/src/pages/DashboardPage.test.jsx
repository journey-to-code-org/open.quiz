import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";

import DashboardPage from "./DashboardPage";

vi.mock("../context/AuthContext", () => ({
  useAuthContext: () => ({
    user: { id: "learner-1" },
    isAuthenticated: true,
  }),
}));

vi.mock("../hooks/useDashboardData", () => ({
  default: () => ({
    dashboard: {
      hero: {
        greeting: "Welcome back, Abigail",
        statusText: "Nice pace. Your next lesson is ready when you are.",
        streak: { currentDays: 2, helperText: "Keep going." },
        dailyGoal: { current: 1, target: 1, isMet: true, label: "1 / 1 lesson" },
        primaryAction: { label: "Continue Income", href: "/learn/cashFlow/1.2" },
      },
      progress: { completedLessons: 1, totalLessons: 4, overallPercent: 25 },
      nextAction: {
        title: "Income",
        description: "Pick up where you left off.",
        ctaLabel: "Continue Income",
        href: "/learn/cashFlow/1.2",
      },
      units: [
        {
          id: "cashFlow",
          name: "Budgeting and Cash Flow Basics",
          completedLessons: 1,
          totalLessons: 4,
          progressPercent: 25,
        },
      ],
      recentActivity: [],
    },
    isLoading: false,
    error: "",
  }),
}));

vi.mock("../hooks/useLeaderboardData", () => ({
  default: () => ({
    leaderboard: {
      optedIn: true,
      entries: [],
      currentUser: null,
    },
    isLoading: false,
    error: "",
    refresh: vi.fn(),
  }),
}));

describe("DashboardPage", () => {
  it("keeps the recommendation, overall progress, and unit marker visible", () => {
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    expect(screen.getByText("Recommended next")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Continue Income" })).toHaveAttribute(
      "href",
      "/learn/cashFlow/1.2",
    );
    expect(screen.getByText("Overall progress")).toBeInTheDocument();
    expect(screen.getByText("1 of 4 lessons complete")).toBeInTheDocument();
    expect(screen.getByText("B")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Weekly leaderboard" })).toBeInTheDocument();
    expect(screen.getByText(/No XP rankings yet/)).toBeInTheDocument();
  });
});
