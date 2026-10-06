import { expect, test } from "./fixtures/network.js";
import introductionModule from "../shared/content/examples/openquiz-introduction/openquiz-introduction.json" with { type: "json" };

const sampleLessonUrl = "/learn/openQuizIntroduction/1.1?sample=true";
const sampleLesson = introductionModule.lessons.find(({ id }) => id === "1.1");

const mockSampleLesson = (page) =>
  page.route("**/api/v1/lessons/public/openQuizIntroduction/1.1", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        moduleData: introductionModule,
        lessonData: sampleLesson,
        progress: null,
      }),
    }),
  );

test("learners can view glossary resources without changing their lesson state", async ({
  page,
}) => {
  await mockSampleLesson(page);
  const progressWrites = [];
  page.on("request", (request) => {
    if (
      request.method() === "PATCH" &&
      request.url().includes("/api/v1/lessons/progress")
    ) {
      progressWrites.push(request);
    }
  });

  await page.goto(sampleLessonUrl);

  const lesson = page.locator("#main-content");
  await expect(lesson.getByText("This is a sample of a lesson.")).toBeVisible();
  // Let async theme and asset requests settle so the baseline text is stable.
  await page.waitForLoadState("networkidle");
  const lessonState = await lesson.innerText();
  const opener = page.getByRole("button", {
    name: "Open glossary and references",
  });

  await opener.click();

  const dialog = page.getByRole("dialog", { name: "Glossary and References" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("Instance", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Close dialog" }),
  ).toBeFocused();

  await dialog.getByRole("button", { name: "Works Cited" }).click();
  await expect(
    dialog.getByText("open.quiz README", { exact: true }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Glossary" }).click();

  await page.keyboard.press("Escape");

  await expect(dialog).not.toBeVisible();
  await expect(opener).toBeFocused();
  expect(await lesson.innerText()).toBe(lessonState);
  expect(progressWrites).toHaveLength(0);
});

test("the glossary dialog fits a mobile lesson viewport", async ({ page }) => {
  await mockSampleLesson(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(sampleLessonUrl);

  await page
    .getByRole("button", { name: "Open glossary and references" })
    .click();

  const dialog = page.getByRole("dialog", { name: "Glossary and References" });
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole("textbox", { name: "Search glossary terms" }),
  ).toBeVisible();

  const bounds = await dialog.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.y).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(390);
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(844);
});
