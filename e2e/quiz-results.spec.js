import { expect, test } from "./fixtures/network.js";

const lessonUrl = "/learn/quiz-results/1.1?sample=true";

const lessonPayload = {
  moduleData: {
    id: "quiz-results",
    title: "Quiz Results Test Module",
    lessons: [{ id: "1.1" }],
  },
  lessonData: {
    id: "1.1",
    title: "Quiz Results Test Lesson",
    learningGoal: "Check quiz results.",
    passingScore: 70,
    microLessons: [
      {
        id: "1.1.1",
        title: "Quiz check",
        microLessonContent: [
          { type: "paragraph", text: "Answer both questions." },
          {
            type: "knowledgeCheck",
            id: "q1",
            question: "Which answer passes?",
            answerChoices: [
              { key: "a", text: "The correct answer" },
              { key: "b", text: "A distractor" },
            ],
            correctResponse: "a",
          },
          {
            type: "knowledgeCheck",
            id: "q2",
            question: "Which answer is also correct?",
            answerChoices: [
              { key: "a", text: "Another correct answer" },
              { key: "b", text: "Another distractor" },
            ],
            correctResponse: "a",
          },
        ],
      },
    ],
  },
  progress: null,
};

async function mockQuizLesson(page) {
  await page.route("**/api/v1/lessons/public/quiz-results/1.1", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(lessonPayload),
    }),
  );

  await page.route("**/api/v1/quizzes/check", async (route) => {
    const { questionId, choiceIds } = route.request().postDataJSON();
    const correctChoiceIds = ["a"];
    const isCorrect =
      choiceIds.length === correctChoiceIds.length &&
      choiceIds[0] === correctChoiceIds[0];

    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        isCorrect,
        correctChoiceIds,
        explanation: `Feedback for ${questionId}`,
      }),
    });
  });
}

async function completeQuiz(page, choices) {
  await page.goto(lessonUrl);
  await expect(
    page.getByRole("heading", { name: "Quiz Results Test Lesson" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Quick check" }).click();

  for (const [index, choice] of choices.entries()) {
    await page.getByRole("radio", { name: choice }).click();
    await page.getByRole("button", { name: "Check answer" }).click();
    await expect(
      page.getByRole("img", {
        name:
          choice === "The correct answer" || choice === "Another correct answer"
            ? "Correct answer"
            : "Incorrect answer",
      }),
    ).toBeVisible();

    await page
      .getByRole("button", {
        name: index === choices.length - 1 ? "View results" : "Continue",
      })
      .click();
  }
}

test("a passing quiz shows a pass and never reports a failure", async ({
  page,
}) => {
  await mockQuizLesson(page);
  await completeQuiz(page, ["The correct answer", "Another correct answer"]);

  await expect(page.getByText("Score: 100% — Pass")).toBeVisible();
  await expect(page.getByText(/Score: .*Fail/)).not.toBeVisible();
});

test("a failing quiz shows a failure and never reports a pass", async ({
  page,
}) => {
  await mockQuizLesson(page);
  await completeQuiz(page, ["A distractor", "Another distractor"]);

  await expect(page.getByText("Score: 0% — Fail")).toBeVisible();
  await expect(page.getByText(/Score: .*Pass/)).not.toBeVisible();
});
