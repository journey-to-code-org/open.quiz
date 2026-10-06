const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const request = require("supertest");
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
const app = require("../src/app");
const User = require("../src/models/User.model");
const { hashPassword } = require("../src/utils/password");
const { useTestDb } = require("./setup");

useTestDb();

const tokenFor = (userId, role) =>
  jwt.sign({ id: userId, role, csrfToken: "test-csrf" }, process.env.JWT_SECRET);

const createUser = (role = "learner") =>
  User.create({
    name: `${role} user`,
    email: `${role}-${new mongoose.Types.ObjectId()}@example.com`,
    password_hash: "hashed-password",
    role,
    tos_agreement: true,
  });

describe("admin access boundary", () => {
  test("rejects unauthenticated admin requests", async () => {
    const response = await request(app).get("/api/v1/admin/status");

    expect(response.status).toBe(401);
  });

  test("rejects authenticated learners from admin requests", async () => {
    const learner = await createUser();
    const response = await request(app)
      .get("/api/v1/admin/status")
      .set("Authorization", `Bearer ${tokenFor(learner._id, "learner")}`);

    expect(response.status).toBe(403);
  });

  test("allows admins to access the admin boundary", async () => {
    const admin = await createUser("admin");
    const response = await request(app)
      .get("/api/v1/admin/status")
      .set("Authorization", `Bearer ${tokenFor(admin._id, "admin")}`);

    expect(response.status).toBe(200);
    expect(response.body.isAdmin).toBe(true);
  });

  test("lists safe user fields for admins", async () => {
    const admin = await createUser("admin");
    await createUser();

    const response = await request(app)
      .get("/api/v1/admin/users")
      .set("Authorization", `Bearer ${tokenFor(admin._id, "admin")}`);

    expect(response.status).toBe(200);
    expect(response.body.users).toHaveLength(2);
    expect(response.body.users[0]).not.toHaveProperty("password_hash");
  });

  test("keeps deletion-scheduled users visible for administrative follow-up", async () => {
    const admin = await createUser("admin");
    const target = await createUser();
    const auth = { Authorization: `Bearer ${tokenFor(admin._id, "admin")}` };

    const scheduled = await request(app)
      .patch(`/api/v1/admin/users/${target._id}/deleted`)
      .set(auth)
      .send({ confirmation: "CONFIRM", deleted: true });
    expect(scheduled.status).toBe(200);

    const listed = await request(app).get("/api/v1/admin/users").set(auth);

    expect(listed.status).toBe(200);
    expect(listed.body.total).toBe(2);
    expect(listed.body.users).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: target._id.toString(),
          is_deleted: true,
          deletion_status: "approved",
          deleted_at: expect.any(String),
          deletion_scheduled_at: expect.any(String),
        }),
      ]),
    );
  });

  test("explains why a scheduled account cannot be banned", async () => {
    const admin = await createUser("admin");
    const target = await createUser();
    const auth = { Authorization: `Bearer ${tokenFor(admin._id, "admin")}` };

    await request(app)
      .patch(`/api/v1/admin/users/${target._id}/deleted`)
      .set(auth)
      .send({ confirmation: "CONFIRM", deleted: true });

    const response = await request(app)
      .patch(`/api/v1/admin/users/${target._id}/disabled`)
      .set(auth)
      .send({ confirmation: "CONFIRM", disabled: true });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      message:
        "A deletion-scheduled account must be restored before its ban status can be changed.",
    });
  });

  test("allows admins to seed random learner accounts", async () => {
    const admin = await createUser("admin");
    const response = await request(app)
      .post("/api/v1/admin/users/seed-random")
      .set("Authorization", `Bearer ${tokenFor(admin._id, "admin")}`)
      .send({ count: 3 });

    expect(response.status).toBe(201);
    expect(response.body.count).toBe(3);
    expect(response.body.users).toHaveLength(3);
    expect(new Set(response.body.users.map((user) => user.email)).size).toBe(3);
    response.body.users.forEach((user) => {
      expect(user).toMatchObject({ role: "learner", is_disabled: false });
      expect(user).not.toHaveProperty("password_hash");
    });
    expect(await User.countDocuments({ role: "learner" })).toBe(3);
  });

  test("requires confirmation and prevents the last admin from demotion", async () => {
    const admin = await createUser("admin");
    const response = await request(app)
      .patch(`/api/v1/admin/users/${admin._id}/role`)
      .set("Authorization", `Bearer ${tokenFor(admin._id, "admin")}`)
      .send({ role: "learner", confirmation: "CONFIRM" });

    expect(response.status).toBe(409);
  });

  test("counts legacy admins with unset status fields when deleting an admin", async () => {
    const admin = await createUser("admin");
    const legacyAdminId = new mongoose.Types.ObjectId();
    await User.collection.insertOne({
      _id: legacyAdminId,
      name: "Legacy Admin",
      email: "legacy-admin@example.com",
      password_hash: "hashed-password",
      role: "admin",
      tos_agreement: true,
      created_at: new Date(),
      updated_at: new Date(),
    });

    const response = await request(app)
      .patch(`/api/v1/admin/users/${legacyAdminId}/deleted`)
      .set("Authorization", `Bearer ${tokenFor(admin._id, "admin")}`)
      .send({ confirmation: "CONFIRM", deleted: true });

    expect(response.status).toBe(200);
    expect(response.body.deleted_at).toBeTruthy();
  });

  test("allows hard deletion of a soft-deleted admin when another active admin remains", async () => {
    const admin = await createUser("admin");
    const target = await createUser("admin");
    const auth = { Authorization: `Bearer ${tokenFor(admin._id, "admin")}` };

    const deleted = await request(app)
      .patch(`/api/v1/admin/users/${target._id}/deleted`)
      .set(auth)
      .send({ confirmation: "CONFIRM", deleted: true });
    expect(deleted.status).toBe(200);

    const hardDeleted = await request(app)
      .delete(`/api/v1/admin/users/${target._id}`)
      .set(auth)
      .send({ confirmation: "CONFIRM", email: target.email });

    expect(hardDeleted.status).toBe(200);
    expect(await User.exists({ _id: target._id })).toBeNull();
  });

  test("allows permanent deletion of a seeded test-domain user", async () => {
    const admin = await createUser("admin");
    const target = await User.create({
      name: "Seeded User",
      email: "seeded-user@example.test",
      password_hash: "hashed-password",
      tos_agreement: true,
    });

    const response = await request(app)
      .delete(`/api/v1/admin/users/${target._id}`)
      .set("Authorization", `Bearer ${tokenFor(admin._id, "admin")}`)
      .send({ confirmation: "CONFIRM", email: target.email });

    expect(response.status).toBe(200);
    expect(await User.exists({ _id: target._id })).toBeNull();
  });

  test("makes the first successful login an admin, not an unverified registration", async () => {
    const response = await request(app).post("/api/v1/users/register").send({
      name: "First Admin",
      email: "first-admin@example.com",
      password: "P@ssword123!",
      confirmPassword: "P@ssword123!",
      tos: true,
    });

    expect(response.status).toBe(201);
    expect(response.body.user.role).toBe("learner");
    const user = await User.findOne({ email: "first-admin@example.com" });
    expect(user.role).toBe("learner");
    const unverified = await request(app).post("/api/v1/users/login").send({
      email: user.email,
      password: "P@ssword123!",
    });
    expect(unverified.status).toBe(403);
    user.email_verified_at = new Date();
    await user.save();
    const login = await request(app).post("/api/v1/users/login").send({
      email: user.email,
      password: "P@ssword123!",
    });
    expect(login.status).toBe(200);
    expect(login.body.user.role).toBe("admin");
    const persisted = await User.findById(user._id);
    expect(persisted.role).toBe("admin");
  });

  test("manages modules and nested lessons through admin APIs", async () => {
    const admin = await createUser("admin");
    const auth = { Authorization: `Bearer ${tokenFor(admin._id, "admin")}` };
    const moduleBody = { id: "admin-module", title: "Admin module", lessons: [] };

    const created = await request(app).post("/api/v1/admin/modules").set(auth).send(moduleBody);
    expect(created.status).toBe(201);

    const duplicate = await request(app).post("/api/v1/admin/modules").set(auth).send(moduleBody);
    expect(duplicate.status).toBe(409);

    const lesson = { id: "1.1", title: "First lesson", microLessons: [] };
    const createdLesson = await request(app)
      .post("/api/v1/admin/modules/admin-module/lessons")
      .set(auth)
      .send(lesson);
    expect(createdLesson.status).toBe(201);

    const updatedLesson = await request(app)
      .patch("/api/v1/admin/modules/admin-module/lessons/1.1")
      .set(auth)
      .send({
        id: "1.1",
        title: "Updated lesson",
        learningGoal: "Understand the updated lesson.",
        microLessons: [
          {
            id: "1.1.1",
            title: "Updated step",
            microLessonContent: [{ type: "paragraph", text: "Updated content." }],
          },
        ],
      });
    expect(updatedLesson.status).toBe(200);
    expect(updatedLesson.body.title).toBe("Updated lesson");
    expect(updatedLesson.body.microLessons[0].microLessonContent[0].text).toBe("Updated content.");

    const deletedLesson = await request(app)
      .delete("/api/v1/admin/modules/admin-module/lessons/1.1")
      .set(auth);
    expect(deletedLesson.status).toBe(200);
  });

  test("does not expose a built-in budgeting seed route", async () => {
    const admin = await createUser("admin");
    const response = await request(app)
      .post("/api/v1/admin/modules/seed-budgeting")
      .set("Authorization", `Bearer ${tokenFor(admin._id, "admin")}`);

    expect(response.status).toBe(404);
  });

  test("supports verification, reversible deletion, and confirmed hard deletion", async () => {
    const admin = await createUser("admin");
    const target = await createUser();
    const auth = { Authorization: `Bearer ${tokenFor(admin._id, "admin")}` };

    const verified = await request(app)
      .patch(`/api/v1/admin/users/${target._id}/verify-email`)
      .set(auth)
      .send({ confirmation: "CONFIRM" });
    expect(verified.status).toBe(200);

    const deleted = await request(app)
      .patch(`/api/v1/admin/users/${target._id}/deleted`)
      .set(auth)
      .send({ confirmation: "CONFIRM", deleted: true });
    expect(deleted.status).toBe(200);
    expect(deleted.body.deleted_at).toBeTruthy();
    expect(new Date(deleted.body.deletion_scheduled_at).getTime()).toBeGreaterThan(Date.now());

    const restored = await request(app)
      .patch(`/api/v1/admin/users/${target._id}/deleted`)
      .set(auth)
      .send({ confirmation: "CONFIRM", deleted: false });
    expect(restored.status).toBe(200);
    expect(restored.body.deleted_at).toBeNull();

    const hardDeleted = await request(app)
      .delete(`/api/v1/admin/users/${target._id}`)
      .set(auth)
      .send({ confirmation: "CONFIRM", email: target.email });
    expect(hardDeleted.status).toBe(200);
  });

  test("rejects self-targeted account actions and repeated verification", async () => {
    const admin = await createUser("admin");
    const auth = { Authorization: `Bearer ${tokenFor(admin._id, "admin")}` };

    const disableSelf = await request(app)
      .patch(`/api/v1/admin/users/${admin._id}/disabled`)
      .set(auth)
      .send({ disabled: true, confirmation: "CONFIRM" });
    expect(disableSelf.status).toBe(409);

    const deleteSelf = await request(app)
      .patch(`/api/v1/admin/users/${admin._id}/deleted`)
      .set(auth)
      .send({ confirmation: "CONFIRM", deleted: true });
    expect(deleteSelf.status).toBe(409);

    admin.email_verified_at = new Date();
    await admin.save();
    const verifyAgain = await request(app)
      .patch(`/api/v1/admin/users/${admin._id}/verify-email`)
      .set(auth)
      .send({ confirmation: "CONFIRM" });
    expect(verifyAgain.status).toBe(409);
  });

  test("invalidates banned users' authenticated sessions", async () => {
    const user = await createUser("admin");
    user.is_disabled = true;
    await user.save();

    const response = await request(app)
      .get("/api/v1/admin/status")
      .set("Authorization", `Bearer ${tokenFor(user._id, "admin")}`);

    expect(response.status).toBe(401);
    expect(response.body.message).toContain("banned");
    expect(response.body.code).toBe("ACCOUNT_DISABLED");
  });

  test.each([
    ["an active account", {}],
    ["a banned account", { is_disabled: true }],
    ["a deleted account", { is_deleted: true, deleted_at: new Date() }],
  ])("does not disclose the state of %s with an incorrect password", async (_, accountState) => {
    const user = await createUser();
    user.password_hash = await hashPassword("P@ssword123!");
    user.email_verified_at = new Date();
    Object.assign(user, accountState);
    await user.save();

    const response = await request(app).post("/api/v1/users/login").send({
      email: user.email,
      password: "WrongPassword1!",
    });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Invalid email or password." });
  });

  test("shows banned users a banned message at login", async () => {
    const user = await createUser();
    user.password_hash = await hashPassword("P@ssword123!");
    user.is_disabled = true;
    await user.save();

    const response = await request(app).post("/api/v1/users/login").send({
      email: user.email,
      password: "P@ssword123!",
    });

    expect(response.status).toBe(403);
    expect(response.body.message).toBe("This account has been banned.");
    expect(response.body.code).toBe("ACCOUNT_DISABLED");
  });

  test("shows deleted users an unavailable message at login", async () => {
    const user = await createUser();
    user.password_hash = await hashPassword("P@ssword123!");
    user.is_deleted = true;
    user.deleted_at = new Date();
    await user.save();

    const response = await request(app).post("/api/v1/users/login").send({
      email: user.email,
      password: "P@ssword123!",
    });

    expect(response.status).toBe(403);
    expect(response.body.message).toBe("This account is unavailable.");
    expect(response.body.code).toBe("ACCOUNT_DELETED");
  });
});
test("invalidates an existing session when an administrator bans a user", async () => {
  const admin = await createUser("admin");
  const learner = await createUser();
  const learnerToken = tokenFor(learner._id, learner.role);

  const banned = await request(app)
    .patch(`/api/v1/admin/users/${learner._id}/disabled`)
    .set("Authorization", `Bearer ${tokenFor(admin._id, admin.role)}`)
    .send({ disabled: true, confirmation: "CONFIRM" });

  expect(banned.status).toBe(200);
  expect(await User.findById(learner._id)).toMatchObject({
    is_disabled: true,
    token_version: 1,
  });

  const staleSession = await request(app)
    .get("/api/v1/dashboard")
    .set("Authorization", `Bearer ${learnerToken}`);

  expect(staleSession.status).toBe(401);
  expect(staleSession.body.code).toBe("SESSION_INVALIDATED");
});
