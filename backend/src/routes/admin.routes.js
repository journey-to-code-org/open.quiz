const express = require("express");
const multer = require("multer");
const { importLessonModule } = require("../controllers/lesson.controller");
const {
  activateDefaultTheme,
  activatePackage,
  deletePackage,
  exportPackage,
  exportSite,
  getSiteSettings,
  inspectPackage,
  importPackage,
  installPackageContent,
  listPackages,
  updateSiteSettings,
} = require("../controllers/openQuizPackage.controller");
const { demoOwnAccountOnly } = require("../config/demoMode");
const { listAvatarAssets, uploadAvatarAsset } = require("../controllers/contentAsset.controller");
const {
  getAdminStatus,
  listUsers,
  seedRandomUsers,
  resetUserProgress,
  setUserDisabled,
  updateUserRole,
  verifyUserEmail,
  setUserDeleted,
  hardDeleteUser,
  listModules,
  getModule,
  createModule,
  updateModule,
  deleteModule,
  createLesson,
  updateLesson,
  deleteLesson,
  getPendingDeleteAccount,
  approveDeleteAccount,
  rejectDeleteAccount,
  reactivateUserAcct,
} = require("../controllers/admin.controller");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const packageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 16 * 1024 * 1024 },
});
const handlePackageUpload = (req, res, next) =>
  packageUpload.single("file")(req, res, (error) => {
    if (error?.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ message: "Package exceeds the 16 MB upload limit." });
    }
    return next(error);
  });

router.get("/status", getAdminStatus);
router.get("/users", listUsers);
router.post("/users/seed-random", seedRandomUsers);
router.post("/users/:userId/progress/reset", demoOwnAccountOnly, resetUserProgress);
router.patch("/users/:userId/disabled", demoOwnAccountOnly, setUserDisabled);
router.patch("/users/:userId/role", demoOwnAccountOnly, updateUserRole);
router.patch("/users/:userId/verify-email", demoOwnAccountOnly, verifyUserEmail);
router.patch("/users/:userId/deleted", demoOwnAccountOnly, setUserDeleted);
router.delete("/users/:userId", demoOwnAccountOnly, hardDeleteUser);
router.get("/deletions/pending", getPendingDeleteAccount);
router.patch("/deletions/approve/:userId", demoOwnAccountOnly, approveDeleteAccount);
router.patch("/deletions/deny/:userId", demoOwnAccountOnly, rejectDeleteAccount);
router.patch("/deletions/reactivate/:userId", demoOwnAccountOnly, reactivateUserAcct);
router.get("/modules", listModules);
router.get("/assets/avatars", listAvatarAssets);
router.post("/assets/avatars", upload.single("file"), uploadAvatarAsset);
router.get("/modules/:moduleId", getModule);
router.post("/modules", createModule);
router.patch("/modules/:moduleId", updateModule);
router.delete("/modules/:moduleId", deleteModule);
router.post("/modules/:moduleId/lessons", createLesson);
router.patch("/modules/:moduleId/lessons/:lessonId", updateLesson);
router.delete("/modules/:moduleId/lessons/:lessonId", deleteLesson);
router.post("/modules/import", upload.single("file"), importLessonModule);
router.get("/packages", listPackages);
router.post("/packages/inspect", handlePackageUpload, inspectPackage);
router.post("/packages/import", handlePackageUpload, importPackage);
router.post("/packages/default/activate", activateDefaultTheme);
router.get("/site-export", exportSite);
router.get("/site-settings", getSiteSettings);
router.patch("/site-settings", updateSiteSettings);
router.get("/packages/:packageId/export", exportPackage);
router.patch("/packages/:packageId/activate", activatePackage);
router.post("/packages/:packageId/content", installPackageContent);
router.delete("/packages/:packageId", deletePackage);

module.exports = router;
