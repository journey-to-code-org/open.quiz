const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const request = require("supertest");
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
const app = require("../src/app");
const LessonModule = require("../src/models/LessonModule.model");
const User = require("../src/models/User.model");
const { useTestDb } = require("./setup");

useTestDb();

const authFor = (user) => ({
  Authorization: `Bearer ${jwt.sign(
    { id: user._id.toString(), role: user.role, csrfToken: "test-csrf" },
    process.env.JWT_SECRET,
  )}`,
});

const createUser = (role = "learner") =>
  User.create({
    name: `${role} user`,
    email: `${role}-${new mongoose.Types.ObjectId()}@example.com`,
    password_hash: "hashed-password",
    role,
    tos_agreement: true,
    email_verified_at: new Date(),
  });

const lesson = (id, title = `Lesson ${id}`) => ({ id, title, questions: [] });

describe("admin lesson module management", () => {
  let auth;

  beforeEach(async () => {
    auth = authFor(await createUser("admin"));
  });

  test("creates, lists, reads, updates, and deletes a module", async () => {
    const created = await request(app)
      .post("/api/v1/admin/modules")
      .set(auth)
      .send({ id: "budgeting", title: "Budgeting", lessons: [lesson("one")] });
    expect(created.status).toBe(201);

    const duplicate = await request(app)
      .post("/api/v1/admin/modules")
      .set(auth)
      .send({ id: "budgeting", title: "Again", lessons: [] });
    expect(duplicate.status).toBe(409);

    const invalid = await request(app).post("/api/v1/admin/modules").set(auth).send({});
    expect(invalid.status).toBe(400);

    const listed = await request(app).get("/api/v1/admin/modules").set(auth);
    expect(listed.status).toBe(200);
    expect(listed.body.modules).toContainEqual(
      expect.objectContaining({ id: "budgeting", lessonCount: 1 }),
    );

    const read = await request(app).get("/api/v1/admin/modules/budgeting").set(auth);
    expect(read.status).toBe(200);
    expect(read.body.title).toBe("Budgeting");

    const updated = await request(app)
      .patch("/api/v1/admin/modules/budgeting")
      .set(auth)
      .send({ title: "Budget Basics" });
    expect(updated.status).toBe(200);
    expect(updated.body.title).toBe("Budget Basics");

    const deleted = await request(app).delete("/api/v1/admin/modules/budgeting").set(auth);
    expect(deleted.status).toBe(200);
    expect(await LessonModule.exists({ id: "budgeting" })).toBeNull();
  });

  test("returns 404 for missing modules", async () => {
    const read = await request(app).get("/api/v1/admin/modules/missing").set(auth);
    const updated = await request(app)
      .patch("/api/v1/admin/modules/missing")
      .set(auth)
      .send({ title: "Nope" });
    const deleted = await request(app).delete("/api/v1/admin/modules/missing").set(auth);
    const lessonCreate = await request(app)
      .post("/api/v1/admin/modules/missing/lessons")
      .set(auth)
      .send(lesson("one"));
    const lessonUpdate = await request(app)
      .patch("/api/v1/admin/modules/missing/lessons/one")
      .set(auth)
      .send(lesson("one"));
    const lessonDelete = await request(app)
      .delete("/api/v1/admin/modules/missing/lessons/one")
      .set(auth);

    for (const response of [read, updated, deleted, lessonCreate, lessonUpdate, lessonDelete]) {
      expect(response.status).toBe(404);
    }
  });

  test("creates, updates, and deletes lessons within a module", async () => {
    await LessonModule.create({
      id: "saving",
      title: "Saving",
      lessons: [lesson("one"), lesson("two")],
    });
    const base = "/api/v1/admin/modules/saving/lessons";

    const created = await request(app).post(base).set(auth).send(lesson("three"));
    expect(created.status).toBe(201);
    const duplicate = await request(app).post(base).set(auth).send(lesson("one"));
    expect(duplicate.status).toBe(409);

    const updated = await request(app)
      .patch(`${base}/one`)
      .set(auth)
      .send(lesson("one", "Renamed"));
    expect(updated.status).toBe(200);
    const conflict = await request(app).patch(`${base}/one`).set(auth).send(lesson("two"));
    expect(conflict.status).toBe(409);
    const missingLesson = await request(app).patch(`${base}/nope`).set(auth).send(lesson("nope"));
    expect(missingLesson.status).toBe(404);

    const deleted = await request(app).delete(`${base}/two`).set(auth);
    expect(deleted.status).toBe(200);
    const missingDelete = await request(app).delete(`${base}/two`).set(auth);
    expect(missingDelete.status).toBe(404);

    const stored = await LessonModule.findOne({ id: "saving" }).lean();
    expect(stored.lessons.map(({ id, title }) => ({ id, title }))).toEqual([
      { id: "one", title: "Renamed" },
      { id: "three", title: "Lesson three" },
    ]);
  });
});

describe("admin role management", () => {
  test("promotes and demotes users while protecting the last admin", async () => {
    const admin = await createUser("admin");
    const learner = await createUser("learner");
    const auth = authFor(admin);

    const selfDemote = await request(app)
      .patch(`/api/v1/admin/users/${admin._id}/role`)
      .set(auth)
      .send({ role: "learner", confirmation: "CONFIRM" });
    expect(selfDemote.status).toBe(409);

    const promoted = await request(app)
      .patch(`/api/v1/admin/users/${learner._id}/role`)
      .set(auth)
      .send({ role: "admin", confirmation: "CONFIRM" });
    expect(promoted.status).toBe(200);
    expect(promoted.body.role).toBe("admin");

    const demoted = await request(app)
      .patch(`/api/v1/admin/users/${learner._id}/role`)
      .set(auth)
      .send({ role: "learner", confirmation: "CONFIRM" });
    expect(demoted.status).toBe(200);
    expect(demoted.body.role).toBe("learner");

    const invalid = await request(app)
      .patch(`/api/v1/admin/users/${learner._id}/role`)
      .set(auth)
      .send({ role: "owner" });
    expect(invalid.status).toBe(400);

    const missing = await request(app)
      .patch(`/api/v1/admin/users/${new mongoose.Types.ObjectId()}/role`)
      .set(auth)
      .send({ role: "admin", confirmation: "CONFIRM" });
    expect(missing.status).toBe(404);
  });
});
