import { expect } from "./network.js";

export const lessonIds = ["1.1", "1.2", "1.3", "1.4", "1.5", "1.6"];
export const moduleId = "openQuizIntroduction";
export const quizCompletionError =
  "Pass every knowledge check before completing this lesson.";

export const quizQuestions = [
  { id: "1.1.2-q1", prompt: "First quiz question", correctChoice: "a" },
  { id: "1.1.2-q2", prompt: "Second quiz question", correctChoice: "a" },
  { id: "1.1.2-q3", prompt: "Third quiz question", correctChoice: "a" },
];

export const secondQuizQuestions = [
  { id: "1.1.4-q1", prompt: "Fourth quiz question", correctChoice: "a" },
  { id: "1.1.4-q2", prompt: "Fifth quiz question", correctChoice: "a" },
  { id: "1.1.4-q3", prompt: "Sixth quiz question", correctChoice: "a" },
];

// Allows the mocked /check endpoint to look up the expected answer
// regardless of which knowledge check the question belongs to.
const firstLessonQuestions = new Map(
  [...quizQuestions, ...secondQuizQuestions].map((question) => [
    question.id,
    question,
  ]),
);

const wait = (ms) =>
  ms > 0
    ? new Promise((resolve) => setTimeout(resolve, ms))
    : Promise.resolve();

function buildMicroLesson(id, title, questions = []) {
  return {
    id,
    title,
    microLessonContent: [
      { type: "paragraph", text: `${title} content.` },
      ...questions.map((question) => ({
        type: "knowledgeCheck",
        id: question.id,
        question: question.prompt,
        questionType: "multipleChoice",
        answerChoices: [
          { key: "a", text: "Correct answer" },
          { key: "b", text: "Distractor" },
        ],
        correctResponse: question.correctChoice,
        explanation: "Answer feedback.",
      })),
    ],
  };
}

function buildCurriculum() {
  return {
    id: moduleId,
    title: "Welcome to open.quiz",
    lessons: lessonIds.map((lessonId, index) => ({
      id: lessonId,
      title: `Lesson ${lessonId}`,
      learningGoal: `Learn the goals of lesson ${lessonId}.`,
      passingScore: 70,

      // Only lesson 1.1 needs quizzes for this regression test.
      // The remaining lessons just need enough content to exercise
      // normal lesson completion and navigation.
      microLessons:
        index === 0
          ? [
              buildMicroLesson("1.1.2", "First quiz", quizQuestions),
              buildMicroLesson("1.1.4", "Second quiz", secondQuizQuestions),
            ]
          : [buildMicroLesson(`${lessonId}.1`, `Lesson ${lessonId} step`)],
    })),
  };
}

/**
 * Per-endpoint artificial latency, in milliseconds, applied before the mocked
 * response is fulfilled. Used to reproduce slow-network races locally.
 */
export const NO_DELAYS = {
  profile: 0,
  dashboard: 0,
  onboarding: 0,
  lessonDetail: 0,
  lessonComplete: 0,
  microLessonComplete: 0,
  quizStart: 0,
  quizCheck: 0,
  quizSubmit: 0,
  lessonProgress: 0,
};

export async function prepareCurriculumSession(page, delays = {}) {
  const latency = { ...NO_DELAYS, ...delays };
  const curriculum = buildCurriculum();

  // These arrays act as spies for mocked API calls so the test can verify
  // what the frontend actually submitted during the full curriculum flow.
  const submittedQuizzes = [];
  const completedLessons = [];
  const completedMicroLessons = [];
  const lessonDetailRequests = [];

  // Seed auth before the app loads so ProtectedRoute sees an authenticated
  // learner immediately instead of redirecting to login during hydration.
  await page.addInitScript(() => {
    window.sessionStorage.setItem(
      "openquiz.auth",
      JSON.stringify({
        user: {
          id: "curriculum-learner",
          name: "Curriculum Learner",
          email: "curriculum@example.com",
        },
        csrfToken: "test-csrf-token",
      }),
    );
  });

  await page.route("**/api/v1/profile", async (route) => {
    await wait(latency.profile);
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        user: {
          id: "curriculum-learner",
          name: "Curriculum Learner",
          email: "curriculum@example.com",
        },
      }),
    });
  });

  await page.route("**/api/v1/dashboard", async (route) => {
    await wait(latency.dashboard);
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ progress: { overallPercent: 0 } }),
    });
  });

  // Mark onboarding complete so the test reaches the learning experience
  // without being redirected into the onboarding flow.
  await page.route("**/api/v1/onboarding", async (route) => {
    await wait(latency.onboarding);
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ onboarding: { is_completed: true } }),
    });
  });

  await page.route("**/api/v1/lessons/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (request.method() === "GET") {
      // Lesson detail requests end with the lesson ID:
      // /api/v1/lessons/openQuizIntroduction/1.1 -> "1.1"
      const lessonId = url.pathname.split("/").pop();
      const lessonData = curriculum.lessons.find(
        (lesson) => lesson.id === lessonId,
      );

      lessonDetailRequests.push(lessonId);
      await wait(latency.lessonDetail);
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          moduleData: curriculum,
          lessonData,
          progress: null,
        }),
      });
      return;
    }

    if (
      request.method() === "POST" &&
      url.pathname.endsWith("/progress/complete")
    ) {
      const body = request.postDataJSON();

      if (body.lessonId === "1.1") {
        const aggregateScore =
          submittedQuizzes.reduce((total, quiz) => total + quiz.score, 0) /
          submittedQuizzes.length;
        if (submittedQuizzes.length < 2 || aggregateScore < 70) {
          await wait(latency.lessonComplete);
          await route.fulfill({
            status: 409,
            contentType: "application/json",
            body: JSON.stringify({ message: quizCompletionError }),
          });
          return;
        }
      }

      // Capture lesson completion requests for assertions at the end.
      completedLessons.push(body);

      await wait(latency.lessonComplete);
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ completedLessons: [body.lessonId] }),
      });
      return;
    }

    if (request.method() === "POST" && url.pathname.endsWith("/complete")) {
      const body = request.postDataJSON();

      // This endpoint represents individual micro-lesson completion,
      // rather than completion of the entire lesson.
      completedMicroLessons.push(body);

      await wait(latency.microLessonComplete);
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ rewards: [] }),
      });
      return;
    }

    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({}),
    });
  });

  await page.route("**/api/v1/quizzes/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (request.method() === "POST" && url.pathname.endsWith("/check")) {
      const { questionId, choiceIds } = request.postDataJSON();
      const question = firstLessonQuestions.get(questionId);

      // Knowledge checks are single-choice, so an answer only counts as
      // correct when exactly one choice was submitted and it matches.
      const isCorrect =
        choiceIds.length === 1 && choiceIds[0] === question.correctChoice;

      await wait(latency.quizCheck);
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          isCorrect,
          correctChoiceIds: [question.correctChoice],
          explanation: "Answer feedback.",
        }),
      });
      return;
    }

    if (request.method() === "POST" && url.pathname.endsWith("/start")) {
      await wait(latency.quizStart);
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ attemptId: "test-attempt" }),
      });
      return;
    }

    if (request.method() === "POST" && url.pathname.includes("/submit")) {
      const body = request.postDataJSON();

      // Both mocked quizzes use the same attempt ID, so identify which quiz
      // is being submitted by checking whether its answers contain the
      // first question from quiz 1.
      const questions =
        body.attemptId === "test-attempt" && body.answers["1.1.2-q1"]
          ? quizQuestions
          : secondQuizQuestions;

      const correctCount = questions.filter((question) => {
        const choices = body.answers[question.id] ?? [];
        return choices.length === 1 && choices[0] === question.correctChoice;
      }).length;

      const score = Math.round((correctCount / questions.length) * 100);

      // For a URL ending in /<microLessonId>/submit, the second-to-last segment identifies which quiz produced this score.
      submittedQuizzes.push({
        microLessonId: url.pathname.split("/").slice(-2)[0],
        score,
        passed: score >= 70,
      });

      await wait(latency.quizSubmit);
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          score,
          passed: score >= 70,
          missed: [],
          reviews: [],
        }),
      });
      return;
    }

    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({}),
    });
  });

  await page.route("**/api/v1/lessons/progress", async (route) => {
    await wait(latency.lessonProgress);
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({}),
    });
  });

  return {
    submittedQuizzes,
    completedLessons,
    completedMicroLessons,
    lessonDetailRequests,
  };
}

export async function answerQuiz(page, choices, finalQuestion) {
  for (const [index, choice] of choices.entries()) {
    await page.getByRole("radio", { name: choice }).click();
    await page.getByRole("button", { name: "Check answer" }).click();

    // The last question of the final quiz transitions to results.
    // Every other answered question advances with "Continue".
    const nextButtonName =
      index === choices.length - 1 && finalQuestion
        ? "View results"
        : "Continue";

    await expect(
      page.getByRole("button", { name: nextButtonName }),
    ).toBeVisible();

    await page.getByRole("button", { name: nextButtonName }).click();
  }
}

export async function expectNoQuizCompletionError(page) {
  await expect(
    page.getByText(quizCompletionError, { exact: true }),
  ).not.toBeVisible();
}
