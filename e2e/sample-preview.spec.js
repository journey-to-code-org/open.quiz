import { expect, test } from "./fixtures/network.js";
import introductionModule from "../shared/content/examples/openquiz-introduction/openquiz-introduction.json" with { type: "json" };

const firstLesson = introductionModule.lessons.find(({ id }) => id === "1.1");

test("a guest can explore the first installed lesson without signing in", async ({
  page,
}) => {
  await page.route("**/api/v1/lessons/public/modules", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        modules: [{ id: introductionModule.id, firstLessonId: firstLesson.id }],
      }),
    }),
  );
  await page.route(
    `**/api/v1/lessons/public/${introductionModule.id}/${firstLesson.id}`,
    (route) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          moduleData: introductionModule,
          lessonData: firstLesson,
          progress: null,
        }),
      }),
  );

  await page.goto("/");
  await page.getByRole("link", { name: "Explore lessons" }).click();

  await expect(page).toHaveURL(
    `/learn/${introductionModule.id}/${firstLesson.id}?sample=true`,
  );
  await expect(page.getByText("This is a sample of a lesson.")).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: /A place to learn|Four parts working together/,
    }),
  ).toBeVisible();
  await expect(page.locator('img[alt="Nova"], img[alt="Kit"]')).toHaveCount(1);
});
