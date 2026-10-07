const mongoose = require("mongoose");

const themeConfigurationSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, default: "active" },
    activePackageId: { type: String, default: null },
    appName: { type: String, default: null, trim: true, maxlength: 60 },
    landing: { type: mongoose.Schema.Types.Mixed, default: null },
    colorMode: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: true },
);

module.exports = mongoose.model("ThemeConfiguration", themeConfigurationSchema);
