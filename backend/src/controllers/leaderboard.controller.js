const { StatusCodes } = require("http-status-codes");
const { getLeaderboardForUser } = require("../services/leaderboardRead.service");

async function getLeaderboard(req, res, next) {
  try {
    const leaderboard = await getLeaderboardForUser({ userId: req.user.id, limit: 20 });
    return res.status(StatusCodes.OK).json(leaderboard);
  } catch (error) {
    if (error.code === "USER_NOT_FOUND") {
      return res.status(StatusCodes.NOT_FOUND).json({ message: "User not found." });
    }
    return next(error);
  }
}

module.exports = { getLeaderboard };
