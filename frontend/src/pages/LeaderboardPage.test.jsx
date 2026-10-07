import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LeaderboardPage from "./LeaderboardPage";
import { getPublicLeaderboard } from "../services/api";
import { useAuthContext } from "../context/AuthContext";

vi.mock("../services/api", async (importOriginal) => ({
  ...(await importOriginal()),
  getPublicLeaderboard: vi.fn(),
}));
vi.mock("../context/AuthContext", () => ({ useAuthContext: vi.fn() }));

describe("LeaderboardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthContext.mockReturnValue({ isAuthenticated: false });
  });

  it("shows rankings and a sign-in link to anonymous visitors", async () => {
    getPublicLeaderboard.mockResolvedValue({
      optedIn: null,
      currentUser: null,
      entries: [{ displayName: "Avery", weeklyXp: 100, rank: 1, isCurrentUser: false }],
    });
    render(
      <MemoryRouter>
        <LeaderboardPage />
      </MemoryRouter>,
    );
    expect(await screen.findByText("Avery")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Log in to join the leaderboard" })).toHaveAttribute(
      "href",
      "/login",
    );
  });

  it("reports failures and retries the public request", async () => {
    getPublicLeaderboard
      .mockRejectedValueOnce(new Error("Temporarily unavailable"))
      .mockResolvedValueOnce({ optedIn: null, entries: [], currentUser: null });
    render(
      <MemoryRouter>
        <LeaderboardPage />
      </MemoryRouter>,
    );
    expect(await screen.findByText("Temporarily unavailable")).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(screen.getByText(/No XP rankings yet/)).toBeInTheDocument());
  });
});
