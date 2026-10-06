const { getAuthenticationFailure, issueAuthenticatedSession } = require("../utils/authSession.js");
const { bootstrapLoginAdmin } = require("../services/adminBootstrap.service");

const CLIENT_URL =
  process.env.CLIENT_URL || process.env.RENDER_EXTERNAL_URL || "http://localhost:5173";

const OAUTH_PUBLIC_ERROR_CODES = Object.freeze({
  OAUTH_VERIFIED_EMAIL_REQUIRED: "oauth_email_required",
  OAUTH_TERMS_REQUIRED: "oauth_terms_required",
  OAUTH_PROVIDER_UNAVAILABLE: "oauth_unavailable",
  OAUTH_STATE_INVALID: "oauth_state_failed",
});

const getOAuthFailureRedirect = (errorCode) => {
  const publicErrorCode = OAUTH_PUBLIC_ERROR_CODES[errorCode] || "oauth_failed";
  return `${CLIENT_URL}/login?error=${publicErrorCode}`;
};

const completeOAuthLogin = async (req, res, next) => {
  const user = req.user;
  const authenticationFailure = getAuthenticationFailure(user);
  if (authenticationFailure) {
    return res.redirect(getOAuthFailureRedirect());
  }

  try {
    await bootstrapLoginAdmin(user);
    issueAuthenticatedSession({ req, res, user });

    const callbackUrl = new URL("/oauth/callback", CLIENT_URL);
    if (req.oauth?.next) callbackUrl.searchParams.set("next", req.oauth.next);

    return res.redirect(callbackUrl.toString());
  } catch (error) {
    return next(error);
  }
};

const oauthFailureRedirect = getOAuthFailureRedirect();

module.exports = {
  completeOAuthLogin,
  getOAuthFailureRedirect,
  oauthFailureRedirect,
};
