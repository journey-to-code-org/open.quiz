const jwt = require("jsonwebtoken");
const request = require("supertest");
const { useTestDb } = require("./setup");
const app = require("../src/app");
const LessonModule = require("../src/models/LessonModule.model");
const { createAuthedUser } = require("./helpers/authTestHelpers");
const { withAuth, withSessionCsrf } = require("./helpers/requestTestHelpers");
const cashFlow = require("./fixtures/budgetingModule.json");

useTestDb();

beforeEach(async () => {
  await LessonModule.create(cashFlow);
});

describe("backend API negative paths", () => {
  it("rejects protected routes when no authentication is provided", async () => {
    // Call several protected routes without sending any authentication.
    const dashboardRes = await request(app).get("/api/v1/dashboard");
    const lessonProgressRes = await request(app).get("/api/v1/lessons/progress");
    const quizProgressRes = await request(app).get("/api/v1/quizzes/progress");

    // Each protected route should reject the request the same way.
    for (const res of [dashboardRes, lessonProgressRes, quizProgressRes]) {
      expect(res.status).toBe(401);
      expect(res.body.message).toContain("No user is authenticated");
    }
  });
  it("rejects protected routes when bearer token is malformed", async () => {
    // Send something that looks like a bearer token, but is not a valid JWT.
    const dashboardRes = await request(app)
      .get("/api/v1/dashboard")
      .set("Authorization", "Bearer not-a-real-jwt");

    expect(dashboardRes.status).toBe(401);
    expect(dashboardRes.body.message).toContain("No user is authenticated");
  });

  it("rejects protected routes when bearer token is expired", async () => {
    // Create a valid JWT that is already expired.
    const expiredToken = jwt.sign(
      { id: "507f1f77bcf86cd799439011", role: "learner", csrfToken: "test-csrf" },
      process.env.JWT_SECRET,
      { expiresIn: -1 },
    );

    // Even though the token is formatted correctly, an expired token should not authenticate the user.
    const lessonRes = await withAuth(
      request(app).get("/api/v1/lessons/progress"),
      `Bearer ${expiredToken}`,
    );

    expect(lessonRes.status).toBe(401);
    expect(lessonRes.body.message).toContain("No user is authenticated");
  });

  it("rejects cookie-authenticated logout when CSRF token is missing", async () => {
    const { token } = await createAuthedUser("Missing Csrf User", "missing-csrf@example.com");

    // Send a valid session cookie but leave out the required CSRF header.
    const logoutRes = await request(app)
      .post("/api/v1/users/logout")
      .set("Cookie", [`session_token=${token}`]);

    expect(logoutRes.status).toBe(403);
    expect(logoutRes.body.message).toContain("Invalid CSRF token");
  });

  it("rejects cookie-authenticated logout when CSRF token does not match", async () => {
    const { token } = await createAuthedUser("Mismatched Csrf User", "mismatched-csrf@example.com");

    // Send a valid session cookie, but use a CSRF token that does not match the one in the JWT.
    const logoutRes = await withSessionCsrf(
      request(app).post("/api/v1/users/logout"),
      token,
      "different-csrf-token",
    );

    expect(logoutRes.status).toBe(403);
    expect(logoutRes.body.message).toContain("Invalid CSRF token");
  });

  it("returns 404 when lesson progress is requested for an unknown module", async () => {
    const { authHeader } = await createAuthedUser(
      "Unknown Module User",
      "unknown-module@example.com",
    );

    // Use a module ID that does not exist in the lesson content.
    const progressRes = await withAuth(
      request(app).get("/api/v1/lessons/progress"),
      authHeader,
    ).query({
      moduleId: "missingModule",
    });

    expect(progressRes.status).toBe(404);
    expect(progressRes.body.message).toContain("was not found");
  });

  it("returns 400 when lesson progress update has no lesson or micro-lesson cursor", async () => {
    const { authHeader } = await createAuthedUser("Empty Cursor User", "empty-cursor@example.com");

    // Send the module ID without telling the API which lesson or micro-lesson to update.
    const updateRes = await withAuth(
      request(app).patch("/api/v1/lessons/progress"),
      authHeader,
    ).send({
      moduleId: "cashFlow",
    });

    expect(updateRes.status).toBe(400);
    expect(updateRes.body.message).toContain("lessonId or microLessonId is required");
  });

  it("returns 404 when lesson content is requested for an unknown module", async () => {
    const { authHeader } = await createAuthedUser(
      "Unknown Lesson Module User",
      "unknown-lesson-module@example.com",
    );

    // Request lesson content from a module that does not exist.
    const lessonRes = await withAuth(
      request(app).get("/api/v1/lessons/missingModule/1.1"),
      authHeader,
    );

    expect(lessonRes.status).toBe(404);
    expect(lessonRes.body.message).toContain("Module 'missingModule' was not found");
  });

  it("returns 404 when lesson content is requested for an unknown lesson id", async () => {
    const { authHeader } = await createAuthedUser(
      "Unknown Lesson Id User",
      "unknown-lesson-id@example.com",
    );

    // Use a real module, but request a lesson ID that does not exist in it.
    const lessonRes = await withAuth(request(app).get("/api/v1/lessons/cashFlow/9.9"), authHeader);

    expect(lessonRes.status).toBe(404);
    expect(lessonRes.body.message).toContain("Lesson '9.9' was not found in module 'cashFlow'");
  });

  it("returns 400 when quiz start is missing microLessonId", async () => {
    const { authHeader } = await createAuthedUser(
      "Missing Micro User",
      "missing-micro@example.com",
    );

    // Starting a quiz requires both the module and the micro-lesson being attempted.
    const startRes = await withAuth(request(app).post("/api/v1/quizzes/start"), authHeader).send({
      moduleId: "cashFlow",
    });

    expect(startRes.status).toBe(400);
    expect(startRes.body.message).toContain("microLessonId is required");
  });

  it("returns 404 when submitting a quiz for a micro-lesson that has no knowledge checks", async () => {
    const { authHeader } = await createAuthedUser(
      "Missing Questions User",
      "missing-questions@example.com",
    );

    // Use a micro-lesson ID that does not have any quiz questions tied to it.
    const submitRes = await withAuth(
      request(app).post("/api/v1/quizzes/9.9.9/submit"),
      authHeader,
    ).send({
      moduleId: "cashFlow",
      answers: {},
    });

    expect(submitRes.status).toBe(404);
    expect(submitRes.body.message).toContain("No quiz questions found");
  });

  it("returns 404 when submitting a valid quiz without a started attempt", async () => {
    const { authHeader } = await createAuthedUser("No Attempt User", "no-attempt@example.com");

    // Use a real quiz, but skip the quiz start request so no attempt exists yet.
    const submitRes = await withAuth(
      request(app).post("/api/v1/quizzes/1.1.2/submit"),
      authHeader,
    ).send({
      moduleId: "cashFlow",
      answers: {},
    });

    expect(submitRes.status).toBe(404);
    expect(submitRes.body.message).toContain("No record of any quiz attempt");
  });

  it("returns 409 when the same quiz attempt is submitted more than once", async () => {
    const { authHeader } = await createAuthedUser(
      "Duplicate Submit User",
      "duplicate-submit@example.com",
    );

    const startRes = await withAuth(request(app).post("/api/v1/quizzes/start"), authHeader).send({
      microLessonId: "1.1.2",
      moduleId: "cashFlow",
    });

    expect(startRes.status).toBe(201);

    const firstSubmitRes = await withAuth(
      request(app).post("/api/v1/quizzes/1.1.2/submit"),
      authHeader,
    ).send({
      attemptId: startRes.body.attemptId,
      moduleId: "cashFlow",
      answers: {
        "1.1.2-q2": ["d"],
        "1.1.2-q3": ["a"],
        "1.1.2-q4": ["a"],
      },
    });

    expect(firstSubmitRes.status).toBe(200);

    const duplicateSubmitRes = await withAuth(
      request(app).post("/api/v1/quizzes/1.1.2/submit"),
      authHeader,
    ).send({
      attemptId: startRes.body.attemptId,
      moduleId: "cashFlow",
      answers: {
        "1.1.2-q2": ["d"],
        "1.1.2-q3": ["a"],
        "1.1.2-q4": ["a"],
      },
    });

    expect(duplicateSubmitRes.status).toBe(409);
    expect(duplicateSubmitRes.body.message).toContain("already been submitted");
  });
});
