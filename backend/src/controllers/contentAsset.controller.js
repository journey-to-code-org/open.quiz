const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { StatusCodes } = require("http-status-codes");
const ContentAsset = require("../models/ContentAsset.model");

const imageSignatures = {
  "image/png": (buffer) =>
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
  "image/jpeg": (buffer) =>
    buffer.length >= 3 && buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255,
  "image/webp": (buffer) =>
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP",
};

const assetUrl = (assetId) => `/api/v1/assets/${encodeURIComponent(assetId)}`;

exports.listAvatarAssets = async (_req, res, next) => {
  try {
    const assets = await ContentAsset.find({ kind: "avatar" })
      .select("asset_id name mime_type createdAt source_package_id package_asset_key")
      .sort({ createdAt: -1 })
      .lean();

    return res.status(StatusCodes.OK).json({
      assets: assets.map((asset) => ({
        id: asset.asset_id,
        name: asset.name,
        mimeType: asset.mime_type,
        url: assetUrl(asset.asset_id),
        sourcePackageId: asset.source_package_id || null,
        packageAssetKey: asset.package_asset_key || null,
      })),
    });
  } catch (error) {
    return next(error);
  }
};

exports.uploadAvatarAsset = async (req, res, next) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(StatusCodes.BAD_REQUEST).json({ message: "Choose an image to upload." });
    }

    const verifySignature = imageSignatures[file.mimetype];
    if (!verifySignature || !verifySignature(file.buffer)) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        message: "Avatar files must be valid PNG, JPEG, or WebP images.",
      });
    }

    const name = path
      .basename(file.originalname)
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .slice(0, 120);
    const asset = await ContentAsset.create({
      asset_id: randomUUID(),
      name: name || "avatar",
      mime_type: file.mimetype,
      kind: "avatar",
      data: file.buffer,
      uploaded_by: req.user.id,
    });

    return res.status(StatusCodes.CREATED).json({
      id: asset.asset_id,
      name: asset.name,
      mimeType: asset.mime_type,
      url: assetUrl(asset.asset_id),
    });
  } catch (error) {
    return next(error);
  }
};

exports.getPublicContentAsset = async (req, res, next) => {
  try {
    const asset = await ContentAsset.findOne({ asset_id: req.params.assetId }).select(
      "mime_type data",
    );
    if (!asset) {
      return res.status(StatusCodes.NOT_FOUND).json({ message: "Image asset not found." });
    }

    return res
      .set("Content-Type", asset.mime_type)
      .set("X-Content-Type-Options", "nosniff")
      .set("Cache-Control", "public, max-age=31536000, immutable")
      .status(StatusCodes.OK)
      .send(asset.data);
  } catch (error) {
    return next(error);
  }
};
