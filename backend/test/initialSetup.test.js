const request = require("supertest");
const jwt = require("jsonwebtoken");
const { useTestDb } = require("./setup");
const User = require("../src/models/User.model");
const AdminBootstrap = require("../src/models/AdminBootstrap.model");
const ContentAsset = require("../src/models/ContentAsset.model");
const OpenQuizPackage = require("../src/models/OpenQuizPackage.model");
const ThemeConfiguration = require("../src/models/ThemeConfiguration.model");
const LessonModule = require("../src/models/LessonModule.model");
const { ensureBundledThemes } = require("../src/services/bundledThemes.service");
const { ensureInstructionalContent } = require("../src/services/bundledContent.service");
const { bootstrapLoginAdmin } = require("../src/services/adminBootstrap.service");
const { findOrCreateOAuthUser } = require("../src/services/oauthUser.service");
const { completeOAuthLogin } = require("../src/controllers/oauth.controller");
const app = require("../src/app");

useTestDb();

const createLearner = (email) =>
  User.create({
    name: "Setup learner",
    email,
    tos_agreement: true,
    email_verified_at: new Date(),
  });

describe("initial installation setup", () => {
  test("preinstalls instructional data without overwriting existing lessons or installing finance content", async () => {
    await Promise.all([ensureInstructionalContent(), ensureInstructionalContent()]);
    const introduction = await LessonModule.findOne({ id: "openQuizIntroduction" });
    expect(introduction.title).toBe("Welcome to open.quiz");
    expect(introduction.lessons.length).toBeGreaterThan(0);
    expect(introduction.metadata.packageId).toBe("openquiz-introduction");
    expect(introduction.characters[0]).not.toHaveProperty("imagePath");
    const discovery = await request(app).get("/api/v1/lessons/public/modules");
    expect(discovery.body.modules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "openQuizIntroduction", firstLessonId: "1.1" }),
      ]),
    );
    await LessonModule.updateOne(
      { id: introduction.id },
      { $set: { title: "Customized introduction" } },
    );
    await ensureInstructionalContent();
    expect((await LessonModule.findOne({ id: introduction.id })).title).toBe(
      "Customized introduction",
    );
    expect(await LessonModule.countDocuments()).toBe(1);
  });

  test.each(["google", "github"])(
    "makes the first successful %s login admin before issuing its session",
    async (provider) => {
      const user = await findOrCreateOAuthUser({
        provider,
        providerId: "first-provider-user",
        name: "First admin",
        emails: [{ value: `${provider}@example.test`, verified: true }],
        tosAccepted: true,
      });
      expect(user.role).toBe("learner");
      const res = { cookie: jest.fn(), redirect: jest.fn() };
      const next = jest.fn();
      await completeOAuthLogin({ user, app: { emit: jest.fn() } }, res, next);
      expect(next).not.toHaveBeenCalled();
      expect((await User.findById(user._id)).role).toBe("admin");
      expect(jwt.verify(res.cookie.mock.calls[0][1], process.env.JWT_SECRET).role).toBe("admin");
      const second = await createLearner("second@example.test");
      await bootstrapLoginAdmin(second);
      expect((await User.findById(second._id)).role).toBe("learner");
    },
  );

  test("only promotes one user when logins race", async () => {
    const users = await Promise.all(
      ["a", "b", "c"].map((id) => createLearner(`${id}@example.test`)),
    );
    await Promise.all(users.map(bootstrapLoginAdmin));
    expect(await User.countDocuments({ role: "admin" })).toBe(1);
    expect(await AdminBootstrap.countDocuments()).toBe(1);
  });

  test("does not create another administrator when a legacy installation already has one", async () => {
    await User.create({
      name: "Admin",
      email: "admin@example.test",
      role: "admin",
      tos_agreement: true,
    });
    const learner = await createLearner("learner@example.test");
    await bootstrapLoginAdmin(learner);
    expect(learner.role).toBe("learner");
  });

  test("rejects ineligible bootstrap candidates", async () => {
    const user = await createLearner("disabled@example.test");
    user.is_disabled = true;
    await expect(bootstrapLoginAdmin(user)).rejects.toThrow(/verified, active/);
    expect(await AdminBootstrap.countDocuments()).toBe(0);
  });

  test("installs both bundled themes idempotently without activating themes or installing finance lessons", async () => {
    await ensureBundledThemes();
    await Promise.all([ensureBundledThemes(), ensureBundledThemes()]);
    expect(await OpenQuizPackage.countDocuments()).toBe(2);
    expect(await ContentAsset.countDocuments()).toBe(8);
    expect(await User.countDocuments()).toBe(0);
    expect(await LessonModule.countDocuments()).toBe(0);
    expect(await ThemeConfiguration.countDocuments()).toBe(0);
    expect((await request(app).get("/api/v1/theme")).body).toEqual({
      theme: null,
      appName: null,
      landing: null,
      colorMode: { default: "light", showToggle: true, togglePosition: "header" },
    });
    const sprout = await OpenQuizPackage.findOne({ packageId: "sprout" });
    expect(sprout.installedSections).toEqual(["theme"]);
    expect(sprout.manifest.includes).toEqual({ theme: true, content: false });
    const beaver = await ContentAsset.findOne({
      source_package_id: "sprout",
      package_asset_key: "avatar.beaver",
    });
    expect(beaver.kind).toBe("avatar");
    const image = await request(app).get(`/api/v1/assets/${beaver.asset_id}`);
    expect(image.status).toBe(200);
    const admin = await User.create({
      name: "Admin",
      email: "admin@example.test",
      role: "admin",
      tos_agreement: true,
    });
    const token = jwt.sign(
      { id: admin._id, role: "admin", csrfToken: "csrf" },
      process.env.JWT_SECRET,
    );
    const library = await request(app)
      .get("/api/v1/admin/assets/avatars")
      .set("Authorization", `Bearer ${token}`);
    expect(library.body.assets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ packageAssetKey: "avatar.beaver", sourcePackageId: "sprout" }),
      ]),
    );
    await ThemeConfiguration.create({ key: "active", activePackageId: "learning-garden" });
    await ensureBundledThemes();
    expect((await ThemeConfiguration.findOne({ key: "active" })).activePackageId).toBe(
      "learning-garden",
    );
  });

  test("repairs a missing beaver avatar in an older Sprout installation without changing its theme", async () => {
    await ensureBundledThemes();
    await OpenQuizPackage.updateOne(
      { packageId: "sprout" },
      {
        $pull: {
          assets: { key: "avatar.beaver" },
          "theme.assets.avatars": { assetKey: "avatar.beaver" },
        },
        $set: { "theme.tokens.primary": "#123456" },
      },
    );
    await ContentAsset.deleteOne({
      source_package_id: "sprout",
      package_asset_key: "avatar.beaver",
    });
    await ensureBundledThemes();
    const sprout = await OpenQuizPackage.findOne({ packageId: "sprout" });
    expect(sprout.theme.tokens.primary).toBe("#123456");
    expect(sprout.theme.assets.avatars).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "beaver", assetKey: "avatar.beaver" }),
      ]),
    );
    expect(
      await ContentAsset.countDocuments({ kind: "avatar", package_asset_key: "avatar.beaver" }),
    ).toBe(1);
  });
});
