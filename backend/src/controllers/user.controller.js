const crypto = require("crypto");
const { StatusCodes } = require("http-status-codes");
const { sendVerificationEmail } = require("../utils/sendEmail");
//User is capitalized because it represents a model which is a collection of items for the database
const User = require("../models/User.model.js");
const { bootstrapLoginAdmin } = require("../services/adminBootstrap.service");
const { hashPassword, comparePassword } = require("../utils/password.js");
const { clearSessionCookie, issueSession } = require("../utils/session");
const { isWithinReactivationGracePeriod, reactivateAccount } = require("../utils/accountDeletion");
const { getUserXpTotal } = require("../services/xp.service");
const { getDisplayStreak } = require("../utils/streaks");
const { getLearningMotivation } = require("../utils/learningStats");
const {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  validateRequest,
} = require("../validation/userValidation.js");
const { getAuthenticationFailure } = require("../utils/authSession.js");
const CLIENT_URL =
  process.env.CLIENT_URL || process.env.RENDER_EXTERNAL_URL || "http://localhost:5173";
const IS_DEV_ENV = process.env.NODE_ENV !== "production";
const accountStateLookup = {
  is_deleted: { $in: [true, false, null] },
  is_archived: { $in: [true, false, null] },
};

const sendAccountStateError = (res, user) => {
  if (user.is_disabled) {
    res.status(StatusCodes.FORBIDDEN).json({
      message: "This account has been banned.",
      code: "ACCOUNT_DISABLED",
    });
    return true;
  }
  if (user.is_deleted || user.deleted_at) {
    res.status(StatusCodes.FORBIDDEN).json({
      message: "This account is unavailable.",
      code: "ACCOUNT_DELETED",
    });
    return true;
  }

  return false;
};

//function register registers a new user document in MongoDB user story 2.1.6

const register = async (req, res, next) => {
  try {
    //validate input from request body versus Joi based schema
    const { error, value } = registerSchema.validate(req.body, {
      abortEarly: false,
    });
    if (error) {
      //return 400 if validation fails
      return res.status(StatusCodes.BAD_REQUEST).json({
        message: "Validation error",
        errors: error.details.map((detail) => detail.message),
      });
    }
    //3. Check if user exists already using JOI userValidation )

    const { name, email, password, timezone } = value;

    // using Mongoose  to figure out if the user already exists
    const previousUser = await User.findOne({ email });
    if (previousUser) {
      return res.status(StatusCodes.CONFLICT).json({ message: "Email already registered." });
    }
    const password_hash = await hashPassword(password);
    const verificationToken = crypto.randomBytes(32).toString("hex");
    const tokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    //record using mongoose model

    const newUser = await User.create({
      name,
      email,
      password_hash,
      role: "learner",
      tos_agreement: true,
      tos_agreement_at: new Date(),
      timezone: timezone || "UTC",
      email_verified_at: null,
      verification_token: verificationToken,
      verification_token_expires_at: tokenExpiresAt,
    });

    const verifyUrl = `${CLIENT_URL}/verify?token=${verificationToken}`;

    const emailDelivery = await sendVerificationEmail(
      newUser.email,
      "Verify your email address",
      `Hello ${newUser.name || ""},\n\nPlease verify your account by clicking this link: ${verifyUrl}`,
      `<p>Hello ${newUser.name || "User"},</p>
    <p>Please Verify your account by clicking the link below:</p>
    <p><a href="${verifyUrl}">${verifyUrl}</a></p>
    <p>This link expires in 24 hours.</p>`,
    );

    return res.status(StatusCodes.CREATED).json({
      message: emailDelivery.skipped
        ? "Registration successful. Use the verification link to activate your account."
        : "Registration successful. Please check for verification email.",
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        tos_agreement: newUser.tos_agreement,
        tos_agreement_at: newUser.tos_agreement_at,
        created_at: newUser.createdAt || newUser.created_at,
      },
      ...(IS_DEV_ENV ? { devVerification: { token: verificationToken, verifyUrl } } : {}),
      ...(emailDelivery.skipped ? { verificationUrl: verifyUrl } : {}),
    });
  } catch (err) {
    return next(err);
  }
};
//POST reaactivate route /api/v1/users/reactivate
const reactivate = async (req, res, next) => {
  try {
    const body = validateRequest(res, loginSchema, req.body);
    if (!body) return;
    const { email, password } = body;
    const user = await User.findOne({
      email,
      is_deleted: { $in: [true, false] },
      is_archived: { $in: [true, false] },
    });
    if (!user) {
      return res
        .status(StatusCodes.UNAUTHORIZED)
        .json({ message: "Email or password is incorrect." });
    }
    const isMatch = await comparePassword(password, user.password_hash);
    if (!isMatch) {
      return res
        .status(StatusCodes.UNAUTHORIZED)
        .json({ message: "Email or password is incorrect." });
    }
    if (!user.is_deleted) {
      return res.status(StatusCodes.BAD_REQUEST).json({ message: "Account is active." });
    }
    //check if request is made within 30 day period to reactivate deleted account
    if (!isWithinReactivationGracePeriod(user)) {
      return res.status(StatusCodes.GONE).json({ message: "Reactivation period has closed." });
    }
    //Restore user state of not deleted account
    reactivateAccount(user);
    await user.save();

    return res.status(StatusCodes.OK).json({ message: "Account is reactivated. Please log in." });
  } catch (error) {
    return next(error);
  }
};
//user story 2.1.8 - Login
//POST /api/v1/users/login
const login = async (req, res, next) => {
  try {
    const { error, value } = loginSchema.validate(req.body, {
      abortEarly: false,
    });
    if (error) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        message: "Validation error",
        errors: error.details.map((detail) => detail.message),
      });
    }
    //Joi gives the sanitized input and the value is the output
    const { email, password, remember } = value;
    // LOok up in mongo database
    const user = await User.findOne({
      email,
      ...accountStateLookup,
    });
    if (!user) {
      req.app.emit?.("login_failed", {
        email,
        ip: req.ip,
        reason: "user_not_found",
      });

      return res.status(StatusCodes.UNAUTHORIZED).json({ message: "Invalid email or password." });
    }
    //compared hashed password

    const isMatched = await comparePassword(password, user.password_hash);
    if (!isMatched) {
      req.app.emit?.("login_failed", {
        email,
        userId: user._id,
        ip: req.ip,
        reason: "invalid_password",
      });
      return res.status(StatusCodes.UNAUTHORIZED).json({ message: "Invalid email or password." });
    }

    if (sendAccountStateError(res, user)) return;

    if (!user.email_verified_at) {
      const authenticationFailure = getAuthenticationFailure(user);
      return res
        .status(authenticationFailure.status)
        .json({ message: authenticationFailure.message });
    }
    await bootstrapLoginAdmin(user);
    const motivation = await getLearningMotivation(user._id);
    const csrfToken = issueSession(res, user, { remember });
    req.app.emit?.("login_success", {
      userId: user._id,
      email: user.email,
      ip: req.ip,
    });

    return res.status(StatusCodes.OK).json({
      message: "Login successful!",
      csrfToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        xp: await getUserXpTotal(user._id),
        streak: Math.max(motivation.streak.currentDays, getDisplayStreak(user.streak)),
        avatar_url: user.avatar_url || null,
      },
    });
  } catch (err) {
    return next(err);
  }
};

// user story 2.1 -Post logout
//L8 clear cookies from most active session after user logs out so user's cookies cannot be used inappropriately

const logout = async (req, res) => {
  const hasSessionCookie = Boolean(req.cookies?.session_token);
  clearSessionCookie(res);

  if (!hasSessionCookie) {
    return res.status(StatusCodes.UNAUTHORIZED).json({ message: "No user is authenticated." });
  }

  return res.status(StatusCodes.OK).json({ message: "Logout successful." });
};

// GET/ Verify -email
const verifyEmail = async (req, res, next) => {
  try {
    const { token } = req.query;
    if (!token) {
      return res
        .status(StatusCodes.BAD_REQUEST)
        .json({ message: " Verification token is needed." });
    }
    const user = await User.findOne({
      verification_token: token,
      verification_token_expires_at: { $gt: new Date() },
      ...accountStateLookup,
    }).select("+verification_token");
    if (!user) {
      return res
        .status(StatusCodes.BAD_REQUEST)
        .json({ message: " invalid or expired verification token." });
    }

    //Email is verified and clear token
    user.email_verified_at = new Date();
    user.verification_token = undefined;
    user.verification_token_expires_at = undefined;
    await user.save();

    if (sendAccountStateError(res, user)) return;

    const csrfToken = issueSession(res, user);

    req.app.emit?.("login_success", {
      userId: user._id,
      email: user.email,
      ip: req.ip,
    });

    return res.status(StatusCodes.OK).json({
      message: "Email verified successfully. You are now signed in.",
      csrfToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    return next(err);
  }
};
const forgotPassword = async (req, res, next) => {
  try {
    const validatedBody = validateRequest(res, forgotPasswordSchema, req.body);
    if (!validatedBody) return;
    const { email } = validatedBody;
    const user = await User.findOne({ email }).select("+password_reset_token");
    if (!user) {
      return res.status(StatusCodes.OK).json({
        message:
          "If an account with the email exists, a password reset link will be provided to that email.",
      });
    }
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenExpiresAt = new Date(Date.now() + 60 * 60 * 1000);

    user.password_reset_token = resetToken;
    user.password_reset_expires_at = resetTokenExpiresAt;
    await user.save();

    const resetUrl = `${CLIENT_URL}/reset-password?token=${resetToken}`;

    await sendVerificationEmail(
      user.email,
      "Password Reset Request",
      `You requested a password reset. Please click this link: ${resetUrl}`,
      `<p>Hello ${user.name || "User"}, </p>
          <p>Here's your link to reset a new password:</p>
          <p><a href= "${resetUrl}" > ${resetUrl}</a></p>
          <p>Reset link will expire in 1 hour.</p>`,
    );
    return res.status(StatusCodes.OK).json({
      message:
        "If an account with the email exists, a password reset link will be provided to that email.",
      ...(IS_DEV_ENV ? { devPasswordReset: { token: resetToken, resetUrl } } : {}),
    });
  } catch (err) {
    return next(err);
  }
};

//RESET Password

const resetPassword = async (req, res, next) => {
  try {
    const validatedBody = validateRequest(res, resetPasswordSchema, req.body);
    if (!validatedBody) return;
    const { token, newPassword } = validatedBody;
    const user = await User.findOne({
      password_reset_token: token,
      password_reset_expires_at: { $gt: new Date() },
      ...accountStateLookup,
    }).select("+password_reset_token");

    if (!user) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        message: "Expired password reset token or invalid password reset token.",
      });
    }

    user.password_hash = await hashPassword(newPassword);
    user.password_reset_token = undefined;
    user.password_reset_expires_at = undefined;
    user.token_version = (user.token_version || 0) + 1;
    await user.save();

    if (sendAccountStateError(res, user)) return;

    const csrfToken = issueSession(res, user);

    return res.status(StatusCodes.OK).json({
      message: "Password reset successful. You are now signed in.",
      csrfToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    return next(err);
  }
};

// GET /users/me - lets the SPA hydrate auth state after an OAuth redirect (no JSON body returned by that flow).
const getCurrentUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(StatusCodes.UNAUTHORIZED).json({ message: "No user is authenticated." });
    }
    const motivation = await getLearningMotivation(user._id);
    return res.status(StatusCodes.OK).json({
      csrfToken: req.user.csrfToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        xp: await getUserXpTotal(user._id),
        streak: Math.max(motivation.streak.currentDays, getDisplayStreak(user.streak)),
        avatar_url: user.avatar_url || null,
      },
    });
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  register,
  reactivate,
  login,
  logout,
  verifyEmail,
  forgotPassword,
  resetPassword,
  getCurrentUser,
};
