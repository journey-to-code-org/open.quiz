import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AUTH_EXPIRED_EVENT,
  clearCsrfToken,
  getProfile,
  notifyDashboardProgressChanged,
  startQuiz,
} from "./api";

describe("notifyDashboardProgressChanged", () => {
  afterEach(() => {
    window.sessionStorage.clear();
  });

  it("clears dashboard caches even when no dashboard page is mounted", () => {
    window.sessionStorage.setItem("openquiz.dashboard.learner-1", "cached");
    window.sessionStorage.setItem("openquiz.dashboard.learner-2", "cached");
    window.sessionStorage.setItem("openquiz.auth", "active-session");
    const listener = (event) => {
      expect(event.detail).toEqual({ type: "lesson_complete" });
    };
    window.addEventListener("openquiz:progress-updated", listener, { once: true });

    notifyDashboardProgressChanged({ type: "lesson_complete" });

    expect(window.sessionStorage.getItem("openquiz.dashboard.learner-1")).toBeNull();
    expect(window.sessionStorage.getItem("openquiz.dashboard.learner-2")).toBeNull();
    expect(window.sessionStorage.getItem("openquiz.auth")).toBe("active-session");
  });
});

describe("apiRequest", () => {
  afterEach(() => {
    clearCsrfToken();
    vi.unstubAllGlobals();
  });

  it("notifies the app when an API request is unauthorized", async () => {
    const onAuthExpired = vi.fn();
    window.addEventListener(AUTH_EXPIRED_EVENT, onAuthExpired);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        headers: { get: () => "application/json" },
        json: vi.fn().mockResolvedValue({
          message: "No user is authenticated.",
          code: "SESSION_INVALIDATED",
        }),
      }),
    );

    await expect(getProfile()).rejects.toMatchObject({
      message: "No user is authenticated.",
      status: 401,
    });

    expect(onAuthExpired).toHaveBeenCalledTimes(1);
    window.removeEventListener(AUTH_EXPIRED_EVENT, onAuthExpired);
  });

  it("notifies the app for an explicit account-invalidating response", async () => {
    const onAuthExpired = vi.fn();
    window.addEventListener(AUTH_EXPIRED_EVENT, onAuthExpired);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        headers: { get: () => "application/json" },
        json: vi.fn().mockResolvedValue({
          message: "This account has been banned.",
          code: "ACCOUNT_DISABLED",
        }),
      }),
    );

    await expect(getProfile()).rejects.toMatchObject({
      status: 403,
      code: "ACCOUNT_DISABLED",
      authInvalidating: true,
    });

    expect(onAuthExpired).toHaveBeenCalledTimes(1);
    window.removeEventListener(AUTH_EXPIRED_EVENT, onAuthExpired);
  });

  it.each(["Invalid CSRF token.", "Admin access required."])(
    "does not treat ordinary 403 %s responses as expired authentication",
    async (message) => {
      const onAuthExpired = vi.fn();
      window.addEventListener(AUTH_EXPIRED_EVENT, onAuthExpired);
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 403,
          headers: { get: () => "application/json" },
          json: vi.fn().mockResolvedValue({ message }),
        }),
      );

      await expect(getProfile()).rejects.toMatchObject({
        status: 403,
        authInvalidating: false,
      });

      expect(onAuthExpired).not.toHaveBeenCalled();
      window.removeEventListener(AUTH_EXPIRED_EVENT, onAuthExpired);
    },
  );

  it("does not treat an ordinary 401 credential error as an expired session", async () => {
    const onAuthExpired = vi.fn();
    window.addEventListener(AUTH_EXPIRED_EVENT, onAuthExpired);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        headers: { get: () => "application/json" },
        json: vi.fn().mockResolvedValue({ message: "Current password is not correct." }),
      }),
    );

    await expect(getProfile()).rejects.toMatchObject({
      status: 401,
      authInvalidating: false,
    });

    expect(onAuthExpired).not.toHaveBeenCalled();
    window.removeEventListener(AUTH_EXPIRED_EVENT, onAuthExpired);
  });

  it("preserves detailed validation messages from API error responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        headers: { get: () => "application/json" },
        json: vi.fn().mockResolvedValue({
          message: "Validation error",
          errors: ["Name must be at least 2 characters long."],
        }),
      }),
    );

    await expect(getProfile()).rejects.toMatchObject({
      status: 400,
      message: "Validation error",
      errors: ["Name must be at least 2 characters long."],
    });
  });

  it("refreshes a stale CSRF token and retries a quiz start once", async () => {
    const freshCsrfToken = "a4a76cac-cc8e-4b82-8d79-3184dc3a9804";
    const headers = (csrfToken = null) => ({
      get: (name) => {
        if (name === "content-type") return "application/json";
        if (name === "x-csrf-token") return csrfToken;
        return null;
      },
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 403,
        headers: headers(freshCsrfToken),
        json: async () => ({ message: "Invalid CSRF token." }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: headers(),
        json: async () => ({ success: true }),
      });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      startQuiz({
        moduleId: "cashFlow",
        microLessonId: "1.1.1",
        csrfToken: "stale-csrf-token",
      }),
    ).resolves.toEqual({ success: true });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][1].headers).toEqual(
      expect.objectContaining({ "X-CSRF-TOKEN": "stale-csrf-token" }),
    );
    expect(fetchMock.mock.calls[1][1].headers).toEqual(
      expect.objectContaining({ "X-CSRF-TOKEN": freshCsrfToken }),
    );
  });
});
