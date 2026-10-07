import { expect, test } from "./fixtures/network.js";
import {
  answerQuiz,
  expectNoQuizCompletionError,
  lessonIds,
  moduleId,
  prepareCurriculumSession,
} from "./fixtures/learnSession.js";

test("completes the curriculum with weighted quiz scoring and the final lesson", async ({
  page,
}) => {
  const state = await prepareCurriculumSession(page);

  await page.goto(`/learn/${moduleId}/1.1`);
  await expect(page.getByRole("heading", { name: "Lesson 1.1" })).toBeVisible();

  // Quiz 1: 2/3 correct = 67%, which fails its individual 70% threshold.
  await page.getByRole("button", { name: "Quick check" }).click();
  await answerQuiz(
    page,
    ["Distractor", "Correct answer", "Correct answer"],
    false,
  );

  // Quiz 2: 3/3 correct = 100%.
  await page.getByRole("button", { name: "Quick check" }).click();
  await answerQuiz(
    page,
    ["Correct answer", "Correct answer", "Correct answer"],
    true,
  );

  // Across all six questions the learner answered 5 correctly:
  // 5 / 6 = 83%, so the lesson's weighted score passes.
  await expect(page.getByText("Score: 83% — Pass")).toBeVisible();
  await expectNoQuizCompletionError(page);

  // Verify the frontend still submitted each individual quiz with
  // its own independent score instead of incorrectly assigning 83% to both.
  expect(state.submittedQuizzes).toEqual([
    expect.objectContaining({
      microLessonId: "1.1.2",
      score: 67,
      passed: false,
    }),
    expect.objectContaining({
      microLessonId: "1.1.4",
      score: 100,
      passed: true,
    }),
  ]);

  await page.getByRole("link", { name: "Continue" }).click();

  // Walk through every remaining lesson to verify navigation and ensure the final lesson can complete without requiring another quiz.
  for (const lessonId of lessonIds.slice(1)) {
    await expect(page).toHaveURL(new RegExp(`/learn/${moduleId}/${lessonId}$`));

    await expect(
      page.getByRole("heading", { name: `Lesson ${lessonId}` }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Finish lesson" }).click();
    await expectNoQuizCompletionError(page);

    // Intermediate lessons advance to the next lesson; the final lesson offers a dashboard continuation.
    if (lessonId !== lessonIds.at(-1)) {
      await expect(page.getByRole("link", { name: "Continue" })).toBeVisible();
      await page.getByRole("link", { name: "Continue" }).click();
    }
  }

  // The exact end-of-curriculum copy can vary, so accept any supported message that clearly communicates completion.
  await expect(
    page.getByText(
      /reviewed every|all caught up|no more lessons|completed all available|up to date|all lessons are done|finished all the lessons|reached the end|current with your learning path/i,
    ),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Continue" })).toHaveAttribute(
    "href",
    "/dashboard",
  );

  await expectNoQuizCompletionError(page);

  // Most importantly, confirm the final lesson was actually persisted as complete rather than merely rendering the end-state UI.
  expect(state.completedLessons).toEqual(
    expect.arrayContaining([{ moduleId, lessonId: "1.6" }]),
  );

  // Each lesson produces micro-lesson completion events, so there should be more completion calls than there are top-level lessons.
  expect(state.completedMicroLessons.length).toBeGreaterThan(lessonIds.length);
});
