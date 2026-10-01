import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProfilePage from "./ProfilePage";
import { useAuthContext } from "../context/AuthContext";
import {
  changeProfilePassword,
  deleteProfile,
  getProfile,
  resetProfileProgress,
  setProfileAvatarUrl,
  updateProfile,
} from "../services/api";

vi.mock("../context/AuthContext", () => ({
  useAuthContext: vi.fn(),
}));

vi.mock("../services/api", () => ({
  changeProfilePassword: vi.fn(),
  deleteProfile: vi.fn(),
  getProfile: vi.fn(),
  resetProfileProgress: vi.fn(),
  setProfileAvatarUrl: vi.fn(),
  updateProfile: vi.fn(),
}));

describe("ProfilePage", () => {
  let profile;
  let refreshSession;

  beforeEach(() => {
    vi.clearAllMocks();
    profile = {
      id: "user-123",
      name: "Maya",
      email: "maya@example.com",
      goals: "Build a monthly budget",
      notifications: true,
      leaderboard_opt_in: false,
      xp: 125,
      streak: 3,
      avatar_url: null,
    };
    refreshSession = vi.fn();
    useAuthContext.mockReturnValue({ csrfToken: "csrf-token", refreshSession });
    getProfile.mockImplementation(async () => ({ user: { ...profile } }));
    updateProfile.mockImplementation(async ({ csrfToken: _csrfToken, ...updates }) => {
      profile = { ...profile, ...updates };
      return { message: "Profile updated.", user: { ...profile } };
    });
    changeProfilePassword.mockResolvedValue({
      message: "Password changed successfully.",
      csrfToken: "new-csrf-token",
      user: { ...profile },
    });
    deleteProfile.mockResolvedValue({ message: "Deletion request sent." });
    resetProfileProgress.mockResolvedValue({ message: "Your progress has been reset." });
    setProfileAvatarUrl.mockImplementation(async ({ avatarUrl }) => {
      profile = { ...profile, avatar_url: avatarUrl };
      return { message: "Avatar URL saved.", avatar_url: avatarUrl };
    });
    window.localStorage.removeItem("openquiz-quiz-feedback-preference");
  });

  it("saves identity, goals, and preferences with refreshed values and toasts", async () => {
    const user = userEvent.setup();
    render(<ProfilePage />);

    const displayName = await screen.findByLabelText("Display Name");
    await user.clear(displayName);
    await user.type(displayName, "Maya Patel");
    await user.click(screen.getByRole("button", { name: "Save display name" }));
    await waitFor(() => {
      expect(updateProfile).toHaveBeenLastCalledWith({
        name: "Maya Patel",
        csrfToken: "csrf-token",
      });
    });
    expect(await screen.findByRole("status")).toHaveTextContent("Display name saved.");
    expect(screen.getByRole("heading", { name: "Maya Patel" })).toBeInTheDocument();

    const goals = screen.getByLabelText("What are you working toward?");
    await user.clear(goals);
    await user.type(goals, "Pay off credit card debt");
    await user.click(screen.getByRole("button", { name: "Save goals" }));
    await waitFor(() => {
      expect(updateProfile).toHaveBeenLastCalledWith({
        goals: "Pay off credit card debt",
        csrfToken: "csrf-token",
      });
    });
    expect(await screen.findByRole("status")).toHaveTextContent("Goals saved.");
    expect(screen.getByDisplayValue("Pay off credit card debt")).toBeInTheDocument();

    const notifications = screen.getByRole("checkbox", { name: /Learning notifications/i });
    const leaderboard = screen.getByRole("checkbox", { name: /Join the weekly leaderboard/i });
    expect(leaderboard).not.toBeChecked();
    await user.click(notifications);
    await user.click(leaderboard);
    await user.click(screen.getByRole("button", { name: "Save preferences" }));
    await waitFor(() => {
      expect(updateProfile).toHaveBeenLastCalledWith({
        notifications: false,
        leaderboard_opt_in: true,
        csrfToken: "csrf-token",
      });
    });
    expect(await screen.findByRole("status")).toHaveTextContent("Preferences saved.");
    expect(notifications).not.toBeChecked();
    expect(leaderboard).toBeChecked();
    expect(getProfile).toHaveBeenCalledTimes(4);
  });

  it("submits the current password and refreshes the current session", async () => {
    const user = userEvent.setup();
    render(<ProfilePage />);

    await screen.findByLabelText("Current Password");
    await user.type(screen.getByLabelText("Current Password"), "CurrentPass1!");
    await user.type(screen.getByLabelText("New Password"), "NewPass2!");
    await user.click(screen.getByRole("button", { name: "Update Password" }));

    await waitFor(() => {
      expect(changeProfilePassword).toHaveBeenCalledWith({
        currentPassword: "CurrentPass1!",
        newPassword: "NewPass2!",
        csrfToken: "csrf-token",
      });
    });
    expect(refreshSession).toHaveBeenCalledWith(
      expect.objectContaining({
        csrfToken: "new-csrf-token",
        user: expect.objectContaining(profile),
      }),
    );
    expect(await screen.findByRole("status")).toHaveTextContent("Password changed successfully.");
    expect(screen.getByLabelText("Current Password")).toHaveValue("");
    expect(screen.getByLabelText("New Password")).toHaveValue("");
    expect(getProfile).toHaveBeenCalledTimes(2);
  });

  it("saves a URL avatar and refreshes the profile", async () => {
    const user = userEvent.setup();
    render(<ProfilePage />);

    const avatarUrl = await screen.findByLabelText("Avatar image URL");
    await user.type(avatarUrl, "https://example.com/maya.png");
    await user.click(screen.getByRole("button", { name: "Save avatar" }));

    await waitFor(() => {
      expect(setProfileAvatarUrl).toHaveBeenCalledWith({
        avatarUrl: "https://example.com/maya.png",
        csrfToken: "csrf-token",
      });
    });
    expect(await screen.findByRole("status")).toHaveTextContent("Avatar URL saved.");
    expect(screen.getByLabelText("Avatar image URL")).toHaveValue("https://example.com/maya.png");
    expect(screen.getByRole("img", { name: "Maya avatar" })).toHaveAttribute(
      "src",
      "https://example.com/maya.png",
    );
    expect(screen.getByRole("img", { name: "Maya avatar" })).toHaveAttribute(
      "referrerpolicy",
      "no-referrer",
    );
  });

  it("resets progress only after confirmation and refreshes the profile", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);
    render(<ProfilePage />);

    const resetButton = await screen.findByRole("button", { name: "Reset my progress" });
    await user.click(resetButton);
    expect(resetProfileProgress).not.toHaveBeenCalled();

    await user.click(resetButton);
    await waitFor(() => expect(resetProfileProgress).toHaveBeenCalledWith("csrf-token"));
    expect(window.confirm).toHaveBeenCalledWith(
      "Reset all lesson progress? This cannot be undone.",
    );
    expect(await screen.findByRole("status")).toHaveTextContent("Your progress has been reset.");
    expect(getProfile).toHaveBeenCalledTimes(2);
  });

  it("renders the user's initial when no avatar image is saved", async () => {
    render(<ProfilePage />);

    expect(await screen.findByLabelText("Maya avatar")).toHaveTextContent("M");
    expect(screen.queryByRole("img", { name: "Maya avatar" })).not.toBeInTheDocument();
  });

  it("switches quiz feedback between instant and end-of-quiz modes", async () => {
    const user = userEvent.setup();
    render(<ProfilePage />);

    expect(await screen.findByText("Feedback: Instant")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Toggle" }));

    expect(screen.getByText("Feedback: At the end")).toBeInTheDocument();
    expect(window.localStorage.getItem("openquiz-quiz-feedback-preference")).toBe("end");
  });

  it("shows a retryable load error instead of placeholder profile details", async () => {
    const user = userEvent.setup();
    getProfile
      .mockRejectedValueOnce(new Error("Profile service is unavailable."))
      .mockResolvedValueOnce({ user: { ...profile } });

    render(<ProfilePage />);

    expect(
      await screen.findByRole("heading", { name: "We could not load your profile" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Profile service is unavailable.")).toHaveLength(2);
    expect(screen.queryByRole("heading", { name: "username" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Display Name")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByLabelText("Display Name")).toHaveValue("Maya");
  });

  it("displays detailed profile validation messages returned by the API utility", async () => {
    const user = userEvent.setup();
    updateProfile.mockRejectedValueOnce(
      Object.assign(new Error("Validation error"), {
        errors: ["Name must be at least 2 characters long."],
      }),
    );
    render(<ProfilePage />);

    const displayName = await screen.findByLabelText("Display Name");
    await user.clear(displayName);
    await user.type(displayName, "M");
    await user.click(screen.getByRole("button", { name: "Save display name" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Name must be at least 2 characters long.",
    );
  });
});
