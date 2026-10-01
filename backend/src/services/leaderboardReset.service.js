const mongoose = require("mongoose");
const LeaderboardHistory = require("../models/LeaderboardHistory.model");
const User = require("../models/User.model");
const WeeklyLeaderboard = require("../models/WeeklyLeaderboard.model");
const { getLeaderboardWeek } = require("../utils/leaderboardTime");
const weeklyLeaderboardService = require("./weeklyLeaderboard.service");

function getPreviousLeaderboardWeek(date = new Date()) {
  const currentWeek = getLeaderboardWeek(date);
  return getLeaderboardWeek(new Date(currentWeek.weekStart.getTime() - 1));
}

function cannotUseTransactions(error) {
  return (
    (error?.code === 20 && error?.codeName === "IllegalOperation") ||
    error?.message?.includes(
      "Transaction numbers are only allowed on a replica set member or mongos",
    )
  );
}

async function rotateWeek({ weekStart, weekEnd, archivedAt, session }) {
  const sessionOptions = session ? { session } : {};
  await weeklyLeaderboardService.rollupLeaderboardWeek({ date: weekStart, ...sessionOptions });

  const aggregation = WeeklyLeaderboard.aggregate([
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
    { $project: { _id: 0, user_id: 1, xp_total: 1, rank: 1 } },
  ]);
  const rankedLearners = await (session ? aggregation.session(session) : aggregation);

  if (rankedLearners.length > 0) {
    await LeaderboardHistory.bulkWrite(
      rankedLearners.map((learner) => ({
        updateOne: {
          filter: { user_id: learner.user_id, week_start: weekStart },
          update: {
            $set: {
              week_end: weekEnd,
              xp_total: learner.xp_total,
              rank: learner.rank,
              archived_at: archivedAt,
            },
          },
          upsert: true,
        },
      })),
      { ordered: false, ...sessionOptions },
    );
  }

  await WeeklyLeaderboard.deleteMany({ week_start: weekStart }, sessionOptions);
  return rankedLearners.length;
}

async function rotatePreviousLeaderboardWeek({ date = new Date() } = {}) {
  const { weekStart, weekEnd } = getPreviousLeaderboardWeek(date);
  const archivedAt = new Date();
  const session = await mongoose.startSession();
  let learnersArchived = 0;

  try {
    try {
      await session.withTransaction(async () => {
        learnersArchived = await rotateWeek({ weekStart, weekEnd, archivedAt, session });
      });
    } catch (error) {
      if (!cannotUseTransactions(error)) throw error;
      learnersArchived = await rotateWeek({ weekStart, weekEnd, archivedAt });
    }
  } finally {
    await session.endSession();
  }

  return { weekStart, weekEnd, learnersArchived, archivedAt };
}

module.exports = { getPreviousLeaderboardWeek, rotatePreviousLeaderboardWeek };
