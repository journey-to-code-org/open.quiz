const mongoose = require("mongoose");
const DailyXpTotal = require("../models/DailyXpTotal.model");
const UserProgress = require("../models/UserProgress.model");

const getUserXpTotal = async (userId) => {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return 0;
  }

  const result = await UserProgress.aggregate([
    {
      $match: {
        user_id: new mongoose.Types.ObjectId(userId),
      },
    },
    {
      $group: {
        _id: null,
        totalXp: {
          $sum: "$xp",
        },
      },
    },
  ]);

  return result[0]?.totalXp || 0;
};

async function getXpEarnedToday(userId) {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return 0;
  }

  const now = new Date();
  const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const dailyTotal = await DailyXpTotal.findOne({
    user_id: new mongoose.Types.ObjectId(userId),
    day_start: dayStart,
  }).select("xp_total");

  return dailyTotal?.xp_total ?? 0;
}

module.exports = { getUserXpTotal, getXpEarnedToday };
