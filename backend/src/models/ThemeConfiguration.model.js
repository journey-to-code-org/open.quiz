const mongoose = require("mongoose");

const themeConfigurationSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, default: "active" },
    activePackageId: { type: String, default: null },
  },
  { timestamps: true },
);

module.exports = mongoose.model("ThemeConfiguration", themeConfigurationSchema);
