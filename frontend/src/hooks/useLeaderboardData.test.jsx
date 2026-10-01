import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getLeaderboardMock } = vi.hoisted(() => ({ getLeaderboardMock: vi.fn() }));

vi.mock("../services/api", () => ({ getLeaderboard: getLeaderboardMock }));

import useLeaderboardData from "./useLeaderboardData";

const leaderboard = { optedIn: true, entries: [], currentUser: null };

describe("useLeaderboardData", () => {
  beforeEach(() => getLeaderboardMock.mockReset());

  it("loads leaderboard data for the authenticated learner", async () => {
    getLeaderboardMock.mockResolvedValue(leaderboard);

    const { result } = renderHook(() =>
      useLeaderboardData({ userId: "learner-1", isAuthenticated: true }),
    );

    await waitFor(() => expect(result.current.leaderboard).toEqual(leaderboard));
    expect(result.current.error).toBe("");
  });

  it("keeps request failures local and supports retry", async () => {
    getLeaderboardMock
      .mockRejectedValueOnce(new Error("Leaderboard unavailable."))
      .mockResolvedValueOnce(leaderboard);
    const { result } = renderHook(() =>
      useLeaderboardData({ userId: "learner-1", isAuthenticated: true }),
    );

    await waitFor(() => expect(result.current.error).toBe("Leaderboard unavailable."));
    await act(() => result.current.refresh());

    expect(result.current.leaderboard).toEqual(leaderboard);
    expect(result.current.error).toBe("");
  });

  it("refreshes after profile preference changes", async () => {
    getLeaderboardMock.mockResolvedValue(leaderboard);
    renderHook(() => useLeaderboardData({ userId: "learner-1", isAuthenticated: true }));
    await waitFor(() => expect(getLeaderboardMock).toHaveBeenCalledTimes(1));

    act(() => window.dispatchEvent(new Event("sprout:profile-updated")));

    await waitFor(() => expect(getLeaderboardMock).toHaveBeenCalledTimes(2));
  });
});
