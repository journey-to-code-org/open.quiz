import { test, expect } from "./fixtures/network.js";

test("saving a display name updates the header avatar", async ({ page }) => {
  // Mutable mock profile so the PATCH request can update the same data returned by subsequent mocked profile responses.
  let profile = {
    id: "learner-1",
    name: "Maya",
    email: "maya@example.com",
    xp: 120,
    streak: 3,
    goals: "Build an emergency fund",
    notifications: true,
  };

  // Seed the authenticated session before the app loads so the test starts on the profile page as a logged-in learner.
  await page.addInitScript((user) => {
    window.sessionStorage.setItem(
      "openquiz.auth",
      JSON.stringify({ user, csrfToken: "test-csrf-token" }),
    );
  }, profile);

  // Mock the profile API so this test exercises the frontend without depending on a running backend or database.
  await page.route("**/api/v1/profile", async (route) => {
    const request = route.request();

    if (request.method() === "PATCH") {
      // Verify the frontend sends both the expected CSRF token and only the display-name field being changed.
      expect(request.headers()["x-csrf-token"]).toBe("test-csrf-token");
      expect(request.postDataJSON()).toEqual({ name: "Zoe" });

      // Simulate the backend persisting the updated display name.
      profile = { ...profile, name: "Zoe" };
    }

    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ user: profile }),
    });
  });
  await page.route("**/api/v1/dashboard", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ progress: { overallPercent: 25 } }),
    }),
  );
  await page.route("**/api/v1/onboarding", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ onboarding: { is_completed: true } }),
    }),
  );

  await page.goto("/profile");

  // Target the profile link in the primary nav, whose text is the user's current display-name initial.
  const avatar = page.locator(
    'nav[aria-label="Primary navigation"] a[href="/profile"]',
  );

  await expect(avatar).toHaveText("M");

  await page
    .getByRole("textbox", { name: "Display Name", exact: true })
    .fill("Zoe");
  await page.getByRole("button", { name: "Save display name" }).click();

  await expect(page.getByText("Display name saved.")).toBeVisible();
  await expect(avatar).toHaveText("Z");
});
