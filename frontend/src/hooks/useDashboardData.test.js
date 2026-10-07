import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getDashboardMock } = vi.hoisted(() => ({
  getDashboardMock: vi.fn(),
}));

vi.mock("../services/api", () => ({
  getDashboard: getDashboardMock,
}));

import useDashboardData from "./useDashboardData";

const cachedDashboard = {
  hero: { greeting: "Welcome back, Learner" },
  progress: { completedLessons: 1, totalLessons: 4, overallPercent: 25 },
};

describe("useDashboardData", () => {
  beforeEach(() => {
    getDashboardMock.mockReset();
    window.sessionStorage.clear();
  });

  it("loads the dashboard for an authenticated user and caches the payload", async () => {
    const payload = {
      hero: { title: "Welcome back" },
      nextAction: { title: "Keep going", href: "/learn/cashFlow/1.1" },
      units: [{ id: "unit-1", completedLessons: 2 }],
      recentActivity: [{ label: "Lesson completed" }],
    };

    getDashboardMock.mockResolvedValue(payload);

    const { result } = renderHook(() =>
      useDashboardData({ userId: "user-123", isAuthenticated: true }),
    );

    await waitFor(() => {
      expect(result.current.dashboard).toEqual(payload);
    });

    expect(getDashboardMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(sessionStorage.getItem("openquiz.dashboard.user-123"))).toMatchObject({
      payload,
    });
  });

  it("uses the current session cache without another dashboard request", async () => {
    window.sessionStorage.setItem(
      "openquiz.dashboard.learner-1",
      JSON.stringify({
        payload: cachedDashboard,
        expiresAt: Date.now() + 30_000,
      }),
    );

    const { result } = renderHook(() =>
      useDashboardData({ userId: "learner-1", isAuthenticated: true }),
    );

    await waitFor(() => {
      expect(result.current.dashboard).toEqual(cachedDashboard);
    });
    expect(getDashboardMock).not.toHaveBeenCalled();
  });

  it("uses the cached dashboard when it is still fresh and refreshes on progress event", async () => {
    const cachedPayload = {
      hero: { title: "Cached" },
      nextAction: { title: "Resume" },
      units: [],
      recentActivity: [],
    };

    sessionStorage.setItem(
      "openquiz.dashboard.user-123",
      JSON.stringify({
        payload: cachedPayload,
        expiresAt: Date.now() + 30_000,
      }),
    );

    getDashboardMock.mockResolvedValue({
      hero: { title: "Fresh" },
      nextAction: { title: "Fresh action" },
      units: [{ id: "u-1", completedLessons: 1 }],
      recentActivity: [],
    });

    const { result } = renderHook(() =>
      useDashboardData({ userId: "user-123", isAuthenticated: true }),
    );

    await waitFor(() => {
      expect(result.current.dashboard).toEqual(cachedPayload);
    });

    expect(getDashboardMock).not.toHaveBeenCalled();

    act(() => {
      window.dispatchEvent(new Event("openquiz:progress-updated"));
    });

    await waitFor(() => {
      expect(getDashboardMock).toHaveBeenCalledTimes(1);
    });
  });

  it("ignores malformed and expired cache entries", async () => {
    const freshPayload = { hero: { title: "Fresh" }, units: [], recentActivity: [] };
    getDashboardMock.mockResolvedValue(freshPayload);

    sessionStorage.setItem("openquiz.dashboard.user-123", "not-json");

    const malformed = renderHook(() =>
      useDashboardData({ userId: "user-123", isAuthenticated: true }),
    );

    await waitFor(() => expect(malformed.result.current.dashboard).toEqual(freshPayload));

    sessionStorage.setItem(
      "openquiz.dashboard.user-456",
      JSON.stringify({ payload: { hero: { title: "Expired" } }, expiresAt: Date.now() - 1 }),
    );

    const expired = renderHook(() =>
      useDashboardData({ userId: "user-456", isAuthenticated: true }),
    );

    await waitFor(() => expect(expired.result.current.dashboard).toEqual(freshPayload));
    expect(getDashboardMock).toHaveBeenCalledTimes(2);
  });

  it("clears cached data and refetches after a completion event", async () => {
    const refreshedDashboard = {
      ...cachedDashboard,
      progress: { completedLessons: 2, totalLessons: 4, overallPercent: 50 },
    };

    getDashboardMock
      .mockResolvedValueOnce(cachedDashboard)
      .mockResolvedValueOnce(refreshedDashboard);

    const { result } = renderHook(() =>
      useDashboardData({ userId: "learner-1", isAuthenticated: true }),
    );

    await waitFor(() => {
      expect(result.current.dashboard).toEqual(cachedDashboard);
    });

    act(() => {
      window.dispatchEvent(new Event("openquiz:progress-updated"));
    });

    await waitFor(() => {
      expect(result.current.dashboard).toEqual(refreshedDashboard);
    });
    expect(getDashboardMock).toHaveBeenCalledTimes(2);
  });
});
