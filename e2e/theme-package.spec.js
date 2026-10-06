import { expect, test } from "./fixtures/network.js";

const candidatePackage = {
  schemaVersion: 1,
  package: {
    id: "playwright-garden",
    name: "Playwright Garden",
    version: "1.0.0",
  },
  theme: {
    tokens: { primary: "#18816a", heading: "#105647" },
    assets: {
      logo: null,
      favicon: null,
      hero: null,
      progressBar: null,
      avatars: [],
    },
  },
  assets: [],
};

test("admin previews, installs, activates, reloads, and restores a package theme", async ({
  page,
}) => {
  const adminUser = {
    id: "appearance-admin",
    name: "Appearance Admin",
    email: "appearance@example.test",
    role: "admin",
  };
  let installed = false;
  let activeTheme = null;

  await page.addInitScript((user) => {
    window.sessionStorage.setItem(
      "openquiz.auth",
      JSON.stringify({ user, csrfToken: "test-csrf-token" }),
    );
  }, adminUser);

  await page.route("**/api/v1/profile", (route) =>
    route.fulfill({ json: { user: adminUser } }),
  );
  await page.route("**/api/v1/theme", (route) =>
    route.fulfill({ json: { theme: activeTheme } }),
  );
  await page.route("**/api/v1/onboarding", (route) =>
    route.fulfill({ json: { onboarding: { is_completed: true } } }),
  );
  await page.route("**/api/v1/admin/users", (route) =>
    route.fulfill({ json: { users: [] } }),
  );
  await page.route("**/api/v1/admin/modules", (route) =>
    route.fulfill({ json: { modules: [] } }),
  );
  await page.route("**/api/v1/admin/deletions/pending", (route) =>
    route.fulfill({ json: { users: [] } }),
  );
  await page.route("**/api/v1/admin/assets/avatars", (route) =>
    route.fulfill({ json: { assets: [] } }),
  );
  await page.route("**/api/v1/admin/packages", (route) =>
    route.fulfill({
      json: {
        activePackageId: activeTheme?.id || null,
        packages: installed
          ? [
              {
                packageId: "playwright-garden",
                name: "Playwright Garden",
                version: "1.0.0",
                description: "",
                installedSections: ["theme"],
                importedModuleIds: [],
                isActive: activeTheme?.id === "playwright-garden",
                themePreview: activeTheme || {
                  id: "playwright-garden",
                  name: "Playwright Garden",
                  tokens: candidatePackage.theme.tokens,
                  assets: { logo: null, avatars: {} },
                },
              },
            ]
          : [],
      },
    }),
  );
  await page.route("**/api/v1/admin/packages/inspect", (route) =>
    route.fulfill({
      json: {
        package: candidatePackage.package,
        includes: { theme: true, content: false },
        manifest: {
          includes: { theme: true, content: false },
          counts: {
            assets: 0,
            avatars: 0,
            modules: 0,
            lessons: 0,
            knowledgeChecks: 0,
          },
        },
        conflicts: [],
        theme: candidatePackage.theme,
      },
    }),
  );
  await page.route("**/api/v1/admin/packages/import", async (route) => {
    installed = true;
    await route.fulfill({
      status: 201,
      json: {
        package: {
          id: "playwright-garden",
          name: "Playwright Garden",
          version: "1.0.0",
        },
        installed: { theme: true, content: false },
        importedModules: [],
        skippedModules: [],
      },
    });
  });
  await page.route(
    "**/api/v1/admin/packages/playwright-garden/activate",
    async (route) => {
      activeTheme = {
        id: "playwright-garden",
        name: "Playwright Garden",
        version: "1.0.0",
        tokens: candidatePackage.theme.tokens,
        assets: {
          logo: null,
          favicon: null,
          hero: null,
          progressBar: null,
          avatars: {},
        },
      };
      await route.fulfill({ json: { activePackageId: "playwright-garden" } });
    },
  );
  await page.route(
    "**/api/v1/admin/packages/default/activate",
    async (route) => {
      activeTheme = null;
      await route.fulfill({ json: { activePackageId: null } });
    },
  );
  await page.goto("/admin/dashboard");
  await expect(
    page.getByRole("heading", { name: "Appearance and packages" }),
  ).toBeVisible();
  await page.getByLabel("Choose .openquiz.json").setInputFiles({
    name: "playwright-garden.openquiz.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(candidatePackage)),
  });
  await expect(page.getByLabel("Theme preview")).toBeVisible();
  await expect(
    page
      .getByLabel("Theme preview")
      .getByRole("heading", { name: "Playwright Garden" }),
  ).toBeVisible();
  expect(
    await page.evaluate(() =>
      document.documentElement.style.getPropertyValue("--instance-primary"),
    ),
  ).toBe("");

  await page.getByRole("button", { name: "Install selected scope" }).click();
  await expect(page.getByRole("status")).toContainText(
    "active theme was not changed",
  );
  await page.getByRole("button", { name: "Activate" }).click();
  await expect
    .poll(() =>
      page.evaluate(() =>
        document.documentElement.style.getPropertyValue("--instance-primary"),
      ),
    )
    .toBe("#18816a");

  await page.reload();
  await expect
    .poll(() =>
      page.evaluate(() =>
        document.documentElement.style.getPropertyValue("--instance-primary"),
      ),
    )
    .toBe("#18816a");
  await page.getByRole("button", { name: "Restore defaults" }).click();
  await expect
    .poll(() =>
      page.evaluate(() =>
        document.documentElement.style.getPropertyValue("--instance-primary"),
      ),
    )
    .toBe("");
});
