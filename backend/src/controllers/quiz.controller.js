//retrieves user progress, quiz attempts, evaluates quiz process submitted quiz grades
//need to import mongoose models for database interactions  which is quizattempt and UserProgress

const EventEmitter = require("events");
const quizEvents = new EventEmitter();
//Event listeners for Quiz Cycle

const { calculateXpDelta } = require("../utils/coreRules");
const { updateUserStreak } = require("../services/streak.service");
const { awardEligibleBadges } = require("../services/badge.service");
const { getXpEarnedToday } = require("../services/xp.service");
const { awardXp } = require("../services/xpAward.service");

quizEvents.on("quiz_submit", ({ userId, microLessonId, score, attemptNumber }) => {
  console.log(
    `[Event: quiz_submit] User ${userId} submitted ${microLessonId} (Attempt #${attemptNumber}, Score: ${score}%)`,
  );
});
quizEvents.on("quiz_pass", ({ userId, microLessonId }) => {
  console.log(`[Event: quiz_pass] User ${userId} passed quiz ${microLessonId}`);
});
quizEvents.on("quiz_fail", ({ userId, microLessonId }) => {
  console.log(`[Event: quiz_fail] User ${userId} did not pass ${microLessonId}`);
});

const QuizAttempt = require("../models/QuizAttempt.model");
const UserProgress = require("../models/UserProgress.model");
const { invalidateDashboardCache } = require("./dashboard.controller");
const { getModule, getDefaultModule } = require("../utils/content");
const {
  quizStartSchema,
  quizCheckSchema,
  quizSubmissionParamsSchema,
  quizSubmissionSchema,
  validateRequest,
} = require("../validation/userValidation");

//Import Status codes library http-status-codes
const { StatusCodes } = require("http-status-codes");
const { getUserXpTotal } = require("../services/xp.service");

//Array comparison helper for single, multi-choice and multi-select questions
const arraysMatch = (arr1 = [], arr2 = []) => {
  const normal1 = Array.isArray(arr1) ? arr1 : [arr1];
  const normal2 = Array.isArray(arr2) ? arr2 : [arr2];
  if (normal1.length !== normal2.length) return false;

  const sorted1 = [...normal1].map(String).sort();
  const sorted2 = [...normal2].map(String).sort();
  return sorted1.every((val, idx) => val === sorted2[idx]);
};
//search inside modules => lessons ....knowledge check
const getQuestionsFromLesson = async (moduleId, microLessonId) => {
  const resolvedModuleId = moduleId || (await getDefaultModule())?.id;
  const moduleData = resolvedModuleId ? await getModule(resolvedModuleId) : null;
  if (!moduleData) return [];

  //search inside the modules to get the lessons and then inside lessons to get microlessons which then include the knowledgechecks
  for (const lesson of moduleData.lessons || []) {
    for (const micro of lesson.microLessons || []) {
      if (micro.id === microLessonId) {
        return (micro.microLessonContent || []).filter((item) => item.type === "knowledgeCheck");
      }
    }
  }
  return [];
};

// get all micro-lesson IDS that belong to a specific lesson ID
const getMicroLessonIdsForLesson = async (moduleId, lessonId) => {
  const resolvedModuleId = moduleId || (await getDefaultModule())?.id;
  const moduleData = resolvedModuleId ? await getModule(resolvedModuleId) : null;
  if (!moduleData) return [];
  const lesson = (moduleData.lessons || []).find((l) => l.id === lessonId);

  if (!lesson || !lesson.microLessons) return [];
  return lesson.microLessons.map((micro) => micro.id);
};

//GET /api/v1/quizzes/progress
exports.getUserProgress = async (req, res, next) => {
  try {
    const xpTotal = await getUserXpTotal(req.user.id);

    let progressRecord = await UserProgress.findOne({ user_id: req.user.id });
    if (!progressRecord) {
      const defaultModule = await getDefaultModule();
      if (!defaultModule) {
        return res.status(StatusCodes.OK).json({ module_id: null, xp: xpTotal });
      }
      progressRecord = await UserProgress.create({
        user_id: req.user.id,
        module_id: defaultModule.id,
      });
    }
    return res.status(StatusCodes.OK).json({
      ...progressRecord.toObject(),
      xp: xpTotal,
    });
  } catch (error) {
    return next(error);
  }
};

//Route: GET /api/v1/quizzes/attempts
//Function: fetches quiz attempt records linked to user's ID
//need to sort attempts based on results from newest to oldest

exports.getUserAttempts = async (req, res, next) => {
  try {
    let attempts = await QuizAttempt.find({ user_id: req.user.id }).sort({
      createdAt: -1,
    });
    return res.status(StatusCodes.OK).json(attempts);
  } catch (error) {
    return next(error);
  }
};

//Route: POST /api/v1/quizzes/start
exports.startQuiz = async (req, res, next) => {
  try {
    const requestBody = req.body ?? {};
    if (typeof requestBody.microLessonId === "undefined") {
      return res.status(StatusCodes.BAD_REQUEST).json({
        message: "microLessonId is required.",
      });
    }

    const validatedBody = validateRequest(res, quizStartSchema, req.body);
    if (!validatedBody) return;
    const { microLessonId, moduleId } = validatedBody;
    const userId = req.user.id;
    const lessonId = microLessonId.split(".").slice(0, 2).join(".");

    const latestAttempt = await QuizAttempt.findOne({
      user_id: userId,
      micro_lesson_id: microLessonId,
    }).sort({ createdAt: -1 });

    if (
      latestAttempt &&
      !latestAttempt.submitted_at &&
      Date.now() - new Date(latestAttempt.createdAt).getTime() < 5000
    ) {
      return res.status(StatusCodes.CONFLICT).json({
        message: "Please wait 5 seconds before submitting an answer again.",
      });
    }
    const previousCount = await QuizAttempt.countDocuments({
      user_id: userId,
      micro_lesson_id: microLessonId,
    });

    const attemptNumber = previousCount + 1;

    const newAttempt = await QuizAttempt.create({
      user_id: userId,
      module_id: moduleId,
      lesson_id: lessonId,
      micro_lesson_id: microLessonId,
      attempt_number: attemptNumber,
      started_at: new Date(),
    });
    return res.status(StatusCodes.CREATED).json({
      attemptId: newAttempt._id,
      attempt_number: newAttempt.attempt_number,
      micro_lesson_id: newAttempt.micro_lesson_id,
      started_at: newAttempt.started_at,
    });
  } catch (error) {
    return next(error);
  }
};

// Route: POST /api/v1/quizzes/check
// Supports immediate quiz feedback by returning the correct choices and explanation after a choice is submitted.
exports.checkAnswer = async (req, res, next) => {
  try {
    const validatedBody = validateRequest(res, quizCheckSchema, req.body);
    if (!validatedBody) return;

    const { moduleId, microLessonId, questionId, choiceIds } = validatedBody;
    const question = (await getQuestionsFromLesson(moduleId, microLessonId)).find(
      (item) => item.id === questionId,
    );

    if (!question) {
      return res.status(StatusCodes.NOT_FOUND).json({
        message: `Question '${questionId}' was not found in micro-lesson '${microLessonId}'.`,
      });
    }

    const correctChoiceIds = Array.isArray(question.correctResponse)
      ? question.correctResponse
      : [question.correctResponse];

    return res.status(StatusCodes.OK).json({
      isCorrect: arraysMatch(choiceIds, correctChoiceIds),
      correctChoiceIds,
      explanation: question.explanation,
    });
  } catch (error) {
    return next(error);
  }
};
// Route: POST /api/v1/quizzes/:id/submit
//Function: Submit quiz responses based on courseId, grades answers, logs the number of quiz attempts, updates lesson progress.

exports.submitQuiz = async (req, res, next) => {
  const xpRewards = [];
  let streakReward = null;
  let awardedBadges = [];
  try {
    const validatedParams = validateRequest(res, quizSubmissionParamsSchema, req.params);
    if (!validatedParams) return;
    const validatedBody = validateRequest(res, quizSubmissionSchema, req.body);
    if (!validatedBody) return;
    const microLessonId = validatedParams.id;
    const userId = req.user.id; //due to middleware from jwt
    const { attemptId, moduleId, answers } = validatedBody;

    //Prevent double-submission of answers by comparing attempt to any prior existing attempt
    //if there is a double answer submission, there is a 409 CONFLICT
    //get lesson id from micro_lesson_id
    const lessonId = microLessonId.split(".").slice(0, 2).join(".");
    // 1. Fetch previous attempt to calculate attempt_number and prevent instant duplicate double clicks
    const contentQuestions = await getQuestionsFromLesson(moduleId, microLessonId);
    if (!contentQuestions.length) {
      return res.status(StatusCodes.NOT_FOUND).json({
        message: `No quiz questions found for micro-lesson '${microLessonId}'.`,
      });
    }
    //Locate existing attempt record

    let attempt;
    if (attemptId) {
      attempt = await QuizAttempt.findOne({ _id: attemptId, user_id: userId });
    } else {
      attempt = await QuizAttempt.findOne({
        user_id: userId,
        micro_lesson_id: microLessonId,
        submitted_at: { $exists: false },
      }).sort({ createdAt: -1 });
    }
    if (!attempt) {
      return res.status(StatusCodes.NOT_FOUND).json({
        message: "No record of any quiz attempt. Please start Quiz. ",
      });
    }
    if (attempt.submitted_at) {
      return res.status(StatusCodes.CONFLICT).json({
        message: "Your attempt for the quiz has already been submitted.",
      });
    }

    // compare user answer choices and compare to correct answer choice, Figure out the percentage correct since we established that a passing score of 70 is needed to move onto the next question*/
    //Submit grades:
    let correctCount = 0;
    const missed = [];
    const reviews = [];
    const evaluatedAnswers = contentQuestions.map((q) => {
      const rawChoices = answers[q.id] || [];
      const userChoices = Array.isArray(rawChoices) ? rawChoices : [rawChoices];
      const correctAnswers = q.correctResponse || q.correctChoiceIds || [];

      const correctChoices = Array.isArray(correctAnswers) ? correctAnswers : [correctAnswers];

      const isCorrect = arraysMatch(userChoices, correctChoices);

      if (isCorrect) {
        correctCount++;
      } else {
        missed.push(q.id);
      }

      reviews.push({
        questionId: q.id,
        isCorrect,
        correctChoiceIds: correctChoices,
        explanation: q.explanation,
      });

      return {
        question_id: q.id,
        selected_choice_ids: userChoices,
        is_correct: isCorrect,
      };
    });

    const totalQuestions = contentQuestions.length || 1;
    const score = Math.round((correctCount / totalQuestions) * 100);
    const passThreshold = 70;
    const passed = score >= passThreshold;

    //Check if they've passed previously to award xp for only first pass
    const previousPass = await QuizAttempt.findOne({
      user_id: userId,
      micro_lesson_id: microLessonId,
      passed: true,
    });

    //Check if they've gotten a perfect score previously on this quiz
    const previousPerfect = await QuizAttempt.findOne({
      user_id: userId,
      micro_lesson_id: microLessonId,
      score: 100,
    });

    //Add xp for passing quiz

    //Calculate user's current xp total for the day to make sure they don't exceed the daily cap

    const currentTotal = await getXpEarnedToday(userId);

    const quizPassXp = calculateXpDelta({
      eventType: "quiz_pass",
      currentTotal,
      score,
      isFirstPass: passed && !previousPass,
    });

    //Add xp for first perfect score on each quiz
    const perfectXp = calculateXpDelta({
      eventType: "quiz_perfect",
      currentTotal: currentTotal + quizPassXp.amount,
      score,
      isPerfect: score === 100,
      isFirstPerfect: !previousPerfect,
    });

    //Emit events
    quizEvents.emit("quiz_submit", {
      userId,
      microLessonId,
      score,
      attemptNumber: attempt.attempt_number,
    });
    if (passed) {
      quizEvents.emit("quiz_pass", { userId, microLessonId });
    } else {
      quizEvents.emit("quiz_fail", { userId, microLessonId });
    }

    // UPdate and save existing attempt record
    attempt.submitted_at = new Date();
    attempt.score = score;
    attempt.passed = passed;
    attempt.pass_threshold = passThreshold;
    attempt.answers = evaluatedAnswers;
    await attempt.save();

    // save attempt record & update xp for passing quiz for first time
    if (passed) {
      //Checking if this microLesson is completed
      const existingProgress = await UserProgress.findOne({
        user_id: userId,
        module_id: moduleId,
      });

      const alreadyCompletedMicro =
        existingProgress?.completed_micro_lessons?.includes(microLessonId) || false;
      const alreadyCompletedLesson =
        existingProgress?.completed_lessons?.includes(lessonId) || Boolean(previousPass);

      const update = {
        $addToSet: {
          completed_micro_lessons: microLessonId,
        },
        // used by next action in dashboard to point Resume Course button to  user's latest lesson
        $set: {
          current_micro_lesson_id: microLessonId,
        },
      };

      let quizPassAwarded = 0;
      if (quizPassXp.amount > 0) {
        const award = await awardXp({
          userId,
          eventType: "quiz_pass",
          sourceKey: `quiz_pass:${microLessonId}`,
          requestedXp: quizPassXp.amount,
        });
        quizPassAwarded = award.duplicate ? 0 : (award.event?.awarded_xp ?? 0);
      }

      //increases UserProgress.xp
      if (quizPassAwarded > 0) {
        update.$inc = {
          xp: quizPassAwarded,
        };
      }

      //award xp to send to frontend for Toast notification
      if (quizPassAwarded > 0) {
        xpRewards.push({
          type: "quiz_pass",
          amount: quizPassAwarded,
        });
      }

      let perfectAwarded = 0;
      if (perfectXp.amount > 0) {
        const award = await awardXp({
          userId,
          eventType: "quiz_perfect",
          sourceKey: `quiz_perfect:${microLessonId}`,
          requestedXp: perfectXp.amount,
        });
        perfectAwarded = award.duplicate ? 0 : (award.event?.awarded_xp ?? 0);
      }

      //increases UserProgress.xp
      if (perfectAwarded > 0) {
        update.$inc = {
          ...(update.$inc || {}),
          xp: (update.$inc?.xp || 0) + perfectAwarded,
        };
      }

      if (perfectAwarded > 0) {
        xpRewards.push({
          type: "quiz_perfect",
          amount: perfectAwarded,
        });
      }

      const updatedProgress = await UserProgress.findOneAndUpdate(
        { user_id: userId, module_id: moduleId },
        update,
        { upsert: true, returnDocument: "after" },
      );
      if (!alreadyCompletedMicro) {
        streakReward = await updateUserStreak(userId);
      }
      awardedBadges = await awardEligibleBadges(userId);
      const allMicroLessonsIds = await getMicroLessonIdsForLesson(moduleId, lessonId);
      const userCompletedMicros = new Set(updatedProgress.completed_micro_lessons || []);
      const isLessonFullyCompleted =
        allMicroLessonsIds.length > 0 &&
        allMicroLessonsIds.every((id) => userCompletedMicros.has(id));
      const isFinalLessonQuiz = allMicroLessonsIds.at(-1) === microLessonId;

      // A passed final quiz completes the parent lesson even when the learner
      // reaches it with an incomplete earlier micro-lesson.
      if (isLessonFullyCompleted || isFinalLessonQuiz) {
        const lessonXp = calculateXpDelta({
          eventType: "lesson_complete",
          currentTotal: currentTotal + quizPassXp.amount + perfectXp.amount,
          isFirstTime: !alreadyCompletedLesson,
        });

        let lessonAwarded = 0;
        if (lessonXp.amount > 0) {
          const award = await awardXp({
            userId,
            eventType: "lesson_complete",
            sourceKey: `lesson_complete:${moduleId}:${lessonId}`,
            requestedXp: lessonXp.amount,
          });
          lessonAwarded = award.duplicate ? 0 : (award.event?.awarded_xp ?? 0);
        }

        await UserProgress.findOneAndUpdate(
          { user_id: userId, module_id: moduleId },
          {
            $addToSet: {
              completed_lessons: lessonId,
            },
            //increases UserProgress.xp
            ...(lessonAwarded > 0 ? { $inc: { xp: lessonAwarded } } : {}),
          },
        );

        //award xp for Toast notification to frontend for lesson completion
        if (lessonAwarded > 0) {
          xpRewards.push({
            type: "lesson_complete",
            amount: lessonAwarded,
          });
        }
      }
    }

    invalidateDashboardCache(userId);
    return res.status(StatusCodes.OK).json({
      score: attempt.score,
      passed: attempt.passed,
      attempt_number: attempt.attempt_number,
      missed,
      reviews,
      rewards: {
        xp: xpRewards,
        streak: streakReward,
        badges: awardedBadges,
      },
    });
  } catch (error) {
    return next(error);
  }
};
