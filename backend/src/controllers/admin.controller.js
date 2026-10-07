const { StatusCodes } = require("http-status-codes");
const mongoose = require("mongoose");
const { randomUUID } = require("node:crypto");
const User = require("../models/User.model");
const UserProgress = require("../models/UserProgress.model");
const LessonModule = require("../models/LessonModule.model");
const { clearModuleCache } = require("../utils/content");
const { isDemoMode, maskDemoUser } = require("../config/demoMode");
const { hashPassword } = require("../utils/password");
const {
  getScheduledDeletionFields,
  scheduleAccountDeletion,
  isWithinReactivationGracePeriod,
  reactivateAccount,
} = require("../utils/accountDeletion");
const {
  adminActionSchema,
  adminDisableSchema,
  adminDeleteSchema,
  adminSoftDeleteSchema,
  adminRoleSchema,
  adminUserQuerySchema,
  adminUserSeedSchema,
  adminModuleSchema,
  adminModuleUpdateSchema,
  adminLessonSchema,
  validateRequest,
} = require("../validation/userValidation");

const safeUser = (user) => ({
  _id: user._id,
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  email_verified_at: user.email_verified_at,
  is_disabled: user.is_disabled,
  disabled_at: user.disabled_at,
  is_deleted: user.is_deleted,
  deleted_at: user.deleted_at,
  deletion_scheduled_at: user.deletion_scheduled_at,
  deletion_status: user.deletion_status,
  created_at: user.created_at,
});

const getTargetUser = async (userId) => {
  if (!mongoose.isValidObjectId(userId)) return null;
  return User.findOne({
    _id: userId,
    is_deleted: { $in: [true, false, null] },
    is_archived: { $in: [true, false, null] },
  });
};

const countOtherActiveAdmins = (userId) =>
  User.countDocuments({
    _id: { $ne: userId },
    role: "admin",
    is_disabled: { $ne: true },
    deleted_at: null,
    is_deleted: { $ne: true },
    is_archived: { $ne: true },
  });

const getAllAdminUsers = async (req, res, next) => {
  try {
    const users = await User.find({ role: "admin" })
      .select("_id name email role created_at")
      .lean();
    return res.status(StatusCodes.OK).json({
      success: true,
      count: users.length,
      users: users.map((user) => maskDemoUser(user, req.user.id)),
    });
  } catch (error) {
    return next(error);
  }
};

const getAdminStatus = (req, res) => {
  return res.status(StatusCodes.OK).json({
    isAdmin: true,
    userId: req.user.id,
    demoMode: isDemoMode(),
  });
};

const listUsers = async (req, res, next) => {
  try {
    const query = validateRequest(res, adminUserQuerySchema, req.query);
    if (!query) return;
    const filters = {
      is_deleted: { $in: [true, false, null] },
      is_archived: { $ne: true },
    };
    if (query.role) filters.role = query.role;
    if (query.emailVerified !== undefined) {
      filters.email_verified_at = query.emailVerified ? { $ne: null } : null;
    }
    if (query.search) {
      // Demo admins cannot probe for other people's email addresses.
      filters.$or = isDemoMode()
        ? [{ name: { $regex: query.search, $options: "i" } }]
        : [
            { email: { $regex: query.search, $options: "i" } },
            { name: { $regex: query.search, $options: "i" } },
          ];
    }
    const [users, total] = await Promise.all([
      User.find(filters)
        .select(
          "name email role email_verified_at is_disabled disabled_at is_deleted deleted_at deletion_scheduled_at deletion_status created_at",
        )
        .sort({ role: 1, created_at: 1 })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit),
      User.countDocuments(filters),
    ]);
    return res.status(StatusCodes.OK).json({
      success: true,
      count: users.length,
      users: users.map((user) => maskDemoUser(safeUser(user), req.user.id)),
      page: query.page,
      limit: query.limit,
      total,
      demoMode: isDemoMode(),
    });
  } catch (error) {
    return next(error);
  }
};

const seedRandomUsers = async (req, res, next) => {
  try {
    const body = validateRequest(res, adminUserSeedSchema, req.body);
    if (!body) return;
    const seedUsers = await Promise.all(
      Array.from({ length: body.count }, async () => {
        const uniqueId = randomUUID();
        return {
          name: `Seeded User ${uniqueId.slice(0, 8)}`,
          email: `seeded-user-${uniqueId}@example.test`,
          password_hash: await hashPassword(randomUUID()),
          email_verified_at: new Date(),
          role: "learner",
          tos_agreement: true,
        };
      }),
    );
    const users = await User.insertMany(seedUsers);
    return res.status(StatusCodes.CREATED).json({
      success: true,
      count: users.length,
      users: users.map(safeUser),
    });
  } catch (error) {
    return next(error);
  }
};

const getPendingDeleteAccount = async (req, res, next) => {
  try {
    const pendingDeletionRequests = await User.find({
      deletion_status: "pending",
    })
      .select("name email deletion_status deletion_requested_at created_at")
      .lean();
    return res.status(StatusCodes.OK).json({
      success: true,
      count: pendingDeletionRequests.length,
      users: pendingDeletionRequests.map((user) => maskDemoUser(user, req.user.id)),
    });
  } catch (error) {
    return next(error);
  }
};

const approveDeleteAccount = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const user = await getTargetUser(userId);
    if (!user || user.deletion_status !== "pending" || user.is_deleted) {
      return res.status(StatusCodes.CONFLICT).json({
        message: "Deletion request is not pending.",
      });
    }
    if (user._id.equals(req.user.id)) {
      return res
        .status(StatusCodes.CONFLICT)
        .json({ message: "You cannot manage your own account." });
    }
    if (user.role === "admin") {
      const otherActiveAdmins = await countOtherActiveAdmins(user._id);
      if (otherActiveAdmins < 1) {
        return res
          .status(StatusCodes.CONFLICT)
          .json({ message: "The last active admin cannot be deleted." });
      }
    }
    const updatedUser = await User.findOneAndUpdate(
      { _id: user._id, deletion_status: "pending", is_deleted: false },
      {
        $set: getScheduledDeletionFields({
          approvedBy: req.user.id,
          deletionRequestedAt: user.deletion_requested_at,
        }),
        $inc: { token_version: 1 },
      },
      { returnDocument: "after" },
    );
    if (!updatedUser) {
      return res.status(StatusCodes.CONFLICT).json({
        message: "Deletion request is not pending.",
      });
    }
    return res.status(StatusCodes.OK).json({
      message: "Account has been approved for deletion.",
      user: safeUser(updatedUser),
    });
  } catch (error) {
    return next(error);
  }
};

const rejectDeleteAccount = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const updatedUser = await User.findOneAndUpdate(
      { _id: userId, deletion_status: "pending", is_deleted: false },
      {
        $set: {
          deletion_status: "denied",
          is_deleted: false,
          deletion_requested_at: null,
        },
      },
      { returnDocument: "after" },
    );
    if (!updatedUser) {
      return res.status(StatusCodes.CONFLICT).json({
        message: "Deletion request is not pending.",
      });
    }
    return res.status(StatusCodes.OK).json({ message: "Account request for deletion rejected." });
  } catch (error) {
    return next(error);
  }
};

const reactivateUserAcct = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const user = await getTargetUser(userId);
    if (!user || !user.is_deleted) {
      return res.status(StatusCodes.NOT_FOUND).json({ message: "No User is found." });
    }
    if (!isWithinReactivationGracePeriod(user)) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        message: "Grace period to reactivate account has expired. Please register again.",
      });
    }
    reactivateAccount(user);
    await user.save();

    return res.status(StatusCodes.OK).json({
      success: true,
      message: "User account has been reactivated.",
    });
  } catch (error) {
    return next(error);
  }
};

const resetUserProgress = async (req, res, next) => {
  try {
    const body = validateRequest(res, adminSoftDeleteSchema, req.body);
    if (!body) return;
    const target = await getTargetUser(req.params.userId);
    if (!target || target.deleted_at) {
      return res.status(StatusCodes.NOT_FOUND).json({ message: "User not found." });
    }
    await UserProgress.deleteMany({ user_id: target._id });
    return res.status(StatusCodes.OK).json({ message: "User progress reset." });
  } catch (error) {
    return next(error);
  }
};

const verifyUserEmail = async (req, res, next) => {
  try {
    const body = validateRequest(res, adminActionSchema, req.body);
    if (!body) return;
    const target = await getTargetUser(req.params.userId);
    if (!target || target.deleted_at) {
      return res.status(StatusCodes.NOT_FOUND).json({ message: "User not found." });
    }
    if (target._id.equals(req.user.id)) {
      return res
        .status(StatusCodes.CONFLICT)
        .json({ message: "You cannot manage your own account." });
    }
    if (target.email_verified_at) {
      return res.status(StatusCodes.CONFLICT).json({ message: "User email is already verified." });
    }
    target.email_verified_at = new Date();
    target.verification_token = null;
    target.verification_token_expires_at = null;
    await target.save();
    return res.status(StatusCodes.OK).json(safeUser(target));
  } catch (error) {
    return next(error);
  }
};

const setUserDeleted = async (req, res, next) => {
  try {
    const body = validateRequest(res, adminSoftDeleteSchema, req.body);
    if (!body) return;
    const target = await getTargetUser(req.params.userId);
    if (!target) return res.status(StatusCodes.NOT_FOUND).json({ message: "User not found." });
    if (target._id.equals(req.user.id)) {
      return res
        .status(StatusCodes.CONFLICT)
        .json({ message: "You cannot manage your own account." });
    }
    if (target.role === "admin" && body.deleted && !target.deleted_at) {
      const otherActiveAdmins = await countOtherActiveAdmins(target._id);
      if (otherActiveAdmins < 1) {
        return res
          .status(StatusCodes.CONFLICT)
          .json({ message: "The last active admin cannot be deleted." });
      }
    }
    if (body.deleted) {
      scheduleAccountDeletion(target, { approvedBy: req.user.id });
    } else if (target.is_deleted || target.deleted_at) {
      if (!isWithinReactivationGracePeriod(target)) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          message: "Grace period to reactivate account has expired. Please register again.",
        });
      }
      reactivateAccount(target);
    }
    await target.save();
    return res.status(StatusCodes.OK).json(safeUser(target));
  } catch (error) {
    return next(error);
  }
};

const hardDeleteUser = async (req, res, next) => {
  try {
    const body = validateRequest(res, adminDeleteSchema, req.body);
    if (!body) return;
    const target = await getTargetUser(req.params.userId);
    if (!target || target.email !== body.email) {
      return res.status(StatusCodes.NOT_FOUND).json({ message: "User not found." });
    }
    if (target._id.equals(req.user.id)) {
      return res
        .status(StatusCodes.CONFLICT)
        .json({ message: "You cannot manage your own account." });
    }
    if (target.role === "admin") {
      const otherActiveAdmins = await countOtherActiveAdmins(target._id);
      if (otherActiveAdmins < 1) {
        return res
          .status(StatusCodes.CONFLICT)
          .json({ message: "The last active admin cannot be deleted." });
      }
    }
    await UserProgress.deleteMany({ user_id: target._id });
    await User.deleteOne({ _id: target._id });
    return res.status(StatusCodes.OK).json({ message: "User permanently deleted." });
  } catch (error) {
    return next(error);
  }
};

const setUserDisabled = async (req, res, next) => {
  try {
    const body = validateRequest(res, adminDisableSchema, req.body);
    if (!body) return;
    const target = await getTargetUser(req.params.userId);
    if (!target) {
      return res.status(StatusCodes.NOT_FOUND).json({ message: "User not found." });
    }
    if (target.is_deleted || target.deleted_at) {
      return res.status(StatusCodes.CONFLICT).json({
        message:
          "A deletion-scheduled account must be restored before its ban status can be changed.",
      });
    }
    if (target._id.equals(req.user.id)) {
      return res
        .status(StatusCodes.CONFLICT)
        .json({ message: "You cannot manage your own account." });
    }
    if (target.role === "admin" && body.disabled) {
      const otherActiveAdmins = await countOtherActiveAdmins(target._id);
      if (otherActiveAdmins < 1) {
        return res
          .status(StatusCodes.CONFLICT)
          .json({ message: "The last active admin cannot be disabled." });
      }
    }
    if (target.is_disabled !== body.disabled) {
      target.token_version = (target.token_version || 0) + 1;
    }
    target.is_disabled = body.disabled;
    target.disabled_at = target.is_disabled ? new Date() : null;
    await target.save();
    return res.status(StatusCodes.OK).json(safeUser(target));
  } catch (error) {
    return next(error);
  }
};

const updateUserRole = async (req, res, next) => {
  try {
    const body = validateRequest(res, adminRoleSchema, req.body);
    if (!body) return;
    const target = await getTargetUser(req.params.userId);
    if (!target || target.deleted_at) {
      return res.status(StatusCodes.NOT_FOUND).json({ message: "User not found." });
    }
    if (target._id.equals(req.user.id) && body.role !== "admin") {
      return res.status(StatusCodes.CONFLICT).json({ message: "You cannot demote yourself." });
    }
    if (target.role === "admin" && body.role !== "admin") {
      const otherActiveAdmins = await countOtherActiveAdmins(target._id);
      if (otherActiveAdmins < 1) {
        return res
          .status(StatusCodes.CONFLICT)
          .json({ message: "The last active admin cannot be demoted." });
      }
    }
    target.role = body.role;
    await target.save();
    return res.status(StatusCodes.OK).json(safeUser(target));
  } catch (error) {
    return next(error);
  }
};

const listModules = async (req, res, next) => {
  try {
    const modules = await LessonModule.find({}).select("id title lessons").sort({ id: 1 }).lean();
    return res.status(StatusCodes.OK).json({
      modules: modules.map((module) => ({ ...module, lessonCount: module.lessons?.length ?? 0 })),
    });
  } catch (error) {
    return next(error);
  }
};

const getModule = async (req, res, next) => {
  try {
    const module = await LessonModule.findOne({ id: req.params.moduleId }).lean();
    if (!module) {
      return res.status(StatusCodes.NOT_FOUND).json({ message: "Lesson module not found." });
    }
    return res.status(StatusCodes.OK).json(module);
  } catch (error) {
    return next(error);
  }
};

const createModule = async (req, res, next) => {
  try {
    const body = validateRequest(res, adminModuleSchema, req.body);
    if (!body) return;
    if (await LessonModule.exists({ id: body.id })) {
      return res.status(StatusCodes.CONFLICT).json({ message: "Lesson module already exists." });
    }
    const module = await LessonModule.create(body);
    clearModuleCache(body.id);
    return res.status(StatusCodes.CREATED).json(module);
  } catch (error) {
    return next(error);
  }
};

const updateModule = async (req, res, next) => {
  try {
    const body = validateRequest(res, adminModuleUpdateSchema, req.body);
    if (!body) return;
    const module = await LessonModule.findOneAndUpdate(
      { id: req.params.moduleId },
      { $set: body },
      { returnDocument: "after" },
    ).lean();
    if (!module) {
      return res.status(StatusCodes.NOT_FOUND).json({ message: "Lesson module not found." });
    }
    clearModuleCache(req.params.moduleId);
    return res.status(StatusCodes.OK).json(module);
  } catch (error) {
    return next(error);
  }
};

const deleteModule = async (req, res, next) => {
  try {
    const result = await LessonModule.deleteOne({ id: req.params.moduleId });
    if (!result.deletedCount) {
      return res.status(StatusCodes.NOT_FOUND).json({ message: "Lesson module not found." });
    }
    clearModuleCache(req.params.moduleId);
    return res.status(StatusCodes.OK).json({ message: "Lesson module deleted." });
  } catch (error) {
    return next(error);
  }
};

const createLesson = async (req, res, next) => {
  try {
    const body = validateRequest(res, adminLessonSchema, req.body);
    if (!body) return;
    const module = await LessonModule.findOne({ id: req.params.moduleId });
    if (!module) {
      return res.status(StatusCodes.NOT_FOUND).json({ message: "Lesson module not found." });
    }
    if ((module.lessons || []).some((lesson) => lesson.id === body.id)) {
      return res
        .status(StatusCodes.CONFLICT)
        .json({ message: "Lesson already exists in this module." });
    }
    module.lessons = [...(module.lessons || []), body];
    await module.save();
    clearModuleCache(module.id);
    return res.status(StatusCodes.CREATED).json(body);
  } catch (error) {
    return next(error);
  }
};

const updateLesson = async (req, res, next) => {
  try {
    const body = validateRequest(res, adminLessonSchema, req.body);
    if (!body) return;
    const module = await LessonModule.findOne({ id: req.params.moduleId });
    if (!module) {
      return res.status(StatusCodes.NOT_FOUND).json({ message: "Lesson module not found." });
    }
    const index = (module.lessons || []).findIndex((lesson) => lesson.id === req.params.lessonId);
    if (index < 0) return res.status(StatusCodes.NOT_FOUND).json({ message: "Lesson not found." });
    if (body.id !== req.params.lessonId && module.lessons.some((lesson) => lesson.id === body.id)) {
      return res
        .status(StatusCodes.CONFLICT)
        .json({ message: "Lesson already exists in this module." });
    }
    module.lessons[index] = body;
    module.markModified("lessons");
    await module.save();
    clearModuleCache(module.id);
    return res.status(StatusCodes.OK).json(body);
  } catch (error) {
    return next(error);
  }
};

const deleteLesson = async (req, res, next) => {
  try {
    const module = await LessonModule.findOne({ id: req.params.moduleId });
    if (!module) {
      return res.status(StatusCodes.NOT_FOUND).json({ message: "Lesson module not found." });
    }
    if (!(module.lessons || []).some((lesson) => lesson.id === req.params.lessonId)) {
      return res.status(StatusCodes.NOT_FOUND).json({ message: "Lesson not found." });
    }
    module.lessons = module.lessons.filter((lesson) => lesson.id !== req.params.lessonId);
    await module.save();
    clearModuleCache(module.id);
    return res.status(StatusCodes.OK).json({ message: "Lesson deleted." });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getAllAdminUsers,
  getAdminStatus,
  listUsers,
  seedRandomUsers,
  getPendingDeleteAccount,
  approveDeleteAccount,
  rejectDeleteAccount,
  reactivateUserAcct,
  resetUserProgress,
  verifyUserEmail,
  setUserDeleted,
  hardDeleteUser,
  setUserDisabled,
  updateUserRole,
  listModules,
  getModule,
  createModule,
  updateModule,
  deleteModule,
  createLesson,
  updateLesson,
  deleteLesson,
};
