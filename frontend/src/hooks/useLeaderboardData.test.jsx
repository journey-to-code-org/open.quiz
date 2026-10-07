import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getLeaderboardMock, getPublicLeaderboardMock } = vi.hoisted(() => ({
  getLeaderboardMock: vi.fn(),
  getPublicLeaderboardMock: vi.fn(),
}));

vi.mock("../services/api", () => ({
  getLeaderboard: getLeaderboardMock,
  getPublicLeaderboard: getPublicLeaderboardMock,
}));

import useLeaderboardData from "./useLeaderboardData";

const leaderboard = { optedIn: true, entries: [], currentUser: null };

describe("useLeaderboardData", () => {
  beforeEach(() => {
    getLeaderboardMock.mockReset();
    getPublicLeaderboardMock.mockReset();
  });

  it("loads public rankings without an authenticated user", async () => {
    const payload = { optedIn: null, entries: [], currentUser: null };
    getPublicLeaderboardMock.mockResolvedValue(payload);
    const { result } = renderHook(() => useLeaderboardData({ publicView: true }));
    await waitFor(() => expect(result.current.leaderboard).toEqual(payload));
    expect(getLeaderboardMock).not.toHaveBeenCalled();
  });

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

    act(() => window.dispatchEvent(new Event("openquiz:profile-updated")));

    await waitFor(() => expect(getLeaderboardMock).toHaveBeenCalledTimes(2));
  });
});
