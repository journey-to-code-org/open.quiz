const mongoose = require("mongoose");

const leaderboardHistorySchema = new mongoose.Schema(
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
      required: true,
    },
    rank: {
      type: Number,
      min: 1,
      required: true,
    },
    archived_at: {
      type: Date,
      default: Date.now,
      required: true,
    },
  },
  {
    timestamps: false,
  },
);

leaderboardHistorySchema.index({ user_id: 1, week_start: 1 }, { unique: true });
leaderboardHistorySchema.index({ week_start: -1, rank: 1 });

module.exports = mongoose.model("LeaderboardHistory", leaderboardHistorySchema);
