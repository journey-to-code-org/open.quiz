const XpEvent = require("../models/XpEvent.model");
const WeeklyLeaderboard = require("../models/WeeklyLeaderboard.model");
const { getLeaderboardWeek } = require("../utils/leaderboardTime");

async function rollupLeaderboardWeek({ date = new Date(), session } = {}) {
  const { weekStart, weekEnd } = getLeaderboardWeek(date);
  const rolledUpAt = new Date();
  const totals = await XpEvent.aggregate([
    { $match: { week_start: weekStart } },
    { $group: { _id: "$user_id", xpTotal: { $sum: "$awarded_xp" } } },
  ]).session(session ?? null);

  if (totals.length > 0) {
    await WeeklyLeaderboard.bulkWrite(
      totals.map(({ _id: userId, xpTotal }) => ({
        updateOne: {
          filter: { user_id: userId, week_start: weekStart },
          update: {
            $set: {
              week_end: weekEnd,
              xp_total: xpTotal,
              last_aggregated_at: rolledUpAt,
            },
          },
          upsert: true,
        },
      })),
      { ordered: false, ...(session ? { session } : {}) },
    );
  }

  return {
    weekStart,
    weekEnd,
    learnersProcessed: totals.length,
    xpProcessed: totals.reduce((sum, total) => sum + total.xpTotal, 0),
    rolledUpAt,
  };
}

module.exports = { rollupLeaderboardWeek };
