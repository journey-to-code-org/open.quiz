import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import LeaderboardCard from "./LeaderboardCard.component";

const renderCard = (leaderboard) =>
  render(
    <MemoryRouter>
      <LeaderboardCard leaderboard={leaderboard} />
    </MemoryRouter>,
  );

const entry = (overrides = {}) => ({
  isCurrentUser: false,
  displayName: "Avery",
  avatarUrl: null,
  weeklyXp: 125,
  rank: 1,
  ...overrides,
});

describe("LeaderboardCard", () => {
  it("shows a settings CTA instead of rankings when opted out", () => {
    renderCard({ optedIn: false, entries: [], currentUser: null });

    expect(screen.queryByRole("list", { name: "Weekly XP rankings" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Choose leaderboard settings" })).toHaveAttribute(
      "href",
      "/profile",
    );
  });

  it("marks the learner in the top list and repeats their rank in the summary strip", () => {
    const currentUser = entry({
      isCurrentUser: true,
      displayName: "Maya",
      rank: 2,
      weeklyXp: 90,
    });
    renderCard({
      optedIn: true,
      entries: [entry(), currentUser],
      currentUser,
    });

    const currentRow = screen.getByRole("listitem", { current: true });
    expect(within(currentRow).getByText("Maya")).toBeInTheDocument();
    expect(within(currentRow).getByText("(You)")).toBeInTheDocument();
    expect(screen.getByText("You are #2")).toBeInTheDocument();
    expect(screen.getByText("You’re in the top 20 this week.")).toBeInTheDocument();
  });

  it("shows the learner's rank when they are outside the top 20", () => {
    const currentUser = entry({ displayName: "Maya", rank: 24, weeklyXp: 25 });
    renderCard({ optedIn: true, entries: [entry()], currentUser });

    expect(screen.getByText("You are #24")).toBeInTheDocument();
    expect(screen.getByText("Your rank is outside the top 20.")).toBeInTheDocument();
    expect(screen.queryByText("Maya")).not.toBeInTheDocument();
  });

  it("shows an empty state and an unranked message before anyone earns XP", () => {
    renderCard({ optedIn: true, entries: [], currentUser: null });

    expect(screen.getByText(/No XP rankings yet/)).toBeInTheDocument();
    expect(screen.getByText("Earn XP to receive your first weekly rank.")).toBeInTheDocument();
  });
});
