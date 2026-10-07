const express = require("express");
const { getPublicContentAsset } = require("../controllers/contentAsset.controller");

const router = express.Router();

router.get("/:assetId", getPublicContentAsset);

module.exports = router;
