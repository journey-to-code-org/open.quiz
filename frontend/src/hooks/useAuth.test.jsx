import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAuth } from "./useAuth";
import { AUTH_EXPIRED_EVENT } from "../services/api";
import * as api from "../services/api";

vi.mock("../services/api", () => ({
  AUTH_EXPIRED_EVENT: "openquiz:auth-expired",
  CSRF_TOKEN_UPDATED_EVENT: "openquiz:csrf-token-updated",
  clearCsrfToken: vi.fn(),
  getProfile: vi.fn(),
  setCsrfToken: vi.fn(),
}));

describe("useAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    localStorage.clear();
    api.getProfile.mockResolvedValue({
      user: {
        id: "user-id",
        name: "Maya",
        email: "maya@example.com",
      },
    });
  });

  it("refreshes an incomplete stored user from the authenticated profile", async () => {
    sessionStorage.setItem(
      "openquiz.auth",
      JSON.stringify({
        user: { id: "user-id", email: "maya@example.com", role: "learner" },
        csrfToken: "csrf-token",
      }),
    );

    const { result } = renderHook(() => useAuth());

    await waitFor(() => expect(result.current.isHydrating).toBe(false));

    expect(api.getProfile).toHaveBeenCalledTimes(1);
    expect(result.current.user).toEqual(expect.objectContaining({ name: "Maya", role: "learner" }));
    expect(JSON.parse(sessionStorage.getItem("openquiz.auth"))).toEqual(
      expect.objectContaining({
        csrfToken: "csrf-token",
        user: expect.objectContaining({ name: "Maya", role: "learner" }),
      }),
    );
  });

  it.each(["ACCOUNT_DISABLED", "ACCOUNT_DELETED"])(
    "clears stored authentication for %s during hydration",
    async (code) => {
      sessionStorage.setItem(
        "openquiz.auth",
        JSON.stringify({
          user: { id: "user-id", email: "maya@example.com", role: "learner" },
          csrfToken: "csrf-token",
        }),
      );
      api.getProfile.mockRejectedValueOnce(
        Object.assign(new Error("Unauthorized"), { status: 401, code, authInvalidating: true }),
      );

      const { result } = renderHook(() => useAuth());

      await waitFor(() => expect(result.current.isHydrating).toBe(false));

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBeNull();
      expect(result.current.csrfToken).toBeNull();
      expect(sessionStorage.getItem("openquiz.auth")).toBeNull();
    },
  );

  it("logs out when the API reports an expired authentication session", async () => {
    sessionStorage.setItem(
      "openquiz.auth",
      JSON.stringify({
        user: { id: "user-id", email: "maya@example.com", role: "learner" },
        csrfToken: "csrf-token",
      }),
    );
    const { result } = renderHook(() => useAuth());

    await waitFor(() => expect(result.current.isHydrating).toBe(false));

    act(() => {
      window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
    expect(result.current.csrfToken).toBeNull();
    expect(sessionStorage.getItem("openquiz.auth")).toBeNull();
  });

  it("updates the persisted CSRF token after a stale-token recovery", async () => {
    sessionStorage.setItem(
      "openquiz.auth",
      JSON.stringify({
        user: { id: "user-id", email: "maya@example.com", role: "learner" },
        csrfToken: "stale-csrf-token",
      }),
    );
    const { result } = renderHook(() => useAuth());

    await waitFor(() => expect(result.current.isHydrating).toBe(false));

    act(() => {
      window.dispatchEvent(
        new CustomEvent("openquiz:csrf-token-updated", { detail: { csrfToken: "fresh-csrf-token" } }),
      );
    });

    expect(result.current.csrfToken).toBe("fresh-csrf-token");
    expect(JSON.parse(sessionStorage.getItem("openquiz.auth"))).toEqual(
      expect.objectContaining({ csrfToken: "fresh-csrf-token" }),
    );
  });

  it("synchronizes profile update events into stored auth state", async () => {
    sessionStorage.setItem(
      "openquiz.auth",
      JSON.stringify({
        user: { id: "user-id", name: "Maya", email: "maya@example.com", role: "learner" },
        csrfToken: "csrf-token",
      }),
    );
    const { result } = renderHook(() => useAuth());

    await waitFor(() => expect(result.current.isHydrating).toBe(false));
    act(() => {
      window.dispatchEvent(
        new CustomEvent("openquiz:profile-updated", {
          detail: { user: { name: "Zoe" }, avatarUrl: "https://example.com/zoe.png" },
        }),
      );
    });

    expect(result.current.user).toEqual(
      expect.objectContaining({ name: "Zoe", avatar_url: "https://example.com/zoe.png" }),
    );
    expect(JSON.parse(sessionStorage.getItem("openquiz.auth")).user).toEqual(
      expect.objectContaining({ name: "Zoe", avatar_url: "https://example.com/zoe.png" }),
    );
  });

  it("preserves profile-derived stats when refreshing a password-change session", async () => {
    sessionStorage.setItem(
      "openquiz.auth",
      JSON.stringify({
        user: {
          id: "user-id",
          name: "Maya",
          email: "maya@example.com",
          role: "learner",
          xp: 125,
          streak: 3,
          avatar_url: "https://example.com/maya.png",
        },
        csrfToken: "old-csrf-token",
      }),
    );
    const { result } = renderHook(() => useAuth());

    await waitFor(() => expect(result.current.isHydrating).toBe(false));
    act(() => {
      result.current.refreshSession({
        csrfToken: "new-csrf-token",
        user: { id: "user-id", name: "Maya", email: "maya@example.com", role: "learner" },
      });
    });

    expect(result.current).toMatchObject({
      csrfToken: "new-csrf-token",
      xpTotal: 125,
      user: expect.objectContaining({
        xp: 125,
        streak: 3,
        avatar_url: "https://example.com/maya.png",
      }),
    });
  });

  it("refreshes stored profile values after learning progress changes", async () => {
    sessionStorage.setItem(
      "openquiz.auth",
      JSON.stringify({
        user: { id: "user-id", email: "maya@example.com", role: "learner", streak: 0 },
        csrfToken: "csrf-token",
      }),
    );
    const { result } = renderHook(() => useAuth());

    await waitFor(() => expect(result.current.isHydrating).toBe(false));
    api.getProfile.mockResolvedValueOnce({
      user: { id: "user-id", name: "Maya", email: "maya@example.com", streak: 1 },
    });

    act(() => {
      window.dispatchEvent(new Event("openquiz:progress-updated"));
    });

    await waitFor(() => expect(result.current.user.streak).toBe(1));
    expect(JSON.parse(sessionStorage.getItem("openquiz.auth")).user.streak).toBe(1);
  });
});
