import { useState, useCallback, useEffect } from "react";

import { useAuthContext } from "../context/AuthContext";
import QuizFeedbackSetting from "../features/learn/Quiz/QuizFeedbackSetting/QuizFeedbackSetting.component";
import {
  changeProfilePassword,
  deleteProfile,
  getProfile,
  resetProfileProgress,
  setProfileAvatarUrl,
  updateProfile,
} from "../services/api";

import Button from "../shared/Button/Button.component";
import Input from "../shared/Input/Input.component";
import Toast from "../shared/Toast/Toast.component";
import Card from "../shared/Card/Card.component";
import Skeleton from "../shared/Skeleton/Skeleton.component";
import EmptyState from "../shared/EmptyState/EmptyState.component";

const errorMessage = (error) =>
  error.errors?.length ? error.errors.join(" ") : error.message || "Something went wrong.";

const Stat = ({ label, value }) => {
  return (
    <p className="text-center">
      <span>{label}</span>
      <span>{value}</span>
    </p>
  );
};

export default function ProfilePage() {
  const { csrfToken, refreshSession } = useAuthContext();
  const [profile, setProfile] = useState(null);
  const [failedAvatarUrl, setFailedAvatarUrl] = useState(null);

  const [name, setName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [goals, setGoals] = useState("");
  const [notifications, setNotifications] = useState(true);
  const [leaderboardOptIn, setLeaderboardOptIn] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [deleteEmail, setDeleteEmail] = useState("");

  const [toastMessage, setToastMessage] = useState({
    isOpen: false,
    message: "",
    variant: "default",
  });
  const [pending, setPending] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const showToast = useCallback((message, variant = "default") => {
    setToastMessage({ isOpen: true, message, variant });
  }, []);

  const closeToast = useCallback(() => {
    setToastMessage((value) => ({ ...value, isOpen: false }));
  }, []);

  const applyProfile = useCallback((user) => {
    if (!user) return;
    setProfile(user);
    setName(user.name ?? "");
    setAvatarUrl(user.avatar_url ?? "");
    setGoals(user.goals ?? "");
    setNotifications(user.notifications ?? true);
    setLeaderboardOptIn(user.leaderboard_opt_in ?? false);
  }, []);

  const reloadProfile = useCallback(async () => {
    const { user } = await getProfile();
    applyProfile(user);
    return user;
  }, [applyProfile]);

  const retryProfile = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      await reloadProfile();
    } catch (error) {
      const message = errorMessage(error);
      setLoadError(message);
      showToast(message);
    } finally {
      setLoading(false);
    }
  }, [reloadProfile, showToast]);

  useEffect(() => {
    let active = true;
    getProfile()
      .then(({ user }) => {
        if (active) applyProfile(user);
      })
      .catch((error) => {
        if (!active) return;
        const message = errorMessage(error);
        setLoadError(message);
        showToast(message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [applyProfile, showToast]);

  const saveProfile = async (event, updates, pendingKey, successMessage) => {
    event.preventDefault();
    setPending(pendingKey);
    try {
      await updateProfile({ ...updates, csrfToken });
      await reloadProfile();
      showToast(successMessage, "success");
    } catch (error) {
      showToast(errorMessage(error));
    } finally {
      setPending("");
    }
  };

  const changePassword = async (event) => {
    event.preventDefault();
    setPending("password");
    try {
      const result = await changeProfilePassword({ currentPassword, newPassword, csrfToken });
      refreshSession(result);
      await reloadProfile();
      setCurrentPassword("");
      setNewPassword("");
      showToast(result.message, "success");
    } catch (error) {
      showToast(errorMessage(error));
    } finally {
      setPending("");
    }
  };

  const saveAvatar = async (event) => {
    event.preventDefault();
    setPending("avatar");
    try {
      const result = await setProfileAvatarUrl({ avatarUrl, csrfToken });
      await reloadProfile();
      showToast(result.message, "success");
    } catch (error) {
      showToast(errorMessage(error));
    } finally {
      setPending("");
    }
  };

  const requestDeleteAccount = async (event) => {
    event.preventDefault();
    setPending("delete");
    try {
      const result = await deleteProfile({ email: deleteEmail, csrfToken });
      showToast(result.message || "Request for account deletion sent to admin.", "success");
      setDeleteEmail("");
    } catch (error) {
      showToast(errorMessage(error));
    } finally {
      setPending("");
    }
  };

  const requestResetProgress = async () => {
    if (!window.confirm("Reset all lesson progress? This cannot be undone.")) return;

    setPending("reset-progress");
    try {
      const result = await resetProfileProgress(csrfToken);
      await reloadProfile();
      showToast(result.message || "Your progress has been reset.", "success");
    } catch (error) {
      showToast(errorMessage(error));
    } finally {
      setPending("");
    }
  };
  if (loading) {
    return <Skeleton />;
  }

  if (loadError || !profile) {
    return (
      <section className="mx-auto max-w-4xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <Toast {...toastMessage} onClose={closeToast} />
        <EmptyState
          title="We could not load your profile"
          message={loadError || "Your profile details are not available right now."}
          action={
            <Button type="button" variant="primary" onClick={() => void retryProfile()}>
              Retry
            </Button>
          }
        />
      </section>
    );
  }

  const savedDisplayName = profile.name;
  const savedAvatarUrl = profile.avatar_url;
  const avatarInitial = savedDisplayName?.charAt(0)?.toUpperCase() || "A";
  const showAvatarImage = Boolean(savedAvatarUrl && failedAvatarUrl !== savedAvatarUrl);

  return (
    <section className="mx-auto max-w-4xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <Toast {...toastMessage} onClose={closeToast} />

      {/* Header Profile Summary */}
      <header className="flex flex-col gap-4 rounded-2xl border border-neutral-200 bg-surface-raised p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-primary/40 bg-surface-inset text-h3 font-semibold text-heading">
            {showAvatarImage ? (
              <img
                src={savedAvatarUrl}
                alt={`${savedDisplayName} avatar`}
                referrerPolicy="no-referrer"
                onError={() => setFailedAvatarUrl(savedAvatarUrl)}
                className="h-full w-full object-cover"
              />
            ) : (
              <span aria-label={`${savedDisplayName} avatar`}>{avatarInitial}</span>
            )}
          </span>
          <div>
            <h1 className="font-heading text-h3 font-bold text-heading">{savedDisplayName}</h1>
            <p className="text-small text-neutral-600">Manage your profile and preferences.</p>
          </div>
        </div>

        <div className="flex items-center gap-4 rounded-xl border border-neutral-100 bg-surface-app px-4 py-3 shadow-inner">
          <Stat label="XP Points:" value={` ${(profile?.xp ?? 0).toLocaleString()}`} />
          <div className="h-8 w-px bg-neutral-200" />
          <Stat label="Streak:" value={` ${profile?.streak ?? 0} days`} />
          <Stat label="Longest Streak:" value={` ${profile?.longest_streak ?? 0} days`} />
          <Stat label="Total Days:" value={` ${profile?.active_learning_days ?? 0} days`} />
        </div>
      </header>

      <Card className="space-y-4">
        <h2 className="font-heading text-h4 font-bold text-heading">Identity</h2>
        <form
          onSubmit={(event) => void saveProfile(event, { name }, "identity", "Display name saved.")}
          className="max-w-md space-y-4"
        >
          <Input
            id="profile-name"
            label="Display Name"
            required
            minLength={2}
            maxLength={30}
            value={name}
            disabled={pending === "identity"}
            onChange={(event) => setName(event.target.value)}
          />
          <div>
            <p className="text-sm font-semibold text-heading">Email</p>
            <p className="mt-1 text-sm text-foreground">{profile?.email || "-"}</p>
          </div>
          <Button type="submit" loading={pending === "identity"}>
            Save display name
          </Button>
        </form>
      </Card>

      <Card className="space-y-4">
        <h2 className="font-heading text-h4 font-bold text-heading">Avatar</h2>
        <form onSubmit={saveAvatar} className="max-w-md space-y-4">
          <Input
            id="profile-avatar-url"
            type="url"
            label="Avatar image URL"
            value={avatarUrl}
            disabled={pending === "avatar"}
            onChange={(event) => setAvatarUrl(event.target.value)}
            placeholder="https://example.com/avatar.png"
          />
          <p className="text-small text-neutral-600">Leave blank to use your initials.</p>
          <Button type="submit" loading={pending === "avatar"}>
            Save avatar
          </Button>
        </form>
      </Card>

      <Card className="space-y-4">
        <h2 className="font-heading text-h4 font-bold text-heading">Goals</h2>
        <form
          onSubmit={(event) => void saveProfile(event, { goals }, "goals", "Goals saved.")}
          className="max-w-2xl space-y-4"
        >
          <label htmlFor="profile-goals" className="block text-sm font-semibold text-heading">
            What are you working toward?
          </label>
          <textarea
            id="profile-goals"
            className="min-h-28 w-full rounded-xl border border-neutral-300 bg-surface-input px-3 py-2 text-sm shadow-sm outline-none transition-all duration-200 focus:ring-4 focus:ring-primary/20 disabled:cursor-not-allowed"
            maxLength={500}
            value={goals}
            disabled={pending === "goals"}
            onChange={(event) => setGoals(event.target.value)}
          />
          <Button type="submit" loading={pending === "goals"}>
            Save goals
          </Button>
        </form>
      </Card>

      <Card className="space-y-4">
        <h2 className="font-heading text-h4 font-bold text-heading">Preferences</h2>
        <form
          onSubmit={(event) =>
            void saveProfile(
              event,
              { notifications, leaderboard_opt_in: leaderboardOptIn },
              "preferences",
              "Preferences saved.",
            )
          }
          className="max-w-md space-y-4"
        >
          <label className="flex items-start gap-3 text-sm text-foreground">
            <input
              type="checkbox"
              checked={notifications}
              disabled={pending === "preferences"}
              onChange={(event) => setNotifications(event.target.checked)}
              className="mt-0.5 h-4 w-4 accent-primary"
            />
            <span>
              <span className="block font-semibold text-heading">Learning notifications</span>
              <span className="block text-neutral-600">
                Receive updates about your lessons and progress.
              </span>
            </span>
          </label>
          <label className="flex items-start gap-3 text-sm text-foreground">
            <input
              type="checkbox"
              checked={leaderboardOptIn}
              disabled={pending === "preferences"}
              onChange={(event) => setLeaderboardOptIn(event.target.checked)}
              className="mt-0.5 h-4 w-4 accent-primary"
            />
            <span>
              <span className="block font-semibold text-heading">Join the weekly leaderboard</span>
              <span className="block text-neutral-600">
                Show your display name, avatar, weekly XP, and rank to other learners. Leave this
                off to stay hidden and not see rankings.
              </span>
            </span>
          </label>
          <div className="border-t border-neutral-200 pt-4">
            <QuizFeedbackSetting />
          </div>
          <Button type="submit" loading={pending === "preferences"}>
            Save preferences
          </Button>
        </form>
      </Card>

      {/* Security & Credentials */}
      <Card className="space-y-4">
        <h2 className="font-heading text-h4 font-bold text-heading">Security & Credentials</h2>
        <form onSubmit={changePassword} className="space-y-4 max-w-md">
          <Input
            id="current-password"
            type="password"
            label="Current Password"
            required
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="••••••••"
          />
          <Input
            id="new-password"
            type="password"
            label="New Password"
            required
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="••••••••"
          />
          <Button type="submit" loading={pending === "password"}>
            Update Password
          </Button>
        </form>
      </Card>

      <div className="space-y-4 rounded-2xl border-2 border-dashed border-danger/40 bg-danger/5 p-6">
        <header className="space-y-1">
          <h2 className="font-heading text-h4 font-bold text-danger">Danger Zone</h2>
          <p className="text-small text-neutral-600">
            Requesting account deletion sends a ticket to our administrators for review. Your
            account remains active until a request is approved, at which point it is deactivated.
          </p>
        </header>

        <form onSubmit={requestDeleteAccount} className="space-y-4 max-w-md">
          <Input
            id="delete-account-email"
            type="email"
            label="Type account email to verify deletion request:"
            required
            value={deleteEmail}
            onChange={(e) => setDeleteEmail(e.target.value)}
            placeholder="you@domain.com"
          />
          <Button
            type="submit"
            disabled={pending === "delete"}
            className="rounded-xl bg-danger px-5 py-2.5 text-sm font-semibold text-white hover:bg-danger/90"
          >
            {pending === "delete" ? "Submitting request.." : "Request Account Deletion"}
          </Button>
        </form>

        <div className="border-t border-danger/20 pt-4">
          <p className="text-sm text-neutral-600">
            Reset lesson progress while keeping your profile.
          </p>
          <Button
            type="button"
            variant="secondary"
            className="mt-3 border border-danger/40 text-danger hover:bg-danger/10"
            disabled={pending === "reset-progress"}
            onClick={() => void requestResetProgress()}
          >
            {pending === "reset-progress" ? "Resetting progress..." : "Reset my progress"}
          </Button>
        </div>
      </div>
    </section>
  );
}
