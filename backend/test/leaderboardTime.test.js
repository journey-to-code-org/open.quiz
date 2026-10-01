const { describe, expect, it } = require("@jest/globals");
const WeeklyLeaderboard = require("../src/models/WeeklyLeaderboard.model");
const {
  LEADERBOARD_RESET_DAY,
  LEADERBOARD_RESET_HOUR,
  LEADERBOARD_TIME_ZONE,
  getLeaderboardWeek,
} = require("../src/utils/leaderboardTime");

describe("leaderboard week contract", () => {
  it("documents a Monday 00:00 UTC weekly boundary", () => {
    expect({
      day: LEADERBOARD_RESET_DAY,
      hour: LEADERBOARD_RESET_HOUR,
      timeZone: LEADERBOARD_TIME_ZONE,
    }).toEqual({ day: "Monday", hour: 0, timeZone: "UTC" });
  });

  it.each([
    ["2026-09-07T00:00:00.000Z", "2026-09-07T00:00:00.000Z", "2026-09-14T00:00:00.000Z"],
    ["2026-09-13T23:59:59.999Z", "2026-09-07T00:00:00.000Z", "2026-09-14T00:00:00.000Z"],
    ["2026-09-14T00:00:00.000Z", "2026-09-14T00:00:00.000Z", "2026-09-21T00:00:00.000Z"],
  ])("maps %s to the expected half-open week", (input, expectedStart, expectedEnd) => {
    const { weekStart, weekEnd } = getLeaderboardWeek(input);

    expect(weekStart.toISOString()).toBe(expectedStart);
    expect(weekEnd.toISOString()).toBe(expectedEnd);
  });

  it("rejects invalid dates", () => {
    expect(() => getLeaderboardWeek("not-a-date")).toThrow(TypeError);
  });

  it("defines one materialized total per user and week plus a ranking index", () => {
    const indexes = WeeklyLeaderboard.schema.indexes();

    expect(indexes).toEqual(
      expect.arrayContaining([
        [{ user_id: 1, week_start: 1 }, { unique: true }],
        [{ week_start: 1, xp_total: -1, user_id: 1 }, {}],
      ]),
    );
  });
});
