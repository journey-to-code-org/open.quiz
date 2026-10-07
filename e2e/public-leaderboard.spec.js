import { test, expect } from "./fixtures/network.js";

test("visitors can open the public leaderboard from desktop and mobile navigation", async ({
  page,
}) => {
  await page.route("**/api/v1/users/me", (route) =>
    route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ message: "Not authenticated." }),
    }),
  );
  await page.route("**/api/v1/leaderboard/public", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        optedIn: null,
        currentUser: null,
        entries: [
          {
            displayName: "Avery",
            weeklyXp: 250,
            rank: 1,
            isCurrentUser: false,
          },
        ],
      }),
    }),
  );

  await page.goto("/");
  await page.getByRole("link", { name: "Leaderboard", exact: true }).click();
  await expect(page).toHaveURL(/\/leaderboard$/);
  await expect(
    page.getByRole("heading", { name: "Leaderboard", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Avery", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Log in to join the leaderboard" }),
  ).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Open navigation menu" }).click();
  await page
    .getByRole("link", { name: "Leaderboard", exact: true })
    .last()
    .click();
  await expect(page).toHaveURL(/\/leaderboard$/);
  await expect(page.getByText("Avery", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Open navigation menu" }),
  ).toHaveAttribute("aria-expanded", "false");
});
