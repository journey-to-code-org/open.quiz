const mongoose = require("mongoose");
const { XP_CAP } = require("../utils/coreRules");
const { getLeaderboardWeek } = require("../utils/leaderboardTime");

const XP_EVENT_TYPES = ["onboarding_complete", "lesson_complete", "quiz_pass", "quiz_perfect"];

function getUtcDayStart(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

const xpEventSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    event_type: {
      type: String,
      required: true,
      enum: XP_EVENT_TYPES,
    },
    source_key: {
      type: String,
      required: true,
      trim: true,
    },
    requested_xp: {
      type: Number,
      required: true,
      min: 0,
      max: XP_CAP,
    },
    awarded_xp: {
      type: Number,
      required: true,
      min: 0,
      max: XP_CAP,
    },
    occurred_at: {
      type: Date,
      default: Date.now,
      required: true,
    },
    day_start: {
      type: Date,
      required: true,
    },
    week_start: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  },
);

xpEventSchema.pre("validate", function setTimeBuckets() {
  const occurredAt =
    this.occurred_at instanceof Date ? this.occurred_at : new Date(this.occurred_at);
  if (!Number.isNaN(occurredAt.getTime())) {
    this.occurred_at = occurredAt;
    this.day_start = getUtcDayStart(occurredAt);
    this.week_start = getLeaderboardWeek(occurredAt).weekStart;
  }
});

xpEventSchema.index({ user_id: 1, source_key: 1 }, { unique: true });
xpEventSchema.index({ user_id: 1, day_start: 1 });
xpEventSchema.index({ week_start: 1, user_id: 1 });
xpEventSchema.index({ created_at: -1 });

const XpEvent = mongoose.model("XpEvent", xpEventSchema);

module.exports = XpEvent;
module.exports.XP_EVENT_TYPES = XP_EVENT_TYPES;
