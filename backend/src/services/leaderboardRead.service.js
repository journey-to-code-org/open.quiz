const mongoose = require("mongoose");
const User = require("../models/User.model");
const WeeklyLeaderboard = require("../models/WeeklyLeaderboard.model");
const { getLeaderboardWeek } = require("../utils/leaderboardTime");
const weeklyLeaderboardService = require("./weeklyLeaderboard.service");

const DEFAULT_LEADERBOARD_LIMIT = 20;
const MAX_LEADERBOARD_LIMIT = 100;

function normalizeLimit(limit) {
  if (!Number.isInteger(limit) || limit < 1) return DEFAULT_LEADERBOARD_LIMIT;
  return Math.min(limit, MAX_LEADERBOARD_LIMIT);
}

async function getLeaderboardForUser({
  userId,
  date = new Date(),
  limit = DEFAULT_LEADERBOARD_LIMIT,
}) {
  if (!mongoose.isValidObjectId(userId)) throw new TypeError("A valid user ID is required.");

  const currentUserId = new mongoose.Types.ObjectId(userId);
  const currentUser = await User.findById(currentUserId).select("leaderboard_opt_in").lean();

  if (!currentUser) {
    const error = new Error("User not found.");
    error.code = "USER_NOT_FOUND";
    throw error;
  }

  const { weekStart, weekEnd } = getLeaderboardWeek(date);
  if (!currentUser.leaderboard_opt_in) {
    return {
      optedIn: false,
      weekStart,
      weekEnd,
      entries: [],
      currentUser: null,
    };
  }

  await weeklyLeaderboardService.rollupLeaderboardWeek({ date });

  const entryLimit = normalizeLimit(limit);
  const [leaderboard = { entries: [], currentUser: [] }] = await WeeklyLeaderboard.aggregate([
    { $match: { week_start: weekStart } },
    {
      $lookup: {
        from: User.collection.name,
        localField: "user_id",
        foreignField: "_id",
        as: "user",
      },
    },
    { $unwind: "$user" },
    {
      $match: {
        "user.leaderboard_opt_in": true,
        "user.is_disabled": { $ne: true },
        "user.is_deleted": { $ne: true },
        "user.is_archived": { $ne: true },
      },
    },
    {
      $setWindowFields: {
        sortBy: { xp_total: -1 },
        output: { rank: { $rank: {} } },
      },
    },
    { $sort: { xp_total: -1, user_id: 1 } },
    {
      $project: {
        _id: 0,
        isCurrentUser: { $eq: ["$user_id", currentUserId] },
        displayName: "$user.name",
        avatarUrl: "$user.avatar_url",
        weeklyXp: "$xp_total",
        rank: 1,
      },
    },
    {
      $facet: {
        entries: [{ $limit: entryLimit }],
        currentUser: [{ $match: { isCurrentUser: true } }, { $limit: 1 }],
      },
    },
  ]);

  return {
    optedIn: true,
    weekStart,
    weekEnd,
    entries: leaderboard.entries,
    currentUser: leaderboard.currentUser[0] ?? null,
  };
}

module.exports = {
  DEFAULT_LEADERBOARD_LIMIT,
  MAX_LEADERBOARD_LIMIT,
  getLeaderboardForUser,
  normalizeLimit,
};
