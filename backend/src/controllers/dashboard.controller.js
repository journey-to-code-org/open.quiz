const { StatusCodes } = require("http-status-codes");
const User = require("../models/User.model");
const UserProgress = require("../models/UserProgress.model");
const QuizAttempt = require("../models/QuizAttempt.model");
const LessonModule = require("../models/LessonModule.model");
const { buildLearningPath, pickCurrentNode } = require("../utils/learningPath");
const { getLearningMotivation } = require("../utils/learningStats");
const { dashboardEventSchema, validateRequest } = require("../validation/userValidation");
const { getUserXpTotal } = require("../services/xp.service");
const { getDisplayStreak } = require("../utils/streaks");

function invalidateDashboardCache() {}

function getModuleLessons(module) {
  return module?.lessons || [];
}

function findLesson(module, lessonId) {
  return getModuleLessons(module).find((lesson) => lesson.id === lessonId);
}

function findMicroLesson(module, lessonId, microLessonId) {
  return findLesson(module, lessonId)?.microLessons?.find((micro) => micro.id === microLessonId);
}

function buildUnit(module, progressRecord) {
  const lessons = getModuleLessons(module);
  const completedLessonIds = new Set(progressRecord?.completed_lessons || []);
  const completedMicroLessonIds = new Set(progressRecord?.completed_micro_lessons || []);
  const isModuleComplete = Boolean(progressRecord?.is_module_completed);
  const completedLessons = lessons.filter(
    (lesson) =>
      isModuleComplete ||
      completedLessonIds.has(lesson.id) ||
      (lesson.microLessons?.length > 0 &&
        lesson.microLessons.every((microLesson) => completedMicroLessonIds.has(microLesson.id))),
  ).length;

  return {
    id: module.id,
    name: module.title,
    completedLessons,
    totalLessons: lessons.length,
    totalMicroLessons: lessons.reduce(
      (total, lesson) => total + (lesson.microLessons?.length || 0),
      0,
    ),
    progressPercent: lessons.length ? Math.round((completedLessons / lessons.length) * 100) : 0,
  };
}

function buildOverallProgress(units) {
  const totalLessons = units.reduce((sum, unit) => sum + unit.totalLessons, 0);
  const completedLessons = units.reduce((sum, unit) => sum + unit.completedLessons, 0);

  return {
    completedLessons,
    totalLessons,
    overallPercent: totalLessons ? Math.round((completedLessons / totalLessons) * 100) : 0,
  };
}

function getNextAction(modules, progressByModule, units) {
  for (const module of modules) {
    const progressRecord = progressByModule.get(module.id);
    const currentNode = pickCurrentNode(buildLearningPath(module), progressRecord);
    if (!currentNode || currentNode.isModuleComplete) continue;

    const lesson = findLesson(module, currentNode.lessonId);
    if (!lesson) continue;
    const unit = units.find((item) => item.id === module.id);
    const hasStarted =
      unit?.completedLessons > 0 || (progressRecord?.completed_micro_lessons?.length || 0) > 0;

    return {
      title: lesson.title,
      description: hasStarted
        ? "Pick up where you left off."
        : "Ready to start? Begin with this lesson.",
      ctaLabel: hasStarted ? `Continue ${lesson.title}` : `Start ${lesson.title}`,
      href: `/learn/${module.id}/${lesson.id}`,
    };
  }

  return {
    title: modules.length ? "Review Quiz" : "Content coming soon",
    description: modules.length
      ? "Great work. Review a quiz to reinforce what you learned."
      : "New lessons are being prepared. Check back soon.",
    ctaLabel: modules.length ? "Review a Quiz" : "View learning path",
    href: "/learn",
  };
}

function getHero(user, units, nextAction, motivation) {
  const totalLessons = units.reduce((sum, unit) => sum + unit.totalLessons, 0);
  const completedLessons = units.reduce((sum, unit) => sum + unit.completedLessons, 0);
  const isNewUser = completedLessons === 0;
  const isAllCaughtUp = totalLessons > 0 && completedLessons >= totalLessons;
  let state = "in_progress";
  let greeting = `Welcome back, ${user.name || "Learner"}`;
  let statusText = "Nice pace. Your next lesson is ready when you are.";

  if (isNewUser) {
    state = "new_user";
    greeting = `Welcome, ${user.name}`;
    statusText = "Start with one short lesson and get your first win today.";
  } else if (isAllCaughtUp) {
    state = "all_caught_up";
    greeting = `You're caught up, ${user.name}`;
    statusText = "Great work finishing every lesson. A quick review can keep the habit warm.";
  }

  return {
    state,
    displayName: user.name || "Learner",
    greeting,
    statusText,
    streak: {
      ...motivation.streak,
      currentDays: Math.max(motivation.streak.currentDays, getDisplayStreak(user.streak)),
      longestDays: user.streak?.longest ?? 0,
      activeLearningDays: user.streak?.active_learning_days ?? 0,
    },
    dailyGoal: motivation.dailyGoal,
    primaryAction: { label: nextAction.ctaLabel, href: nextAction.href },
  };
}

async function reconcileProgressFromPassedAttempts(userId, modules) {
  const moduleIds = modules.map((module) => module.id);
  const passedAttempts = await QuizAttempt.find({
    user_id: userId,
    module_id: { $in: moduleIds },
    passed: true,
    submitted_at: { $ne: null },
  }).select("module_id lesson_id micro_lesson_id");

  const passedMicrosByModule = new Map();
  for (const attempt of passedAttempts) {
    const microLessonIds = passedMicrosByModule.get(attempt.module_id) || [];
    microLessonIds.push(attempt.micro_lesson_id);
    passedMicrosByModule.set(attempt.module_id, microLessonIds);
  }

  await Promise.all(
    [...passedMicrosByModule].map(async ([moduleId, microLessonIds]) => {
      const module = modules.find((item) => item.id === moduleId);
      const completedLessons = getModuleLessons(module)
        .filter((lesson) => {
          const finalMicroLesson = lesson.microLessons?.at(-1);
          return (
            finalMicroLesson?.microLessonContent?.some((item) => item.type === "knowledgeCheck") &&
            microLessonIds.includes(finalMicroLesson.id)
          );
        })
        .map((lesson) => lesson.id);

      await UserProgress.findOneAndUpdate(
        { user_id: userId, module_id: moduleId },
        {
          $addToSet: {
            completed_micro_lessons: { $each: microLessonIds },
            completed_lessons: { $each: completedLessons },
          },
        },
        { upsert: true },
      );
    }),
  );
}

async function getRecentActivity(userId, modulesById) {
  const attempts = await QuizAttempt.find({
    user_id: userId,
    submitted_at: { $ne: null },
  })
    .sort({ submitted_at: -1 })
    .limit(5);

  return attempts.map((attempt) => {
    const microLesson = findMicroLesson(
      modulesById.get(attempt.module_id),
      attempt.lesson_id,
      attempt.micro_lesson_id,
    );
    const prefix = attempt.passed ? "Passed quiz" : "Attempted quiz";
    return {
      id: String(attempt._id),
      label: `${prefix}: ${microLesson?.title || attempt.micro_lesson_id} (${attempt.score}%)`,
      timeLabel: new Date(attempt.submitted_at).toLocaleString(),
    };
  });
}

exports.getDashboard = async (req, res, next) => {
  try {
    const userId = String(req.user.id);

    const user = await User.findById(userId).select("name streak timezone earned_badges");
    if (!user) {
      return res.status(StatusCodes.NOT_FOUND).json({ message: "User not found." });
    }
    const xpTotal = await getUserXpTotal(userId);

    const databaseModules = await LessonModule.find({}).lean();
    const modules = databaseModules;
    const moduleIds = modules.map((module) => module.id);
    await reconcileProgressFromPassedAttempts(userId, modules);
    const progressRecords = await UserProgress.find({
      user_id: userId,
      module_id: { $in: moduleIds },
    });
    const progressByModule = new Map(progressRecords.map((record) => [record.module_id, record]));
    const units = modules.map((module) => buildUnit(module, progressByModule.get(module.id)));
    const progress = buildOverallProgress(units);
    const nextAction = getNextAction(modules, progressByModule, units);
    const [motivation, recentActivity] = await Promise.all([
      getLearningMotivation(userId),
      getRecentActivity(userId, new Map(modules.map((module) => [module.id, module]))),
    ]);
    const payload = {
      hero: getHero(user, units, nextAction, motivation),
      progress,
      nextAction,
      xp: {
        total: xpTotal,
      },
      badges: user.earned_badges || [],
      units,
      recentActivity,
      meta: {
        generatedAt: new Date().toISOString(),
      },
    };
    return res.set("Cache-Control", "no-store").status(StatusCodes.OK).json(payload);
  } catch (error) {
    return next(error);
  }
};

exports.trackDashboardEvent = async (req, res, next) => {
  try {
    const validatedBody = validateRequest(res, dashboardEventSchema, req.body);
    if (!validatedBody) return;
    invalidateDashboardCache(req.user.id);
    return res.status(StatusCodes.ACCEPTED).json({ message: "Dashboard event processed." });
  } catch (error) {
    return next(error);
  }
};

exports.invalidateDashboardCache = invalidateDashboardCache;
