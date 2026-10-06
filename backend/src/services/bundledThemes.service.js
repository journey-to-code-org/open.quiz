const ContentAsset = require("../models/ContentAsset.model");
const LessonModule = require("../models/LessonModule.model");
const { clearModuleCache } = require("../utils/content");
const OpenQuizPackage = require("../models/OpenQuizPackage.model");
const { validateOpenQuizPackage } = require("./openQuizPackage");
const learningGarden = require("../../../shared/packages/examples/learning-garden.openquiz.json");
const sprout = require("../../../shared/packages/examples/sprout.openquiz.json");

const assetIdFor = (packageId, key) => `bundled.${packageId}.${key}`;
const copy = (value) => JSON.parse(JSON.stringify(value));

async function ensureAsset(pkg, asset) {
  const assetId = assetIdFor(pkg.package.id, asset.key);
  const isAvatar = pkg.theme.assets.avatars.some((avatar) => avatar.assetKey === asset.key);
  const slot = Object.entries(pkg.theme.assets).find(([, key]) => key === asset.key)?.[0];
  const kinds = {
    logo: "theme-logo",
    favicon: "theme-favicon",
    hero: "theme-hero",
    progressBar: "theme-progress",
    progressFrame: "theme-progress",
    trailDecoration: "theme-trail",
    answerCorrect: "theme-feedback",
    answerIncorrect: "theme-feedback",
  };
  await ContentAsset.updateOne(
    { asset_id: assetId },
    {
      $setOnInsert: {
        asset_id: assetId,
        name: asset.filename,
        mime_type: asset.mimeType,
        kind: isAvatar ? "avatar" : kinds[slot] || "package-content",
        data: pkg._assetBuffers[asset.key],
        source_package_id: pkg.package.id,
        package_asset_key: asset.key,
        systemProvided: true,
      },
    },
    { upsert: true, runValidators: true, setDefaultsOnInsert: true },
  );
  return { key: asset.key, assetId };
}

async function repairSproutBeaver(pkg, installed) {
  if (!installed.theme) return;
  const beaver = installed.theme.assets?.avatars?.find((avatar) => avatar.key === "beaver");
  const existingReference = installed.assets.find((asset) => asset.key === beaver?.assetKey);
  if (existingReference && (await ContentAsset.exists({ asset_id: existingReference.assetId }))) {
    await ContentAsset.updateOne(
      { asset_id: existingReference.assetId },
      { $set: { kind: "avatar" } },
    );
    await OpenQuizPackage.updateOne(
      { packageId: pkg.package.id, "theme.assets.avatars.key": { $ne: "guide" } },
      {
        $push: {
          "theme.assets.avatars": {
            key: "guide",
            name: "Beaver guide",
            assetKey: beaver.assetKey,
          },
        },
      },
    );
    return;
  }
  const asset = pkg.assets.find((item) => item.key === "avatar.beaver");
  const reference = await ensureAsset(pkg, asset);
  await OpenQuizPackage.updateOne(
    { packageId: pkg.package.id, "assets.key": { $ne: reference.key } },
    { $push: { assets: reference } },
  );
  await OpenQuizPackage.updateOne(
    { packageId: pkg.package.id, "theme.assets.avatars.key": { $ne: "beaver" } },
    {
      $push: {
        "theme.assets.avatars": { key: "beaver", name: "Beaver guide", assetKey: asset.key },
      },
    },
  );
  if (beaver) {
    await OpenQuizPackage.updateOne(
      { packageId: pkg.package.id, "theme.assets.avatars.key": "beaver" },
      { $set: { "theme.assets.avatars.$.assetKey": asset.key } },
    );
  }
  await OpenQuizPackage.updateOne(
    { packageId: pkg.package.id, "theme.assets.avatars.key": { $ne: "guide" } },
    {
      $push: {
        "theme.assets.avatars": { key: "guide", name: "Beaver guide", assetKey: asset.key },
      },
    },
  );
  const repaired = await OpenQuizPackage.findOne({ packageId: pkg.package.id }).lean();
  const avatarCount = new Set(repaired.theme.assets.avatars.map((avatar) => avatar.assetKey)).size;
  await OpenQuizPackage.updateOne(
    { packageId: pkg.package.id },
    {
      $set: {
        "manifest.counts.assets": repaired.assets.length,
        "manifest.counts.avatars": Math.max(avatarCount, repaired.manifest.counts.avatars || 0),
      },
    },
  );
}

// Adds image slots introduced by newer bundled releases without overwriting admin-visible choices.
async function repairMissingThemeSlots(pkg, installed) {
  if (!installed.systemProvided || !installed.theme) return;
  let added = false;
  for (const [slot, assetKey] of Object.entries(pkg.theme.assets || {})) {
    if (slot === "avatars" || !assetKey || Object.hasOwn(installed.theme.assets || {}, slot))
      continue;
    const asset = pkg.assets.find((item) => item.key === assetKey);
    if (!asset) continue;
    const reference = await ensureAsset(pkg, asset);
    await OpenQuizPackage.updateOne(
      { packageId: pkg.package.id, "assets.key": { $ne: reference.key } },
      { $push: { assets: reference } },
    );
    await OpenQuizPackage.updateOne(
      { packageId: pkg.package.id, [`theme.assets.${slot}`]: { $exists: false } },
      { $set: { [`theme.assets.${slot}`]: reference.key } },
    );
    added = true;
  }
  if (added) {
    const repaired = await OpenQuizPackage.findOne({ packageId: pkg.package.id }).lean();
    await OpenQuizPackage.updateOne(
      { packageId: pkg.package.id },
      { $set: { version: pkg.package.version, "manifest.counts.assets": repaired.assets.length } },
    );
  }
}

async function ensureBundledThemes() {
  await Promise.all([ContentAsset.init(), OpenQuizPackage.init()]);
  for (const source of [learningGarden, sprout]) {
    const themeOnly = copy(source);
    delete themeOnly.content;
    const pkg = validateOpenQuizPackage(themeOnly);
    const installed = await OpenQuizPackage.findOne({ packageId: pkg.package.id }).lean();
    if (installed) {
      if (installed.systemProvided && installed.theme) {
        for (const section of ["trail", "appName", "landing"]) {
          if (installed.theme[section] !== undefined || pkg.theme[section] === undefined) continue;
          await OpenQuizPackage.updateOne(
            { packageId: pkg.package.id, [`theme.${section}`]: { $exists: false } },
            { $set: { [`theme.${section}`]: pkg.theme[section] } },
          );
        }
        // Newer releases can add color tokens; fill only the ones the install does not have.
        for (const [token, value] of Object.entries(pkg.theme.tokens || {})) {
          if (Object.hasOwn(installed.theme.tokens || {}, token)) continue;
          await OpenQuizPackage.updateOne(
            { packageId: pkg.package.id, [`theme.tokens.${token}`]: { $exists: false } },
            { $set: { [`theme.tokens.${token}`]: value } },
          );
        }
      }
      if (pkg.package.id === "sprout") await repairSproutBeaver(pkg, installed);
      await repairMissingThemeSlots(pkg, installed);
      continue;
    }
    const assets = [];
    for (const asset of pkg.assets) assets.push(await ensureAsset(pkg, asset));
    await OpenQuizPackage.updateOne(
      { packageId: pkg.package.id },
      {
        $setOnInsert: {
          packageId: pkg.package.id,
          name: pkg.package.name,
          version: pkg.package.version,
          schemaVersion: pkg.schemaVersion,
          description: pkg.package.description,
          author: pkg.package.author,
          homepage: pkg.package.homepage,
          theme: pkg.theme,
          assets,
          installedSections: ["theme"],
          importedModuleIds: [],
          manifest: pkg.manifest,
          systemProvided: true,
        },
      },
      { upsert: true, runValidators: true, setDefaultsOnInsert: true },
    );
  }
}

function bundledSource(packageId) {
  return [learningGarden, sprout].find((source) => source.package.id === packageId) || null;
}

function bundledContentSummary(installed) {
  if (!installed?.systemProvided) return null;
  const modules = bundledSource(installed.packageId)?.content?.modules || [];
  if (!modules.length) return null;
  const importedIds = new Set(installed.importedModuleIds || []);
  return {
    modules: modules.map((module) => ({
      id: module.id,
      title: module.title,
      lessonCount: module.lessons?.length || 0,
    })),
    installed: modules.every((module) => importedIds.has(module.id)),
  };
}

async function installBundledContent(packageId) {
  const source = bundledSource(packageId);
  const installed = await OpenQuizPackage.findOne({ packageId }).lean();
  if (!installed?.systemProvided || !source?.content?.modules?.length) {
    const error = new Error("This package does not include bundled lessons.");
    error.status = 400;
    throw error;
  }
  const pkg = validateOpenQuizPackage(copy(source));
  const assetIds = new Map((installed.assets || []).map((asset) => [asset.key, asset.assetId]));
  const importedModules = [];
  const skippedModules = [];
  for (const module of pkg.content.modules) {
    if (await LessonModule.exists({ id: module.id })) {
      skippedModules.push(module.id);
      continue;
    }
    const lessonModule = copy(module);
    for (const character of lessonModule.characters || []) {
      if (!character.assetKey) continue;
      if (!assetIds.has(character.assetKey)) {
        const asset = pkg.assets.find((item) => item.key === character.assetKey);
        if (!asset) throw new Error(`Bundled asset ${character.assetKey} is missing.`);
        const reference = await ensureAsset(pkg, asset);
        await OpenQuizPackage.updateOne(
          { packageId, "assets.key": { $ne: reference.key } },
          { $push: { assets: reference } },
        );
        assetIds.set(reference.key, reference.assetId);
      }
      character.imagePath = `/api/v1/assets/${encodeURIComponent(assetIds.get(character.assetKey))}`;
      delete character.assetKey;
    }
    try {
      await LessonModule.create(lessonModule);
      importedModules.push(module.id);
      clearModuleCache(module.id);
    } catch (error) {
      if (error.code !== 11000) throw error;
      skippedModules.push(module.id);
    }
  }
  if (importedModules.length) {
    await OpenQuizPackage.updateOne(
      { packageId },
      {
        $addToSet: {
          installedSections: "content",
          importedModuleIds: { $each: importedModules },
        },
      },
    );
  }
  return { importedModules, skippedModules };
}

module.exports = {
  ensureBundledThemes,
  bundledContentSummary,
  installBundledContent,
};
