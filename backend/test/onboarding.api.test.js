const request = require("supertest");
const { useTestDb } = require("./setup");
const app = require("../src/app");
const User = require("../src/models/User.model");
const UserProgress = require("../src/models/UserProgress.model");
const LessonModule = require("../src/models/LessonModule.model");
const { createAuthedUser } = require("./helpers/authTestHelpers");
const cashFlow = require("./fixtures/budgetingModule.json");

useTestDb();

const tourKeys = ["dashboardPage", "profilePage", "lessonPage", "learningPath"];
const base = "/api/v1/onboarding";

describe("onboarding API", () => {
  it.each([
    ["get", ""],
    ["get", "/begin"],
    ["patch", "/step"],
    ["patch", "/toggle"],
    ["post", "/reset"],
  ])("requires authentication for %s %s", async (method, path) => {
    await request(app)[method](`${base}${path}`).expect(401);
  });

  it("returns default tours without overwriting saved progress", async () => {
    const { authHeader } = await createAuthedUser();
    await request(app)
      .patch(`${base}/step`)
      .set("Authorization", authHeader)
      .send({ tourKey: "dashboardPage", step: 2 })
      .expect(200);

    const initial = await request(app)
      .get(`${base}/begin`)
      .set("Authorization", authHeader)
      .expect(200);
    expect(Object.keys(initial.body.tours).sort()).toEqual([...tourKeys].sort());
    for (const tour of Object.values(initial.body.tours)) {
      expect(tour).toEqual({ step: 0, status: "pending", dismissed: false });
    }

    const saved = await request(app).get(base).set("Authorization", authHeader).expect(200);
    expect(saved.body.onboarding).toMatchObject({
      current_step: 2,
      is_completed: false,
      started_at: expect.any(String),
      tours: { dashboardPage: { step: 2, status: "pending", dismissed: false } },
    });
  });

  it("awards 50 XP for completing every tour and does not award it again on retry", async () => {
    await LessonModule.create(cashFlow);
    const { user, authHeader } = await createAuthedUser();
    for (const [index, tourKey] of tourKeys.entries()) {
      const result = await request(app)
        .patch(`${base}/step`)
        .set("Authorization", authHeader)
        .send({ tourKey, step: 3, status: "completed" })
        .expect(200);
      expect(result.body.xpAwarded).toBe(index === 3 ? 50 : 0);
      expect(result.body.onboarding.is_completed).toBe(index === 3);
      expect(result.body.onboarding.tours[tourKey].completed_at).toEqual(expect.any(String));
      expect(result.body.statistics.allCompleted).toBe(index === 3);
    }
    const retry = await request(app)
      .patch(`${base}/step`)
      .set("Authorization", authHeader)
      .send({ tourKey: "learningPath", status: "completed" })
      .expect(200);
    expect(retry.body.xpAwarded).toBe(0);
    expect((await UserProgress.findOne({ user_id: user._id })).xp).toBe(50);
    expect((await User.findById(user._id)).onboarding.is_completed).toBe(true);
  });

  it("completes dismissed tours without awarding XP", async () => {
    const { user, authHeader } = await createAuthedUser();
    let result;
    for (const tourKey of tourKeys) {
      result = await request(app)
        .patch(`${base}/step`)
        .set("Authorization", authHeader)
        .send({ tourKey, dismissed: true })
        .expect(200);
      expect(result.body.xpAwarded).toBe(0);
      expect(result.body.onboarding.tours[tourKey]).toMatchObject({
        status: "skipped",
        dismissed: true,
      });
    }
    expect(result.body.onboarding.is_completed).toBe(true);
    expect(result.body.statistics).toEqual({ allCompleted: false, allDismissed: true });
    expect(await UserProgress.findOne({ user_id: user._id })).toBeNull();
  });

  it("disables tours while preserving steps, then re-enables fresh tours", async () => {
    const { user, authHeader } = await createAuthedUser();
    await request(app)
      .patch(`${base}/step`)
      .set("Authorization", authHeader)
      .send({ tourKey: "profilePage", step: 2 })
      .expect(200);
    const disabled = await request(app)
      .patch(`${base}/toggle`)
      .set("Authorization", authHeader)
      .send({ enabled: false })
      .expect(200);
    expect(disabled.body.onboarding.is_completed).toBe(true);
    expect(disabled.body.onboarding.tours.profilePage.step).toBe(2);
    for (const tourKey of tourKeys) {
      expect(disabled.body.onboarding.tours[tourKey]).toMatchObject({
        status: "skipped",
        dismissed: true,
      });
    }
    await request(app)
      .patch(`${base}/toggle`)
      .set("Authorization", authHeader)
      .send({ enabled: true })
      .expect(200);
    const saved = await User.findById(user._id);
    expect(saved.onboarding.is_completed).toBe(false);
    expect(saved.onboarding.completed_at).toBeNull();
    expect(saved.onboarding.started_at).toBeInstanceOf(Date);
    for (const tourKey of tourKeys) {
      expect(saved.onboarding.tours[tourKey]).toMatchObject({
        step: 0,
        status: "pending",
        dismissed: false,
      });
    }
  });

  it("supports explicit completion and resets persisted onboarding state", async () => {
    const { user, authHeader } = await createAuthedUser();
    const completed = await request(app)
      .patch(`${base}/step`)
      .set("Authorization", authHeader)
      .send({ markAllComplete: true })
      .expect(200);
    expect(completed.body.onboarding.is_completed).toBe(true);
    expect(completed.body.xpAwarded).toBe(0);
    await request(app).post(`${base}/reset`).set("Authorization", authHeader).expect(200);
    const saved = await User.findById(user._id);
    expect(saved.onboarding.is_completed).toBe(false);
    expect(saved.onboarding.started_at).toBeNull();
    expect(saved.onboarding.completed_at).toBeNull();
    for (const tourKey of tourKeys) {
      expect(saved.onboarding.tours[tourKey]).toMatchObject({
        step: 0,
        status: "pending",
        dismissed: false,
      });
    }
  });

  it.each([{ tourKey: "unknown" }, { step: -1 }, { status: "invalid" }])(
    "rejects invalid progress without modifying the user: %j",
    async (payload) => {
      const { user, authHeader } = await createAuthedUser();
      const result = await request(app)
        .patch(`${base}/step`)
        .set("Authorization", authHeader)
        .send(payload)
        .expect(400);
      expect(result.body.message).toBe("Validation error");
      expect(result.body.errors.length).toBeGreaterThan(0);
      expect((await User.findById(user._id)).onboarding.toObject()).toEqual(
        user.onboarding.toObject(),
      );
    },
  );
});
