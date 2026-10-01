const mongoose = require("mongoose");
const DailyXpTotal = require("../src/models/DailyXpTotal.model");
const UserProgress = require("../src/models/UserProgress.model");
const { getUserXpTotal, getXpEarnedToday } = require("../src/services/xp.service");

jest.mock("../src/models/DailyXpTotal.model");
jest.mock("../src/models/UserProgress.model");

describe("getUserXpTotal", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("sums XP from every UserProgress record for a user", async () => {
    const userId = new mongoose.Types.ObjectId();
    UserProgress.aggregate.mockResolvedValue([{ totalXp: 75 }]);

    await expect(getUserXpTotal(userId)).resolves.toBe(75);
    expect(UserProgress.aggregate).toHaveBeenCalledWith([
      {
        $match: {
          user_id: userId,
        },
      },
      {
        $group: {
          _id: null,
          totalXp: { $sum: "$xp" },
        },
      },
    ]);
  });

  it("returns zero without querying for an invalid user ID", async () => {
    await expect(getUserXpTotal("invalid-id")).resolves.toBe(0);
    expect(UserProgress.aggregate).not.toHaveBeenCalled();
  });
});

describe("getXpEarnedToday", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("reads the current UTC daily XP total", async () => {
    const userId = new mongoose.Types.ObjectId();
    const now = new Date("2026-10-01T00:30:00.000Z");
    jest.useFakeTimers().setSystemTime(now);
    DailyXpTotal.findOne.mockReturnValue({
      select: jest.fn().mockResolvedValue({ xp_total: 125 }),
    });

    await expect(getXpEarnedToday(userId)).resolves.toBe(125);
    expect(DailyXpTotal.findOne).toHaveBeenCalledWith({
      user_id: userId,
      day_start: new Date("2026-10-01T00:00:00.000Z"),
    });

    jest.useRealTimers();
  });

  it("returns zero when no daily total exists", async () => {
    DailyXpTotal.findOne.mockReturnValue({
      select: jest.fn().mockResolvedValue(null),
    });

    await expect(getXpEarnedToday(new mongoose.Types.ObjectId())).resolves.toBe(0);
  });

  it("returns zero without querying for an invalid user ID", async () => {
    await expect(getXpEarnedToday("invalid-id")).resolves.toBe(0);
    expect(DailyXpTotal.findOne).not.toHaveBeenCalled();
  });
});
