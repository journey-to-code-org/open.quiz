const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const request = require("supertest");
const { useTestDb } = require("./setup");
const app = require("../src/app");
const User = require("../src/models/User.model");
const LessonModule = require("../src/models/LessonModule.model");
const budgetingModule = require("./fixtures/budgetingModule.json");
const {
  registerSchema,
  passwordSchema,
  lessonProgressSchema,
  quizSubmissionSchema,
} = require("../src/validation/userValidation");

useTestDb();

beforeEach(async () => {
  await LessonModule.create(budgetingModule);
});

// Create a valid bearer token so validation tests can reach protected endpoints.
let authUser;
const authHeader = () => ({
  Authorization: `Bearer ${jwt.sign(
    {
      id: authUser._id.toString(),
      role: authUser.role,
      csrfToken: "test-csrf",
      token_version: authUser.token_version,
    },
    process.env.JWT_SECRET,
  )}`,
});

// Reuse the common validation response checks across the different endpoints.
const expectValidationError = (response) => {
  expect(response.status).toBe(400);
  expect(response.body.message).toBe("Validation error");
  expect(response.body.errors).toEqual(expect.any(Array));
  expect(response.body.errors.length).toBeGreaterThan(0);
};

const expectRequiredFieldError = (response, message) => {
  expect(response.status).toBe(400);
  expect(response.body.message).toBe(message);
};

describe("write endpoint input validation", () => {
  beforeEach(async () => {
    authUser = await User.create({
      name: "Validation Learner",
      email: "validation-learner@example.com",
      password_hash: "not-a-real-hash",
      tos_agreement: true,
    });
  });

  test("accepts supported password policy variants while rejecting weak passwords", () => {
    expect(passwordSchema.validate("YxNqSSe9uqCCVAE").error).toBeUndefined();
    expect(passwordSchema.validate("YxNqSSe9uqCCVAEx").error).toBeUndefined();
    expect(passwordSchema.validate("StrongPass1!").error).toBeUndefined();
    expect(passwordSchema.validate("longpasswordwithoutnumber").error).toBeDefined();
    expect(passwordSchema.validate("Password1 ").error).toBeDefined();
    expect(passwordSchema.validate("weakpass").error).toBeDefined();
  });

  test("accepts matching trimmed register passwords", () => {
    const { error } = registerSchema.validate({
      name: "Learner",
      email: "learner@example.com",
      password: " StrongPass1! ",
      confirmPassword: " StrongPass1! ",
      tos: true,
    });

    expect(error).toBeUndefined();
  });

  test("rejects unknown lesson progress fields", async () => {
    const response = await request(app)
      .patch("/api/v1/lessons/progress")
      .set(authHeader())
      .send({ lessonId: "1.1", unexpected: true });

    expectValidationError(response);
    expect(response.body.errors.join(" ")).toContain("unexpected");
  });

  test("requires a lesson or micro-lesson ID", async () => {
    const response = await request(app)
      .patch("/api/v1/lessons/progress")
      .set(authHeader())
      .send({ moduleId: "cashFlow" });

    expectRequiredFieldError(response, "lessonId or microLessonId is required.");
  });

  test("rejects invalid lesson progress module IDs", async () => {
    const response = await request(app)
      .patch("/api/v1/lessons/progress")
      .set(authHeader())
      .send({ moduleId: 42, lessonId: "1.1" });

    expectValidationError(response);
  });

  test("rejects quiz starts without a micro-lesson ID", async () => {
    // Leave out the required microLessonId before the request reaches quiz logic.
    const response = await request(app).post("/api/v1/quizzes/start").set(authHeader()).send({});

    expectRequiredFieldError(response, "microLessonId is required.");
  });

  test("rejects quiz starts with a missing request body", async () => {
    const response = await request(app).post("/api/v1/quizzes/start").set(authHeader());

    expectRequiredFieldError(response, "microLessonId is required.");
  });

  test("rejects invalid quiz submission route parameters before grading", async () => {
    // Use an invalid micro-lesson route value so validation stops the request before grading.
    const response = await request(app)
      .post("/api/v1/quizzes/%20/submit")
      .set(authHeader())
      .send({});

    expectValidationError(response);
  });

  test("rejects invalid quiz submission bodies before database access", async () => {
    // Use an invalid attempt ID so the request is rejected before any database lookup is needed.
    const response = await request(app)
      .post("/api/v1/quizzes/1.1.1/submit")
      .set(authHeader())
      .send({ attemptId: "not-an-object-id" });

    expectValidationError(response);
  });

  test("rejects malformed forgot-password email addresses", async () => {
    // Send an invalid email format so the request fails before password reset processing starts.
    const response = await request(app)
      .post("/api/v1/users/forgot-password")
      .send({ email: "not-an-email" });

    expectValidationError(response);
    expect(response.body.errors.join(" ")).toContain("valid email address");
  });

  test("rejects invalid reset tokens and weak passwords", async () => {
    // Make both reset values invalid so validation can report more than one problem.
    const response = await request(app)
      .post("/api/v1/users/reset-password")
      .send({ token: "invalid", newPassword: "weak" });

    expectValidationError(response);
    expect(response.body.errors.length).toBeGreaterThan(1);
  });

  test("rejects unsupported dashboard event types", async () => {
    // Send an event type that is not part of the supported dashboard event list.
    const response = await request(app)
      .post("/api/v1/dashboard/events")
      .set(authHeader())
      .send({ type: "cache_bypass" });

    expectValidationError(response);
  });

  test("accepts valid lesson progress and quiz submission payloads", () => {
    expect(lessonProgressSchema.validate({ lessonId: "1.1" }).error).toBeUndefined();
    expect(
      quizSubmissionSchema.validate({
        attemptId: new mongoose.Types.ObjectId().toString(),
        moduleId: "cashFlow",
        answers: { "question-1": "answer-1" },
      }).error,
    ).toBeUndefined();
  });

  test("sanitizes correct answers from public lesson content", async () => {
    const response = await request(app).get("/api/v1/lessons/public/cashFlow/1.1");
    const content = response.body.lessonData.microLessons.flatMap(
      (microLesson) => microLesson.microLessonContent,
    );
    const knowledgeChecks = content.filter((item) => item.type === "knowledgeCheck");

    expect(response.status).toBe(200);
    expect(knowledgeChecks.length).toBeGreaterThan(0);
    expect(JSON.stringify(response.body)).not.toContain("correctResponse");
    expect(JSON.stringify(response.body)).not.toContain("explanation");
  });

  test("sanitizes correct answers from authenticated lesson content", async () => {
    const response = await request(app).get("/api/v1/lessons/cashFlow/1.1").set(authHeader());
    const content = response.body.lessonData.microLessons.flatMap(
      (microLesson) => microLesson.microLessonContent,
    );
    const knowledgeChecks = content.filter((item) => item.type === "knowledgeCheck");

    expect(response.status).toBe(200);
    expect(knowledgeChecks.length).toBeGreaterThan(0);
    expect(JSON.stringify(response.body)).not.toContain("correctResponse");
    expect(JSON.stringify(response.body)).not.toContain("explanation");
  });

  test("intentionally reveals immediate feedback for a correct public quiz check", async () => {
    const response = await request(app).post("/api/v1/quizzes/check").send({
      moduleId: "cashFlow",
      microLessonId: "1.1.2",
      questionId: "1.1.2-q3",
      choiceIds: "a",
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      isCorrect: true,
      correctChoiceIds: ["a"],
      explanation: expect.any(String),
    });
  });

  test("intentionally reveals the correct choice and explanation after an incorrect public check", async () => {
    const response = await request(app).post("/api/v1/quizzes/check").send({
      moduleId: "cashFlow",
      microLessonId: "1.1.2",
      questionId: "1.1.2-q3",
      choiceIds: "b",
    });

    expect(response.status).toBe(200);
    expect(response.body.isCorrect).toBe(false);
    expect(response.body.correctChoiceIds).toEqual(["a"]);
    expect(response.body.explanation).toEqual(expect.any(String));
  });

  test("returns not found for an unknown quiz question", async () => {
    const response = await request(app).post("/api/v1/quizzes/check").send({
      moduleId: "cashFlow",
      microLessonId: "1.1.2",
      questionId: "missing-question",
      choiceIds: "a",
    });

    expect(response.status).toBe(404);
  });

  test("rejects lesson imports without the shared secret", async () => {
    const response = await request(app).post("/api/v1/lessons/import").send({});

    expect(response.status).toBe(401);
  });

  test("validates lesson imports with the shared secret", async () => {
    const response = await request(app)
      .post("/api/v1/lessons/import")
      .set("X-Import-Secret", process.env.LESSON_IMPORT_SECRET)
      .send({ id: "cashFlow" });

    expectValidationError(response);
  });

  test("imports a lesson module with the shared secret", async () => {
    const response = await request(app)
      .post("/api/v1/lessons/import")
      .set("X-Import-Secret", process.env.LESSON_IMPORT_SECRET)
      .send({ id: "imported", title: "Imported lessons", lessons: [] });

    expect(response.status).toBe(200);
    expect(response.body.id).toBe("imported");
  });

  test("refreshes cached lesson content after re-importing a module", async () => {
    const initialModule = {
      id: "cache-test",
      title: "Initial title",
      lessons: [{ id: "1.1", title: "Initial lesson", microLessons: [] }],
    };
    const updatedModule = {
      ...initialModule,
      title: "Updated title",
    };

    await request(app)
      .post("/api/v1/lessons/import")
      .set("X-Import-Secret", process.env.LESSON_IMPORT_SECRET)
      .send(initialModule);
    await request(app)
      .post("/api/v1/lessons/import")
      .set("X-Import-Secret", process.env.LESSON_IMPORT_SECRET)
      .send(updatedModule);

    const response = await request(app).get("/api/v1/lessons/public/cache-test/1.1");

    expect(response.status).toBe(200);
    expect(response.body.moduleData.title).toBe("Updated title");
  });

  test("imports a complete lesson module from a JSON file", async () => {
    const moduleFile = {
      id: "uploaded-module",
      title: "Uploaded module",
      lessons: [{ id: "1.1", title: "Uploaded lesson", microLessons: [] }],
      tags: ["budgeting"],
      metadata: { version: 1 },
      characters: [],
      budgets: [],
      tables: [],
    };

    const response = await request(app)
      .post("/api/v1/lessons/import")
      .set("X-Import-Secret", process.env.LESSON_IMPORT_SECRET)
      .attach("file", Buffer.from(JSON.stringify(moduleFile)), {
        filename: "uploaded-module.json",
        contentType: "application/json",
      });

    expect(response.status).toBe(200);
    expect(response.body.id).toBe("uploaded-module");
    expect(response.body.lessons[0].title).toBe("Uploaded lesson");
    expect(response.body.tags).toEqual(["budgeting"]);
    expect(response.body.metadata.version).toBe(1);
  });

  test("rejects invalid JSON lesson files", async () => {
    const response = await request(app)
      .post("/api/v1/lessons/import")
      .set("X-Import-Secret", process.env.LESSON_IMPORT_SECRET)
      .attach("file", Buffer.from("not json"), {
        filename: "broken.json",
        contentType: "application/json",
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain("invalid JSON");
  });
});

describe("public lesson content endpoint", () => {
  test("lists previewable modules without authentication", async () => {
    const response = await request(app).get("/api/v1/lessons/public/modules");

    expect(response.status).toBe(200);
    expect(response.body.modules).toEqual([
      expect.objectContaining({ id: "cashFlow", firstLessonId: "1.1" }),
    ]);
  });

  test("does not load unseeded lesson modules from repository JSON", async () => {
    const response = await request(app).get("/api/v1/lessons/public/not-seeded/1.1");

    expect(response.status).toBe(404);
  });

  test("serves the installed finance example lesson", async () => {
    const response = await request(app).get("/api/v1/lessons/public/cashFlow/1.1");

    expect(response.status).toBe(200);
    expect(response.body.moduleData.id).toBe("cashFlow");
    expect(response.body.lessonData.id).toBe("1.1");
  });

  test("returns not found for an unknown lesson", async () => {
    const response = await request(app).get("/api/v1/lessons/public/cashFlow/does-not-exist");

    expect(response.status).toBe(404);
  });
});
