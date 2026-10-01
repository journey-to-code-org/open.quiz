const { beforeEach, describe, expect, it } = require("@jest/globals");

jest.mock("../src/models/User.model.js", () => ({ findById: jest.fn() }));
jest.mock("../src/models/UserProgress.model.js", () => ({ findOneAndUpdate: jest.fn() }));
jest.mock("../src/services/xpAward.service.js", () => ({ awardXp: jest.fn() }));
jest.mock("../src/utils/content.js", () => ({
  getDefaultModule: jest.fn().mockResolvedValue({ id: "example-module" }),
}));

const User = require("../src/models/User.model.js");
const UserProgress = require("../src/models/UserProgress.model.js");
const { awardXp } = require("../src/services/xpAward.service.js");
const { updateOnboardingProgress } = require("../src/controllers/onboarding.controller.js");

function completedOnboardingUser() {
  const completedTour = { step: 1, status: "completed", dismissed: false };
  return {
    onboarding: {
      is_completed: false,
      started_at: new Date(),
      tours: {
        dashboardPage: { ...completedTour },
        profilePage: { ...completedTour },
        lessonPage: { ...completedTour },
        learningPath: { ...completedTour },
      },
    },
    markModified: jest.fn(),
    save: jest.fn(),
  };
}

function responseDouble() {
  const res = { json: jest.fn() };
  res.status = jest.fn(() => res);
  return res;
}

describe("onboarding XP", () => {
  beforeEach(() => jest.clearAllMocks());

  it("persists the capped amount returned by the XP award service", async () => {
    User.findById.mockResolvedValue(completedOnboardingUser());
    awardXp.mockResolvedValue({
      duplicate: false,
      event: { awarded_xp: 10 },
    });
    UserProgress.findOneAndUpdate.mockResolvedValue({ xp: 10 });
    const res = responseDouble();

    await updateOnboardingProgress(
      { user: { id: "507f1f77bcf86cd799439011" }, body: { markAllComplete: true } },
      res,
      jest.fn(),
    );

    expect(awardXp).toHaveBeenCalledWith({
      userId: "507f1f77bcf86cd799439011",
      eventType: "onboarding_complete",
      sourceKey: "onboarding:v1",
      requestedXp: 50,
    });
    expect(UserProgress.findOneAndUpdate).toHaveBeenCalledWith(
      { user_id: "507f1f77bcf86cd799439011", module_id: "example-module" },
      { $inc: { xp: 10 } },
      { upsert: true, returnDocument: "after" },
    );
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ xpAwarded: 10 }));
  });

  it("does not increment progress or claim XP for a duplicate reward", async () => {
    User.findById.mockResolvedValue(completedOnboardingUser());
    awardXp.mockResolvedValue({
      duplicate: true,
      event: { awarded_xp: 50 },
    });
    const res = responseDouble();

    await updateOnboardingProgress(
      { user: { id: "507f1f77bcf86cd799439011" }, body: { markAllComplete: true } },
      res,
      jest.fn(),
    );

    expect(UserProgress.findOneAndUpdate).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ xpAwarded: 0 }));
  });
});
