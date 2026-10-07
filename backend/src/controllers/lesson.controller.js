const { StatusCodes } = require("http-status-codes");
const UserProgress = require("../models/UserProgress.model");
const LessonModule = require("../models/LessonModule.model");
const QuizAttempt = require("../models/QuizAttempt.model");
const { invalidateDashboardCache } = require("./dashboard.controller");
const {
  getModule,
  getDefaultModule,
  getLesson,
  sanitizeLessonData,
  sanitizeModuleData,
  clearModuleCache,
} = require("../utils/content");
const {
  lessonProgressSchema,
  lessonCompletionSchema,
  lessonImportSchema,
  validateRequest,
} = require("../validation/userValidation");
const { updateUserStreak } = require("../services/streak.service");
const { awardEligibleBadges } = require("../services/badge.service");
const { getCurrentLessonId, isLessonAccessible } = require("../utils/learningPath");

// Shape a UserProgress document into the fields the frontend needs to render the learning path.
function shapeProgress(progressRecord) {
  return {
    currentModule: progressRecord.module_id,
    currentLessonId: progressRecord.course_lesson_id,
    currentMicroLessonId: progressRecord.current_micro_lesson_id,
    currentChunkIndex: progressRecord.current_chunk_index,
    completedLessons: progressRecord.completed_lessons,
    completedMicroLessons: progressRecord.completed_micro_lessons,
    isModuleCompleted: progressRecord.is_module_completed,
  };
}

async function reconcileFinalQuizCompletions(userId, moduleData, progressRecord) {
  const finalQuizMicroLessonIds = (moduleData.lessons || [])
    .map((lesson) => lesson.microLessons?.at(-1))
    .filter((microLesson) =>
      microLesson?.microLessonContent?.some((item) => item.type === "knowledgeCheck"),
    )
    .map((microLesson) => microLesson.id);

  if (finalQuizMicroLessonIds.length === 0) return progressRecord;

  const passedFinalQuizzes = await QuizAttempt.find({
    user_id: userId,
    module_id: moduleData.id,
    micro_lesson_id: { $in: finalQuizMicroLessonIds },
    passed: true,
    submitted_at: { $ne: null },
  }).select("micro_lesson_id");
  const passedFinalQuizIds = new Set(passedFinalQuizzes.map((attempt) => attempt.micro_lesson_id));
  const completedLessons = (moduleData.lessons || [])
    .filter((lesson) => passedFinalQuizIds.has(lesson.microLessons?.at(-1)?.id))
    .map((lesson) => lesson.id);

  if (completedLessons.length === 0) return progressRecord;

  return UserProgress.findOneAndUpdate(
    { _id: progressRecord._id },
    { $addToSet: { completed_lessons: { $each: completedLessons } } },
    { returnDocument: "after" },
  );
}

exports.getLessonModules = async (req, res, next) => {
  try {
    // Only fetch the fields needed for the module picker / learning path.
    // `lean()` returns plain objects since these records are only being read.
    const modules = await LessonModule.find({}).select("id title lessons").sort({ id: 1 }).lean();

    return res.status(StatusCodes.OK).json({
      modules: modules.map(({ id, title, lessons }) => ({
        id,
        title,
        firstLessonId: lessons?.[0]?.id ?? null,
      })),
    });
  } catch (error) {
    return next(error);
  }
};

exports.getPublicLessonModules = async (_req, res, next) => {
  try {
    const modules = await LessonModule.find({}).select("id title lessons").sort({ id: 1 }).lean();

    return res.status(StatusCodes.OK).json({
      modules: modules.map(({ id, title, lessons }) => ({
        id,
        title,
        firstLessonId: lessons?.[0]?.id ?? null,
      })),
    });
  } catch (error) {
    return next(error);
  }
};

// GET /api/v1/lessons/last
// Returns the path to the learner's most recently touched, currently-unlocked lesson.
exports.getLastLesson = async (req, res, next) => {
  try {
    const progressRecord = await UserProgress.findOne({
      user_id: req.user.id,
    })
      .sort({ updated_at: -1 })
      .lean();

    // A brand-new learner has no progress yet, so fall back to the
    // first lesson in the default module instead of returning a dead end.
    if (!progressRecord) {
      const firstModule = await getDefaultModule();
      const firstLessonId = firstModule?.lessons?.[0]?.id;

      return res.status(StatusCodes.OK).json({
        lastLessonPath:
          firstModule && firstLessonId ? `/learn/${firstModule.id}/${firstLessonId}` : null,
      });
    }

    // Resolve the most appropriate lesson from saved progress rather than
    // blindly trusting the stored lesson ID, which may now be stale or locked.
    const moduleData = await getModule(progressRecord.module_id);
    const lessonId = getCurrentLessonId(moduleData, progressRecord);

    return res.status(StatusCodes.OK).json({
      lastLessonPath: lessonId ? `/learn/${progressRecord.module_id}/${lessonId}` : null,
    });
  } catch (error) {
    return next(error);
  }
};

// GET /api/v1/lessons/:moduleId/:lessonId
// Returns the module + lesson content along with the caller's progress, without mutating it.
exports.getLesson = async (req, res, next) => {
  try {
    const { moduleId, lessonId } = req.params;

    const moduleData = await getModule(moduleId);
    if (!moduleData) {
      return res.status(StatusCodes.NOT_FOUND).json({
        message: `Module '${moduleId}' was not found.`,
      });
    }

    const lessonData = await getLesson(moduleId, lessonId);
    if (!lessonData) {
      return res.status(StatusCodes.NOT_FOUND).json({
        message: `Lesson '${lessonId}' was not found in module '${moduleId}'.`,
      });
    }

    const progressRecord = await UserProgress.findOne({
      user_id: req.user.id,
      module_id: moduleId,
    });

    // Enforce learning-path progression on the backend as well as the UI
    // so a learner cannot skip locked lessons by typing the URL directly.
    if (!isLessonAccessible(moduleData, progressRecord, lessonId)) {
      return res.status(StatusCodes.FORBIDDEN).json({
        message: "Complete the previous lesson to unlock this one.",
      });
    }

    // Strip answer keys and other protected content before sending lesson
    // data to the browser.
    return res.status(StatusCodes.OK).json({
      moduleData: sanitizeModuleData(moduleData),
      lessonData: sanitizeLessonData(lessonData),
      progress: progressRecord ? shapeProgress(progressRecord) : null,
    });
  } catch (error) {
    return next(error);
  }
};

// GET /api/v1/lessons/public/:moduleId/:lessonId
// Returns sanitized lesson content for signed-out previews without reading user progress.
exports.getPublicLesson = async (req, res, next) => {
  try {
    const { moduleId, lessonId } = req.params;

    const moduleData = await getModule(moduleId);
    if (!moduleData) {
      return res.status(StatusCodes.NOT_FOUND).json({
        message: `Module '${moduleId}' was not found.`,
      });
    }

    const lessonData = await getLesson(moduleId, lessonId);
    if (!lessonData) {
      return res.status(StatusCodes.NOT_FOUND).json({
        message: `Lesson '${lessonId}' was not found in module '${moduleId}'.`,
      });
    }

    return res.status(StatusCodes.OK).json({
      moduleData: sanitizeModuleData(moduleData),
      lessonData: sanitizeLessonData(lessonData),
    });
  } catch (error) {
    return next(error);
  }
};

// GET /api/v1/lessons/progress?moduleId=cashFlow
// Returns progress only, so the learning path can render without loading lesson content.
exports.getLessonProgress = async (req, res, next) => {
  try {
    const moduleId = req.query.moduleId;

    if (!moduleId) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        message: "A moduleId is required to load lesson progress.",
      });
    }

    if (!(await getModule(moduleId))) {
      return res.status(StatusCodes.NOT_FOUND).json({
        message: `Module '${moduleId}' was not found.`,
      });
    }

    let progressRecord = await UserProgress.findOne({
      user_id: req.user.id,
      module_id: moduleId,
    });

    // Reading progress also initializes a record for first-time learners,
    // giving later progress updates a consistent document to work with.
    if (!progressRecord) {
      progressRecord = await UserProgress.create({
        user_id: req.user.id,
        module_id: moduleId,
      });
    }

    const moduleData = await getModule(moduleId);
    progressRecord = await reconcileFinalQuizCompletions(req.user.id, moduleData, progressRecord);

    return res.status(StatusCodes.OK).json(shapeProgress(progressRecord));
  } catch (error) {
    return next(error);
  }
};

// POST /api/v1/lessons/complete
exports.completeMicroLesson = async (req, res, next) => {
  try {
    const { moduleId: requestedModuleId, microLessonId } = req.body ?? {};
    const moduleId = requestedModuleId || (await getDefaultModule())?.id;

    if (
      typeof moduleId !== "string" ||
      typeof microLessonId !== "string" ||
      !microLessonId.trim()
    ) {
      return res
        .status(StatusCodes.BAD_REQUEST)
        .json({ message: "A moduleId and microLessonId are required." });
    }

    const moduleData = await getModule(moduleId);

    // Micro-lessons are nested under lessons, so flatten the module before
    // locating the requested micro-lesson by ID.
    const micro = moduleData?.lessons
      ?.flatMap((lesson) => lesson.microLessons || [])
      .find((item) => item.id === microLessonId);

    if (!micro) {
      return res.status(StatusCodes.NOT_FOUND).json({ message: "Micro-lesson not found." });
    }

    // Quiz-bearing micro-lessons cannot be marked complete until the learner
    // has a submitted passing attempt recorded by the backend.
    if (micro.microLessonContent?.some((item) => item.type === "knowledgeCheck")) {
      const passedAttempt = await QuizAttempt.exists({
        user_id: req.user.id,
        module_id: moduleId,
        micro_lesson_id: microLessonId,
        passed: true,
        submitted_at: { $ne: null },
      });

      if (!passedAttempt) {
        return res.status(StatusCodes.CONFLICT).json({
          message: "Pass every knowledge check before completing this micro-lesson.",
        });
      }
    }

    const progress = await UserProgress.findOne({
      user_id: req.user.id,
      module_id: moduleId,
    });

    // Track whether this is genuinely a first completion so repeated requests
    // do not extend the learner's streak more than once.
    const alreadyCompleted = progress?.completed_micro_lessons?.includes(microLessonId) || false;

    const updatedProgress = await UserProgress.findOneAndUpdate(
      {
        user_id: req.user.id,
        module_id: moduleId,
      },
      {
        // `$addToSet` makes completion idempotent: retries will not create
        // duplicate micro-lesson IDs in the progress document.
        $addToSet: {
          completed_micro_lessons: microLessonId,
        },
        $set: {
          current_micro_lesson_id: microLessonId,
        },
      },
      {
        upsert: true,
        returnDocument: "after",
      },
    );

    let streakAward = null;

    // Only a first-time completion should advance the streak.
    if (!alreadyCompleted) {
      streakAward = await updateUserStreak(req.user.id);
    }

    const awardedBadges = await awardEligibleBadges(req.user.id);

    invalidateDashboardCache(req.user.id);

    return res.status(StatusCodes.OK).json({
      progress: shapeProgress(updatedProgress),
      rewards: {
        streak: streakAward,
        badges: awardedBadges,
      },
    });
  } catch (error) {
    return next(error);
  }
};

// PATCH /api/v1/lessons/progress
// Body: { moduleId, lessonId, microLessonId, currentChunkIndex }
// Saves the caller's current position so it can be resumed later. Completion state is untouched.
exports.updateLessonProgress = async (req, res, next) => {
  try {
    const { lessonId, microLessonId } = req.body ?? {};

    if (!lessonId && !microLessonId) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        message: "lessonId or microLessonId is required.",
      });
    }

    const validatedBody = validateRequest(res, lessonProgressSchema, req.body);

    if (!validatedBody) return;

    const moduleId = validatedBody.moduleId ?? (await getDefaultModule())?.id;
    const {
      lessonId: validatedLessonId,
      microLessonId: validatedMicroLessonId,
      currentChunkIndex,
    } = validatedBody;

    if (!moduleId) {
      return res
        .status(StatusCodes.NOT_FOUND)
        .json({ message: "No lesson modules are available." });
    }

    if (!(await getModule(moduleId))) {
      return res.status(StatusCodes.NOT_FOUND).json({
        message: `Module '${moduleId}' was not found.`,
      });
    }

    // Build the update dynamically so callers can save only the portion
    // of their position that actually changed.
    const update = {};

    if (validatedLessonId) {
      update.course_lesson_id = validatedLessonId;
    }

    if (validatedMicroLessonId) {
      update.current_micro_lesson_id = validatedMicroLessonId;
    }

    if (typeof currentChunkIndex === "number") {
      update.current_chunk_index = currentChunkIndex;
    }

    if (typeof currentChunkIndex === "number") {
      update.current_chunk_index = currentChunkIndex;
    }

    const progressRecord = await UserProgress.findOneAndUpdate(
      {
        user_id: req.user.id,
        module_id: moduleId,
      },
      {
        $set: update,
      },
      {
        upsert: true,
        returnDocument: "after",
        setDefaultsOnInsert: true,
      },
    );

    invalidateDashboardCache(req.user.id);

    return res.status(StatusCodes.OK).json(shapeProgress(progressRecord));
  } catch (error) {
    return next(error);
  }
};

exports.completeLesson = async (req, res, next) => {
  try {
    const validatedBody = validateRequest(res, lessonCompletionSchema, req.body);

    if (!validatedBody) return;

    const { moduleId, lessonId } = validatedBody;
    const moduleData = await getModule(moduleId);

    if (!moduleData) {
      return res.status(StatusCodes.NOT_FOUND).json({
        message: `Module '${moduleId}' was not found.`,
      });
    }

    const lesson = (moduleData.lessons || []).find((item) => item.id === lessonId);

    if (!lesson) {
      return res.status(StatusCodes.NOT_FOUND).json({
        message: `Lesson '${lessonId}' was not found in module '${moduleId}'.`,
      });
    }

    const microLessonIds = (lesson.microLessons || []).map((microLesson) => microLesson.id);

    // Only micro-lessons containing knowledge checks participate in the
    // lesson-level quiz completion gate.
    const quizMicroLessonIds = (lesson.microLessons || [])
      .filter((microLesson) =>
        microLesson.microLessonContent?.some((item) => item.type === "knowledgeCheck"),
      )
      .map((microLesson) => microLesson.id);

    if (quizMicroLessonIds.length > 0) {
      // Load every submitted attempt so retries can be considered when
      // determining the learner's best result for each quiz.
      const submittedAttempts = await QuizAttempt.find({
        user_id: req.user.id,
        module_id: moduleId,
        lesson_id: lessonId,
        micro_lesson_id: {
          $in: quizMicroLessonIds,
        },
        submitted_at: {
          $ne: null,
        },
      }).select("micro_lesson_id score passed answers");

      // A learner may retry a quiz. Keep only the highest-scoring submitted
      // attempt for each quiz micro-lesson.
      const bestAttempts = new Map();

      for (const attempt of submittedAttempts) {
        const currentBest = bestAttempts.get(attempt.micro_lesson_id);

        if (!currentBest || attempt.score > currentBest.score) {
          bestAttempts.set(attempt.micro_lesson_id, attempt);
        }
      }

      // Count questions across every quiz in the lesson. This lets the final
      // lesson score be weighted by number of questions instead of averaging
      // quiz percentages equally.
      const quizQuestions = (lesson.microLessons || [])
        .filter((microLesson) => quizMicroLessonIds.includes(microLesson.id))
        .flatMap((microLesson) =>
          (microLesson.microLessonContent || []).filter((item) => item.type === "knowledgeCheck"),
        );

      const totalQuestions = quizQuestions.length;

      // Count correct answers from each quiz's best attempt.
      const correctAnswers = [...bestAttempts.values()].reduce((total, attempt) => {
        if (attempt.answers?.length > 0) {
          return total + attempt.answers.filter((answer) => answer.is_correct).length;
        }

        // Older attempts may only have the passed flag. Preserve their
        // previously recorded full-credit result during migration.
        return (
          total +
          (attempt.passed
            ? quizQuestions.filter((question) =>
                question.id.startsWith(`${attempt.micro_lesson_id}-`),
              ).length
            : 0)
        );
      }, 0);

      // Example: 2/3 on one quiz + 3/3 on another = 5/6 = 83%.
      // `passingScore` is stored as a percentage, so normalize it to 0–1.
      const aggregateScore = totalQuestions ? correctAnswers / totalQuestions : 0;

      const passThreshold = (lesson.passingScore ?? 70) / 100;

      // Require both:
      // 1. at least one submitted attempt for every quiz micro-lesson, and
      // 2. an aggregate question-weighted score that meets the lesson threshold.
      if (bestAttempts.size < quizMicroLessonIds.length || aggregateScore < passThreshold) {
        return res.status(StatusCodes.CONFLICT).json({
          message: "Pass every knowledge check before completing this lesson.",
        });
      }
    }

    // Finishing a lesson leaves the saved resume position at the end of
    // that lesson while resetting its chunk position.
    const positionUpdate = {
      course_lesson_id: lessonId,
      current_chunk_index: 0,
    };

    if (microLessonIds.length > 0) {
      positionUpdate.current_micro_lesson_id = microLessonIds[microLessonIds.length - 1];
    }

    // Mark the lesson and all of its micro-lessons complete in one atomic
    // progress update. `$addToSet` keeps retries idempotent.
    const progressUpdate = {
      $set: positionUpdate,
      $addToSet: {
        completed_lessons: lessonId,
      },
    };

    if (microLessonIds.length > 0) {
      progressUpdate.$addToSet.completed_micro_lessons = {
        $each: microLessonIds,
      };
    }

    const progressRecord = await UserProgress.findOneAndUpdate(
      {
        user_id: req.user.id,
        module_id: moduleId,
      },
      progressUpdate,
      {
        upsert: true,
        returnDocument: "after",
        setDefaultsOnInsert: true,
      },
    );

    // Recalculate module completion from the source module definition so
    // adding/removing lessons does not rely on a stale completion count.
    const completedLessonIds = new Set(progressRecord.completed_lessons || []);

    const isModuleCompleted =
      moduleData.lessons.length > 0 &&
      moduleData.lessons.every((moduleLesson) => completedLessonIds.has(moduleLesson.id));

    if (progressRecord.is_module_completed !== isModuleCompleted) {
      progressRecord.is_module_completed = isModuleCompleted;
      await progressRecord.save();
    }

    invalidateDashboardCache(req.user.id);

    return res.status(StatusCodes.OK).json(shapeProgress(progressRecord));
  } catch (error) {
    return next(error);
  }
};

// Restart the learner's saved position at the beginning of the selected module.
// This resets position only; it does not erase completion history.
exports.restartLessonProgress = async (req, res, next) => {
  try {
    const moduleId = req.body?.moduleId || (await getDefaultModule())?.id;
    if (!moduleId) {
      return res
        .status(StatusCodes.NOT_FOUND)
        .json({ message: "No lesson modules are available." });
    }

    const moduleData = await getModule(moduleId);

    if (!moduleData) {
      return res.status(StatusCodes.NOT_FOUND).json({
        message: `Module ${moduleId} was not found.`,
      });
    }

    // Restart from the first lesson and its first micro-lesson.
    const firstLesson = moduleData.lessons?.[0];
    const firstMicroLesson = firstLesson?.microLessons?.[0];

    const progressRecord = await UserProgress.findOneAndUpdate(
      {
        user_id: req.user.id,
        module_id: moduleId,
      },
      {
        $set: {
          course_lesson_id: firstLesson.id,
          current_micro_lesson_id: firstMicroLesson.id,
          current_chunk_index: 0,
        },
      },
      {
        upsert: true,
        returnDocument: "after",
        setDefaultsOnInsert: true,
      },
    );

    return res.status(StatusCodes.OK).json(shapeProgress(progressRecord));
  } catch (error) {
    return next(error);
  }
};

// POST /api/v1/lessons/import
// Upserts a complete lesson module from a trusted operator request.
exports.importLessonModule = async (req, res, next) => {
  try {
    // Support either a parsed JSON request body or a multipart-uploaded
    // JSON file. Uploaded file content takes precedence when present.
    let importBody = req.body;

    if (req.file) {
      if (!req.file.originalname.toLowerCase().endsWith(".json")) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          message: "Lesson imports must be .json files.",
        });
      }

      try {
        // Multer keeps the uploaded file in memory, so decode the buffer
        // before validating it against the lesson module schema.
        importBody = JSON.parse(req.file.buffer.toString("utf8"));
      } catch {
        return res.status(StatusCodes.BAD_REQUEST).json({
          message: "Uploaded lesson file contains invalid JSON.",
        });
      }
    }

    const validatedBody = validateRequest(res, lessonImportSchema, importBody);

    if (!validatedBody) return;

    // Import behaves like "create or replace by module ID", allowing admins
    // to update an existing curriculum module with the same endpoint.
    const lessonModule = await LessonModule.findOneAndUpdate(
      {
        id: validatedBody.id,
      },
      validatedBody,
      {
        upsert: true,
        returnDocument: "after",
        setDefaultsOnInsert: true,
      },
    ).lean();

    // getModule() is cached, so invalidate this module immediately or the app
    // could continue serving the pre-import curriculum until the cache expires.
    clearModuleCache(validatedBody.id);

    return res.status(StatusCodes.OK).json(lessonModule);
  } catch (error) {
    return next(error);
  }
};
