const express = require("express");
const { getPublicTheme } = require("../controllers/openQuizPackage.controller");

const router = express.Router();

router.get("/", getPublicTheme);

module.exports = router;
