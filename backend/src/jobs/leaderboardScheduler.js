const { rotatePreviousLeaderboardWeek } = require("../services/leaderboardReset.service");
const { rollupLeaderboardWeek } = require("../services/weeklyLeaderboard.service");
const { getLeaderboardWeek } = require("../utils/leaderboardTime");

const NIGHTLY_ROLLUP_HOUR_UTC = 0;
const NIGHTLY_ROLLUP_MINUTE_UTC = 5;

function millisecondsUntilNextReset(date = new Date()) {
  return getLeaderboardWeek(date).weekEnd.getTime() - new Date(date).getTime();
}

function millisecondsUntilNextNightlyRollup(date = new Date()) {
  const now = new Date(date);
  if (Number.isNaN(now.getTime())) throw new TypeError("A valid scheduler date is required.");

  const nextRun = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      NIGHTLY_ROLLUP_HOUR_UTC,
      NIGHTLY_ROLLUP_MINUTE_UTC,
    ),
  );
  if (nextRun <= now) nextRun.setUTCDate(nextRun.getUTCDate() + 1);
  return nextRun.getTime() - now.getTime();
}

function startLeaderboardScheduler({
  now = () => new Date(),
  setTimer = setTimeout,
  clearTimer = clearTimeout,
  logger = console,
  rotate = rotatePreviousLeaderboardWeek,
  rollup = rollupLeaderboardWeek,
} = {}) {
  let stopped = false;
  let resetTimer;
  let rollupTimer;

  const runSafely = async (label, job) => {
    try {
      await job();
    } catch (error) {
      logger.error(`${label} failed:`, error);
    }
  };

  const scheduleReset = () => {
    if (stopped) return;
    resetTimer = setTimer(async () => {
      await runSafely("Weekly leaderboard reset", () => rotate({ date: now() }));
      scheduleReset();
    }, millisecondsUntilNextReset(now()));
    resetTimer?.unref?.();
  };

  const scheduleRollup = () => {
    if (stopped) return;
    rollupTimer = setTimer(async () => {
      await runSafely("Nightly leaderboard rollup", () => rollup({ date: now() }));
      scheduleRollup();
    }, millisecondsUntilNextNightlyRollup(now()));
    rollupTimer?.unref?.();
  };

  void runSafely("Leaderboard startup reset", () => rotate({ date: now() }));
  void runSafely("Leaderboard startup rollup", () => rollup({ date: now() }));
  scheduleReset();
  scheduleRollup();

  return () => {
    stopped = true;
    if (resetTimer) clearTimer(resetTimer);
    if (rollupTimer) clearTimer(rollupTimer);
  };
}

module.exports = {
  NIGHTLY_ROLLUP_HOUR_UTC,
  NIGHTLY_ROLLUP_MINUTE_UTC,
  millisecondsUntilNextNightlyRollup,
  millisecondsUntilNextReset,
  startLeaderboardScheduler,
};
