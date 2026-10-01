const mongoose = require("mongoose");
const { afterEach, describe, expect, it } = require("@jest/globals");
const LeaderboardHistory = require("../src/models/LeaderboardHistory.model");
const WeeklyLeaderboard = require("../src/models/WeeklyLeaderboard.model");
const weeklyLeaderboardService = require("../src/services/weeklyLeaderboard.service");
const {
  getPreviousLeaderboardWeek,
  rotatePreviousLeaderboardWeek,
} = require("../src/services/leaderboardReset.service");

describe("leaderboard reset service", () => {
  afterEach(() => jest.restoreAllMocks());

  it("selects the full week immediately before the current boundary", () => {
    expect(getPreviousLeaderboardWeek("2026-09-14T00:00:00.000Z")).toEqual({
      weekStart: new Date("2026-09-07T00:00:00.000Z"),
      weekEnd: new Date("2026-09-14T00:00:00.000Z"),
    });
  });

  it("finalizes, archives, and removes the prior active week in one transaction", async () => {
    const session = {
      withTransaction: jest.fn(async (operation) => operation()),
      endSession: jest.fn(),
    };
    const firstUserId = new mongoose.Types.ObjectId();
    const secondUserId = new mongoose.Types.ObjectId();
    jest.spyOn(mongoose, "startSession").mockResolvedValue(session);
    const rollup = jest
      .spyOn(weeklyLeaderboardService, "rollupLeaderboardWeek")
      .mockResolvedValue({});
    jest.spyOn(WeeklyLeaderboard, "aggregate").mockReturnValue({
      session: jest.fn().mockResolvedValue([
        { user_id: firstUserId, xp_total: 300, rank: 1 },
        { user_id: secondUserId, xp_total: 200, rank: 2 },
      ]),
    });
    const archive = jest.spyOn(LeaderboardHistory, "bulkWrite").mockResolvedValue({});
    const remove = jest.spyOn(WeeklyLeaderboard, "deleteMany").mockResolvedValue({});

    const result = await rotatePreviousLeaderboardWeek({
      date: "2026-09-14T00:00:00.000Z",
    });

    expect(rollup).toHaveBeenCalledWith({
      date: new Date("2026-09-07T00:00:00.000Z"),
      session,
    });
    expect(archive).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          updateOne: expect.objectContaining({
            filter: { user_id: firstUserId, week_start: new Date("2026-09-07T00:00:00.000Z") },
            update: {
              $set: expect.objectContaining({ xp_total: 300, rank: 1 }),
            },
            upsert: true,
          }),
        }),
      ]),
      { ordered: false, session },
    );
    expect(remove).toHaveBeenCalledWith(
      { week_start: new Date("2026-09-07T00:00:00.000Z") },
      { session },
    );
    expect(result).toMatchObject({
      weekStart: new Date("2026-09-07T00:00:00.000Z"),
      weekEnd: new Date("2026-09-14T00:00:00.000Z"),
      learnersArchived: 2,
      archivedAt: expect.any(Date),
    });
    expect(session.withTransaction).toHaveBeenCalledTimes(1);
    expect(session.endSession).toHaveBeenCalledTimes(1);
  });
});
