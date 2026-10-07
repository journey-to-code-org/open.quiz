import { test, expect } from "./fixtures/network.js";

test("signed-out learners are redirected from protected routes", async ({
  page,
}) => {
  // Start on a protected page without an authenticated session.
  await page.goto("/dashboard");

  // Signed-out learners should be sent to login with the original route saved as next.
  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard/);
  await expect(page.getByRole("heading", { name: "Login" })).toBeVisible();
});

test("learners can open the mobile menu and navigate with the keyboard", async ({
  page,
}) => {
  // Use a mobile-sized viewport so the responsive navigation menu is shown.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  // Keyboard users should be able to open the mobile menu with Enter.
  const toggle = page.locator("button[aria-controls]");
  await expect(toggle).toHaveAccessibleName("Open navigation menu");
  await toggle.focus();
  await page.keyboard.press("Enter");

  await expect(toggle).toHaveAttribute("aria-expanded", "true");

  // Move focus to the mobile login link and activate it with the keyboard.
  const loginLink = page.getByRole("link", { name: "Login" }).last();
  await expect(loginLink).toBeVisible();
  await loginLink.focus();
  await page.keyboard.press("Enter");

  // Navigation should succeed and the mobile menu should close again.
  await expect(page).toHaveURL(/\/login$/);
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
});

test("learners can dismiss the mobile menu and create an account", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  const toggle = page.locator("button[aria-controls]");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");

  await page.mouse.click(4, 100);
  await expect(toggle).toHaveAttribute("aria-expanded", "false");

  await toggle.click();
  await page.keyboard.press("Escape");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");

  await toggle.click();
  await page.getByRole("link", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/register$/);
});

test("signed-in learners can reach their profile from the mobile menu", async ({
  page,
}) => {
  const user = {
    id: "learner-1",
    name: "Maya",
    email: "maya@example.com",
    xp: 120,
    streak: 3,
  };

  await page.addInitScript((storedUser) => {
    window.sessionStorage.setItem(
      "openquiz.auth",
      JSON.stringify({ user: storedUser, csrfToken: "test-csrf-token" }),
    );
  }, user);
  await page.route("**/api/v1/profile", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ user }),
    }),
  );
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

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  const toggle = page.locator("button[aria-controls]");
  await toggle.click();

  await expect(page.getByText("120 XP | 3 day streak")).toBeVisible();
  await page.getByRole("link", { name: "Profile" }).click();

  await expect(page).toHaveURL(/\/profile$/);
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
});
