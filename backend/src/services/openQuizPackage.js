const { randomUUID } = require("node:crypto");

const PACKAGE_SCHEMA_VERSION = 1;
const MAX_ASSET_BYTES = 4 * 1024 * 1024;
const MAX_TOTAL_ASSET_BYTES = 12 * 1024 * 1024;
const MAX_PACKAGE_BYTES = 16 * 1024 * 1024;
const MAX_AVATARS = 20;
const MAX_ASSETS = 64;
const TRAIL_STYLES = ["vine", "dashed", "dotted", "solid", "double"];
const THEME_ASSET_SLOTS = [
  "logo",
  "favicon",
  "hero",
  "progressBar",
  "progressFrame",
  "trailDecoration",
  "answerCorrect",
  "answerIncorrect",
];
const ALLOWED_TOKEN_NAMES = new Set([
  "primary",
  "primaryHover",
  "primaryAlt",
  "accent",
  "success",
  "progressStart",
  "progressEnd",
  "progressNearStart",
  "progressNearEnd",
  "progressCompleteStart",
  "progressCompleteEnd",
  "heading",
  "foreground",
  "onPrimary",
  "surfaceApp",
  "surfaceRaised",
  "surfaceInset",
  "surfaceInput",
  "focus",
  "learningPathSurface",
  "learningPathText",
  "learningPathHeading",
  "learningPathLine",
  "fontHeading",
  "fontBody",
  "fontSizeH1",
  "fontSizeH2",
  "fontSizeH3",
  "fontSizeH4",
  "fontSizeBody",
  "fontSizeSmall",
  "fontSizeCaption",
  "radiusSm",
  "radiusMd",
  "radiusLg",
  "radiusPill",
]);
const SECRET_KEYS = new Set([
  "user",
  "users",
  "email",
  "emails",
  "password",
  "passwords",
  "passwordhash",
  "oauth",
  "oauthcredentials",
  "jwtsecret",
  "secret",
  "apikey",
  "databaseurl",
  "session",
  "sessions",
  "progress",
  "learnerprogress",
  "quizattempts",
  "leaderboardhistory",
  "analytics",
  "admin",
  "adminaccounts",
  "deploymentsecrets",
  "environment",
  "environmentfile",
]);
const FORBIDDEN_PACKAGE_KEYS = new Set([
  "__proto__",
  "prototype",
  "constructor",
  "_id",
  "__v",
  "asset_id",
  "uploaded_by",
  "installedBy",
]);

const imageSignatures = {
  "image/png": (buffer) =>
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
  "image/jpeg": (buffer) =>
    buffer.length >= 3 && buffer.subarray(0, 3).equals(Buffer.from([255, 216, 255])),
  "image/webp": (buffer) =>
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP",
};

const fail = (message) => {
  const error = new Error(message);
  error.status = 400;
  throw error;
};

function validateColor(value, label) {
  if (typeof value !== "string" || !/^#[\da-f]{3}(?:[\da-f]{3})?$/i.test(value)) {
    fail(`Theme token ${label} must be a 3- or 6-digit hex color.`);
  }
}

function validateTokens(tokens) {
  if (!tokens || typeof tokens !== "object" || Array.isArray(tokens)) {
    fail("Theme tokens must be an object.");
  }

  for (const [name, value] of Object.entries(tokens)) {
    if (!ALLOWED_TOKEN_NAMES.has(name)) fail(`Unrecognized theme token: ${name}.`);
    if (name.startsWith("fontSize")) {
      const match = typeof value === "string" && /^(\d{1,2}(?:\.\d+)?)(px|rem)$/.exec(value);
      if (!match) fail(`Theme token ${name} must be a bounded px or rem font size.`);
      const size = Number(match[1]);
      const maximum = match[2] === "px" ? 96 : 6;
      const minimum = match[2] === "px" ? 8 : 0.5;
      if (size < minimum || size > maximum)
        fail(`Theme token ${name} is outside the supported font-size range.`);
    } else if (name.startsWith("font")) {
      if (
        typeof value !== "string" ||
        value.length > 120 ||
        !/^[\w\s,"'-]+$/.test(value) ||
        /url|import/i.test(value)
      ) {
        fail(`Theme token ${name} must be a safe font stack.`);
      }
    } else if (name.startsWith("radius")) {
      if (typeof value !== "string" || !/^(?:\d{1,3}px|\d{1,2}(?:\.\d+)?rem|9999px)$/.test(value)) {
        fail(`Theme token ${name} must be a pixel or rem radius.`);
      }
    } else {
      validateColor(value, name);
    }
  }
}

function validateTrail(trail) {
  if (!trail || typeof trail !== "object" || Array.isArray(trail))
    fail("Theme trail must be an object.");
  for (const [name, value] of Object.entries(trail)) {
    if (name === "style") {
      if (!TRAIL_STYLES.includes(value))
        fail(`Theme trail style must be one of: ${TRAIL_STYLES.join(", ")}.`);
    } else if (name === "decorationCount") {
      if (!Number.isInteger(value) || value < 0 || value > 3)
        fail("Theme trail decorationCount must be an integer from 0 to 3.");
    } else {
      fail(`Unrecognized theme trail setting: ${name}.`);
    }
  }
}

const MAX_APP_NAME_LENGTH = 60;

const LANDING_LIST_LIMITS = { benefits: 6, steps: 6, faq: 10 };
const LANDING_ITEM_FIELDS = {
  benefits: { icon: 8, title: 80, body: 600 },
  steps: { title: 80, body: 600 },
  faq: { question: 200, answer: 1200 },
};

function landingText(value, label, maxLength, { optional = false } = {}) {
  if (value === undefined && optional) return undefined;
  if (typeof value !== "string") fail(`Landing page ${label} must be text.`);
  const text = value.trim();
  if ((!text && !optional) || text.length > maxLength)
    fail(`Landing page ${label} must be between 1 and ${maxLength} characters.`);
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text))
    fail(`Landing page ${label} cannot contain control characters.`);
  return text || undefined;
}

function normalizeLanding(landing) {
  if (!landing || typeof landing !== "object" || Array.isArray(landing))
    fail("Landing page settings must be an object.");
  const normalized = {};
  for (const key of Object.keys(landing)) {
    if (!["hero", ...Object.keys(LANDING_LIST_LIMITS)].includes(key))
      fail(`Unrecognized landing page section: ${key}.`);
  }
  if (landing.hero !== undefined) {
    const hero = landing.hero;
    if (!hero || typeof hero !== "object" || Array.isArray(hero))
      fail("Landing page hero must be an object.");
    for (const key of Object.keys(hero)) {
      if (!["heading", "body", "showAvatars"].includes(key))
        fail(`Unrecognized landing page hero field: ${key}.`);
    }
    if (hero.showAvatars !== undefined && typeof hero.showAvatars !== "boolean")
      fail("Landing page hero showAvatars must be true or false.");
    normalized.hero = {
      heading: landingText(hero.heading, "hero heading", 120),
      body: landingText(hero.body, "hero text", 500),
      ...(hero.showAvatars !== undefined ? { showAvatars: hero.showAvatars } : {}),
    };
  }
  for (const [section, limit] of Object.entries(LANDING_LIST_LIMITS)) {
    if (landing[section] === undefined) continue;
    const value = landing[section];
    if (!value || typeof value !== "object" || Array.isArray(value))
      fail(`Landing page ${section} must be an object.`);
    for (const key of Object.keys(value)) {
      if (!["heading", "items"].includes(key))
        fail(`Unrecognized landing page ${section} field: ${key}.`);
    }
    if (!Array.isArray(value.items) || value.items.length > limit)
      fail(`Landing page ${section} needs a list of at most ${limit} items.`);
    const fields = LANDING_ITEM_FIELDS[section];
    normalized[section] = {
      heading: landingText(value.heading, `${section} heading`, 120),
      items: value.items.map((item, index) => {
        if (!item || typeof item !== "object" || Array.isArray(item))
          fail(`Landing page ${section} item ${index + 1} must be an object.`);
        for (const key of Object.keys(item)) {
          if (!fields[key]) fail(`Unrecognized landing page ${section} item field: ${key}.`);
        }
        return Object.fromEntries(
          Object.entries(fields)
            .map(([field, max]) => [
              field,
              landingText(item[field], `${section} ${field}`, max, { optional: field === "icon" }),
            ])
            .filter(([, text]) => text !== undefined),
        );
      }),
    };
  }
  return normalized;
}

function normalizeAppName(value) {
  if (typeof value !== "string") fail("App name must be text.");
  const name = value.trim().replace(/\s+/g, " ");
  if (!name || name.length > MAX_APP_NAME_LENGTH)
    fail(`App name must be between 1 and ${MAX_APP_NAME_LENGTH} characters.`);
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(name)) fail("App name cannot contain control characters.");
  return name;
}

function decodePackageAsset(asset, keys) {
  if (!asset || typeof asset !== "object" || Array.isArray(asset))
    fail("Each package asset must be an object.");
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/.test(asset.key || ""))
    fail("Package asset keys must be stable, safe identifiers.");
  if (keys.has(asset.key)) fail(`Duplicate package asset key: ${asset.key}.`);
  keys.add(asset.key);
  if (!imageSignatures[asset.mimeType]) fail(`Unsupported image type for asset ${asset.key}.`);
  if (
    typeof asset.filename !== "string" ||
    asset.filename.length > 160 ||
    /[\\/]/.test(asset.filename)
  ) {
    fail(`Asset ${asset.key} must have a plain filename.`);
  }
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([a-z\d+/]+=*)$/i.exec(asset.data || "");
  if (!match || match[1].toLowerCase() !== asset.mimeType)
    fail(`Asset ${asset.key} has invalid base64 image data.`);
  const data = Buffer.from(match[2], "base64");
  if (data.length > MAX_ASSET_BYTES) fail(`Asset ${asset.key} exceeds the 4 MB limit.`);
  if (!imageSignatures[asset.mimeType](data))
    fail(`Asset ${asset.key} does not match its declared image type.`);
  return data;
}

function inspectModules(modules) {
  if (!Array.isArray(modules)) fail("content.modules must be an array.");
  const ids = new Set();
  let lessonCount = 0;
  let knowledgeChecks = 0;

  for (const module of modules) {
    if (!module || typeof module !== "object" || Array.isArray(module))
      fail("Each content module must be an object.");
    if (
      typeof module.id !== "string" ||
      !module.id.trim() ||
      typeof module.title !== "string" ||
      !module.title.trim()
    ) {
      fail("Every content module needs an id and title.");
    }
    if (ids.has(module.id)) fail(`Duplicate module ID in package: ${module.id}.`);
    ids.add(module.id);
    if (!Array.isArray(module.lessons)) fail(`Module ${module.id} must contain a lessons array.`);
    const characters = module.characters || [];
    if (!Array.isArray(characters)) fail(`Module ${module.id} characters must be an array.`);
    const characterIds = new Set();
    for (const character of characters) {
      if (
        !character ||
        typeof character.characterId !== "string" ||
        !character.characterId.trim()
      ) {
        fail(`Module ${module.id} has a character without a characterId.`);
      }
      if (characterIds.has(character.characterId))
        fail(`Module ${module.id} contains duplicate character ${character.characterId}.`);
      characterIds.add(character.characterId);
      if (character.imagePath && !character.assetKey) {
        fail(
          `Character ${character.characterId} must use a package-local assetKey instead of an installation-specific imagePath.`,
        );
      }
      if (character.assetKey && !/^[a-zA-Z0-9][\w.-]{0,79}$/.test(character.assetKey)) {
        fail(`Character ${character.characterId} has an invalid assetKey.`);
      }
    }
    for (const entry of module.glossary || []) {
      if (
        !entry ||
        typeof entry.term !== "string" ||
        !entry.term.trim() ||
        typeof entry.definition !== "string"
      ) {
        fail(`Module ${module.id} has an invalid glossary entry.`);
      }
    }
    if (module.worksCited !== undefined && !Array.isArray(module.worksCited)) {
      fail(`Module ${module.id} worksCited must be an array.`);
    }
    for (const citation of module.worksCited || []) {
      if (!citation || typeof citation.title !== "string" || !citation.title.trim()) {
        fail(`Module ${module.id} has an invalid citation.`);
      }
    }
    const lessonIds = new Set();
    const microLessonIds = new Set();
    const questionIds = new Set();
    for (const lesson of module.lessons) {
      if (!lesson || typeof lesson.id !== "string" || !lesson.id.trim())
        fail(`Module ${module.id} has a lesson without an id.`);
      if (lessonIds.has(lesson.id))
        fail(`Module ${module.id} contains duplicate lesson ID ${lesson.id}.`);
      lessonIds.add(lesson.id);
      lessonCount += 1;
      if (lesson.microLessons !== undefined && !Array.isArray(lesson.microLessons)) {
        fail(`Lesson ${lesson.id} microLessons must be an array.`);
      }
      for (const microLesson of lesson.microLessons || []) {
        if (!microLesson || typeof microLesson.id !== "string" || !microLesson.id.trim()) {
          fail(`Lesson ${lesson.id} has a micro-lesson without an id.`);
        }
        if (microLessonIds.has(microLesson.id))
          fail(`Module ${module.id} contains duplicate micro-lesson ID ${microLesson.id}.`);
        microLessonIds.add(microLesson.id);
        if (!Array.isArray(microLesson.microLessonContent)) {
          fail(`Micro-lesson ${microLesson.id} must contain a microLessonContent array.`);
        }
        for (const item of microLesson.microLessonContent) {
          if (!item || typeof item.type !== "string")
            fail(`Micro-lesson ${microLesson.id} contains an invalid content block.`);
          if (item.characterId && !characterIds.has(item.characterId)) {
            fail(`Content block references unknown character ${item.characterId}.`);
          }
          if (item.type !== "knowledgeCheck") continue;
          knowledgeChecks += 1;
          if (typeof item.id !== "string" || !item.id.trim() || questionIds.has(item.id)) {
            fail(`Module ${module.id} contains a missing or duplicate knowledge-check ID.`);
          }
          questionIds.add(item.id);
          if (
            !item.question ||
            !["multipleChoice", "trueFalse", "multiSelect"].includes(item.questionType)
          ) {
            fail(`Knowledge check ${item.id} needs a supported questionType and question.`);
          }
          if (!Array.isArray(item.answerChoices) || item.answerChoices.length < 2) {
            fail(`Knowledge check ${item.id} must have at least two answer choices.`);
          }
          const choiceKeys = new Set();
          for (const choice of item.answerChoices) {
            if (
              !choice ||
              typeof choice.key !== "string" ||
              !choice.key.trim() ||
              typeof choice.text !== "string" ||
              !choice.text.trim()
            ) {
              fail(`Knowledge check ${item.id} contains an invalid answer choice.`);
            }
            if (choiceKeys.has(choice.key))
              fail(`Knowledge check ${item.id} contains duplicate answer keys.`);
            choiceKeys.add(choice.key);
          }
          const correctKeys = Array.isArray(item.correctResponse)
            ? item.correctResponse
            : [item.correctResponse];
          if (
            !correctKeys.length ||
            correctKeys.some((key) => typeof key !== "string" || !choiceKeys.has(key))
          ) {
            fail(
              `Knowledge check ${item.id} has a correct response that does not match an answer choice.`,
            );
          }
        }
      }
    }
  }
  return { moduleCount: modules.length, lessonCount, knowledgeChecks };
}

function rejectPrivateData(value, path = "package") {
  if (!value || typeof value !== "object") return;
  for (const [key, nested] of Object.entries(value)) {
    if (FORBIDDEN_PACKAGE_KEYS.has(key))
      fail(`Packages cannot contain database fields (${path}.${key}).`);
    const normalizedKey = key.toLowerCase().replace(/[^a-z]/g, "");
    if (SECRET_KEYS.has(normalizedKey))
      fail(`Packages cannot contain private operational data (${path}.${key}).`);
    rejectPrivateData(nested, `${path}.${key}`);
  }
}

function validateOpenQuizPackage(input) {
  let pkg = input;
  if (Buffer.isBuffer(input)) {
    if (input.length > MAX_PACKAGE_BYTES) fail("Package exceeds the 16 MB upload limit.");
    try {
      pkg = JSON.parse(input.toString("utf8"));
    } catch {
      fail("Package file contains invalid JSON.");
    }
  } else if (Buffer.byteLength(JSON.stringify(input ?? {}), "utf8") > MAX_PACKAGE_BYTES) {
    fail("Package exceeds the 16 MB upload limit.");
  }
  if (!pkg || typeof pkg !== "object" || Array.isArray(pkg)) fail("Package must be a JSON object.");
  rejectPrivateData(pkg);
  if (pkg.schemaVersion !== PACKAGE_SCHEMA_VERSION)
    fail(`Unsupported package schemaVersion. Supported version: ${PACKAGE_SCHEMA_VERSION}.`);
  if (!pkg.package || typeof pkg.package !== "object" || Array.isArray(pkg.package))
    fail("Package metadata is required.");
  const metadata = {
    ...pkg.package,
    id: pkg.package.id || `imported-${randomUUID()}`,
    name: pkg.package.name || "Imported open.quiz package",
    version: pkg.package.version || "1.0.0",
  };
  pkg = { ...pkg, package: metadata };
  if (!/^[a-z0-9][a-z0-9._-]{0,79}$/i.test(metadata.id)) fail("Package metadata needs a valid id.");
  if (typeof metadata.name !== "string" || !metadata.name.trim() || metadata.name.length > 120)
    fail("Package metadata needs a name under 120 characters.");
  if (
    typeof metadata.version !== "string" ||
    !/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(metadata.version)
  )
    fail("Package version must use semantic version format.");

  const hasTheme = Object.hasOwn(pkg, "theme");
  const hasContent = Object.hasOwn(pkg, "content");
  if (!hasTheme && !hasContent) fail("Package must include a theme, content, or both.");
  if (hasTheme) {
    if (!pkg.theme || typeof pkg.theme !== "object" || Array.isArray(pkg.theme))
      fail("theme must be an object.");
    if (pkg.theme.tokens !== undefined) validateTokens(pkg.theme.tokens);
    if (pkg.theme.trail !== undefined) validateTrail(pkg.theme.trail);
    if (pkg.theme.appName !== undefined) pkg.theme.appName = normalizeAppName(pkg.theme.appName);
    if (pkg.theme.landing !== undefined) pkg.theme.landing = normalizeLanding(pkg.theme.landing);
    for (const key of Object.keys(pkg.theme)) {
      if (!["tokens", "assets", "trail", "appName", "landing"].includes(key))
        fail(`Unrecognized theme section: ${key}.`);
    }
  }
  const assets = pkg.assets ?? [];
  if (!Array.isArray(assets)) fail("assets must be an array.");
  if (assets.length > MAX_ASSETS) fail("A package can include at most 64 assets.");
  const assetKeys = new Set();
  let totalAssetBytes = 0;
  for (const asset of assets) totalAssetBytes += decodePackageAsset(asset, assetKeys).length;
  if (totalAssetBytes > MAX_TOTAL_ASSET_BYTES)
    fail("Package assets exceed the 12 MB decoded size limit.");
  const avatars = pkg.theme?.assets?.avatars ?? [];
  if (!Array.isArray(avatars) || avatars.length > MAX_AVATARS)
    fail("A package can include at most 20 theme avatars.");
  const avatarKeys = new Set();
  for (const avatar of avatars) {
    if (!avatar || typeof avatar.key !== "string" || !/^[a-zA-Z0-9][\w.-]{0,79}$/.test(avatar.key))
      fail("Theme avatars need stable keys.");
    if (avatarKeys.has(avatar.key)) fail(`Duplicate avatar key: ${avatar.key}.`);
    avatarKeys.add(avatar.key);
    if (!assetKeys.has(avatar.assetKey))
      fail(`Avatar ${avatar.key} references an unknown package asset.`);
  }
  for (const [slot, assetKey] of Object.entries(pkg.theme?.assets || {})) {
    if (slot === "avatars") continue;
    if (assetKey !== null && !assetKeys.has(assetKey))
      fail(`Theme asset ${slot} references an unknown package asset.`);
    if (!THEME_ASSET_SLOTS.includes(slot)) fail(`Unrecognized theme asset slot: ${slot}.`);
  }
  const contentCounts = hasContent
    ? inspectModules(pkg.content?.modules)
    : { moduleCount: 0, lessonCount: 0, knowledgeChecks: 0 };
  const contentAssetKeys = new Set();
  const visitAssetRefs = (value) => {
    if (!value || typeof value !== "object") return;
    if (typeof value.assetKey === "string") contentAssetKeys.add(value.assetKey);
    for (const nested of Object.values(value)) visitAssetRefs(nested);
  };
  if (hasContent) visitAssetRefs(pkg.content);
  for (const key of contentAssetKeys)
    if (!assetKeys.has(key)) fail(`Content references unknown package asset ${key}.`);
  const avatarAssetKeys = new Set(avatars.map((avatar) => avatar.assetKey));
  for (const module of pkg.content?.modules || []) {
    for (const character of module.characters || []) {
      if (character.assetKey) avatarAssetKeys.add(character.assetKey);
    }
  }

  const manifest = {
    includes: { theme: hasTheme, content: hasContent },
    counts: {
      assets: assets.length,
      avatars: avatarAssetKeys.size,
      modules: contentCounts.moduleCount,
      lessons: contentCounts.lessonCount,
      knowledgeChecks: contentCounts.knowledgeChecks,
    },
  };
  const assetBuffers = Object.fromEntries(
    assets.map((asset) => [asset.key, Buffer.from(asset.data.split(",")[1], "base64")]),
  );
  return { ...pkg, manifest, _assetBuffers: assetBuffers };
}

module.exports = {
  MAX_APP_NAME_LENGTH,
  MAX_ASSET_BYTES,
  MAX_ASSETS,
  MAX_PACKAGE_BYTES,
  MAX_TOTAL_ASSET_BYTES,
  PACKAGE_SCHEMA_VERSION,
  THEME_ASSET_SLOTS,
  TRAIL_STYLES,
  normalizeAppName,
  normalizeLanding,
  validateOpenQuizPackage,
};
