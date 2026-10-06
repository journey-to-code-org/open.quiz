const fs = require("node:fs");
const path = require("node:path");
const jwt = require("jsonwebtoken");
const request = require("supertest");
const { useTestDb } = require("./setup");
const app = require("../src/app");
const OpenQuizPackage = require("../src/models/OpenQuizPackage.model");
const ThemeConfiguration = require("../src/models/ThemeConfiguration.model");
const User = require("../src/models/User.model");
const { ensureBundledThemes } = require("../src/services/bundledThemes.service");
const { validateOpenQuizPackage } = require("../src/services/openQuizPackage");
const { renderIndexHtml, renderManifest } = require("../src/services/siteShell.service");

useTestDb();

const ADMIN = "/api/v1/admin";
const frontendRoot = path.join(__dirname, "..", "..", "frontend");
const landing = {
  hero: { heading: "Grow", body: "Line one\nLine two", showAvatars: false },
  faq: { heading: "Questions", items: [{ question: "Free?", answer: "Yes" }] },
};

let token;
const withAuth = (req) =>
  req.set("Authorization", `Bearer ${token}`).set("X-CSRF-Token", "test-csrf");
const get = (url) => withAuth(request(app).get(url));
const patch = (url, body) => withAuth(request(app).patch(url)).send(body ?? {});
const post = (url) => withAuth(request(app).post(url));
const readJson = (req) =>
  req
    .buffer(true)
    .parse((res, done) => {
      let data = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => done(null, data));
    })
    .then((res) => {
      expect(res.status).toBe(200);
      return JSON.parse(res.body);
    });

beforeEach(async () => {
  await ensureBundledThemes();
  const admin = await User.create({
    name: "Site settings admin",
    email: `admin-${Date.now()}-${Math.random()}@example.com`,
    password_hash: "test-only",
    role: "admin",
    tos_agreement: true,
    email_verified_at: new Date(),
  });
  token = jwt.sign(
    { id: admin._id.toString(), role: "admin", csrfToken: "test-csrf" },
    process.env.JWT_SECRET,
  );
});

describe("site settings", () => {
  test("start empty and validate updates", async () => {
    expect((await get(`${ADMIN}/site-settings`)).body).toEqual({ appName: null, landing: null });
    const invalid = [
      {},
      { appName: "x".repeat(61) },
      { appName: "bad\u0007name" },
      { landing: { hero: { heading: "x".repeat(121), body: "ok" } } },
      { landing: { hero: { heading: "Only a heading" } } },
      { landing: { unknown: {} } },
      {
        landing: {
          faq: {
            heading: "Q",
            items: Array.from({ length: 11 }, () => ({ question: "q", answer: "a" })),
          },
        },
      },
    ];
    for (const body of invalid) {
      expect((await patch(`${ADMIN}/site-settings`, body)).status).toBe(400);
    }
  });

  test("apply partial updates and expose them publicly", async () => {
    expect(
      (await patch(`${ADMIN}/site-settings`, { appName: "  My   Garden " })).body.appName,
    ).toBe("My Garden");
    const saved = (await patch(`${ADMIN}/site-settings`, { landing })).body;
    expect(saved.appName).toBe("My Garden");
    expect(saved.landing.hero.body).toBe("Line one\nLine two");

    const theme = (await request(app).get("/api/v1/theme")).body;
    expect(theme.appName).toBe("My Garden");
    expect(theme.landing.faq.items[0].question).toBe("Free?");

    const reset = (await patch(`${ADMIN}/site-settings`, { appName: "", landing: null })).body;
    expect(reset).toEqual({ appName: null, landing: null });
  });

  test("theme activation applies packaged branding unless declined", async () => {
    await patch(`${ADMIN}/site-settings`, { appName: "My Garden", landing });

    expect(
      (await patch(`${ADMIN}/packages/sprout/activate`, { applySiteContent: false })).status,
    ).toBe(200);
    let settings = (await get(`${ADMIN}/site-settings`)).body;
    expect(settings.appName).toBe("My Garden");
    expect(settings.landing.hero.heading).toBe("Grow");

    const activated = await patch(`${ADMIN}/packages/sprout/activate`);
    expect(activated.body.appName).toBe("Sprout");
    settings = (await request(app).get("/api/v1/theme")).body;
    expect(settings.appName).toBe("Sprout");
    expect(settings.landing.hero.heading).not.toBe("Grow");
    expect(settings.landing.faq.items.length).toBeGreaterThan(0);

    const listed = (await get(`${ADMIN}/packages`)).body.packages.find(
      (item) => item.packageId === "sprout",
    );
    expect(listed.themePreview.appName).toBe("Sprout");
    expect(listed.themePreview.landing.hero).toBeDefined();
  });

  test("bundled Sprout backfills its app name and landing page", async () => {
    await OpenQuizPackage.updateOne(
      { packageId: "sprout" },
      { $unset: { "theme.appName": 1, "theme.landing": 1 } },
    );
    await ensureBundledThemes();
    const sprout = await OpenQuizPackage.findOne({ packageId: "sprout" }).lean();
    expect(sprout.theme.appName).toBe("Sprout");
    expect(sprout.theme.landing.hero).toBeDefined();
  });

  test("exports carry site branding and round-trip through import", async () => {
    await patch(`${ADMIN}/packages/sprout/activate`);
    await patch(`${ADMIN}/site-settings`, { appName: "Exported Name", landing });

    const themeOnly = await readJson(get(`${ADMIN}/packages/sprout/export?mode=theme`));
    expect(themeOnly.theme.appName).toBe("Sprout");
    const withSite = await readJson(
      get(`${ADMIN}/packages/sprout/export?mode=theme&includeSite=true`),
    );
    expect(withSite.theme.appName).toBe("Exported Name");
    expect(withSite.theme.landing.hero.heading).toBe("Grow");
    expect(() => validateOpenQuizPackage(withSite)).not.toThrow();

    const site = await readJson(get(`${ADMIN}/site-export`));
    expect(site.theme.appName).toBe("Exported Name");
    expect(() => validateOpenQuizPackage(site)).not.toThrow();

    await post(`${ADMIN}/packages/default/activate`);
    await ThemeConfiguration.updateOne(
      { key: "active" },
      { $set: { appName: null, landing: null } },
    );
    site.package.id = "site-copy";
    const imported = await withAuth(request(app).post(`${ADMIN}/packages/import`))
      .field("mode", "all")
      .attach("file", Buffer.from(JSON.stringify(site)), {
        filename: "site.openquiz.json",
        contentType: "application/json",
      });
    expect(imported.status).toBe(201);
    await patch(`${ADMIN}/packages/site-copy/activate`);
    const restored = (await get(`${ADMIN}/site-settings`)).body;
    expect(restored.appName).toBe("Exported Name");
    expect(restored.landing.hero.heading).toBe("Grow");
  });

  test("site export includes branding even without an active theme", async () => {
    await patch(`${ADMIN}/site-settings`, {
      landing: { hero: { heading: "Only", body: "Body" } },
    });
    const site = await readJson(get(`${ADMIN}/site-export`));
    expect(site.theme.landing.hero.heading).toBe("Only");
    expect(() => validateOpenQuizPackage(site)).not.toThrow();
  });
});

describe("site shell branding", () => {
  test("escapes the app name in index.html", () => {
    const html = fs.readFileSync(path.join(frontendRoot, "index.html"), "utf8");
    const rendered = renderIndexHtml(html, `Tom & "Jerry" <script>`);
    expect(rendered).toContain("<title>Tom &amp; &quot;Jerry&quot; &lt;script&gt;</title>");
    expect(rendered).toMatch(/og:site_name" content="Tom &amp;/);
    expect(rendered).toContain('"name": "Tom & \\"Jerry\\" \\u003cscript>"');
    expect(renderIndexHtml(html, null)).toBe(html);
  });

  test("renames the web manifest with a short name of at most 12 characters", () => {
    const manifestJson = fs.readFileSync(
      path.join(frontendRoot, "public", "site.webmanifest"),
      "utf8",
    );
    const manifest = JSON.parse(renderManifest(manifestJson, "A Very Long Garden Name"));
    expect(manifest.name).toBe("A Very Long Garden Name");
    expect(manifest.short_name.length).toBeLessThanOrEqual(12);
  });
});
