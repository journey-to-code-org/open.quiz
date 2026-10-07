const { describe, expect, it } = require("@jest/globals");
const {
  millisecondsUntilNextNightlyRollup,
  millisecondsUntilNextReset,
  startLeaderboardScheduler,
} = require("../src/jobs/leaderboardScheduler");

describe("leaderboard scheduler", () => {
  it("targets Monday at 00:00 UTC for the weekly reset", () => {
    expect(millisecondsUntilNextReset("2026-09-13T23:59:00.000Z")).toBe(60_000);
    expect(millisecondsUntilNextReset("2026-09-14T00:00:00.000Z")).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it("targets 00:05 UTC for the nightly rollup", () => {
    expect(millisecondsUntilNextNightlyRollup("2026-09-14T00:04:00.000Z")).toBe(60_000);
    expect(millisecondsUntilNextNightlyRollup("2026-09-14T00:05:00.000Z")).toBe(
      24 * 60 * 60 * 1000,
    );
  });

  it("runs catch-up jobs, schedules both timers, and supports shutdown", async () => {
    const scheduled = [];
    const cleared = [];
    const setTimer = jest.fn((callback, delay) => {
      const timer = { callback, delay, unref: jest.fn() };
      scheduled.push(timer);
      return timer;
    });
    const clearTimer = jest.fn((timer) => cleared.push(timer));
    const rotate = jest.fn().mockResolvedValue({});
    const rollup = jest.fn().mockResolvedValue({});
    const now = () => new Date("2026-09-13T23:59:00.000Z");

    const stop = startLeaderboardScheduler({ now, setTimer, clearTimer, rotate, rollup });
    await Promise.resolve();

    expect(rotate).toHaveBeenCalledWith({ date: now() });
    expect(rollup).toHaveBeenCalledWith({ date: now() });
    expect(scheduled.map((timer) => timer.delay)).toEqual([
      60_000,
      millisecondsUntilNextNightlyRollup(now()),
    ]);
    expect(scheduled.every((timer) => timer.unref.mock.calls.length === 1)).toBe(true);

    stop();
    expect(cleared).toEqual(scheduled);
  });
});
