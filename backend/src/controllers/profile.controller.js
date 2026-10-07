const { validateRequest } = require("../validation/userValidation");
const User = require("../models/User.model");
const UserProgress = require("../models/UserProgress.model");
const { StatusCodes } = require("http-status-codes");
const { comparePassword, hashPassword } = require("../utils/password");
const { issueSession } = require("../utils/session");
const {
  updateProfileSchema,
  changePasswordSchema,
  deleteAccountSchema,
  avatarUrlSchema,
  resetProgressSchema,
} = require("../validation/profileValidation");
const { getUserXpTotal } = require("../services/xp.service");
const { getLearningMotivation } = require("../utils/learningStats");
const { getDisplayStreak } = require("../utils/streaks");

//Get first initial from  name from user model or email
const getFirstInitial = (name, email) => {
  const source = name?.trim() || email?.trim() || "?";
  return source.charAt(0).toUpperCase();
};
//GET /api/v1/profile
const getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select("-password_hash");
    if (!user || user.is_deleted) {
      return res
        .status(StatusCodes.UNAUTHORIZED)
        .json({ message: "Not authenticated or account deactivated." });
    }

    const progress = await UserProgress.findOne({ user_id: req.user.id }).sort({
      updated_at: -1,
    });

    const xpTotal = await getUserXpTotal(req.user.id);
    const motivation = await getLearningMotivation(req.user.id);
    const currentStreak = Math.max(motivation.streak.currentDays, getDisplayStreak(user.streak));

    return res.status(StatusCodes.OK).json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        goals: user.goals ?? "",
        notifications: user.notifications ?? true,
        xp: xpTotal,
        streak: currentStreak,
        longest_streak: user.streak?.longest ?? 0,
        active_learning_days: user.streak?.active_learning_days ?? 0,
        timezone: user.timezone,
        avatar_url: user.avatar_url || null,
        avatar_initial: getFirstInitial(user.name, user.email),
        leaderboard_opt_in: user.leaderboard_opt_in ?? false,
        current_lesson: progress?.current_micro_lesson_id || "Lesson 1",
        badges: user.earned_badges || [],
      },
    });
  } catch (error) {
    return next(error);
  }
};
// POST /api/v1/profile/avatar: URL avatars only; file uploads are not supported by this route.
const setAvatarUrl = async (req, res, next) => {
  try {
    const value = validateRequest(res, avatarUrlSchema, req.body);
    if (!value) return;
    const user = await User.findById(req.user.id);
    if (!user || user.is_deleted) {
      return res.status(StatusCodes.UNAUTHORIZED).json({ message: "No User found." });
    }
    user.avatar_url = value.avatar_url || null;
    await user.save();

    return res.status(StatusCodes.OK).json({
      message: user.avatar_url ? "Avatar URL saved." : "Avatar set to default initial.",
      avatar_url: user.avatar_url,
      avatar_initial: getFirstInitial(user.name, user.email),
    });
  } catch (error) {
    return next(error);
  }
};

//POST /api/v1/profile/progress/reset
const resetProgress = async (req, res, next) => {
  try {
    const value = validateRequest(res, resetProgressSchema, req.body);
    if (!value) return;

    await UserProgress.deleteMany({ user_id: req.user.id });
    return res.status(StatusCodes.OK).json({ message: "Your progress has been reset." });
  } catch (error) {
    return next(error);
  }
};

//PATCH /api/v1/profile
const updateProfile = async (req, res, next) => {
  try {
    const value = validateRequest(res, updateProfileSchema, req.body);
    if (!value) return;
    const { name, email, goals, notifications, timezone, leaderboard_opt_in } = value;
    const user = await User.findById(req.user.id);

    if (!user || user.is_deleted) {
      return res
        .status(StatusCodes.NOT_FOUND)
        .json({ message: " User not found or user deleted account. " });
    }

    let hasUpdates = false;
    if (name !== undefined) {
      user.name = name;
      hasUpdates = true;
    }
    if (goals !== undefined) {
      user.goals = goals;
      hasUpdates = true;
    }
    if (notifications !== undefined) {
      user.notifications = notifications;
      hasUpdates = true;
    }
    if (leaderboard_opt_in !== undefined) {
      user.leaderboard_opt_in = leaderboard_opt_in;
      hasUpdates = true;
    }
    // Email changed
    if (email !== undefined && email !== user.email) {
      user.email = email;
      user.email_verified_at = null;
      hasUpdates = true;
    }

    if (timezone !== undefined) {
      user.timezone = timezone;
      hasUpdates = true;
    }

    if (!hasUpdates) {
      return res
        .status(StatusCodes.BAD_REQUEST)
        .json({ message: "No items requested to be updated." });
    }

    await user.save();
    const xpTotal = await getUserXpTotal(req.user.id);
    const motivation = await getLearningMotivation(req.user.id);
    const currentStreak = Math.max(motivation.streak.currentDays, getDisplayStreak(user.streak));

    return res.status(StatusCodes.OK).json({
      message: "You have successfully updated your profile.",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        goals: user.goals,
        notifications: user.notifications,
        xp: xpTotal,
        streak: currentStreak,
        longest_streak: user.streak?.longest ?? 0,
        timezone: user.timezone,
        avatar_url: user.avatar_url || null,
        avatar_initial: getFirstInitial(user.name, user.email),
        leaderboard_opt_in: user.leaderboard_opt_in ?? false,
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(StatusCodes.CONFLICT).json({ message: "Email is not able to be used. " });
    }
    return next(error);
  }
};

//POST /api/v1/profile/password (uS 2.4.7)
const changePassword = async (req, res, next) => {
  try {
    //Validate password input using changePasswordSchema
    const value = validateRequest(res, changePasswordSchema, req.body);
    if (!value) return;

    const { currentPassword, newPassword } = value;
    const user = await User.findById(req.user.id).select("+password_hash");
    if (!user || user.is_deleted) {
      return res
        .status(StatusCodes.NOT_FOUND)
        .json({ message: "User not found or account has been deleted." });
    }
    const isMatch = await comparePassword(currentPassword, user.password_hash);
    if (!isMatch) {
      return res
        .status(StatusCodes.UNAUTHORIZED)
        .json({ message: "Current password is not correct." });
    }
    user.password_hash = await hashPassword(newPassword);
    user.token_version = (user.token_version || 0) + 1; //invalidates active jwt on other devices
    await user.save();

    const csrfToken = issueSession(res, user);

    return res.status(StatusCodes.OK).json({
      message: "Password changed successfully.",
      csrfToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    return next(error);
  }
};

//POST /api/v1/profile/request-deletion for soft deletion. items deleted are kept for 30 days in case user wants to reactivate
const deleteAccount = async (req, res, next) => {
  try {
    const value = validateRequest(res, deleteAccountSchema, req.body);
    if (!value) return;
    const user = await User.findById(req.user.id);
    if (!user || user.is_deleted || user.is_archived) {
      return res.status(StatusCodes.NOT_FOUND).json({ message: "User not found." });
    }
    if (user.deletion_status === "pending") {
      return res.status(StatusCodes.CONFLICT).json({
        message: "An account deletion request is already pending.",
      });
    }
    // user must type email to confirm the user wanting to delete their account
    if (user.email.toLowerCase() !== value.email.toLowerCase()) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        message: "Email does not match account email on record. Please try again.",
      });
    }

    // Flag deletion status as pending so Admin Dashboard can review it
    user.deletion_status = "pending";
    user.deletion_requested_at = new Date();
    await user.save();

    return res.status(StatusCodes.OK).json({
      message: "Deletion of user account request sent. Our admin will review your request.",
    });
  } catch (error) {
    return next(error);
  }
};
module.exports = {
  getFirstInitial,
  getProfile,
  updateProfile,
  changePassword,
  deleteAccount,
  setAvatarUrl,
  resetProgress,
};
