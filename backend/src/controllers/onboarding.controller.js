const { StatusCodes } = require("http-status-codes");
const { updateOnboardingProgressSchema } = require("../validation/userValidation.js");
const User = require("../models/User.model.js");
const UserProgress = require("../models/UserProgress.model.js");
const { getDefaultModule } = require("../utils/content");

const { calculateXpDelta } = require("../utils/coreRules");
const { awardXp } = require("../services/xpAward.service");
const { invalidateDashboardCache } = require("./dashboard.controller");

const TOUR_KEYS = ["dashboardPage", "profilePage", "lessonPage", "learningPath"];

const createDefaultTours = () =>
  TOUR_KEYS.reduce((acc, key) => {
    acc[key] = { step: 0, status: "pending", dismissed: false };
    return acc;
  }, {});
const beginOnboarding = async (req, res, next) => {
  try {
    const defaultTours = createDefaultTours();
    return res.status(StatusCodes.OK).json({ success: true, tours: defaultTours });
  } catch (error) {
    return next(error);
  }
};

//POST /api/v1/onboarding/toggle

const toggleOnboardingWorkflow = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { enabled } = req.body;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(StatusCodes.NOT_FOUND).json({ message: "User not found." });
    }
    if (!user.onboarding) {
      user.onboarding = {};
    }
    //Re-enable onboarding: reset global status and indiv tours
    if (enabled) {
      user.onboarding = {
        is_completed: false,
        xp_awarded: user.onboarding.xp_awarded ?? false,
        current_step: 0,
        started_at: new Date(),
        completed_at: null,
        tours: createDefaultTours(),
      };
    } else {
      //disable onboarding: mark completed and dismiss all tours
      user.onboarding.is_completed = true;
      user.onboarding.completed_at = new Date();

      if (!user.onboarding.tours) {
        user.onboarding.tours = {};
      }
      TOUR_KEYS.forEach((key) => {
        user.onboarding.tours[key] = {
          step: user.onboarding.tours[key]?.step || 0,
          status: "skipped",
          dismissed: true,
        };
      });
    }
    //update mongo database object fields have changed
    user.markModified("onboarding");
    await user.save();
    invalidateDashboardCache(userId);

    return res.status(StatusCodes.OK).json({
      success: true,
      message: `Onboarding workflow ${enabled ? "enabled" : "disabled"} successfully.`,
      onboarding: user.onboarding,
    });
  } catch (error) {
    return next(error);
  }
};
//GET /api/v1/onboarding
const getOnboardingState = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId).select("onboarding");
    if (!user) {
      return res.status(StatusCodes.NOT_FOUND).json({ message: "User not found." });
    }
    return res.status(StatusCodes.OK).json({
      success: true,
      onboarding: user.onboarding,
    });
  } catch (err) {
    return next(err);
  }
};

//PATCH /api/v1/onboarding/step (receives updates from frontend when a user moves to next step or new step or dismisses a tour or completes all tours)

const updateOnboardingProgress = async (req, res, next) => {
  try {
    if (updateOnboardingProgressSchema) {
      const { error, value } = updateOnboardingProgressSchema.validate(req.body, {
        abortEarly: false,
      });
      if (error) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          message: "Validation error",
          errors: error.details.map((detail) => detail.message),
        });
      }
      req.body = value;
    }
    const userId = req.user.id;
    const { tourKey, step, status, dismissed, markAllComplete } = req.body;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(StatusCodes.NOT_FOUND).json({ message: "No user found." });
    }
    if (!user.onboarding) {
      user.onboarding = { is_completed: false, current_step: 0, tours: {} };
    }
    if (!user.onboarding.started_at) {
      user.onboarding.started_at = new Date();
    }

    let xpAwarded = 0;

    //Specific tour updates
    if (tourKey) {
      if (!TOUR_KEYS.includes(tourKey)) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          message: `No tourKey found. Need to include one of ${TOUR_KEYS.join(",")}`,
        });
      }
      if (!user.onboarding.tours) {
        user.onboarding.tours = createDefaultTours();
      }

      const currentTour = user.onboarding.tours[tourKey] || {
        step: 0,
        status: "pending",
        dismissed: false,
      };
      const getStepStatus = status || (dismissed ? "skipped" : currentTour.status || "pending");

      if (typeof step === "number") {
        currentTour.step = step;
        user.onboarding.current_step = step; //sync with database in case user needs to resume
      }
      currentTour.status = getStepStatus;
      currentTour.dismissed = getStepStatus == "skipped" || dismissed === true;

      if (getStepStatus === "completed") {
        currentTour.completed_at = new Date();
      }

      user.onboarding.tours[tourKey] = currentTour;
    }
    const tours = user.onboarding.tours || {};
    const totalToursDecided = TOUR_KEYS.every(
      (key) => tours[key] && ["completed", "skipped"].includes(tours[key].status),
    );
    //Award XP on first time step completion so no prior completions count
    const noSkippedTours = TOUR_KEYS.every((key) => tours[key]?.status === "completed");
    const allDismissed = TOUR_KEYS.every(
      (key) => tours[key]?.status === "skipped" || tours[key]?.dismissed === true,
    );
    if ((markAllComplete || totalToursDecided) && !user.onboarding.is_completed) {
      user.onboarding.is_completed = true;
      user.onboarding.completed_at = new Date();
      //points awards for full complete onboarding with zero skipping

      if (noSkippedTours && !user.onboarding.xp_awarded) {
        const requestedXp = calculateXpDelta({
          eventType: "onboarding_complete",
          isFirstTime: true,
        }).amount;
        const award = await awardXp({
          userId,
          eventType: "onboarding_complete",
          sourceKey: "onboarding:v1",
          requestedXp,
        });
        xpAwarded = award.duplicate ? 0 : (award.event?.awarded_xp ?? 0);
        if (!award.duplicate) {
          user.onboarding.xp_awarded = true;
          if (xpAwarded > 0) {
            const defaultModule = await getDefaultModule();
            if (defaultModule) {
              await UserProgress.findOneAndUpdate(
                { user_id: userId, module_id: defaultModule.id },
                { $inc: { xp: xpAwarded } },
                { upsert: true, returnDocument: "after" },
              );
            }
          }
        }
      }
    }
    user.markModified("onboarding");
    await user.save();
    invalidateDashboardCache(userId);
    return res.status(StatusCodes.OK).json({
      success: true,
      message:
        xpAwarded > 0
          ? `You completed the tour. You earned ${xpAwarded} XP.`
          : "Onboarding progress has been updated.",
      xpAwarded,
      rewards: {
        xp: xpAwarded > 0 ? [{ type: "onboarding_complete", amount: xpAwarded }] : [],
        badges: [],
        streak: null,
      },
      onboarding: user.onboarding,
      statistics: {
        allCompleted: noSkippedTours,
        allDismissed: allDismissed,
      },
    });
  } catch (err) {
    return next(err);
  }
};

const resetOnboardingProgress = async (req, res, next) => {
  try {
    //get user id from jwt
    const userId = req.user.id;
    //get user id from mongoDb
    const user = await User.findById(userId);
    //edge case if no user
    if (!user) {
      return res.status(StatusCodes.NOT_FOUND).json({ message: "User not found." });
    }
    //reset onboarding subdocument
    user.onboarding = {
      is_completed: false,
      xp_awarded: user.onboarding?.xp_awarded ?? false,
      started_at: null,
      completed_at: null,
      tours: createDefaultTours(),
    };
    user.markModified("onboarding");
    //save the user infor in the database
    await user.save();
    invalidateDashboardCache(userId);
    return res.status(StatusCodes.OK).json({
      success: true,
      message: "Onboarding tour was reset successfully.",
      onboarding: user.onboarding,
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  beginOnboarding,
  toggleOnboardingWorkflow,
  getOnboardingState,
  updateOnboardingProgress,
  resetOnboardingProgress,
};
