import { afterEach, describe, expect, it, vi } from "vitest";
import {
  changeProfilePassword,
  clearCsrfToken,
  deleteProfile,
  getLeaderboard,
  setProfileAvatarUrl,
} from "./api";

describe("profile API contracts", () => {
  afterEach(() => {
    clearCsrfToken();
    vi.unstubAllGlobals();
  });

  it("submits account deletion requests to the review endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => "application/json" },
      json: async () => ({ message: "Deletion request sent." }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await deleteProfile({ email: "learner@example.com", csrfToken: "csrf-token" });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/profile/request-deletion",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ email: "learner@example.com" }),
        headers: expect.objectContaining({ "X-CSRF-TOKEN": "csrf-token" }),
      }),
    );
  });

  it("sends password changes to the profile password endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => "application/json" },
      json: async () => ({ message: "Password changed successfully." }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await changeProfilePassword({
      currentPassword: "CurrentPass1!",
      newPassword: "NewPass2!",
      csrfToken: "csrf-token",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/profile/password",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ currentPassword: "CurrentPass1!", newPassword: "NewPass2!" }),
        headers: expect.objectContaining({ "X-CSRF-TOKEN": "csrf-token" }),
      }),
    );
  });

  it("sends URL avatar changes to the profile avatar endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => "application/json" },
      json: async () => ({
        message: "Avatar URL saved.",
        avatar_url: "https://example.com/maya.png",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await setProfileAvatarUrl({
      avatarUrl: "https://example.com/maya.png",
      csrfToken: "csrf-token",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/profile/avatar",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ avatar_url: "https://example.com/maya.png" }),
        headers: expect.objectContaining({ "X-CSRF-TOKEN": "csrf-token" }),
      }),
    );
  });
});

describe("leaderboard API contract", () => {
  afterEach(() => {
    clearCsrfToken();
    vi.unstubAllGlobals();
  });

  it("fetches the authenticated weekly leaderboard", async () => {
    const payload = {
      optedIn: true,
      entries: [{ displayName: "Avery", avatarUrl: null, weeklyXp: 100, rank: 1 }],
      currentUser: { displayName: "Maya", avatarUrl: null, weeklyXp: 25, rank: 21 },
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => "application/json" },
      json: async () => payload,
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(getLeaderboard()).resolves.toEqual(payload);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/leaderboard",
      expect.objectContaining({ method: "GET", credentials: "include" }),
    );
  });

  it("preserves authentication errors from the leaderboard endpoint", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        headers: { get: () => "application/json" },
        json: async () => ({
          message: "No user is authenticated.",
          code: "SESSION_INVALIDATED",
        }),
      }),
    );

    await expect(getLeaderboard()).rejects.toMatchObject({
      message: "No user is authenticated.",
      status: 401,
      code: "SESSION_INVALIDATED",
      authInvalidating: true,
    });
  });
});
