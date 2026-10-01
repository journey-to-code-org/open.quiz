//need to import mongoose
const mongoose = require("mongoose");

const pageTourSchema = new mongoose.Schema(
  {
    step: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["pending", "completed", "skipped"],
      default: "pending",
    },
    dismissed: { type: Boolean, default: false },
    completed_at: { type: Date, default: null },
  },
  { _id: false },
);

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Please fill in your name."],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password_hash: {
      // Optional because OAuth users (Google/GitHub) never set a local password.
      type: String,
      default: null,
    },
    google_id: {
      type: String,
      unique: true,
      sparse: true,
    },
    github_id: {
      type: String,
      unique: true,
      sparse: true,
    },
    email_verified_at: {
      type: Date,
      default: null,
    },
    verification_token: {
      type: String,
      default: null,
      select: false,
    },
    verification_token_expires_at: {
      type: Date,
      default: null,
    },
    password_reset_token: {
      type: String,
      default: null,
      select: false,
    },
    password_reset_expires_at: {
      type: Date,
      default: null,
    },
    role: {
      type: String,
      enum: ["learner", "admin"],
      default: "learner",
    },
    is_disabled: {
      type: Boolean,
      default: false,
    },
    disabled_at: {
      type: Date,
      default: null,
    },
    deleted_at: {
      type: Date,
      default: null,
    },
    deletion_scheduled_at: {
      type: Date,
      default: null,
    },
    tos_agreement: {
      type: Boolean,
      required: true,
    },
    tos_agreement_at: {
      type: Date,
      default: null,
    },
    onboarding: {
      is_completed: { type: Boolean, default: false },
      current_step: { type: Number, default: 0 },
      xp_awarded: { type: Boolean, default: false },
      started_at: {
        type: Date,
        default: null,
      },
      completed_at: { type: Date, default: null },
      tours: {
        dashboardPage: {
          type: pageTourSchema,
          default: () => ({ step: 0, dismissed: false }),
        },
        learningPath: {
          type: pageTourSchema,
          default: () => ({ step: 0, dismissed: false }),
        },
        lessonPage: {
          type: pageTourSchema,
          default: () => ({ step: 0, dismissed: false }),
        },
        profilePage: {
          type: pageTourSchema,
          default: () => ({ step: 0, dismissed: false }),
        },
      },
    },
    // additional updates for profile and user account features
    // revoke old JWT session and occurs with a change in passwords
    token_version: {
      type: Number,
      default: 0,
    },
    //profile//
    avatar_url: {
      type: String,
      default: null,
    },
    goals: {
      type: String,
      default: "",
    },
    notifications: {
      type: Boolean,
      default: true,
    },
    leaderboard_opt_in: {
      type: Boolean,
      default: false,
    },
    streak: {
      current: {
        type: Number,
        default: 0,
      },
      longest: {
        type: Number,
        default: 0,
      },
      active_learning_days: {
        type: Number,
        default: 0,
      },
      last_active_date: {
        type: Date,
        default: null,
      },
    },
    earned_badges: [
      { badge_id: { type: String, required: true }, awarded_at: { type: Date, default: Date.now } },
    ],
    timezone: { type: String, default: "UTC" },
    // Soft-deleted accounts
    is_deleted: {
      type: Boolean,
      default: false,
    },
    //archival status
    is_archived: { type: Boolean, default: false },
    archived_at: { type: Date, default: null },

    //admin verification for deletion
    deletion_status: {
      type: String,
      enum: ["none", "pending", "approved", "denied"],
      default: "none",
    },
    deletion_requested_at: {
      type: Date,
      default: null,
    },
    deletion_approved_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    reactivation_token: { type: String, select: false },
    reactivation_expires_at: { type: Date },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  },
);
//auto middleware: excludes archived/deleted users from normal search queries. hides the users marked is_archived. $ne: true in MongoDB means not equal to : true
userSchema.pre(/^find/, function () {
  const queryFilter = this.getFilter();
  const multipleExclusionConditions = {};

  if (queryFilter.is_archived === undefined) {
    multipleExclusionConditions.is_archived = { $ne: true };
  }
  if (queryFilter.is_deleted === undefined) {
    multipleExclusionConditions.is_deleted = { $ne: true };
  }
  if (Object.keys(multipleExclusionConditions).length > 0) {
    this.find(multipleExclusionConditions);
  }
});
userSchema.index({ deletion_status: 1 });
userSchema.index({ reactivation_token: 1 });

const User = mongoose.model("User", userSchema);

module.exports = User;
