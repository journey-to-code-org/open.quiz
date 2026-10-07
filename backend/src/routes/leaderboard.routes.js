const express = require("express");
const { getLeaderboard, getPublicLeaderboard } = require("../controllers/leaderboard.controller");
const { authenticateUser } = require("../middleware/jsonWebToken");

const router = express.Router();

router.get("/public", getPublicLeaderboard);
router.get("/", authenticateUser, getLeaderboard);

module.exports = router;
