const mongoose = require("mongoose");
const { XP_CAP } = require("../utils/coreRules");

const dailyXpTotalSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    day_start: {
      type: Date,
      required: true,
    },
    xp_total: {
      type: Number,
      min: 0,
      max: XP_CAP,
      default: 0,
      required: true,
    },
    last_awarded_xp: {
      type: Number,
      min: 0,
      max: XP_CAP,
      default: 0,
      required: true,
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  },
);

dailyXpTotalSchema.index({ user_id: 1, day_start: 1 }, { unique: true });

module.exports = mongoose.model("DailyXpTotal", dailyXpTotalSchema);
