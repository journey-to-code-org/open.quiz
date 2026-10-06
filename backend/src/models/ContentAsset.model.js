const mongoose = require("mongoose");

const contentAssetSchema = new mongoose.Schema(
  {
    asset_id: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
    },
    mime_type: {
      type: String,
      enum: ["image/png", "image/jpeg", "image/webp"],
      required: true,
    },
    kind: {
      type: String,
      enum: [
        "avatar",
        "theme-logo",
        "theme-favicon",
        "theme-hero",
        "theme-progress",
        "package-content",
      ],
      default: "avatar",
      required: true,
    },
    data: {
      type: Buffer,
      required: true,
    },
    uploaded_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    source_package_id: {
      type: String,
      default: null,
    },
    package_asset_key: {
      type: String,
      default: null,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("ContentAsset", contentAssetSchema);
