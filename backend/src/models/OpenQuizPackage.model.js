const mongoose = require("mongoose");

const openQuizPackageSchema = new mongoose.Schema(
  {
    packageId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    version: { type: String, required: true },
    schemaVersion: { type: Number, required: true },
    description: { type: String, default: "" },
    author: { type: String, default: "" },
    homepage: { type: String, default: null },
    theme: { type: mongoose.Schema.Types.Mixed, default: undefined },
    assets: { type: [mongoose.Schema.Types.Mixed], default: [] },
    installedSections: { type: [String], default: [] },
    importedModuleIds: { type: [String], default: [] },
    manifest: { type: mongoose.Schema.Types.Mixed, required: true },
    installedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: function () {
        return !this.systemProvided;
      },
    },
    systemProvided: { type: Boolean, default: false },
  },
  { timestamps: true },
);

module.exports = mongoose.model("OpenQuizPackage", openQuizPackageSchema);
