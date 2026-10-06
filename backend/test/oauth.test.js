const request = require("supertest");

process.env.JWT_SECRET = "oauth-test-secret";
process.env.CLIENT_URL = "http://localhost:5173";
process.env.GOOGLE_CLIENT_ID = "google-client-id";
process.env.GOOGLE_CLIENT_SECRET = "google-client-secret";
process.env.GITHUB_CLIENT_ID = "github-client-id";
process.env.GITHUB_CLIENT_SECRET = "github-client-secret";

let mockCallbackUser = {
  _id: "oauth-user-id",
  role: "learner",
  email: "oauth-user@example.com",
  email_verified_at: new Date(),
};
let mockCallbackError = null;

jest.mock("../src/config/passport.js", () => ({
  initialize: jest.fn(() => (_req, _res, next) => next()),
  authenticate: jest.fn((provider, _options, callback) => (_req, res) => {
    if (callback) {
      return callback(mockCallbackError, mockCallbackError ? false : mockCallbackUser);
    }
    return res.redirect(`/mock-oauth/${provider}`);
  }),
}));

const passport = require("../src/config/passport.js");
jest.mock("../src/services/adminBootstrap.service", () => ({
  bootstrapLoginAdmin: jest.fn().mockResolvedValue(undefined),
}));

const app = require("../src/app");
const {
  completeOAuthLogin,
  oauthFailureRedirect,
} = require("../src/controllers/oauth.controller.js");
const { OAUTH_STATE_MAX_AGE, getOAuthCookieOptions } = require("../src/middleware/oauthState.js");

describe("OAuth authentication", () => {
  const originalProviderCredentials = {
    googleClientId: process.env.GOOGLE_CLIENT_ID,
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
    githubClientId: process.env.GITHUB_CLIENT_ID,
    githubClientSecret: process.env.GITHUB_CLIENT_SECRET,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockCallbackError = null;
    mockCallbackUser = {
      _id: "oauth-user-id",
      role: "learner",
      email: "oauth-user@example.com",
      email_verified_at: new Date(),
    };
    process.env.GOOGLE_CLIENT_ID = originalProviderCredentials.googleClientId;
    process.env.GOOGLE_CLIENT_SECRET = originalProviderCredentials.googleClientSecret;
    process.env.GITHUB_CLIENT_ID = originalProviderCredentials.githubClientId;
    process.env.GITHUB_CLIENT_SECRET = originalProviderCredentials.githubClientSecret;
  });

  it("uses short-lived secure OAuth state cookies in production", () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";

    expect(getOAuthCookieOptions(OAUTH_STATE_MAX_AGE)).toEqual(
      expect.objectContaining({
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/api/v1/auth",
        maxAge: 10 * 60 * 1000,
      }),
    );

    process.env.NODE_ENV = originalNodeEnv;
  });

  it.each([
    ["google", ["profile", "email"]],
    ["github", ["user:email"]],
  ])("starts the %s provider flow", async (provider, scope) => {
    const response = await request(app)
      .get(`/api/v1/auth/${provider}`)
      .query({ tos: "true" })
      .redirects(0);

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe(`/mock-oauth/${provider}`);
    expect(passport.authenticate).toHaveBeenCalledWith(
      provider,
      expect.objectContaining({ scope, session: false, state: expect.any(String) }),
    );
    expect(response.headers["set-cookie"]).toEqual(
      expect.arrayContaining([
        expect.stringContaining(`oauth_state_${provider}=`),
        expect.stringContaining("HttpOnly"),
        expect.stringContaining("SameSite=Lax"),
        expect.stringContaining("Path=/api/v1/auth"),
        expect.stringContaining("Max-Age=600"),
      ]),
    );
  });

  it("accepts valid state once, creates a normal session, and redirects to the SPA", async () => {
    const agent = request.agent(app);
    const startResponse = await agent
      .get("/api/v1/auth/google")
      .query({ tos: "true" })
      .redirects(0);
    const state = passport.authenticate.mock.calls[0][1].state;

    expect(startResponse.status).toBe(302);

    const callbackResponse = await agent
      .get("/api/v1/auth/google/callback")
      .query({ state, code: "provider-code" })
      .redirects(0);

    expect(callbackResponse.status).toBe(302);
    expect(callbackResponse.headers.location).toBe("http://localhost:5173/oauth/callback");
    expect(callbackResponse.headers["set-cookie"]).toEqual(
      expect.arrayContaining([
        expect.stringContaining("session_token="),
        expect.stringContaining("oauth_state_google=;"),
        expect.stringContaining("oauth_terms_google=;"),
      ]),
    );
    expect(passport.authenticate).toHaveBeenLastCalledWith(
      "google",
      { session: false },
      expect.any(Function),
    );

    const reusedResponse = await agent
      .get("/api/v1/auth/google/callback")
      .query({ state, code: "provider-code" })
      .redirects(0);
    expect(reusedResponse.headers.location).toBe(
      "http://localhost:5173/login?error=oauth_state_failed",
    );
  });

  it("restores a valid next destination only after OAuth state validation", async () => {
    const agent = request.agent(app);
    await agent.get("/api/v1/auth/google").query({ next: "/learn/cashFlow/1.1" }).redirects(0);
    const state = passport.authenticate.mock.calls[0][1].state;

    const callbackResponse = await agent
      .get("/api/v1/auth/google/callback")
      .query({ state, code: "provider-code", next: "https://provider.example/unsafe" })
      .redirects(0);

    expect(callbackResponse.headers.location).toBe(
      "http://localhost:5173/oauth/callback?next=%2Flearn%2FcashFlow%2F1.1",
    );
    expect(callbackResponse.headers["set-cookie"]).toEqual(
      expect.arrayContaining([expect.stringContaining("oauth_next_google=;")]),
    );
  });

  it.each(["https://example.com/phishing", "//example.com/phishing", "/\\example.com/phishing"])(
    "does not preserve unsafe next destination %s",
    async (next) => {
      const agent = request.agent(app);
      await agent.get("/api/v1/auth/github").query({ next }).redirects(0);
      const state = passport.authenticate.mock.calls[0][1].state;

      const callbackResponse = await agent
        .get("/api/v1/auth/github/callback")
        .query({ state, code: "provider-code" })
        .redirects(0);

      expect(callbackResponse.headers.location).toBe("http://localhost:5173/oauth/callback");
    },
  );

  it.each([
    ["missing", undefined],
    ["mismatched", "unexpected-state"],
  ])("rejects a %s OAuth state before calling Passport", async (_description, callbackState) => {
    const agent = request.agent(app);
    await agent.get("/api/v1/auth/github").redirects(0);
    const authenticateCallsBeforeCallback = passport.authenticate.mock.calls.length;

    const response = await agent
      .get("/api/v1/auth/github/callback")
      .query({ state: callbackState, code: "provider-code" })
      .redirects(0);

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe("http://localhost:5173/login?error=oauth_state_failed");
    expect(response.headers["set-cookie"]).toEqual(
      expect.arrayContaining([expect.stringContaining("oauth_state_github=;")]),
    );
    expect(passport.authenticate).toHaveBeenCalledTimes(authenticateCallsBeforeCallback);
  });

  it("redirects known provider failures without exposing provider details", async () => {
    mockCallbackError = Object.assign(new Error("private provider response"), {
      code: "OAUTH_VERIFIED_EMAIL_REQUIRED",
    });
    const agent = request.agent(app);
    await agent.get("/api/v1/auth/github").query({ tos: "true" }).redirects(0);
    const state = passport.authenticate.mock.calls[0][1].state;

    const response = await agent
      .get("/api/v1/auth/github/callback")
      .query({ state, code: "provider-code" })
      .redirects(0);

    expect(response.headers.location).toBe(
      "http://localhost:5173/login?error=oauth_email_required",
    );
    expect(response.headers["set-cookie"]).not.toEqual(
      expect.arrayContaining([expect.stringContaining("session_token=")]),
    );
  });

  it("redirects disabled providers cleanly and exposes their availability", async () => {
    delete process.env.GITHUB_CLIENT_ID;
    delete process.env.GITHUB_CLIENT_SECRET;

    const providersResponse = await request(app).get("/api/v1/auth/providers");
    expect(providersResponse.body).toEqual({ google: true, github: false });

    const response = await request(app).get("/api/v1/auth/github").redirects(0);
    expect(response.status).toBe(302);
    expect(response.headers.location).toBe("http://localhost:5173/login?error=oauth_unavailable");
    expect(passport.authenticate).not.toHaveBeenCalled();
  });

  it("uses the same verified-account rule as password login", async () => {
    const user = {
      _id: "oauth-user-id",
      role: "learner",
      email: "oauth-user@example.com",
      email_verified_at: null,
    };
    const result = {};
    const response = {
      cookie: jest.fn().mockReturnThis(),
      redirect: jest.fn().mockReturnValue(result),
    };
    const request = {
      user,
      ip: "127.0.0.1",
      app: { emit: jest.fn() },
    };

    expect(await completeOAuthLogin(request, response)).toBe(result);
    expect(response.redirect).toHaveBeenCalledWith(
      "http://localhost:5173/login?error=oauth_failed",
    );
    expect(response.cookie).not.toHaveBeenCalled();
    expect(oauthFailureRedirect).toBe("http://localhost:5173/login?error=oauth_failed");
  });
});
