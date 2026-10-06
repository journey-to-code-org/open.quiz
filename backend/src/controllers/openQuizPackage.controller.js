const { randomUUID } = require("node:crypto");
const { StatusCodes } = require("http-status-codes");
const ContentAsset = require("../models/ContentAsset.model");
const LessonModule = require("../models/LessonModule.model");
const OpenQuizPackage = require("../models/OpenQuizPackage.model");
const ThemeConfiguration = require("../models/ThemeConfiguration.model");
const { clearModuleCache } = require("../utils/content");
const {
  THEME_ASSET_SLOTS,
  normalizeAppName,
  normalizeLanding,
  validateOpenQuizPackage,
} = require("../services/openQuizPackage");
const {
  bundledContentSummary,
  installBundledContent,
} = require("../services/bundledThemes.service");

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
  for (const slot of THEME_ASSET_SLOTS) {
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
      trail: installedPackage.theme.trail || {},
      assets,
    },
  };
}

exports.getPublicTheme = async (_req, res, next) => {
  try {
    const active = await ThemeConfiguration.findOne({ key: "active" }).lean();
    const site = { appName: active?.appName || null, landing: active?.landing || null };
    if (!active?.activePackageId) return res.status(StatusCodes.OK).json({ theme: null, ...site });
    const installedPackage = await OpenQuizPackage.findOne({
      packageId: active.activePackageId,
    }).lean();
    return res.status(StatusCodes.OK).json({ ...toPublicTheme(installedPackage), ...site });
  } catch (error) {
    return next(error);
  }
};

exports.getSiteSettings = async (_req, res, next) => {
  try {
    const active = await ThemeConfiguration.findOne({ key: "active" }).lean();
    return res
      .status(StatusCodes.OK)
      .json({ appName: active?.appName || null, landing: active?.landing || null });
  } catch (error) {
    return next(error);
  }
};

exports.updateSiteSettings = async (req, res, next) => {
  try {
    const update = {};
    if (req.body && Object.hasOwn(req.body, "appName")) {
      const requested = req.body.appName;
      update.appName =
        requested === null || (typeof requested === "string" && !requested.trim())
          ? null
          : normalizeAppName(requested);
    }
    if (req.body && Object.hasOwn(req.body, "landing")) {
      update.landing = req.body.landing === null ? null : normalizeLanding(req.body.landing);
    }
    if (!Object.keys(update).length)
      return res
        .status(StatusCodes.BAD_REQUEST)
        .json({ message: "Provide an app name or landing page settings to update." });
    const configuration = await ThemeConfiguration.findOneAndUpdate(
      { key: "active" },
      { $set: update },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
    ).lean();
    return res.status(StatusCodes.OK).json({
      appName: configuration.appName || null,
      landing: configuration.landing || null,
    });
  } catch (error) {
    if (error.status === StatusCodes.BAD_REQUEST)
      return res.status(error.status).json({ message: error.message });
    return next(error);
  }
};

exports.listPackages = async (_req, res, next) => {
  try {
    const [packages, active] = await Promise.all([
      OpenQuizPackage.find({})
        .select(
          "packageId name version schemaVersion description author manifest installedSections importedModuleIds theme assets systemProvided createdAt",
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
        themePreview: item.theme
          ? {
              ...toPublicTheme(item).theme,
              appName: item.theme.appName || null,
              landing: item.theme.landing || null,
            }
          : null,
        bundledContent: bundledContentSummary(item),
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
        progressFrame: "theme-progress",
        trailDecoration: "theme-trail",
        answerCorrect: "theme-feedback",
        answerIncorrect: "theme-feedback",
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
    const content =
      req.body?.includeContent === true
        ? await installBundledContent(installedPackage.packageId)
        : null;
    const update = { activePackageId: installedPackage.packageId };
    if (req.body?.applySiteContent !== false) {
      if (installedPackage.theme.appName) update.appName = installedPackage.theme.appName;
      if (installedPackage.theme.landing) update.landing = installedPackage.theme.landing;
    }
    const configuration = await ThemeConfiguration.findOneAndUpdate(
      { key: "active" },
      { $set: update },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
    );
    return res.status(StatusCodes.OK).json({
      activePackageId: installedPackage.packageId,
      appName: configuration?.appName || null,
      landingApplied: Boolean(update.landing),
      ...(content || {}),
    });
  } catch (error) {
    if (error.status === StatusCodes.BAD_REQUEST)
      return res.status(error.status).json({ message: error.message });
    return next(error);
  }
};

exports.installPackageContent = async (req, res, next) => {
  try {
    if (!(await OpenQuizPackage.exists({ packageId: req.params.packageId })))
      return res.status(StatusCodes.NOT_FOUND).json({ message: "Installed package not found." });
    const result = await installBundledContent(req.params.packageId);
    return res.status(StatusCodes.OK).json(result);
  } catch (error) {
    if (error.status === StatusCodes.BAD_REQUEST)
      return res.status(error.status).json({ message: error.message });
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

const IMAGE_PATH_PATTERN = /^\/api\/v1\/assets\/([^/?#]+)$/;

async function toPortableModules(modules, assetsById, { strict }) {
  const additionalAssets = new Map();
  const portableModules = [];
  const unportable = (character, message) => {
    if (strict) throw new Error(`Character ${character.characterId || ""} ${message}`);
    delete character.imagePath;
  };
  for (const module of modules) {
    const portableModule = deepCopy(module);
    delete portableModule._id;
    delete portableModule.__v;
    for (const character of portableModule.characters || []) {
      if (!character.imagePath) continue;
      const match = IMAGE_PATH_PATTERN.exec(character.imagePath);
      if (!match) {
        unportable(character, "has an image path that cannot be exported portably.");
        continue;
      }
      const assetId = decodeURIComponent(match[1]);
      let reference = assetsById.get(assetId);
      if (!reference) {
        if (!(await ContentAsset.exists({ asset_id: assetId }))) {
          unportable(character, "refers to an image that no longer exists.");
          continue;
        }
        const key = `content.avatar.${module.id}.${character.characterId || "character"}`
          .replace(/[^a-zA-Z0-9._-]/g, "-")
          .slice(0, 80);
        reference = { key, assetId };
        additionalAssets.set(key, reference);
        assetsById.set(assetId, reference);
      }
      character.assetKey = reference.key;
      delete character.imagePath;
    }
    portableModules.push(portableModule);
  }
  return { modules: portableModules, additionalAssets };
}

async function sendPortablePackage(res, exportPackage, references, filename) {
  const usedKeys = new Set();
  for (const [slot, key] of Object.entries(exportPackage.theme?.assets || {})) {
    if (slot === "avatars") for (const avatar of key || []) usedKeys.add(avatar.assetKey);
    else if (key) usedKeys.add(key);
  }
  const visit = (value) => {
    if (!value || typeof value !== "object") return;
    if (value.assetKey) usedKeys.add(value.assetKey);
    for (const nested of Object.values(value)) visit(nested);
  };
  visit(exportPackage.content);
  const seenKeys = new Set();
  const assetReferences = references.filter((asset) => {
    if (!usedKeys.has(asset.key) || seenKeys.has(asset.key)) return false;
    seenKeys.add(asset.key);
    return true;
  });
  const storedAssets = new Map(
    (
      await ContentAsset.find({
        asset_id: { $in: assetReferences.map((asset) => asset.assetId) },
      }).lean()
    ).map((asset) => [asset.asset_id, asset]),
  );
  exportPackage.assets = assetReferences.map((asset) => packageAssetData(asset, storedAssets));
  const portable = { ...validateOpenQuizPackage(exportPackage) };
  delete portable._assetBuffers;
  res.set("Content-Type", "application/json; charset=utf-8");
  res.set("Content-Disposition", `attachment; filename="${filename}"`);
  return res.status(StatusCodes.OK).send(JSON.stringify(portable, null, 2));
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
    if (includeTheme) {
      exportPackage.theme = deepCopy(installedPackage.theme);
      if (req.query.includeSite === "true") {
        const site = await ThemeConfiguration.findOne({ key: "active" }).lean();
        if (site?.appName) exportPackage.theme.appName = site.appName;
        if (site?.landing) exportPackage.theme.landing = deepCopy(site.landing);
      }
    }
    let additionalAssets = new Map();
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
      const portable = await toPortableModules(modules, assetsById, { strict: true });
      additionalAssets = portable.additionalAssets;
      exportPackage.content = { modules: portable.modules };
    }
    return await sendPortablePackage(
      res,
      exportPackage,
      [...installedPackage.assets, ...additionalAssets.values()],
      `${installedPackage.packageId}.openquiz.json`,
    );
  } catch (error) {
    return next(error);
  }
};

exports.exportSite = async (_req, res, next) => {
  try {
    const active = await ThemeConfiguration.findOne({ key: "active" }).lean();
    const themePackage = active?.activePackageId
      ? await OpenQuizPackage.findOne({ packageId: active.activePackageId }).lean()
      : null;
    const modules = await LessonModule.find({}).select("-__v").sort({ id: 1 }).lean();
    const hasSiteBranding = Boolean(active?.appName || active?.landing);
    if (!themePackage?.theme && !modules.length && !hasSiteBranding)
      return res.status(StatusCodes.BAD_REQUEST).json({
        message: "There is no active theme or lesson content to export yet.",
      });
    const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "");
    const siteName = active?.appName || "open.quiz";
    const exportPackage = {
      schemaVersion: 1,
      package: {
        id: `openquiz-site-${stamp}`,
        name: `${siteName} site export ${new Date().toISOString().slice(0, 10)}`,
        version: "1.0.0",
        description: themePackage?.theme
          ? `Active theme (${themePackage.name}) and all lesson modules.`
          : "All lesson modules.",
        homepage: null,
      },
      assets: [],
    };
    const themeAssets = themePackage?.theme ? themePackage.assets || [] : [];
    if (themePackage?.theme) {
      exportPackage.theme = deepCopy(themePackage.theme);
      if (active?.appName) exportPackage.theme.appName = active.appName;
      else delete exportPackage.theme.appName;
      if (active?.landing) exportPackage.theme.landing = deepCopy(active.landing);
      else delete exportPackage.theme.landing;
    } else if (hasSiteBranding) {
      exportPackage.theme = {
        ...(active.appName ? { appName: active.appName } : {}),
        ...(active.landing ? { landing: deepCopy(active.landing) } : {}),
      };
    }
    const assetsById = new Map(themeAssets.map((asset) => [asset.assetId, asset]));
    const portable = await toPortableModules(modules, assetsById, { strict: false });
    if (portable.modules.length) exportPackage.content = { modules: portable.modules };
    return await sendPortablePackage(
      res,
      exportPackage,
      [...themeAssets, ...portable.additionalAssets.values()],
      `${exportPackage.package.id}.openquiz.json`,
    );
  } catch (error) {
    if (error.status === StatusCodes.BAD_REQUEST)
      return res.status(error.status).json({ message: error.message });
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
