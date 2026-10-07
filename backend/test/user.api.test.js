const jwt = require("jsonwebtoken");
const request = require("supertest");
const { useTestDb } = require("./setup");
const app = require("../src/app");
const User = require("../src/models/User.model");
const UserProgress = require("../src/models/UserProgress.model");
const QuizAttempt = require("../src/models/QuizAttempt.model");
const { hashPassword } = require("../src/utils/password");
const { withSessionCsrf } = require("./helpers/requestTestHelpers");

useTestDb();

describe("user API integration", () => {
  it("registers a user, verifies the email, and logs in successfully", async () => {
    const payload = {
      name: "Test Learner",
      email: "verify-flow@example.com",
      password: "Password1!",
      confirmPassword: "Password1!",
      tos: true,
    };

    // Register the user first so we can use the verification token
    // returned by the development response.
    const registerRes = await request(app).post("/api/v1/users/register").send(payload);

    expect(registerRes.status).toBe(201);
    expect(registerRes.body.message).toContain("Registration successful");
    expect(registerRes.body.devVerification).toMatchObject({
      token: expect.any(String),
      verifyUrl: expect.stringContaining("/verify?token="),
    });
    expect(registerRes.body.verificationUrl).toBe(registerRes.body.devVerification.verifyUrl);

    // Make sure registering the user does not automatically verify their email.
    const createdUser = await User.findOne({ email: payload.email });
    expect(createdUser).not.toBeNull();
    expect(createdUser.email_verified_at).toBeNull();

    // Use the token from registration to complete the email verification flow.
    const verifyRes = await request(app)
      .get("/api/v1/users/verify")
      .query({ token: registerRes.body.devVerification.token });

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.message).toContain("Email verified successfully");
    expect(verifyRes.body.user.email).toBe(payload.email);
    expect(verifyRes.body.csrfToken).toEqual(expect.any(String));
    expect(verifyRes.headers["set-cookie"]).toEqual(
      expect.arrayContaining([expect.stringContaining("session_token=")]),
    );

    // The user should now be able to log in with the same credentials.
    const loginRes = await request(app).post("/api/v1/users/login").send({
      email: payload.email,
      password: payload.password,
    });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.csrfToken).toBeTruthy();
    expect(loginRes.body.user).toMatchObject({
      email: payload.email,
      xp: 0,
      streak: 0,
      avatar_url: null,
    });

    // Logging in should also create the session cookie used for authenticated requests.
    expect(loginRes.headers["set-cookie"]).toEqual(
      expect.arrayContaining([expect.stringContaining("session_token=")]),
    );
  });

  it("returns the shared streak and persisted display data when logging in", async () => {
    const password = "Password1!";
    const user = await User.create({
      name: "Returning Learner",
      email: "returning-learner@example.com",
      password_hash: await hashPassword(password),
      role: "learner",
      tos_agreement: true,
      email_verified_at: new Date(),
      streak: 99,
      avatar_url: "https://example.com/returning-learner.png",
    });
    await UserProgress.create({
      user_id: user._id,
      module_id: "cashFlow",
      xp: 125,
    });
    const now = new Date();
    await QuizAttempt.create({
      user_id: user._id,
      module_id: "cashFlow",
      lesson_id: "1.1",
      micro_lesson_id: "1.1.2",
      attempt_number: 1,
      started_at: now,
      submitted_at: now,
      score: 100,
      passed: true,
    });

    const response = await request(app).post("/api/v1/users/login").send({
      email: user.email,
      password,
    });

    expect(response.status).toBe(200);
    expect(response.body.user).toMatchObject({
      id: user._id.toString(),
      xp: 125,
      streak: 1,
      avatar_url: "https://example.com/returning-learner.png",
    });
  });

  it("returns the persisted avatar when hydrating an OAuth session", async () => {
    const user = await User.create({
      name: "OAuth Learner",
      email: "oauth-avatar@example.com",
      role: "learner",
      tos_agreement: true,
      email_verified_at: new Date(),
      google_id: "google-avatar-user",
      avatar_url: "https://lh3.googleusercontent.com/oauth-avatar",
    });
    await UserProgress.create({
      user_id: user._id,
      module_id: "cashFlow",
      xp: 75,
    });
    const token = jwt.sign(
      { id: user._id, role: user.role, csrfToken: "oauth-csrf-token" },
      process.env.JWT_SECRET || "do_not_forget_to_set_a_secret_here",
    );

    const response = await request(app)
      .get("/api/v1/users/me")
      .set("Cookie", `session_token=${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      csrfToken: "oauth-csrf-token",
      user: {
        id: user._id.toString(),
        name: "OAuth Learner",
        avatar_url: "https://lh3.googleusercontent.com/oauth-avatar",
        xp: 75,
        streak: 0,
      },
    });
  });

  it("rejects duplicate registration and invalid payloads", async () => {
    const firstPayload = {
      name: "User One",
      email: "duplicate@example.com",
      password: "Password1!",
      confirmPassword: "Password1!",
      tos: true,
    };

    // Create the user once so the second request can test duplicate registration.
    const firstRes = await request(app).post("/api/v1/users/register").send(firstPayload);
    expect(firstRes.status).toBe(201);

    const duplicateRes = await request(app).post("/api/v1/users/register").send(firstPayload);
    expect(duplicateRes.status).toBe(409);
    expect(duplicateRes.body.message).toMatch(/Email already registered/i);

    // Send several invalid fields at once to make sure registration validation rejects the request.
    const invalidRes = await request(app).post("/api/v1/users/register").send({
      name: "A",
      email: "not-an-email",
      password: "short",
      confirmPassword: "different",
      tos: false,
    });

    expect(invalidRes.status).toBe(400);
    expect(invalidRes.body.errors).toEqual(expect.arrayContaining([expect.any(String)]));
  });

  it("blocks login until the user verifies their email", async () => {
    const payload = {
      name: "Pending User",
      email: "pending@example.com",
      password: "Password1!",
      confirmPassword: "Password1!",
      tos: true,
    };

    // Register the user, but intentionally do not use the verification token.
    await request(app).post("/api/v1/users/register").send(payload);

    const loginRes = await request(app).post("/api/v1/users/login").send({
      email: payload.email,
      password: payload.password,
    });

    expect(loginRes.status).toBe(403);
    expect(loginRes.body.message).toContain("verify your email");
  });

  it("redirects the root route and logs a user out", async () => {
    // Create a verified user directly since this test only needs an authenticated logout request.
    const user = await User.create({
      name: "Logout User",
      email: "logout-user@example.com",
      password_hash: "not-a-real-hash",
      role: "learner",
      tos_agreement: true,
      email_verified_at: new Date(),
    });

    // Create a valid session token with the same CSRF token
    // that will be sent with the logout request.
    const token = jwt.sign(
      { id: user._id.toString(), role: user.role, csrfToken: "test-csrf" },
      process.env.JWT_SECRET,
    );

    // Disable redirect following so we can check the redirect response itself.
    const rootRes = await request(app).get("/").redirects(0);
    expect(rootRes.status).toBe(302);
    expect(rootRes.headers.location).toBe(process.env.CLIENT_URL);

    // Send both the session cookie and matching CSRF token required by logout.
    const logoutRes = await withSessionCsrf(
      request(app).post("/api/v1/users/logout"),
      token,
      "test-csrf",
    );

    expect(logoutRes.status).toBe(200);
    expect(logoutRes.body.message).toContain("Logout successful");
  });

  it("supports the forgot-password and reset-password flow", async () => {
    const email = "reset-user@example.com";

    // Create a verified user directly so we can focus only on the password reset flow.
    await User.create({
      name: "Reset User",
      email,
      password_hash: "not-a-real-hash",
      role: "learner",
      tos_agreement: true,
      email_verified_at: new Date(),
    });

    // Requesting a password reset should create a reset token for the user.
    const forgotRes = await request(app).post("/api/v1/users/forgot-password").send({ email });
    expect(forgotRes.status).toBe(200);
    expect(forgotRes.body.message).toContain("If an account with the email exists");

    // password_reset_token is normally hidden by the model,
    // so include it here so we can use it to finish the reset flow.
    const user = await User.findOne({ email }).select("+password_reset_token");
    expect(user.password_reset_token).toBeTruthy();

    const resetRes = await request(app).post("/api/v1/users/reset-password").send({
      token: user.password_reset_token,
      newPassword: "NewPassword1!",
    });

    expect(resetRes.status).toBe(200);
    expect(resetRes.body.message).toContain("Password reset successful");
    expect(resetRes.body.csrfToken).toEqual(expect.any(String));
    expect(resetRes.headers["set-cookie"]).toEqual(
      expect.arrayContaining([expect.stringContaining("session_token=")]),
    );

    // Make sure the new password actually works after the reset.
    const loginRes = await request(app).post("/api/v1/users/login").send({
      email,
      password: "NewPassword1!",
    });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.user.email).toBe(email);
  });

  test.each([
    ["disabled", { is_disabled: true }, "ACCOUNT_DISABLED", "This account has been banned."],
    [
      "deleted",
      { is_deleted: true, deleted_at: new Date() },
      "ACCOUNT_DELETED",
      "This account is unavailable.",
    ],
  ])(
    "does not issue a session to a %s user after a password reset",
    async (accountStateName, accountState, code, message) => {
      const resetToken = accountStateName === "disabled" ? "a".repeat(64) : "b".repeat(64);
      await User.create({
        name: `${accountStateName} Reset User`,
        email: `${accountStateName}-reset@example.com`,
        password_hash: await hashPassword("CurrentPassword1!"),
        role: "learner",
        tos_agreement: true,
        email_verified_at: new Date(),
        password_reset_token: resetToken,
        password_reset_expires_at: new Date(Date.now() + 60 * 60 * 1000),
        ...accountState,
      });

      const resetRes = await request(app).post("/api/v1/users/reset-password").send({
        token: resetToken,
        newPassword: "NewPassword1!",
      });

      expect(resetRes.status).toBe(403);
      expect(resetRes.body).toEqual({ message, code });
      expect(resetRes.body.csrfToken).toBeUndefined();
      expect(resetRes.headers["set-cookie"] ?? []).not.toEqual(
        expect.arrayContaining([expect.stringContaining("session_token=")]),
      );
    },
  );

  test.each([
    ["disabled", { is_disabled: true }, "ACCOUNT_DISABLED", "This account has been banned."],
    [
      "deleted",
      { is_deleted: true, deleted_at: new Date() },
      "ACCOUNT_DELETED",
      "This account is unavailable.",
    ],
  ])(
    "does not issue a session when a %s user verifies email",
    async (accountStateName, accountState, code, message) => {
      const verificationToken = `${accountStateName}-verification-token`;
      await User.create({
        name: `${accountStateName} Verification User`,
        email: `${accountStateName}-verification@example.com`,
        password_hash: await hashPassword("CurrentPassword1!"),
        role: "learner",
        tos_agreement: true,
        verification_token: verificationToken,
        verification_token_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
        ...accountState,
      });

      const verifyRes = await request(app)
        .get("/api/v1/users/verify")
        .query({ token: verificationToken });

      expect(verifyRes.status).toBe(403);
      expect(verifyRes.body).toEqual({ message, code });
      expect(verifyRes.body.csrfToken).toBeUndefined();
      expect(verifyRes.headers["set-cookie"] ?? []).not.toEqual(
        expect.arrayContaining([expect.stringContaining("session_token=")]),
      );
    },
  );

  it("returns a generic message for forgotten-password requests for unknown emails", async () => {
    // Unknown emails should get the same response so the endpoint
    // does not reveal whether an account exists.
    const res = await request(app).post("/api/v1/users/forgot-password").send({
      email: "missing-user@example.com",
    });

    expect(res.status).toBe(200);
    expect(res.body.message).toContain("If an account with the email exists");
  });
});
