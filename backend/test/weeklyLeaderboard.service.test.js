const mongoose = require("mongoose");
const { afterEach, describe, expect, it } = require("@jest/globals");
const XpEvent = require("../src/models/XpEvent.model");
const WeeklyLeaderboard = require("../src/models/WeeklyLeaderboard.model");
const { rollupLeaderboardWeek } = require("../src/services/weeklyLeaderboard.service");

describe("weekly leaderboard rollup", () => {
  afterEach(() => jest.restoreAllMocks());

  it("upserts summed awarded XP for the requested week", async () => {
    const firstUserId = new mongoose.Types.ObjectId();
    const secondUserId = new mongoose.Types.ObjectId();
    const session = jest.fn().mockResolvedValue([
      { _id: firstUserId, xpTotal: 80 },
      { _id: secondUserId, xpTotal: 35 },
    ]);
    jest.spyOn(XpEvent, "aggregate").mockReturnValue({ session });
    const bulkWrite = jest.spyOn(WeeklyLeaderboard, "bulkWrite").mockResolvedValue({});

    const result = await rollupLeaderboardWeek({ date: "2026-09-10T12:00:00.000Z" });

    expect(XpEvent.aggregate).toHaveBeenCalledWith([
      { $match: { week_start: new Date("2026-09-07T00:00:00.000Z") } },
      { $group: { _id: "$user_id", xpTotal: { $sum: "$awarded_xp" } } },
    ]);
    expect(session).toHaveBeenCalledWith(null);
    expect(bulkWrite).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          updateOne: expect.objectContaining({
            filter: { user_id: firstUserId, week_start: new Date("2026-09-07T00:00:00.000Z") },
            update: {
              $set: expect.objectContaining({
                week_end: new Date("2026-09-14T00:00:00.000Z"),
                xp_total: 80,
              }),
            },
            upsert: true,
          }),
        }),
        expect.objectContaining({
          updateOne: expect.objectContaining({
            filter: { user_id: secondUserId, week_start: new Date("2026-09-07T00:00:00.000Z") },
            update: { $set: expect.objectContaining({ xp_total: 35 }) },
            upsert: true,
          }),
        }),
      ],
      { ordered: false },
    );
    expect(result).toMatchObject({
      weekStart: new Date("2026-09-07T00:00:00.000Z"),
      weekEnd: new Date("2026-09-14T00:00:00.000Z"),
      learnersProcessed: 2,
      xpProcessed: 115,
      rolledUpAt: expect.any(Date),
    });
  });

  it("does not issue an empty bulk write when no XP was awarded", async () => {
    jest.spyOn(XpEvent, "aggregate").mockReturnValue({ session: jest.fn().mockResolvedValue([]) });
    const bulkWrite = jest.spyOn(WeeklyLeaderboard, "bulkWrite");

    const result = await rollupLeaderboardWeek({ date: "2026-09-07T00:00:00.000Z" });

    expect(bulkWrite).not.toHaveBeenCalled();
    expect(result).toMatchObject({ learnersProcessed: 0, xpProcessed: 0 });
  });

  it("passes an optional transaction session through both operations", async () => {
    const transactionSession = {};
    const aggregateSession = jest.fn().mockResolvedValue([]);
    jest.spyOn(XpEvent, "aggregate").mockReturnValue({ session: aggregateSession });

    await rollupLeaderboardWeek({
      date: "2026-09-07T00:00:00.000Z",
      session: transactionSession,
    });

    expect(aggregateSession).toHaveBeenCalledWith(transactionSession);
  });
});
