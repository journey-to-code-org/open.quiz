const jwt = require("jsonwebtoken");
const request = require("supertest");
const { useTestDb } = require("./setup");

const app = require("../src/app");
const User = require("../src/models/User.model");
const UserProgress = require("../src/models/UserProgress.model");
const { hashPassword } = require("../src/utils/password");

useTestDb();

async function createUser({ email, role = "learner", tokenVersion = 0, ...overrides }) {
  return User.create({
    name: "Account Test User",
    email,
    password_hash: "not-a-real-hash",
    role,
    token_version: tokenVersion,
    tos_agreement: true,
    ...overrides,
  });
}

function authHeader(user) {
  const token = jwt.sign(
    {
      id: user._id.toString(),
      role: user.role,
      csrfToken: "test-csrf",
      token_version: user.token_version,
    },
    process.env.JWT_SECRET,
  );

  return `Bearer ${token}`;
}

function cookieSession(user, csrfToken = "current-csrf-token") {
  const token = jwt.sign(
    {
      id: user._id.toString(),
      role: user.role,
      csrfToken,
      token_version: user.token_version,
    },
    process.env.JWT_SECRET,
  );

  return { csrfToken, sessionCookie: `session_token=${token}` };
}

describe("account deletion workflow", () => {
  it("updates supported profile fields and rejects unsupported theme fields", async () => {
    const user = await createUser({ email: "profile-update@example.com" });
    const authorization = authHeader(user);

    const updateResponse = await request(app)
      .patch("/api/v1/profile")
      .set("Authorization", authorization)
      .send({
        goals: "Build a reliable monthly budget",
        notifications: false,
        leaderboard_opt_in: true,
      });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.user).toEqual(
      expect.objectContaining({
        goals: "Build a reliable monthly budget",
        notifications: false,
        leaderboard_opt_in: true,
      }),
    );

    expect(await User.findById(user._id)).toMatchObject({ leaderboard_opt_in: true });

    const unsupportedFieldResponse = await request(app)
      .patch("/api/v1/profile")
      .set("Authorization", authorization)
      .send({ theme: "Dark" });

    expect(unsupportedFieldResponse.status).toBe(400);
    expect(unsupportedFieldResponse.body).toEqual({
      message: "Validation error",
      errors: expect.arrayContaining([expect.stringContaining('"theme" is not allowed')]),
    });
  });

  it("accepts only HTTP(S) avatar URLs and preserves the avatar contract", async () => {
    const user = await createUser({ email: "profile-avatar@example.com" });
    const authorization = authHeader(user);

    const saved = await request(app)
      .post("/api/v1/profile/avatar")
      .set("Authorization", authorization)
      .send({ avatar_url: "https://example.com/avatar.png" });

    expect(saved.status).toBe(200);
    expect(saved.body).toEqual({
      message: "Avatar URL saved.",
      avatar_url: "https://example.com/avatar.png",
      avatar_initial: "A",
    });

    const rejected = await request(app)
      .post("/api/v1/profile/avatar")
      .set("Authorization", authorization)
      .send({ avatar_url: "ftp://example.com/avatar.png" });

    expect(rejected.status).toBe(400);
    expect(rejected.body).toEqual({
      message: "Validation error",
      errors: expect.arrayContaining(["Avatar URL must use HTTP or HTTPS."]),
    });

    const reset = await request(app)
      .post("/api/v1/profile/avatar")
      .set("Authorization", authorization)
      .send({ avatar_url: null });

    expect(reset.status).toBe(200);
    expect(reset.body).toEqual({
      message: "Avatar set to default initial.",
      avatar_url: null,
      avatar_initial: "A",
    });
  });

  it("serves a profile and prevents duplicate deletion requests", async () => {
    const user = await createUser({ email: "profile-delete@example.com" });
    const authorization = authHeader(user);

    const profileResponse = await request(app)
      .get("/api/v1/profile")
      .set("Authorization", authorization);

    expect(profileResponse.status).toBe(200);
    expect(profileResponse.body.user.email).toBe(user.email);
    expect(profileResponse.body.user.leaderboard_opt_in).toBe(false);

    const firstRequest = await request(app)
      .post("/api/v1/profile/request-deletion")
      .set("Authorization", authorization)
      .send({ email: user.email });

    expect(firstRequest.status).toBe(200);

    const duplicateRequest = await request(app)
      .post("/api/v1/profile/request-deletion")
      .set("Authorization", authorization)
      .send({ email: user.email });

    expect(duplicateRequest.status).toBe(409);
  });

  it("allows learners to reset their own progress with explicit confirmation", async () => {
    const user = await createUser({ email: "profile-reset@example.com" });
    const authorization = authHeader(user);
    await UserProgress.create({ user_id: user._id, module_id: "cashFlow" });

    const rejected = await request(app)
      .post("/api/v1/profile/progress/reset")
      .set("Authorization", authorization)
      .send({ confirmation: "reset" });

    expect(rejected.status).toBe(400);
    expect(await UserProgress.countDocuments({ user_id: user._id })).toBe(1);

    const reset = await request(app)
      .post("/api/v1/profile/progress/reset")
      .set("Authorization", authorization)
      .send({ confirmation: "CONFIRM" });

    expect(reset.status).toBe(200);
    expect(reset.body.message).toBe("Your progress has been reset.");
    expect(await UserProgress.countDocuments({ user_id: user._id })).toBe(0);
  });

  it("preserves detailed validation errors for malformed deletion requests", async () => {
    const user = await createUser({ email: "invalid-profile-deletion@example.com" });

    const response = await request(app)
      .post("/api/v1/profile/request-deletion")
      .set("Authorization", authHeader(user))
      .send({ email: "not-an-email" });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      message: "Validation error",
      errors: expect.arrayContaining(["Please provide email that is valid."]),
    });
  });

  it("redacts admin users and only approves pending deletion requests", async () => {
    const admin = await createUser({ email: "admin@example.com", role: "admin" });
    const learner = await createUser({ email: "learner@example.com" });
    const adminAuthorization = authHeader(admin);
    const learnerAuthorization = authHeader(learner);

    const usersResponse = await request(app)
      .get("/api/v1/admin/users")
      .set("Authorization", adminAuthorization);

    expect(usersResponse.status).toBe(200);
    expect(usersResponse.body.users[0]).toEqual(
      expect.objectContaining({
        _id: admin._id.toString(),
        name: admin.name,
        email: admin.email,
        role: "admin",
      }),
    );
    expect(usersResponse.body.users[0]).not.toHaveProperty("password_hash");

    const unrequestedApproval = await request(app)
      .patch(`/api/v1/admin/deletions/approve/${learner._id}`)
      .set("Authorization", adminAuthorization);

    expect(unrequestedApproval.status).toBe(409);

    await User.updateOne(
      { _id: learner._id },
      { $set: { deletion_status: "pending", deletion_requested_at: new Date() } },
    );

    const approvedResponse = await request(app)
      .patch(`/api/v1/admin/deletions/approve/${learner._id}`)
      .set("Authorization", adminAuthorization);

    expect(approvedResponse.status).toBe(200);
    expect(approvedResponse.body.user).toEqual(
      expect.objectContaining({
        id: learner._id.toString(),
        is_deleted: true,
        deletion_status: "approved",
      }),
    );
    expect(approvedResponse.body.user).not.toHaveProperty("password_hash");

    const deletedLearner = await User.findOne({
      _id: learner._id,
      is_deleted: true,
      is_archived: false,
    });
    expect(deletedLearner.deletion_status).toBe("approved");
    expect(deletedLearner.token_version).toBe(1);
    expect(
      deletedLearner.deletion_scheduled_at.getTime() - deletedLearner.deleted_at.getTime(),
    ).toBe(30 * 24 * 60 * 60 * 1000);

    const staleSessionResponse = await request(app)
      .get("/api/v1/profile")
      .set("Authorization", learnerAuthorization);

    expect(staleSessionResponse.status).toBe(401);
    expect(staleSessionResponse.body.code).toBe("SESSION_INVALIDATED");

    const repeatedApproval = await request(app)
      .patch(`/api/v1/admin/deletions/approve/${learner._id}`)
      .set("Authorization", adminAuthorization);

    expect(repeatedApproval.status).toBe(409);
  });

  it("uses the same lifecycle state for reviewed and direct admin deletion", async () => {
    const admin = await createUser({ email: "lifecycle-admin@example.com", role: "admin" });
    const reviewedUser = await createUser({ email: "reviewed-delete@example.com" });
    const dashboardUser = await createUser({ email: "dashboard-delete@example.com" });
    const adminAuthorization = authHeader(admin);
    const dashboardAuthorization = authHeader(dashboardUser);

    const deletionRequest = await request(app)
      .post("/api/v1/profile/request-deletion")
      .set("Authorization", authHeader(reviewedUser))
      .send({ email: reviewedUser.email });
    expect(deletionRequest.status).toBe(200);

    const approved = await request(app)
      .patch(`/api/v1/admin/deletions/approve/${reviewedUser._id}`)
      .set("Authorization", adminAuthorization);
    expect(approved.status).toBe(200);

    const scheduled = await request(app)
      .patch(`/api/v1/admin/users/${dashboardUser._id}/deleted`)
      .set("Authorization", adminAuthorization)
      .send({ confirmation: "CONFIRM", deleted: true });
    expect(scheduled.status).toBe(200);

    const [reviewed, dashboard] = await Promise.all([
      User.findOne({ _id: reviewedUser._id, is_deleted: true }),
      User.findOne({ _id: dashboardUser._id, is_deleted: true }),
    ]);
    for (const user of [reviewed, dashboard]) {
      expect(user).toMatchObject({
        is_deleted: true,
        deletion_status: "approved",
        token_version: 1,
        deletion_approved_by: admin._id,
      });
      expect(user.deleted_at).toBeInstanceOf(Date);
      expect(user.deletion_scheduled_at.getTime() - user.deleted_at.getTime()).toBe(
        30 * 24 * 60 * 60 * 1000,
      );
    }

    const staleSessionResponse = await request(app)
      .get("/api/v1/profile")
      .set("Authorization", dashboardAuthorization);
    expect(staleSessionResponse.status).toBe(401);
    expect(staleSessionResponse.body.code).toBe("SESSION_INVALIDATED");
  });

  it("does not let an administrator approve their own deletion request", async () => {
    const admin = await createUser({ email: "self-approval-admin@example.com", role: "admin" });
    await User.updateOne(
      { _id: admin._id },
      { $set: { deletion_status: "pending", deletion_requested_at: new Date() } },
    );

    const response = await request(app)
      .patch(`/api/v1/admin/deletions/approve/${admin._id}`)
      .set("Authorization", authHeader(admin));

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ message: "You cannot manage your own account." });
    expect(await User.findById(admin._id)).toMatchObject({
      is_deleted: false,
      deletion_status: "pending",
      token_version: 0,
    });
  });

  it("allows only one concurrent approval of a pending deletion request", async () => {
    const firstAdmin = await createUser({
      email: "first-approval-admin@example.com",
      role: "admin",
    });
    const secondAdmin = await createUser({
      email: "second-approval-admin@example.com",
      role: "admin",
    });
    const learner = await createUser({
      email: "concurrent-approval-learner@example.com",
      deletion_status: "pending",
      deletion_requested_at: new Date(),
    });

    const responses = await Promise.all([
      request(app)
        .patch(`/api/v1/admin/deletions/approve/${learner._id}`)
        .set("Authorization", authHeader(firstAdmin)),
      request(app)
        .patch(`/api/v1/admin/deletions/approve/${learner._id}`)
        .set("Authorization", authHeader(secondAdmin)),
    ]);

    expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
    expect(await User.findOne({ _id: learner._id, is_deleted: true })).toMatchObject({
      deletion_status: "approved",
      token_version: 1,
    });
  });

  it("identifies a current session for a deleted account with a stable error code", async () => {
    const deletedUser = await createUser({
      email: "account-deleted@example.com",
      is_deleted: true,
      deleted_at: new Date(),
      deletion_scheduled_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      deletion_status: "approved",
    });

    const response = await request(app)
      .get("/api/v1/profile")
      .set("Authorization", authHeader(deletedUser));

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      message: "This account is scheduled for deletion.",
      code: "ACCOUNT_DELETED",
    });
  });

  it("reactivates a recently approved account", async () => {
    const admin = await createUser({ email: "reactivate-admin@example.com", role: "admin" });
    const deletedUser = await createUser({
      email: "reactivate-user@example.com",
      deletion_status: "approved",
      is_deleted: true,
      deleted_at: new Date(),
    });

    const response = await request(app)
      .patch(`/api/v1/admin/deletions/reactivate/${deletedUser._id}`)
      .set("Authorization", authHeader(admin));

    expect(response.status).toBe(200);

    const reactivatedUser = await User.findById(deletedUser._id);
    expect(reactivatedUser.is_deleted).toBe(false);
    expect(reactivatedUser.deletion_status).toBe("none");
    expect(reactivatedUser.deleted_at).toBeNull();
    expect(reactivatedUser.deletion_scheduled_at).toBeNull();
    expect(reactivatedUser.deletion_approved_by).toBeNull();
  });

  it("allows a user to reactivate a recently approved account", async () => {
    const password = "correct-password";
    const deletedUser = await createUser({
      email: "self-reactivate@example.com",
      password_hash: await hashPassword(password),
      deletion_status: "approved",
      is_deleted: true,
      deleted_at: new Date(),
    });

    const response = await request(app)
      .post("/api/v1/users/reactivate")
      .send({
        email: ` ${deletedUser.email.toUpperCase()} `,
        password,
      });

    expect(response.status).toBe(200);

    const reactivatedUser = await User.findById(deletedUser._id);
    expect(reactivatedUser.is_deleted).toBe(false);
    expect(reactivatedUser.deletion_status).toBe("none");
    expect(reactivatedUser.deleted_at).toBeNull();
    expect(reactivatedUser.deletion_scheduled_at).toBeNull();
    expect(reactivatedUser.deletion_approved_by).toBeNull();
  });

  it("rejects reactivation for an active account", async () => {
    const password = "correct-password";
    const activeUser = await createUser({
      email: "active-reactivate@example.com",
      password_hash: await hashPassword(password),
    });

    const response = await request(app).post("/api/v1/users/reactivate").send({
      email: activeUser.email,
      password,
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: "Account is active." });
  });

  it("only rejects pending deletion requests", async () => {
    const admin = await createUser({ email: "reject-admin@example.com", role: "admin" });
    const learner = await createUser({
      email: "reject-learner@example.com",
      deletion_status: "pending",
      deletion_requested_at: new Date(),
    });
    const authorization = authHeader(admin);

    const rejectedResponse = await request(app)
      .patch(`/api/v1/admin/deletions/deny/${learner._id}`)
      .set("Authorization", authorization);

    expect(rejectedResponse.status).toBe(200);
    expect(rejectedResponse.body).not.toHaveProperty("user");

    const rejectedUser = await User.findById(learner._id);
    expect(rejectedUser.deletion_status).toBe("denied");
    expect(rejectedUser.deletion_requested_at).toBeNull();

    const repeatedRejection = await request(app)
      .patch(`/api/v1/admin/deletions/deny/${learner._id}`)
      .set("Authorization", authorization);

    expect(repeatedRejection.status).toBe(409);
  });

  it("rejects a session token when its version is obsolete", async () => {
    const user = await createUser({ email: "token-version@example.com" });
    const authorization = authHeader(user);

    await User.updateOne({ _id: user._id }, { $set: { token_version: 1 } });

    const response = await request(app).get("/api/v1/profile").set("Authorization", authorization);

    expect(response.status).toBe(401);
  });

  it("requires the current password and renews only the requesting session", async () => {
    const currentPassword = "CurrentPass1!";
    const newPassword = "NewPass2!";
    const user = await createUser({
      email: "password-change@example.com",
      password_hash: await hashPassword(currentPassword),
    });
    const otherDeviceAuthorization = authHeader(user);
    const { csrfToken, sessionCookie } = cookieSession(user);

    const rejected = await request(app)
      .post("/api/v1/profile/password")
      .set("Cookie", sessionCookie)
      .set("X-CSRF-TOKEN", csrfToken)
      .send({ currentPassword: "WrongPass1!", newPassword });

    expect(rejected.status).toBe(401);

    const changed = await request(app)
      .post("/api/v1/profile/password")
      .set("Cookie", sessionCookie)
      .set("X-CSRF-TOKEN", csrfToken)
      .send({ currentPassword, newPassword });

    expect(changed.status).toBe(200);
    expect(changed.body).toEqual(
      expect.objectContaining({
        message: "Password changed successfully.",
        csrfToken: expect.any(String),
        user: expect.objectContaining({ id: user._id.toString(), email: user.email }),
      }),
    );
    const renewedSessionCookie = changed.headers["set-cookie"]
      .find((cookie) => cookie.startsWith("session_token="))
      .split(";")[0];
    expect(await User.findById(user._id)).toMatchObject({ token_version: 1 });

    const otherDevice = await request(app)
      .get("/api/v1/profile")
      .set("Authorization", otherDeviceAuthorization);
    expect(otherDevice.status).toBe(401);

    const currentDevice = await request(app)
      .get("/api/v1/profile")
      .set("Cookie", renewedSessionCookie);
    expect(currentDevice.status).toBe(200);
  });
});
