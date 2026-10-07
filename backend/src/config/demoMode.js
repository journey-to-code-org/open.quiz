const { StatusCodes } = require("http-status-codes");

const DEMO_HIDDEN_EMAIL = "hidden in demo";

/** Public demo sites make every verified login an admin and add privacy guardrails. */
const isDemoMode = () =>
  String(process.env.DEMO_MODE || "")
    .trim()
    .toLowerCase() === "true";

/** Hides other people's email addresses from shared demo admins. */
const maskDemoUser = (user, viewerId) => {
  if (!isDemoMode() || String(user._id ?? user.id) === String(viewerId)) return user;
  return { ...user, email: DEMO_HIDDEN_EMAIL };
};

/** Lets demo admins manage only their own account through user-targeted admin routes. */
const demoOwnAccountOnly = (req, res, next) => {
  if (!isDemoMode() || String(req.params.userId) === String(req.user?.id)) return next();
  return res
    .status(StatusCodes.FORBIDDEN)
    .json({ message: "Managing other accounts is disabled on this demo site." });
};

module.exports = { DEMO_HIDDEN_EMAIL, demoOwnAccountOnly, isDemoMode, maskDemoUser };
