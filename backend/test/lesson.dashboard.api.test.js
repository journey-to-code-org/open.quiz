const request = require("supertest");
const { useTestDb } = require("./setup");
const app = require("../src/app");
const QuizAttempt = require("../src/models/QuizAttempt.model");
const LessonModule = require("../src/models/LessonModule.model");
const UserProgress = require("../src/models/UserProgress.model");
const { createAuthedUser } = require("./helpers/authTestHelpers");
const cashFlow = require("./fixtures/budgetingModule.json");

useTestDb();

describe("lesson and dashboard API integration", () => {
  it("returns progress data and updates the active lesson cursor", async () => {
    await LessonModule.create(cashFlow);
    const { authHeader } = await createAuthedUser("Lesson Reader", "lesson-progress@example.com");

    // A new user should start at the beginning of the module.
    const progressRes = await request(app)
      .get("/api/v1/lessons/progress")
      .set("Authorization", authHeader)
      .query({ moduleId: "cashFlow" });

    expect(progressRes.status).toBe(200);
    expect(progressRes.body).toMatchObject({
      currentModule: "cashFlow",
      currentLessonId: "1.1",
      currentMicroLessonId: "1.1.1",
    });

    // Move the user's saved position to the next micro-lesson.
    const updateRes = await request(app)
      .patch("/api/v1/lessons/progress")
      .set("Authorization", authHeader)
      .send({
        moduleId: "cashFlow",
        lessonId: "1.1",
        microLessonId: "1.1.2",
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body).toMatchObject({
      currentLessonId: "1.1",
      currentMicroLessonId: "1.1.2",
    });

    // Fetching the lesson should use the progress we just saved.
    const lessonRes = await request(app)
      .get("/api/v1/lessons/cashFlow/1.1")
      .set("Authorization", authHeader);

    expect(lessonRes.status).toBe(200);
    expect(lessonRes.body.moduleData.id).toBe("cashFlow");
    expect(lessonRes.body.lessonData.id).toBe("1.1");
    expect(lessonRes.body.moduleData.glossary).toEqual(
      expect.arrayContaining([expect.objectContaining({ term: "Budget" })]),
    );
    expect(lessonRes.body.moduleData.worksCited).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "cfpb-youth-glossary" })]),
    );
    expect(lessonRes.body.progress.currentMicroLessonId).toBe("1.1.2");
  });

  it("does not load example content when MongoDB has no modules", async () => {
    const { authHeader } = await createAuthedUser(
      "Dashboard Learner",
      "dashboard-example@example.com",
    );

    const dashboardRes = await request(app)
      .get("/api/v1/dashboard")
      .set("Authorization", authHeader);

    expect(dashboardRes.status).toBe(200);

    expect(dashboardRes.body.hero).toMatchObject({
      displayName: "Dashboard Learner",
      state: "new_user",
    });

    expect(dashboardRes.body.nextAction).toMatchObject({
      title: "Content coming soon",
      href: "/learn",
    });
    expect(dashboardRes.body.units).toEqual([]);

    // A new learner should not have anything in their activity history yet.
    expect(dashboardRes.body.recentActivity).toEqual([]);
  });

  it("accepts a supported dashboard event payload and responds as accepted", async () => {
    const { authHeader } = await createAuthedUser(
      "Dashboard Event User",
      "dashboard-event@example.com",
    );

    // Send a supported dashboard event as an authenticated user.
    const eventRes = await request(app)
      .post("/api/v1/dashboard/events")
      .set("Authorization", authHeader)
      .send({ type: "quiz_submit" });

    // The event should be accepted and processed successfully.
    expect(eventRes.status).toBe(202);
    expect(eventRes.body.message).toContain("Dashboard event processed");
  });

  it("resolves passed quiz attempts into dashboard progress data", async () => {
    await LessonModule.create(cashFlow);
    const { user, authHeader } = await createAuthedUser(
      "Progress Resolver",
      "progress-resolver@example.com",
    );

    // Add a passed quiz attempt without manually updating UserProgress.
    // The dashboard request should resolve the two for us.
    await QuizAttempt.create({
      user_id: user._id,
      module_id: "cashFlow",
      lesson_id: "1.1",
      micro_lesson_id: "1.1.2",
      attempt_number: 1,
      started_at: new Date(),
      submitted_at: new Date(),
      score: 100,
      passed: true,
      answers: [],
    });

    // Loading the dashboard should notice the passed attempt
    // and use it to update the learner's saved progress.
    const dashboardRes = await request(app)
      .get("/api/v1/dashboard")
      .set("Authorization", authHeader);

    expect(dashboardRes.status).toBe(200);

    // Check the database too, since this endpoint is expected
    // to repair the saved progress when it finds a passed attempt.
    const progress = await UserProgress.findOne({
      user_id: user._id,
      module_id: "cashFlow",
    });

    expect(progress.completed_micro_lessons).toContain("1.1.2");

    // The same passed attempt should also show up in recent activity.
    expect(dashboardRes.body.recentActivity[0].label).toContain("Passed quiz: What is a Budget?");
    expect(dashboardRes.body.recentActivity[0].label).toContain("(100%)");
  });

  it("marks a lesson complete when all of its quizzes have passed", async () => {
    await LessonModule.create(cashFlow);
    const { user, authHeader } = await createAuthedUser(
      "Lesson Completer",
      "lesson-completer@example.com",
    );

    // Lesson 1.1 has quizzes in these two micro-lessons.
    // Passing both should be enough to complete the lesson.
    const passedMicroLessons = ["1.1.2", "1.1.4"];

    // Create a passed attempt for each quiz in the lesson.
    for (const [index, microLessonId] of passedMicroLessons.entries()) {
      await QuizAttempt.create({
        user_id: user._id,
        module_id: "cashFlow",
        lesson_id: "1.1",
        micro_lesson_id: microLessonId,
        attempt_number: index + 1,
        started_at: new Date(),
        submitted_at: new Date(),
        score: 100,
        passed: true,
        answers: [],
      });
    }

    // Loading the dashboard should resolve both quiz attempts
    // and recognize that the whole lesson is now complete.
    const dashboardRes = await request(app)
      .get("/api/v1/dashboard")
      .set("Authorization", authHeader);

    expect(dashboardRes.status).toBe(200);

    // Read the saved progress back from the database so we can verify
    // that both the micro-lessons and the lesson were marked complete.
    const progress = await UserProgress.findOne({
      user_id: user._id,
      module_id: "cashFlow",
    });

    expect(progress.completed_micro_lessons).toEqual(expect.arrayContaining(passedMicroLessons));

    expect(progress.completed_lessons).toContain("1.1");

    // The dashboard summary should reflect the completed lesson too.
    expect(dashboardRes.body.units[0].completedLessons).toBeGreaterThan(0);
  });
});
