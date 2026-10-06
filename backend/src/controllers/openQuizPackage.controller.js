const { randomUUID } = require("node:crypto");
const { StatusCodes } = require("http-status-codes");
const ContentAsset = require("../models/ContentAsset.model");
const LessonModule = require("../models/LessonModule.model");
const OpenQuizPackage = require("../models/OpenQuizPackage.model");
const ThemeConfiguration = require("../models/ThemeConfiguration.model");
const { clearModuleCache } = require("../utils/content");
const { validateOpenQuizPackage } = require("../services/openQuizPackage");

const assetUrl = (assetId) => `/api/v1/assets/${encodeURIComponent(assetId)}`;
const deepCopy = (value) => JSON.parse(JSON.stringify(value));

function getPackageAssetKeys(pkg, includeTheme, includeContent) {
  const keys = new Set();
  if (includeTheme) {
    for (const [slot, value] of Object.entries(pkg.theme?.assets || {})) {
      if (slot === "avatars") {
        for (const avatar of value || []) keys.add(avatar.assetKey);
      } else if (value) keys.add(value);
    }
  }
  if (includeContent) {
    const visit = (value) => {
      if (!value || typeof value !== "object") return;
      if (typeof value.assetKey === "string") keys.add(value.assetKey);
      for (const nested of Object.values(value)) visit(nested);
    };
    visit(pkg.content);
  }
  return keys;
}

function setModuleCharacterAssetUrls(module, assetIds) {
  const copy = deepCopy(module);
  for (const character of copy.characters || []) {
    if (!character.assetKey) continue;
    const assetId = assetIds.get(character.assetKey);
    if (!assetId)
      throw new Error(
        `Character ${character.characterId || ""} references a missing package asset.`,
      );
    character.imagePath = assetUrl(assetId);
    delete character.assetKey;
  }
  return copy;
}

function toPublicTheme(installedPackage) {
  if (!installedPackage?.theme) return { theme: null };
  const assetUrls = new Map(
    (installedPackage.assets || []).map((asset) => [asset.key, assetUrl(asset.assetId)]),
  );
  const themeAssets = installedPackage.theme.assets || {};
  const assets = {};
  for (const slot of ["logo", "favicon", "hero", "progressBar"]) {
    assets[slot] = themeAssets[slot] ? assetUrls.get(themeAssets[slot]) || null : null;
  }
  assets.avatars = Object.fromEntries(
    (themeAssets.avatars || []).map((avatar) => [
      avatar.key,
      { name: avatar.name, url: assetUrls.get(avatar.assetKey) || null },
    ]),
  );
  return {
    theme: {
      id: installedPackage.packageId,
      name: installedPackage.name,
      version: installedPackage.version,
      tokens: installedPackage.theme.tokens || {},
      assets,
    },
  };
}

exports.getPublicTheme = async (_req, res, next) => {
  try {
    const active = await ThemeConfiguration.findOne({ key: "active" }).lean();
    if (!active?.activePackageId) return res.status(StatusCodes.OK).json({ theme: null });
    const installedPackage = await OpenQuizPackage.findOne({
      packageId: active.activePackageId,
    }).lean();
    return res.status(StatusCodes.OK).json(toPublicTheme(installedPackage));
  } catch (error) {
    return next(error);
  }
};

exports.listPackages = async (_req, res, next) => {
  try {
    const [packages, active] = await Promise.all([
      OpenQuizPackage.find({})
        .select(
          "packageId name version schemaVersion description author manifest installedSections importedModuleIds theme assets createdAt",
        )
        .sort({ name: 1 })
        .lean(),
      ThemeConfiguration.findOne({ key: "active" }).lean(),
    ]);
    return res.status(StatusCodes.OK).json({
      activePackageId: active?.activePackageId || null,
      packages: packages.map((item) => ({
        ...item,
        isActive: item.packageId === active?.activePackageId,
        themePreview: toPublicTheme(item).theme,
      })),
    });
  } catch (error) {
    return next(error);
  }
};

exports.inspectPackage = async (req, res, next) => {
  try {
    if (!req.file)
      return res
        .status(StatusCodes.BAD_REQUEST)
        .json({ message: "Choose an .openquiz.json package to inspect." });
    const pkg = validateOpenQuizPackage(req.file.buffer);
    const moduleIds = (pkg.content?.modules || []).map((module) => module.id);
    const conflicts = moduleIds.length
      ? await LessonModule.find({ id: { $in: moduleIds } })
          .select("id title")
          .lean()
      : [];
    const portable = { ...pkg };
    delete portable._assetBuffers;
    return res.status(StatusCodes.OK).json({
      package: portable.package,
      includes: portable.manifest.includes,
      manifest: portable.manifest,
      conflicts: conflicts.map(({ id, title }) => ({ id, title })),
      theme: portable.theme
        ? { tokens: portable.theme.tokens || {}, assets: portable.theme.assets || {} }
        : null,
    });
  } catch (error) {
    if (error.status === StatusCodes.BAD_REQUEST)
      return res.status(error.status).json({ message: error.message });
    return next(error);
  }
};

exports.importPackage = async (req, res, next) => {
  const createdAssetIds = [];
  const createdModuleIds = [];
  try {
    if (!req.file)
      return res
        .status(StatusCodes.BAD_REQUEST)
        .json({ message: "Choose an .openquiz.json package to import." });
    if (req.file.size > 16 * 1024 * 1024)
      return res
        .status(StatusCodes.BAD_REQUEST)
        .json({ message: "Package exceeds the 16 MB upload limit." });
    const pkg = validateOpenQuizPackage(req.file.buffer);
    const mode = req.body.mode || "all";
    if (!["all", "theme", "content"].includes(mode))
      return res
        .status(StatusCodes.BAD_REQUEST)
        .json({ message: "Choose all, theme, or content import scope." });
    const includeTheme = mode !== "content" && Boolean(pkg.theme);
    const includeContent = mode !== "theme" && Boolean(pkg.content);
    if (!includeTheme && !includeContent)
      return res
        .status(StatusCodes.BAD_REQUEST)
        .json({ message: "The selected import scope is not present in this package." });
    if (await OpenQuizPackage.exists({ packageId: pkg.package.id })) {
      return res.status(StatusCodes.CONFLICT).json({
        message:
          "A package with this ID is already installed. Export or remove it before reinstalling.",
      });
    }

    const moduleCandidates = includeContent ? pkg.content.modules || [] : [];
    const moduleIds = moduleCandidates.map((module) => module.id);
    const conflicts = moduleIds.length
      ? await LessonModule.find({ id: { $in: moduleIds } })
          .select("id")
          .lean()
      : [];
    const conflictIds = new Set(conflicts.map((module) => module.id));
    const skippedModules = [...conflictIds];
    const selectedModules = moduleCandidates.filter((module) => !conflictIds.has(module.id));
    const contentCharacterAssetKeys = new Set(
      selectedModules.flatMap((module) =>
        (module.characters || []).map((character) => character.assetKey).filter(Boolean),
      ),
    );
    const selectedAssetKeys = getPackageAssetKeys(pkg, includeTheme, includeContent);
    const assetIds = new Map();

    for (const asset of pkg.assets || []) {
      if (!selectedAssetKeys.has(asset.key)) continue;
      const isAvatar =
        (pkg.theme?.assets?.avatars || []).some((avatar) => avatar.assetKey === asset.key) ||
        contentCharacterAssetKeys.has(asset.key);
      const slot = Object.entries(pkg.theme?.assets || {}).find(
        ([name, key]) => name !== "avatars" && key === asset.key,
      )?.[0];
      const kindBySlot = {
        logo: "theme-logo",
        favicon: "theme-favicon",
        hero: "theme-hero",
        progressBar: "theme-progress",
      };
      const stored = await ContentAsset.create({
        asset_id: randomUUID(),
        name: asset.filename,
        mime_type: asset.mimeType,
        kind: isAvatar ? "avatar" : kindBySlot[slot] || "package-content",
        data: pkg._assetBuffers[asset.key],
        uploaded_by: req.user.id,
        source_package_id: pkg.package.id,
        package_asset_key: asset.key,
      });
      createdAssetIds.push(stored.asset_id);
      assetIds.set(asset.key, stored.asset_id);
    }

    for (const module of selectedModules) {
      const importModule = setModuleCharacterAssetUrls(module, assetIds);
      await LessonModule.create(importModule);
      createdModuleIds.push(module.id);
      clearModuleCache(module.id);
    }

    const packageAssetMap = [...assetIds.entries()].map(([key, assetId]) => ({ key, assetId }));
    const installedPackage = await OpenQuizPackage.create({
      packageId: pkg.package.id,
      name: pkg.package.name,
      version: pkg.package.version,
      schemaVersion: pkg.schemaVersion,
      description: pkg.package.description || "",
      author: pkg.package.author || "",
      homepage: pkg.package.homepage || null,
      theme: includeTheme ? pkg.theme : undefined,
      assets: packageAssetMap,
      installedSections: [
        ...(includeTheme ? ["theme"] : []),
        ...(includeContent ? ["content"] : []),
      ],
      importedModuleIds: createdModuleIds,
      manifest: pkg.manifest,
      installedBy: req.user.id,
    });
    return res.status(StatusCodes.CREATED).json({
      package: {
        id: installedPackage.packageId,
        name: installedPackage.name,
        version: installedPackage.version,
      },
      installed: { theme: includeTheme, content: includeContent },
      importedModules: createdModuleIds,
      skippedModules,
      manifest: pkg.manifest,
    });
  } catch (error) {
    if (createdModuleIds.length) {
      await LessonModule.deleteMany({ id: { $in: createdModuleIds } }).catch(() => {});
      for (const id of createdModuleIds) clearModuleCache(id);
    }
    if (createdAssetIds.length)
      await ContentAsset.deleteMany({ asset_id: { $in: createdAssetIds } }).catch(() => {});
    if (error.code === 11000)
      return res
        .status(StatusCodes.CONFLICT)
        .json({ message: "A package with this ID is already installed." });
    if (error.status === StatusCodes.BAD_REQUEST)
      return res.status(error.status).json({ message: error.message });
    return next(error);
  }
};

exports.activatePackage = async (req, res, next) => {
  try {
    const installedPackage = await OpenQuizPackage.findOne({ packageId: req.params.packageId });
    if (!installedPackage?.theme)
      return res
        .status(StatusCodes.NOT_FOUND)
        .json({ message: "Installed theme package not found." });
    await ThemeConfiguration.findOneAndUpdate(
      { key: "active" },
      { $set: { activePackageId: installedPackage.packageId } },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
    );
    return res.status(StatusCodes.OK).json({ activePackageId: installedPackage.packageId });
  } catch (error) {
    return next(error);
  }
};

exports.activateDefaultTheme = async (_req, res, next) => {
  try {
    await ThemeConfiguration.findOneAndUpdate(
      { key: "active" },
      { $set: { activePackageId: null } },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
    );
    return res.status(StatusCodes.OK).json({ activePackageId: null });
  } catch (error) {
    return next(error);
  }
};

function packageAssetData(asset, storedAssets) {
  const databaseAsset = storedAssets.get(asset.assetId);
  if (!databaseAsset) throw new Error("An installed package asset is missing from storage.");
  return {
    key: asset.key,
    filename: databaseAsset.name,
    mimeType: databaseAsset.mime_type,
    data: `data:${databaseAsset.mime_type};base64,${databaseAsset.data.toString("base64")}`,
  };
}

exports.exportPackage = async (req, res, next) => {
  try {
    const installedPackage = await OpenQuizPackage.findOne({
      packageId: req.params.packageId,
    }).lean();
    if (!installedPackage)
      return res.status(StatusCodes.NOT_FOUND).json({ message: "Installed package not found." });
    const mode = req.query.mode || "theme";
    if (!["all", "theme", "content"].includes(mode))
      return res
        .status(StatusCodes.BAD_REQUEST)
        .json({ message: "Choose all, theme, or content export scope." });
    const includeTheme = mode !== "content" && installedPackage.installedSections.includes("theme");
    const includeContent =
      mode !== "theme" && installedPackage.installedSections.includes("content");
    const exportPackage = {
      schemaVersion: installedPackage.schemaVersion,
      package: {
        id: installedPackage.packageId,
        name: installedPackage.name,
        version: installedPackage.version,
        ...(installedPackage.description ? { description: installedPackage.description } : {}),
        ...(installedPackage.author ? { author: installedPackage.author } : {}),
        homepage: installedPackage.homepage,
      },
      assets: [],
    };
    if (includeTheme) exportPackage.theme = deepCopy(installedPackage.theme);
    const additionalAssets = new Map();
    if (includeContent) {
      const requestedIds =
        req.query.moduleIds !== undefined
          ? String(req.query.moduleIds).split(",").filter(Boolean)
          : installedPackage.importedModuleIds;
      const allowedIds = new Set(installedPackage.importedModuleIds);
      const moduleIds = requestedIds.filter((id) => allowedIds.has(id));
      const modules = await LessonModule.find({ id: { $in: moduleIds } })
        .select("-__v")
        .lean();
      const assetsById = new Map(installedPackage.assets.map((asset) => [asset.assetId, asset]));
      for (const module of modules) {
        for (const character of module.characters || []) {
          if (!character.imagePath) continue;
          const match = /^\/api\/v1\/assets\/([^/?#]+)$/.exec(character.imagePath);
          if (!match)
            throw new Error(
              `Character ${character.characterId || ""} has an image path that cannot be exported portably.`,
            );
          const assetId = decodeURIComponent(match[1]);
          if (assetsById.has(assetId)) continue;
          const assetExists = await ContentAsset.exists({ asset_id: assetId });
          if (!assetExists)
            throw new Error(
              `Character ${character.characterId || ""} refers to an image that no longer exists.`,
            );
          const assetKey = `content.avatar.${module.id}.${character.characterId || "character"}`
            .replace(/[^a-zA-Z0-9._-]/g, "-")
            .slice(0, 80);
          const portableAsset = { key: assetKey, assetId };
          additionalAssets.set(assetKey, portableAsset);
          assetsById.set(assetId, portableAsset);
        }
      }
      exportPackage.content = {
        modules: modules.map((module) => {
          const portableModule = deepCopy(module);
          delete portableModule._id;
          for (const character of portableModule.characters || []) {
            if (!character.imagePath) continue;
            const match = /^\/api\/v1\/assets\/([^/?#]+)$/.exec(character.imagePath);
            const assetId = decodeURIComponent(match[1]);
            const saved = assetsById.get(assetId);
            character.assetKey = saved.key;
            delete character.imagePath;
          }
          return portableModule;
        }),
      };
    }
    const usedKeys = new Set();
    if (includeTheme) {
      for (const [slot, key] of Object.entries(exportPackage.theme.assets || {})) {
        if (slot === "avatars") for (const avatar of key || []) usedKeys.add(avatar.assetKey);
        else if (key) usedKeys.add(key);
      }
    }
    if (includeContent) {
      const visit = (value) => {
        if (!value || typeof value !== "object") return;
        if (value.assetKey) usedKeys.add(value.assetKey);
        for (const nested of Object.values(value)) visit(nested);
      };
      visit(exportPackage.content);
    }
    const assetReferences = [
      ...installedPackage.assets.filter((asset) => usedKeys.has(asset.key)),
      ...[...additionalAssets.values()].filter((asset) => usedKeys.has(asset.key)),
    ];
    const storedAssets = new Map(
      (
        await ContentAsset.find({
          asset_id: { $in: assetReferences.map((asset) => asset.assetId) },
        }).lean()
      ).map((asset) => [asset.asset_id, asset]),
    );
    exportPackage.assets = assetReferences.map((asset) => packageAssetData(asset, storedAssets));
    const validated = validateOpenQuizPackage(exportPackage);
    const portable = { ...validated };
    delete portable._assetBuffers;
    res.set("Content-Type", "application/json; charset=utf-8");
    res.set(
      "Content-Disposition",
      `attachment; filename="${installedPackage.packageId}.openquiz.json"`,
    );
    return res.status(StatusCodes.OK).send(JSON.stringify(portable, null, 2));
  } catch (error) {
    return next(error);
  }
};

exports.deletePackage = async (req, res, next) => {
  try {
    const installedPackage = await OpenQuizPackage.findOne({ packageId: req.params.packageId });
    if (!installedPackage)
      return res.status(StatusCodes.NOT_FOUND).json({ message: "Installed package not found." });
    const existingModuleCount = await LessonModule.countDocuments({
      id: { $in: installedPackage.importedModuleIds },
    });
    if (existingModuleCount) {
      return res.status(StatusCodes.CONFLICT).json({
        message:
          "This package owns installed modules. Remove those modules explicitly before uninstalling it.",
      });
    }
    await ThemeConfiguration.updateOne(
      { key: "active", activePackageId: installedPackage.packageId },
      { $set: { activePackageId: null } },
    );
    const assetIds = installedPackage.assets.map((asset) => asset.assetId);
    const otherPackages = assetIds.length
      ? await OpenQuizPackage.find({
          packageId: { $ne: installedPackage.packageId },
          "assets.assetId": { $in: assetIds },
        })
          .select("assets.assetId")
          .lean()
      : [];
    const sharedAssetIds = new Set(
      otherPackages.flatMap((item) => item.assets.map((asset) => asset.assetId)),
    );
    await installedPackage.deleteOne();
    const orphanedAssetIds = assetIds.filter((assetId) => !sharedAssetIds.has(assetId));
    if (orphanedAssetIds.length) {
      await ContentAsset.deleteMany({ asset_id: { $in: orphanedAssetIds } });
    }
    return res.status(StatusCodes.OK).json({ message: "Package uninstalled." });
  } catch (error) {
    return next(error);
  }
};
