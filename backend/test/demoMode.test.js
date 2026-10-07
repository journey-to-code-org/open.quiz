const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const request = require("supertest");
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
const app = require("../src/app");
const AdminBootstrap = require("../src/models/AdminBootstrap.model");
const ContentAsset = require("../src/models/ContentAsset.model");
const ThemeConfiguration = require("../src/models/ThemeConfiguration.model");
const LessonModule = require("../src/models/LessonModule.model");
const OpenQuizPackage = require("../src/models/OpenQuizPackage.model");
const User = require("../src/models/User.model");
const { DEMO_HIDDEN_EMAIL } = require("../src/config/demoMode");
const { bootstrapLoginAdmin } = require("../src/services/adminBootstrap.service");
const {
  DEMO_RESET_MODELS,
  resetDemoSite,
  resetDemoUsers,
} = require("../src/services/demoReset.service");
const { ensureInstructionalContent } = require("../src/services/bundledContent.service");
const { ensureBundledThemes } = require("../src/services/bundledThemes.service");
const { clearCache, DEMO_MODULE_CACHE_TTL_MS, getModule } = require("../src/utils/content");
const { findOrCreateOAuthUser } = require("../src/services/oauthUser.service");
const { completeOAuthLogin } = require("../src/controllers/oauth.controller");
const { useTestDb } = require("./setup");

useTestDb();

const authFor = (user) => ({
  Authorization: `Bearer ${jwt.sign(
    { id: user._id.toString(), role: user.role, csrfToken: "test-csrf" },
    process.env.JWT_SECRET,
  )}`,
});

const createUser = (role = "learner", name = `${role} user`) =>
  User.create({
    name,
    email: `${role}-${new mongoose.Types.ObjectId()}@example.com`,
    password_hash: "hashed-password",
    role,
    tos_agreement: true,
    email_verified_at: new Date(),
  });

describe("demo mode", () => {
  const originalDemoMode = process.env.DEMO_MODE;

  beforeEach(() => {
    process.env.DEMO_MODE = "true";
  });

  afterEach(() => {
    if (originalDemoMode === undefined) delete process.env.DEMO_MODE;
    else process.env.DEMO_MODE = originalDemoMode;
  });

  test("promotes every verified login to admin, including OAuth logins", async () => {
    const first = await createUser();
    const second = await createUser();
    await bootstrapLoginAdmin(first);
    await bootstrapLoginAdmin(second);
    expect(await User.countDocuments({ role: "admin" })).toBe(2);
    expect(second.role).toBe("admin");

    const oauthUser = await findOrCreateOAuthUser({
      provider: "github",
      providerId: "demo-visitor",
      name: "Demo visitor",
      emails: [{ value: "visitor@example.test", verified: true }],
      tosAccepted: true,
    });
    const res = { cookie: jest.fn(), redirect: jest.fn() };
    await completeOAuthLogin({ user: oauthUser, app: { emit: jest.fn() } }, res, jest.fn());
    expect((await User.findById(oauthUser._id)).role).toBe("admin");
    expect(jwt.verify(res.cookie.mock.calls[0][1], process.env.JWT_SECRET).role).toBe("admin");
  });

  test("still refuses unverified or disabled accounts", async () => {
    const user = await createUser();
    user.is_disabled = true;
    await expect(bootstrapLoginAdmin(user)).rejects.toThrow(/verified, active/);
    expect((await User.findById(user._id)).role).toBe("learner");
  });

  test("reports demo mode and hides other users' emails", async () => {
    const viewer = await createUser("admin", "Viewer");
    const other = await createUser("learner", "Other person");

    const status = await request(app).get("/api/v1/admin/status").set(authFor(viewer));
    expect(status.body.demoMode).toBe(true);

    const listed = await request(app).get("/api/v1/admin/users").set(authFor(viewer));
    expect(listed.status).toBe(200);
    expect(listed.body.demoMode).toBe(true);
    const byId = Object.fromEntries(listed.body.users.map((user) => [user.id, user]));
    expect(byId[viewer._id.toString()].email).toBe(viewer.email);
    expect(byId[other._id.toString()].email).toBe(DEMO_HIDDEN_EMAIL);
    expect(JSON.stringify(listed.body)).not.toContain(other.email);

    const emailProbe = await request(app)
      .get("/api/v1/admin/users")
      .query({ search: other.email.slice(0, 12) })
      .set(authFor(viewer));
    expect(emailProbe.body.users).toHaveLength(0);
    const nameSearch = await request(app)
      .get("/api/v1/admin/users")
      .query({ search: "Other" })
      .set(authFor(viewer));
    expect(nameSearch.body.users).toHaveLength(1);
  });

  test("hides emails in pending deletion requests", async () => {
    const viewer = await createUser("admin");
    const other = await createUser();
    await User.updateOne({ _id: other._id }, { $set: { deletion_status: "pending" } });

    const pending = await request(app).get("/api/v1/admin/deletions/pending").set(authFor(viewer));
    expect(pending.status).toBe(200);
    expect(pending.body.users).toEqual([
      expect.objectContaining({ name: other.name, email: DEMO_HIDDEN_EMAIL }),
    ]);
  });

  test.each([
    ["post", "/progress/reset", {}],
    ["patch", "/disabled", { confirmation: "CONFIRM", disabled: true }],
    ["patch", "/role", { confirmation: "CONFIRM", role: "learner" }],
    ["patch", "/verify-email", { confirmation: "CONFIRM" }],
    ["patch", "/deleted", { confirmation: "CONFIRM", deleted: true }],
    ["delete", "", { confirmation: "CONFIRM" }],
  ])("blocks %s /users/:userId%s on other accounts", async (method, suffix, body) => {
    const viewer = await createUser("admin");
    const other = await createUser("admin");
    const response = await request(app)
      [method](`/api/v1/admin/users/${other._id}${suffix}`)
      .set(authFor(viewer))
      .send(body);
    expect(response.status).toBe(403);
    expect(response.body.message).toMatch(/disabled on this demo site/);
    expect(await User.findById(other._id)).toMatchObject({ role: "admin", is_disabled: false });
  });

  test.each(["approve", "deny", "reactivate"])(
    "blocks %s deletion decisions on other accounts",
    async (action) => {
      const viewer = await createUser("admin");
      const other = await createUser();
      const response = await request(app)
        .patch(`/api/v1/admin/deletions/${action}/${other._id}`)
        .set(authFor(viewer))
        .send({ confirmation: "CONFIRM" });
      expect(response.status).toBe(403);
    },
  );

  test("still lets demo admins manage their own account", async () => {
    const viewer = await createUser("admin");
    const response = await request(app)
      .post(`/api/v1/admin/users/${viewer._id}/progress/reset`)
      .set(authFor(viewer))
      .send({ confirmation: "CONFIRM" });
    expect(response.status).not.toBe(403);
  });

  test("does not mask emails or block actions outside demo mode", async () => {
    delete process.env.DEMO_MODE;
    const viewer = await createUser("admin");
    const other = await createUser();
    const listed = await request(app).get("/api/v1/admin/users").set(authFor(viewer));
    expect(listed.body.demoMode).toBe(false);
    expect(listed.body.users.map((user) => user.email)).toContain(other.email);
    const response = await request(app)
      .patch(`/api/v1/admin/users/${other._id}/disabled`)
      .set(authFor(viewer))
      .send({ confirmation: "CONFIRM", disabled: true });
    expect(response.status).toBe(200);
  });
});

describe("demo reset", () => {
  afterEach(() => {
    delete process.env.DEMO_MODE;
    jest.restoreAllMocks();
  });

  test("clears accounts and learner data", async () => {
    const user = await createUser("admin");
    await AdminBootstrap.create({ key: "first-user-admin", user_id: user._id });
    for (const Model of Object.values(DEMO_RESET_MODELS)) {
      if (Model === User || Model === AdminBootstrap) continue;
      await Model.collection.insertOne({ user_id: user._id });
    }

    const deleted = await resetDemoUsers();

    expect(deleted.users).toBe(1);
    expect(deleted.adminBootstrap).toBe(1);
    for (const Model of Object.values(DEMO_RESET_MODELS)) {
      expect(await Model.countDocuments()).toBe(0);
    }

    const nextVisitor = await createUser();
    await bootstrapLoginAdmin(nextVisitor);
    expect((await User.findById(nextVisitor._id)).role).toBe("admin");
  });

  test("restores the bundled starter content and default site settings", async () => {
    await ensureBundledThemes();
    await ensureInstructionalContent();
    const starterAssetCount = await ContentAsset.countDocuments();
    await LessonModule.updateOne(
      { id: "openQuizIntroduction" },
      { $set: { title: "Vandalized introduction" } },
    );
    await LessonModule.collection.insertOne({ id: "visitor-module", title: "Visitor module" });
    await OpenQuizPackage.collection.insertOne({ packageId: "visitor-theme" });
    await OpenQuizPackage.updateOne({ packageId: "sprout" }, { $set: { name: "Renamed" } });
    await ContentAsset.collection.insertOne({ asset_id: "visitor-upload", kind: "avatar" });
    await ThemeConfiguration.create({ activePackageId: "sprout", appName: "Vandal quiz" });

    const deleted = await resetDemoSite();

    expect(deleted).toEqual(
      expect.objectContaining({ lessonModules: 2, packages: 3, siteSettings: 1 }),
    );
    expect(await ThemeConfiguration.countDocuments()).toBe(0);
    expect((await LessonModule.find().lean()).map((module) => module.id)).toEqual([
      "openQuizIntroduction",
    ]);
    expect((await LessonModule.findOne({ id: "openQuizIntroduction" })).title).toBe(
      "Welcome to open.quiz",
    );
    expect(
      (await OpenQuizPackage.find().sort({ packageId: 1 }).lean()).map((pkg) => [
        pkg.packageId,
        pkg.name,
      ]),
    ).toEqual([
      ["learning-garden", "Learning Garden"],
      ["sprout", "Sprout"],
    ]);
    expect(await ContentAsset.countDocuments()).toBe(starterAssetCount);
    expect(await ContentAsset.exists({ asset_id: "visitor-upload" })).toBeNull();
  });

  test("expires cached lessons in demo mode so outside resets reach the live server", async () => {
    await LessonModule.collection.insertOne({ id: "cached-module", title: "Before" });
    clearCache();
    const now = jest.spyOn(Date, "now").mockReturnValue(1_000_000);
    expect((await getModule("cached-module")).title).toBe("Before");
    await LessonModule.collection.updateOne({ id: "cached-module" }, { $set: { title: "After" } });

    expect((await getModule("cached-module")).title).toBe("Before");
    now.mockReturnValue(1_000_000 + DEMO_MODULE_CACHE_TTL_MS);
    expect((await getModule("cached-module")).title).toBe("Before");

    process.env.DEMO_MODE = "true";
    expect((await getModule("cached-module")).title).toBe("After");
    clearCache();
  });
});
