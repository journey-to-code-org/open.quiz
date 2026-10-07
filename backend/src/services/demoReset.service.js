const AdminBootstrap = require("../models/AdminBootstrap.model");
const ContentAsset = require("../models/ContentAsset.model");
const LessonModule = require("../models/LessonModule.model");
const OpenQuizPackage = require("../models/OpenQuizPackage.model");
const ThemeConfiguration = require("../models/ThemeConfiguration.model");
const DailyXpTotal = require("../models/DailyXpTotal.model");
const LeaderboardHistory = require("../models/LeaderboardHistory.model");
const QuizAttempt = require("../models/QuizAttempt.model");
const User = require("../models/User.model");
const UserProgress = require("../models/UserProgress.model");
const WeeklyLeaderboard = require("../models/WeeklyLeaderboard.model");
const XpEvent = require("../models/XpEvent.model");
const { clearCache } = require("../utils/content");
const { ensureInstructionalContent } = require("./bundledContent.service");
const { ensureBundledThemes } = require("./bundledThemes.service");

// Accounts and the learner data that belongs to them.
const DEMO_RESET_MODELS = {
  users: User,
  adminBootstrap: AdminBootstrap,
  userProgress: UserProgress,
  quizAttempts: QuizAttempt,
  xpEvents: XpEvent,
  dailyXpTotals: DailyXpTotal,
  weeklyLeaderboards: WeeklyLeaderboard,
  leaderboardHistory: LeaderboardHistory,
};

// Site content that demo admins can edit; restored to what a fresh installation provides.
const DEMO_CONTENT_MODELS = {
  lessonModules: LessonModule,
  packages: OpenQuizPackage,
  contentAssets: ContentAsset,
  siteSettings: ThemeConfiguration,
};

/** Removes every account and its learner data so the next demo visitor starts fresh. */
const resetDemoUsers = async () => {
  const deleted = {};
  for (const [name, Model] of Object.entries(DEMO_RESET_MODELS)) {
    const result = await Model.deleteMany({});
    deleted[name] = result.deletedCount ?? 0;
  }
  return deleted;
};

/**
 * Restores lessons, themes, packages, assets, and site settings to a fresh installation:
 * default branding, the bundled Learning Garden and Sprout themes (inactive), and the
 * Welcome to open.quiz lessons.
 */
const resetDemoContent = async () => {
  const deleted = {};
  for (const [name, Model] of Object.entries(DEMO_CONTENT_MODELS)) {
    const result = await Model.deleteMany({});
    deleted[name] = result.deletedCount ?? 0;
  }
  await ensureBundledThemes();
  await ensureInstructionalContent();
  clearCache();
  return deleted;
};

/** Returns the demo to a fresh installation: no accounts and the bundled starter content. */
const resetDemoSite = async () => ({
  ...(await resetDemoUsers()),
  ...(await resetDemoContent()),
});

module.exports = {
  DEMO_CONTENT_MODELS,
  DEMO_RESET_MODELS,
  resetDemoContent,
  resetDemoSite,
  resetDemoUsers,
};
