const AdminBootstrap = require("../models/AdminBootstrap.model");
const User = require("../models/User.model");
const { isDemoMode } = require("../config/demoMode");

async function bootstrapLoginAdmin(user) {
  if (
    !user.email_verified_at ||
    user.is_disabled ||
    user.is_deleted ||
    user.is_archived ||
    user.deleted_at
  ) {
    const error = new Error("Only a verified, active account can initialize administrator access.");
    error.status = 403;
    throw error;
  }
  if (isDemoMode()) {
    if (user.role !== "admin") {
      await User.updateOne({ _id: user._id }, { $set: { role: "admin" } });
      user.role = "admin";
    }
    return;
  }
  await AdminBootstrap.init();
  const existingAdmin = await User.findOne({
    role: "admin",
    is_disabled: { $ne: true },
    is_deleted: { $ne: true },
    is_archived: { $ne: true },
    deleted_at: null,
  }).select("_id");
  let bootstrap;
  try {
    bootstrap = await AdminBootstrap.findOneAndUpdate(
      { key: "first-user-admin" },
      { $setOnInsert: { key: "first-user-admin", user_id: existingAdmin?._id || user._id } },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
    );
  } catch (error) {
    if (error.code !== 11000) throw error;
    bootstrap = await AdminBootstrap.findOne({ key: "first-user-admin" });
    if (!bootstrap) throw error;
  }

  if (!existingAdmin && String(bootstrap.user_id) === String(user._id)) {
    await User.updateOne({ _id: user._id }, { $set: { role: "admin" } });
    user.role = "admin";
  }
}

module.exports = { bootstrapLoginAdmin };
