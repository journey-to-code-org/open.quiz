const mongoose = require("mongoose");
const { afterEach, describe, expect, it } = require("@jest/globals");
const User = require("../src/models/User.model");
const WeeklyLeaderboard = require("../src/models/WeeklyLeaderboard.model");
const weeklyLeaderboardService = require("../src/services/weeklyLeaderboard.service");
const {
  getLeaderboardForUser,
  normalizeLimit,
} = require("../src/services/leaderboardRead.service");

function mockCurrentUser(profile) {
  const lean = jest.fn().mockResolvedValue(profile);
  const select = jest.fn(() => ({ lean }));
  jest.spyOn(User, "findById").mockReturnValue({ select });
}

describe("leaderboard read service", () => {
  afterEach(() => jest.restoreAllMocks());

  it("returns no rankings and skips aggregation for an opted-out learner", async () => {
    mockCurrentUser({ leaderboard_opt_in: false });
    const aggregate = jest.spyOn(WeeklyLeaderboard, "aggregate");
    const rollup = jest.spyOn(weeklyLeaderboardService, "rollupLeaderboardWeek");

    const result = await getLeaderboardForUser({
      userId: new mongoose.Types.ObjectId(),
      date: "2026-09-10T12:00:00.000Z",
    });

    expect(result).toEqual({
      optedIn: false,
      weekStart: new Date("2026-09-07T00:00:00.000Z"),
      weekEnd: new Date("2026-09-14T00:00:00.000Z"),
      entries: [],
      currentUser: null,
    });
    expect(rollup).not.toHaveBeenCalled();
    expect(aggregate).not.toHaveBeenCalled();
  });

  it("returns the top entries and the current learner outside the top group", async () => {
    const currentUserId = new mongoose.Types.ObjectId();
    mockCurrentUser({ leaderboard_opt_in: true });
    const topEntry = {
      isCurrentUser: false,
      displayName: "Avery",
      avatarUrl: null,
      weeklyXp: 400,
      rank: 1,
    };
    const currentEntry = {
      isCurrentUser: true,
      displayName: "Maya",
      avatarUrl: "https://example.com/maya.png",
      weeklyXp: 25,
      rank: 24,
    };
    const rollup = jest
      .spyOn(weeklyLeaderboardService, "rollupLeaderboardWeek")
      .mockResolvedValue({});
    const aggregate = jest
      .spyOn(WeeklyLeaderboard, "aggregate")
      .mockResolvedValue([{ entries: [topEntry], currentUser: [currentEntry] }]);

    const result = await getLeaderboardForUser({
      userId: currentUserId,
      date: "2026-09-10T12:00:00.000Z",
    });

    expect(result).toMatchObject({
      optedIn: true,
      entries: [topEntry],
      currentUser: currentEntry,
    });
    expect(rollup).toHaveBeenCalledWith({ date: "2026-09-10T12:00:00.000Z" });
    const pipeline = aggregate.mock.calls[0][0];
    expect(pipeline).toEqual(
      expect.arrayContaining([
        { $match: { week_start: new Date("2026-09-07T00:00:00.000Z") } },
        expect.objectContaining({
          $match: expect.objectContaining({ "user.leaderboard_opt_in": true }),
        }),
        {
          $project: {
            _id: 0,
            isCurrentUser: { $eq: ["$user_id", currentUserId] },
            displayName: "$user.name",
            avatarUrl: "$user.avatar_url",
            weeklyXp: "$xp_total",
            rank: 1,
          },
        },
      ]),
    );
    expect(JSON.stringify(result)).not.toContain(currentUserId.toString());
    expect(JSON.stringify(pipeline)).not.toContain("email");
  });

  it("uses a safe default and maximum result limit", () => {
    expect(normalizeLimit(undefined)).toBe(20);
    expect(normalizeLimit(0)).toBe(20);
    expect(normalizeLimit(30)).toBe(30);
    expect(normalizeLimit(500)).toBe(100);
  });
});
