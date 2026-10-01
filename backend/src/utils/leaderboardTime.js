const LEADERBOARD_TIME_ZONE = "UTC";
const LEADERBOARD_RESET_DAY = "Monday";
const LEADERBOARD_RESET_HOUR = 0;
const MILLISECONDS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

function getLeaderboardWeek(dateValue = new Date()) {
  const date = dateValue instanceof Date ? new Date(dateValue) : new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    throw new TypeError("A valid date is required to determine the leaderboard week.");
  }

  const daysSinceMonday = (date.getUTCDay() + 6) % 7;
  const weekStart = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - daysSinceMonday),
  );
  const weekEnd = new Date(weekStart.getTime() + MILLISECONDS_PER_WEEK);

  return { weekStart, weekEnd };
}

module.exports = {
  LEADERBOARD_RESET_DAY,
  LEADERBOARD_RESET_HOUR,
  LEADERBOARD_TIME_ZONE,
  getLeaderboardWeek,
};
