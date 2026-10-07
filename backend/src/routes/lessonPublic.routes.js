const express = require("express");
const { getPublicLesson, getPublicLessonModules } = require("../controllers/lesson.controller");

const router = express.Router();

router.get("/public/:moduleId/:lessonId", getPublicLesson);
router.get("/public/modules", getPublicLessonModules);

module.exports = router;
