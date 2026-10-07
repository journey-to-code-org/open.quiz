const jwt = require("jsonwebtoken");
const request = require("supertest");
const { useTestDb } = require("./setup");

const app = require("../src/app");
const User = require("../src/models/User.model");
const UserProgress = require("../src/models/UserProgress.model");
const QuizAttempt = require("../src/models/QuizAttempt.model");
const LessonModule = require("../src/models/LessonModule.model");
const cashFlow = require("./fixtures/budgetingModule.json");

useTestDb();

beforeEach(async () => {
  await LessonModule.create(cashFlow);
});

async function createAuthedUser(email) {
  const user = await User.create({
    name: "Guard Learner",
    email,
    password_hash: "not-a-real-hash",
    tos_agreement: true,
  });

  const token = jwt.sign(
    { id: user._id.toString(), role: user.role, csrfToken: "test-csrf" },
    process.env.JWT_SECRET,
  );

  return { authHeader: `Bearer ${token}`, userId: user._id };
}

describe("server-side lesson access guard", () => {
  it("allows the first lesson of the module with no progress record", async () => {
    const { authHeader } = await createAuthedUser("first-lesson@example.com");

    const response = await request(app)
      .get("/api/v1/lessons/cashFlow/1.1")
      .set("Authorization", authHeader);

    expect(response.status).toBe(200);
  });

  it("returns 403 for a lesson whose predecessor has not been completed", async () => {
    const { authHeader } = await createAuthedUser("locked-lesson@example.com");

    const response = await request(app)
      .get("/api/v1/lessons/cashFlow/1.2")
      .set("Authorization", authHeader);

    expect(response.status).toBe(403);
    expect(response.body.message).toMatch(/complete the previous lesson/i);
  });

  it("allows a lesson once its predecessor is marked complete", async () => {
    const { authHeader, userId } = await createAuthedUser("unlocked-lesson@example.com");

    await UserProgress.create({
      user_id: userId,
      module_id: "cashFlow",
      completed_lessons: ["1.1"],
    });

    const response = await request(app)
      .get("/api/v1/lessons/cashFlow/1.2")
      .set("Authorization", authHeader);

    expect(response.status).toBe(200);
  });

  it("saves completion and opens the next lesson when using bundled content", async () => {
    const { authHeader, userId } = await createAuthedUser("bundled-completion@example.com");
    const complete = () =>
      request(app)
        .post("/api/v1/lessons/progress/complete")
        .set("Authorization", authHeader)
        .send({ moduleId: "cashFlow", lessonId: "1.1" });

    expect((await complete()).status).toBe(409);
    const quizSteps = cashFlow.lessons[0].microLessons.filter((micro) =>
      micro.microLessonContent.some((item) => item.type === "knowledgeCheck"),
    );
    await QuizAttempt.insertMany(
      quizSteps.map((micro) => ({
        user_id: userId,
        module_id: "cashFlow",
        lesson_id: "1.1",
        micro_lesson_id: micro.id,
        passed: true,
        submitted_at: new Date(),
      })),
    );

    const completion = await complete();
    expect(completion.status).toBe(200);
    expect(completion.body.completedLessons).toContain("1.1");
    const next = await request(app)
      .get("/api/v1/lessons/cashFlow/1.2")
      .set("Authorization", authHeader);
    expect(next.status).toBe(200);
  });

  it("allows the learner's saved current lesson even if completion history is missing", async () => {
    const { authHeader, userId } = await createAuthedUser("current-position@example.com");

    await UserProgress.create({
      user_id: userId,
      module_id: "cashFlow",
      course_lesson_id: "1.2",
      completed_lessons: [],
    });

    const response = await request(app)
      .get("/api/v1/lessons/cashFlow/1.2")
      .set("Authorization", authHeader);

    expect(response.status).toBe(200);
  });

  it("allows advancing from the last completed step before parent completion is recorded", async () => {
    const { authHeader, userId } = await createAuthedUser("completed-step@example.com");
    const lastMicroLessonId = cashFlow.lessons[0].microLessons.at(-1).id;
    await UserProgress.create({
      user_id: userId,
      module_id: "cashFlow",
      current_micro_lesson_id: lastMicroLessonId,
      completed_micro_lessons: [lastMicroLessonId],
      completed_lessons: [],
    });

    const next = await request(app)
      .get("/api/v1/lessons/cashFlow/1.2")
      .set("Authorization", authHeader);
    expect(next.status).toBe(200);

    const future = await request(app)
      .get("/api/v1/lessons/cashFlow/1.3")
      .set("Authorization", authHeader);
    expect(future.status).toBe(403);
  });

  it("allows the current step's lesson when the saved parent lesson is stale", async () => {
    const { authHeader, userId } = await createAuthedUser("saved-step@example.com");
    await UserProgress.create({
      user_id: userId,
      module_id: "cashFlow",
      course_lesson_id: "1.1",
      current_micro_lesson_id: "1.2.1",
    });

    const response = await request(app)
      .get("/api/v1/lessons/cashFlow/1.2")
      .set("Authorization", authHeader);
    expect(response.status).toBe(200);
  });

  it("allows reviewing a completed lesson with gaps in older completion history", async () => {
    const { authHeader, userId } = await createAuthedUser("review-lesson@example.com");
    await UserProgress.create({
      user_id: userId,
      module_id: "cashFlow",
      completed_lessons: ["1.3"],
    });

    const response = await request(app)
      .get("/api/v1/lessons/cashFlow/1.3")
      .set("Authorization", authHeader);
    expect(response.status).toBe(200);
  });
});

describe("GET /api/v1/lessons/last", () => {
  it("returns the first lesson path when the learner has no progress", async () => {
    const { authHeader } = await createAuthedUser("no-progress@example.com");

    const response = await request(app)
      .get("/api/v1/lessons/last")
      .set("Authorization", authHeader);

    expect(response.status).toBe(200);
    expect(response.body.lastLessonPath).toBe("/learn/cashFlow/1.1");
  });

  it("preserves the saved current lesson when older completion history is missing", async () => {
    const { authHeader, userId } = await createAuthedUser("stale-position@example.com");

    await UserProgress.create({
      user_id: userId,
      module_id: "cashFlow",
      course_lesson_id: "1.6",
      completed_lessons: ["1.1"],
    });

    const response = await request(app)
      .get("/api/v1/lessons/last")
      .set("Authorization", authHeader);

    expect(response.status).toBe(200);
    expect(response.body.lastLessonPath).toBe("/learn/cashFlow/1.6");
    const lesson = await request(app)
      .get(`/api/v1/lessons/${response.body.lastLessonPath.split("/").slice(2).join("/")}`)
      .set("Authorization", authHeader);
    expect(lesson.status).toBe(200);
  });

  it("returns the learning path's current lesson after the previous lesson's last step", async () => {
    const { authHeader, userId } = await createAuthedUser("last-completed-step@example.com");
    const lastMicroLessonId = cashFlow.lessons[0].microLessons.at(-1).id;
    await UserProgress.create({
      user_id: userId,
      module_id: "cashFlow",
      current_micro_lesson_id: lastMicroLessonId,
      completed_micro_lessons: [lastMicroLessonId],
    });

    const response = await request(app)
      .get("/api/v1/lessons/last")
      .set("Authorization", authHeader);
    expect(response.body.lastLessonPath).toBe("/learn/cashFlow/1.2");
    const lesson = await request(app)
      .get("/api/v1/lessons/cashFlow/1.2")
      .set("Authorization", authHeader);
    expect(lesson.status).toBe(200);
  });

  it("returns an accessible fallback for an invalid cursor and nonsequential completions", async () => {
    const { authHeader, userId } = await createAuthedUser("invalid-cursor@example.com");
    await UserProgress.create({
      user_id: userId,
      module_id: "cashFlow",
      course_lesson_id: "removed-lesson",
      current_micro_lesson_id: "removed-step",
      completed_lessons: ["1.3", "1.5"],
    });

    const response = await request(app)
      .get("/api/v1/lessons/last")
      .set("Authorization", authHeader);
    expect(response.body.lastLessonPath).toBe("/learn/cashFlow/1.1");
  });
});
