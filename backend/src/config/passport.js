const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const GitHubStrategy = require("passport-github2").Strategy;
const { OAUTH_PROVIDER_SCOPES, isOAuthProviderEnabled } = require("./oauthProviders.js");
const { findOrCreateOAuthUser } = require("../services/oauthUser.service.js");

const API_URL = process.env.API_URL || process.env.RENDER_EXTERNAL_URL || "http://localhost:8080";

const createVerifyCallback =
  (provider) => async (req, _accessToken, _refreshToken, profile, done) => {
    try {
      const user = await findOrCreateOAuthUser({
        provider,
        providerId: profile.id,
        name: profile.displayName || profile.username,
        emails: profile.emails,
        photos: profile.photos,
        tosAccepted: req.oauth?.tosAccepted === true,
      });
      return done(null, user);
    } catch (err) {
      return done(err);
    }
  };

if (isOAuthProviderEnabled("google")) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL || `${API_URL}/api/v1/auth/google/callback`,
        scope: OAUTH_PROVIDER_SCOPES.google,
        passReqToCallback: true,
      },
      createVerifyCallback("google"),
    ),
  );
}

if (isOAuthProviderEnabled("github")) {
  passport.use(
    new GitHubStrategy(
      {
        clientID: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
        callbackURL: process.env.GITHUB_CALLBACK_URL || `${API_URL}/api/v1/auth/github/callback`,
        scope: OAUTH_PROVIDER_SCOPES.github,
        allRawEmails: true,
        passReqToCallback: true,
      },
      createVerifyCallback("github"),
    ),
  );
}

module.exports = passport;
