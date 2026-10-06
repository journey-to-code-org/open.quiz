const jwt = require("jsonwebtoken");
const request = require("supertest");
const { useTestDb } = require("./setup");
const app = require("../src/app");
const ContentAsset = require("../src/models/ContentAsset.model");
const LessonModule = require("../src/models/LessonModule.model");
const OpenQuizPackage = require("../src/models/OpenQuizPackage.model");
const ThemeConfiguration = require("../src/models/ThemeConfiguration.model");
const User = require("../src/models/User.model");

useTestDb();

async function createUser(role = "admin") {
  return User.create({
    name: `${role} package test user`,
    email: `${role}-${Date.now()}-${Math.random()}@example.com`,
    password_hash: "test-only",
    role,
    tos_agreement: true,
    email_verified_at: new Date(),
  });
}

const tokenFor = (user) =>
  jwt.sign(
    { id: user._id.toString(), role: user.role, csrfToken: "test-csrf" },
    process.env.JWT_SECRET,
  );

const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const packageJson = ({ id = "sprout-demo", includeContent = true } = {}) => ({
  schemaVersion: 1,
  package: { id, name: "Sprout Demo", version: "1.0.0", description: "Portable sample" },
  theme: {
    tokens: { primary: "#18816a", heading: "#105647" },
    assets: {
      logo: "brand.logo",
      progressFrame: "brand.logo",
      progressBar: "avatar.guide",
      avatars: [{ key: "guide", name: "Guide", assetKey: "avatar.guide" }],
    },
  },
  assets: [
    {
      key: "brand.logo",
      filename: "logo.png",
      mimeType: "image/png",
      data: `data:image/png;base64,${png.toString("base64")}`,
    },
    {
      key: "avatar.guide",
      filename: "guide.png",
      mimeType: "image/png",
      data: `data:image/png;base64,${png.toString("base64")}`,
    },
  ],
  ...(includeContent
    ? {
        content: {
          modules: [
            {
              id: "sprout-basics",
              title: "Sprout basics",
              characters: [{ characterId: "guide", name: "Guide", assetKey: "avatar.guide" }],
              glossary: [{ term: "Practice", definition: "Apply a learned idea." }],
              worksCited: [{ title: "Example source" }],
              lessons: [
                {
                  id: "lesson-1",
                  title: "Start here",
                  microLessons: [
                    {
                      id: "step-1",
                      microLessonContent: [
                        {
                          type: "knowledgeCheck",
                          id: "q1",
                          questionType: "multipleChoice",
                          question: "Ready?",
                          answerChoices: [
                            { key: "yes", text: "Yes" },
                            { key: "no", text: "No" },
                          ],
                          correctResponse: "yes",
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      }
    : {}),
});

describe("open.quiz package API", () => {
  test("exposes a default public theme and restricts import to admins", async () => {
    const publicResponse = await request(app).get("/api/v1/theme");
    expect(publicResponse.status).toBe(200);
    expect(publicResponse.body).toEqual({ theme: null, appName: null, landing: null });

    const learner = await createUser("learner");
    const denied = await request(app)
      .post("/api/v1/admin/packages/import")
      .set("Authorization", `Bearer ${tokenFor(learner)}`)
      .attach("file", Buffer.from(JSON.stringify(packageJson())), {
        filename: "sample.openquiz.json",
        contentType: "application/json",
      });
    expect(denied.status).toBe(403);
  });

  test("inspects packages without writing and reports server-calculated conflicts", async () => {
    const admin = await createUser();
    await LessonModule.create({ id: "sprout-basics", title: "Already installed", lessons: [] });
    const inspected = await request(app)
      .post("/api/v1/admin/packages/inspect")
      .set("Authorization", `Bearer ${tokenFor(admin)}`)
      .attach("file", Buffer.from(JSON.stringify(packageJson())), {
        filename: "sprout.openquiz.json",
        contentType: "application/json",
      });

    expect(inspected.status).toBe(200);
    expect(inspected.body.manifest.counts).toMatchObject({
      assets: 2,
      avatars: 1,
      modules: 1,
      lessons: 1,
      knowledgeChecks: 1,
    });
    expect(inspected.body.conflicts).toEqual([{ id: "sprout-basics", title: "Already installed" }]);
    expect(inspected.body).not.toHaveProperty("assets");
    expect(await ContentAsset.countDocuments()).toBe(0);
    expect(await OpenQuizPackage.countDocuments()).toBe(0);
  });

  test("returns validation failures as client errors during inspection", async () => {
    const admin = await createUser();
    const invalid = await request(app)
      .post("/api/v1/admin/packages/inspect")
      .set("Authorization", `Bearer ${tokenFor(admin)}`)
      .attach("file", Buffer.from('{"schemaVersion":99,"package":{},"theme":{}}'), {
        filename: "bad.openquiz.json",
        contentType: "application/json",
      });

    expect(invalid.status).toBe(400);
    expect(invalid.body.message).toMatch(/Unsupported package schemaVersion/);
  });

  test("imports and exports theme, lesson data, and portable character assets", async () => {
    const admin = await createUser();
    const imported = await request(app)
      .post("/api/v1/admin/packages/import")
      .set("Authorization", `Bearer ${tokenFor(admin)}`)
      .attach("file", Buffer.from(JSON.stringify(packageJson())), {
        filename: "sprout.openquiz.json",
        contentType: "application/json",
      });

    expect(imported.status).toBe(201);
    expect(imported.body).toMatchObject({
      installed: { theme: true, content: true },
      importedModules: ["sprout-basics"],
      skippedModules: [],
    });
    const storedModule = await LessonModule.findOne({ id: "sprout-basics" }).lean();
    expect(storedModule.characters[0].imagePath).toMatch(/^\/api\/v1\/assets\//);
    expect(storedModule.characters[0]).not.toHaveProperty("assetKey");
    expect(storedModule.lessons[0].microLessons[0].microLessonContent[0].correctResponse).toBe(
      "yes",
    );
    const avatars = await request(app)
      .get("/api/v1/admin/assets/avatars")
      .set("Authorization", `Bearer ${tokenFor(admin)}`);
    expect(avatars.body.assets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourcePackageId: "sprout-demo",
          packageAssetKey: "avatar.guide",
        }),
      ]),
    );
    const adminAvatar = await request(app)
      .post("/api/v1/admin/assets/avatars")
      .set("Authorization", `Bearer ${tokenFor(admin)}`)
      .attach("file", png, { filename: "coach.png", contentType: "image/png" });
    const editableModule = await LessonModule.findOne({ id: "sprout-basics" });
    editableModule.characters.push({
      characterId: "coach",
      name: "Coach",
      imagePath: adminAvatar.body.url,
    });
    editableModule.markModified("characters");
    await editableModule.save();

    const activation = await request(app)
      .patch("/api/v1/admin/packages/sprout-demo/activate")
      .set("Authorization", `Bearer ${tokenFor(admin)}`);
    expect(activation.status).toBe(200);
    const publicTheme = await request(app).get("/api/v1/theme");
    expect(publicTheme.body.theme).toMatchObject({
      id: "sprout-demo",
      tokens: { primary: "#18816a", heading: "#105647" },
    });
    expect(publicTheme.body.theme.assets.logo).toMatch(/^\/api\/v1\/assets\//);
    expect(publicTheme.body.theme.assets.progressFrame).toBe(publicTheme.body.theme.assets.logo);
    expect(publicTheme.body.theme.assets.progressBar).toBe(
      publicTheme.body.theme.assets.avatars.guide.url,
    );

    const exported = await request(app)
      .get("/api/v1/admin/packages/sprout-demo/export?mode=all")
      .set("Authorization", `Bearer ${tokenFor(admin)}`);
    expect(exported.status).toBe(200);
    expect(exported.body.content.modules[0].characters[0]).toMatchObject({
      characterId: "guide",
      assetKey: "avatar.guide",
    });
    expect(exported.body.content.modules[0].characters[0]).not.toHaveProperty("imagePath");
    expect(exported.body.content.modules[0].characters[1]).toMatchObject({
      characterId: "coach",
      assetKey: "content.avatar.sprout-basics.coach",
    });
    expect(exported.body.content.modules[0].characters[1]).not.toHaveProperty("imagePath");
    expect(exported.body.assets).toHaveLength(3);
    expect(exported.body.manifest.counts).toMatchObject({
      modules: 1,
      lessons: 1,
      knowledgeChecks: 1,
    });
    expect(JSON.stringify(exported.body)).not.toContain(
      storedModule.characters[0].imagePath.split("/").at(-1),
    );

    const themeExport = await request(app)
      .get("/api/v1/admin/packages/sprout-demo/export?mode=theme")
      .set("Authorization", `Bearer ${tokenFor(admin)}`);
    expect(themeExport.status).toBe(200);
    expect(themeExport.body).not.toHaveProperty("content");
    expect(themeExport.body.assets).toHaveLength(2);
    const themeCopy = {
      ...themeExport.body,
      package: { ...themeExport.body.package, id: "sprout-theme-copy" },
    };
    const themeImport = await request(app)
      .post("/api/v1/admin/packages/import")
      .set("Authorization", `Bearer ${tokenFor(admin)}`)
      .field("mode", "theme")
      .attach("file", Buffer.from(JSON.stringify(themeCopy)), {
        filename: "sprout-theme-copy.openquiz.json",
        contentType: "application/json",
      });
    expect(themeImport.status).toBe(201);
    expect(themeImport.body.installed).toEqual({ theme: true, content: false });
    expect((await request(app).get("/api/v1/theme")).body.theme.id).toBe("sprout-demo");
    expect(await LessonModule.countDocuments({ id: "sprout-basics" })).toBe(1);

    await LessonModule.deleteOne({ id: "sprout-basics" });
    const roundTripPackage = {
      ...exported.body,
      package: { ...exported.body.package, id: "sprout-demo-round-trip" },
    };
    const roundTrip = await request(app)
      .post("/api/v1/admin/packages/import")
      .set("Authorization", `Bearer ${tokenFor(admin)}`)
      .attach("file", Buffer.from(JSON.stringify(roundTripPackage)), {
        filename: "sprout-round-trip.openquiz.json",
        contentType: "application/json",
      });
    expect(roundTrip.status).toBe(201);
    const reimportedModule = await LessonModule.findOne({ id: "sprout-basics" }).lean();
    expect(reimportedModule.characters[0].imagePath).not.toBe(storedModule.characters[0].imagePath);
    expect(reimportedModule.characters[1].imagePath).toMatch(/^\/api\/v1\/assets\//);
    expect(reimportedModule.lessons[0].microLessons[0].microLessonContent[0].correctResponse).toBe(
      "yes",
    );
  });

  test("supports theme-only install without content and reports module conflicts without replacing", async () => {
    const admin = await createUser();
    await LessonModule.create({ id: "sprout-basics", title: "Existing", lessons: [] });
    const imported = await request(app)
      .post("/api/v1/admin/packages/import")
      .set("Authorization", `Bearer ${tokenFor(admin)}`)
      .field("mode", "theme")
      .attach("file", Buffer.from(JSON.stringify(packageJson())), {
        filename: "theme.openquiz.json",
        contentType: "application/json",
      });

    expect(imported.status).toBe(201);
    expect(imported.body).toMatchObject({
      installed: { theme: true, content: false },
      importedModules: [],
      skippedModules: [],
    });
    expect((await LessonModule.findOne({ id: "sprout-basics" })).title).toBe("Existing");
    expect(await ContentAsset.countDocuments()).toBe(2);
  });

  test("skips conflicting content IDs and does not activate on import", async () => {
    const admin = await createUser();
    await LessonModule.create({ id: "sprout-basics", title: "Existing", lessons: [] });
    const imported = await request(app)
      .post("/api/v1/admin/packages/import")
      .set("Authorization", `Bearer ${tokenFor(admin)}`)
      .field("mode", "content")
      .attach("file", Buffer.from(JSON.stringify(packageJson())), {
        filename: "content.openquiz.json",
        contentType: "application/json",
      });

    expect(imported.status).toBe(201);
    expect(imported.body.skippedModules).toEqual(["sprout-basics"]);
    expect((await LessonModule.findOne({ id: "sprout-basics" })).title).toBe("Existing");
    expect(await ThemeConfiguration.findOne({ key: "active" })).toBeNull();
    expect((await OpenQuizPackage.findOne({ packageId: "sprout-demo" })).theme).toBeUndefined();
  });
});
