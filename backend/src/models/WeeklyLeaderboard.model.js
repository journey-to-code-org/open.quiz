const mongoose = require("mongoose");

const weeklyLeaderboardSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    week_start: {
      type: Date,
      required: true,
    },
    week_end: {
      type: Date,
      required: true,
    },
    xp_total: {
      type: Number,
      min: 0,
      default: 0,
      required: true,
    },
    last_aggregated_at: {
      type: Date,
      default: Date.now,
      required: true,
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  },
);

weeklyLeaderboardSchema.index({ user_id: 1, week_start: 1 }, { unique: true });
weeklyLeaderboardSchema.index({ week_start: 1, xp_total: -1, user_id: 1 });

module.exports = mongoose.model("WeeklyLeaderboard", weeklyLeaderboardSchema);
