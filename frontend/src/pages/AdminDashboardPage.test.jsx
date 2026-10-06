import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminDashboardPage from "./AdminDashboardPage";
import { useAuthContext } from "../context/AuthContext";
import {
  approveDeleteAccount,
  getAdminAvatarAssets,
  getAdminPackages,
  getAdminModules,
  getAdminUsers,
  getPendingDeleteAccount,
  rejectDeleteAccount,
  setAdminUserDisabled,
  setAdminUserDeleted,
  uploadAdminAvatar,
} from "../services/api";

vi.mock("../context/AuthContext", () => ({
  useAuthContext: vi.fn(),
}));

vi.mock("../services/api", () => ({
  approveDeleteAccount: vi.fn(),
  createAdminLesson: vi.fn(),
  createAdminModule: vi.fn(),
  deleteAdminLesson: vi.fn(),
  deleteAdminModule: vi.fn(),
  deleteAdminPackage: vi.fn(),
  downloadAdminPackage: vi.fn(),
  getAdminAvatarAssets: vi.fn(),
  getAdminPackages: vi.fn(),
  inspectAdminPackage: vi.fn(),
  getAdminModules: vi.fn(),
  getAdminUsers: vi.fn(),
  getPendingDeleteAccount: vi.fn(),
  hardDeleteAdminUser: vi.fn(),
  importAdminLessonModule: vi.fn(),
  importAdminPackage: vi.fn(),
  activateAdminPackage: vi.fn(),
  activateDefaultAdminTheme: vi.fn(),
  rejectDeleteAccount: vi.fn(),
  resetAdminUserProgress: vi.fn(),
  seedAdminRandomUsers: vi.fn(),
  setAdminUserDisabled: vi.fn(),
  setAdminUserDeleted: vi.fn(),
  updateAdminLesson: vi.fn(),
  updateAdminModule: vi.fn(),
  updateAdminUserRole: vi.fn(),
  uploadAdminAvatar: vi.fn(),
  verifyAdminUserEmail: vi.fn(),
}));

describe("AdminDashboardPage", () => {
  beforeEach(() => {
    useAuthContext.mockReturnValue({ csrfToken: "csrf-token", user: { id: "admin-123" } });
    getAdminUsers.mockResolvedValue({
      users: [
        {
          id: "user-123",
          name: "Pending learner",
          email: "learner@example.com",
          role: "learner",
          is_disabled: false,
          is_deleted: false,
          deleted_at: null,
        },
      ],
    });
    getAdminModules.mockResolvedValue({ modules: [] });
    getAdminPackages.mockResolvedValue({ packages: [], activePackageId: null });
    getAdminAvatarAssets.mockResolvedValue({ assets: [] });
    getPendingDeleteAccount.mockResolvedValue({
      users: [
        {
          _id: "user-123",
          name: "Pending learner",
          email: "learner@example.com",
          deletion_requested_at: "2026-09-01T00:00:00.000Z",
        },
      ],
    });
    approveDeleteAccount.mockResolvedValue({
      user: {
        id: "user-123",
        name: "Pending learner",
        email: "learner@example.com",
        role: "learner",
        is_disabled: false,
        is_deleted: true,
        deleted_at: "2026-09-01T00:00:00.000Z",
        deletion_scheduled_at: "2026-10-01T00:00:00.000Z",
      },
    });
    rejectDeleteAccount.mockResolvedValue({});
  });

  it("shows a copyable lesson schema and lets admins upload avatars", async () => {
    const user = userEvent.setup();
    const uploadedAvatar = {
      id: "avatar-1",
      name: "nova.webp",
      url: "/api/v1/assets/avatar-1",
    };
    uploadAdminAvatar.mockResolvedValue(uploadedAvatar);
    getAdminAvatarAssets.mockResolvedValue({ assets: [uploadedAvatar] });

    render(<AdminDashboardPage />);

    await user.click(await screen.findByText("Lesson JSON schema and example"));
    expect(screen.getByText(/"microLessonContent"/, { selector: "pre" })).toBeInTheDocument();

    const avatarFile = new File(["image"], "nova.webp", { type: "image/webp" });
    await user.upload(screen.getByLabelText("Upload avatar"), avatarFile);

    await waitFor(() => {
      expect(uploadAdminAvatar).toHaveBeenCalledWith({
        file: avatarFile,
        csrfToken: "csrf-token",
      });
      expect(screen.getByText("/api/v1/assets/avatar-1")).toBeInTheDocument();
    });
  });

  it("passes the pending user's ID and CSRF token to deletion approval", async () => {
    const user = userEvent.setup();
    render(<AdminDashboardPage />);

    await user.click(await screen.findByRole("button", { name: "Approve deletion" }));
    await waitFor(() => {
      expect(approveDeleteAccount).toHaveBeenCalledWith("user-123", "csrf-token");
    });
  });

  it("passes the pending user's ID and CSRF token to deletion rejection", async () => {
    const user = userEvent.setup();
    render(<AdminDashboardPage />);

    await user.click(await screen.findByRole("button", { name: "Reject" }));
    await waitFor(() => {
      expect(rejectDeleteAccount).toHaveBeenCalledWith("user-123", "csrf-token");
    });
  });

  it("moves an approved request into the scheduled users list without refetching dashboard data", async () => {
    const user = userEvent.setup();

    render(<AdminDashboardPage />);

    await user.click(await screen.findByRole("button", { name: "Approve deletion" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Deletion scheduled.");
    expect(screen.getByRole("button", { name: "Restore" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Permanently delete" })).toBeInTheDocument();
    expect(screen.getByText("No deletion requests are awaiting review.")).toBeInTheDocument();
    expect(getAdminUsers).toHaveBeenCalledTimes(1);
    expect(getAdminModules).toHaveBeenCalledTimes(1);
    expect(getPendingDeleteAccount).toHaveBeenCalledTimes(1);
  });

  it("updates scheduled and restored users locally without reloading dashboard data", async () => {
    getPendingDeleteAccount.mockResolvedValue({ users: [] });
    setAdminUserDeleted
      .mockResolvedValueOnce({
        id: "user-123",
        is_deleted: true,
        deleted_at: "2026-09-01T00:00:00.000Z",
        deletion_scheduled_at: "2026-10-01T00:00:00.000Z",
      })
      .mockResolvedValueOnce({
        id: "user-123",
        is_deleted: false,
        deleted_at: null,
        deletion_scheduled_at: null,
      });
    const user = userEvent.setup();

    render(<AdminDashboardPage />);

    await user.click(await screen.findByRole("button", { name: "Schedule deletion" }));
    await waitFor(() => {
      expect(setAdminUserDeleted).toHaveBeenCalledWith({
        userId: "user-123",
        deleted: true,
        csrfToken: "csrf-token",
      });
    });
    expect(screen.getByRole("button", { name: "Restore" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ban" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Restore" }));
    await waitFor(() => {
      expect(setAdminUserDeleted).toHaveBeenLastCalledWith({
        userId: "user-123",
        deleted: false,
        csrfToken: "csrf-token",
      });
    });
    expect(screen.getByRole("button", { name: "Ban" })).toBeEnabled();
    expect(getAdminUsers).toHaveBeenCalledTimes(1);
    expect(getAdminModules).toHaveBeenCalledTimes(1);
    expect(getPendingDeleteAccount).toHaveBeenCalledTimes(1);
  });

  it("updates a ban locally without reloading dashboard data", async () => {
    getPendingDeleteAccount.mockResolvedValue({ users: [] });
    setAdminUserDisabled.mockResolvedValue({
      id: "user-123",
      is_disabled: true,
      disabled_at: "2026-09-01T00:00:00.000Z",
    });
    const user = userEvent.setup();

    render(<AdminDashboardPage />);

    await user.click(await screen.findByRole("button", { name: "Ban" }));

    await waitFor(() => {
      expect(setAdminUserDisabled).toHaveBeenCalledWith({
        userId: "user-123",
        disabled: true,
        csrfToken: "csrf-token",
      });
    });
    expect(screen.getByRole("button", { name: "Unban" })).toBeInTheDocument();
    expect(getAdminUsers).toHaveBeenCalledTimes(1);
    expect(getAdminModules).toHaveBeenCalledTimes(1);
    expect(getPendingDeleteAccount).toHaveBeenCalledTimes(1);
  });
});
