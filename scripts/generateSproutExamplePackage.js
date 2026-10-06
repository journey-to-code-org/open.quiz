const fs = require("node:fs");
const { execFileSync } = require("node:child_process");
const { chromium } = require("playwright");
const sproutLanding = require("./sproutLanding");

const sourceCommit = "d431787";
const sourceAssets = [
  {
    key: "brand.logo",
    filename: "sprout-logo.webp",
    path: "frontend/src/assets/logo.svg",
    max: 512,
  },
  {
    key: "progress.flower",
    filename: "flower-progress.webp",
    path: "frontend/src/assets/flower-progress.webp",
    max: 256,
  },
  {
    key: "progress.frame",
    filename: "progress-frame.webp",
    path: "frontend/src/assets/progress-bar.svg",
    max: 900,
  },
  {
    key: "avatar.abigail",
    filename: "abigail.webp",
    path: "frontend/src/assets/abigail.webp",
    max: 512,
    preserveOriginal: true,
  },
  {
    key: "avatar.ramona",
    filename: "ramona.webp",
    path: "frontend/src/assets/ramona.webp",
    max: 512,
    preserveOriginal: true,
  },
  {
    key: "feedback.correct",
    filename: "right-answer.webp",
    path: "frontend/src/assets/right_answer.svg",
    square: 128,
  },
  {
    key: "feedback.incorrect",
    filename: "wrong-answer.webp",
    path: "frontend/src/assets/wrong_answer.svg",
    square: 128,
  },
  {
    key: "avatar.beaver",
    filename: "beaver.webp",
    path: "frontend/src/assets/dabbingBeaver.svg",
    max: 512,
  },
];

const tokens = {
  primary: "#18816a",
  primaryHover: "#105647",
  primaryAlt: "#41e3c0",
  accent: "#54dec0",
  success: "#18816a",
  progressStart: "#ffbf1f",
  progressEnd: "#ffd254",
  progressNearStart: "#ffc618",
  progressNearEnd: "#ffdd4f",
  progressCompleteStart: "#ea6fee",
  progressCompleteEnd: "#c989f7",
  heading: "#105647",
  foreground: "#061e19",
  onPrimary: "#f2fcfa",
  surfaceApp: "#f2fcfa",
  surfaceRaised: "#eafbf7",
  surfaceInset: "#d4f7ef",
  surfaceInput: "#ffffff",
  focus: "#105647",
  learningPathSurface: "#e8f7f2",
  learningPathText: "#195d50",
  learningPathHeading: "#1a6b58",
  learningPathLine: "#263e39",
  fontHeading:
    String.fromCharCode(34) +
    "Poppins" +
    String.fromCharCode(34) +
    ", sans-serif",
  fontBody:
    String.fromCharCode(34) +
    "Inter" +
    String.fromCharCode(34) +
    ", sans-serif",
  radiusSm: "4px",
  radiusMd: "8px",
  radiusLg: "12px",
  radiusPill: "9999px",
};

async function convertAsset(page, sourceAsset) {
  const buffer = execFileSync("git", [
    "show",
    `${sourceCommit}:${sourceAsset.path}`,
  ]);
  if (sourceAsset.preserveOriginal) {
    return {
      key: sourceAsset.key,
      filename: sourceAsset.filename,
      mimeType: "image/webp",
      data: `data:image/webp;base64,${buffer.toString("base64")}`,
    };
  }
  const mimeType = sourceAsset.path.endsWith(".svg")
    ? "image/svg+xml"
    : "image/webp";
  const source = `data:${mimeType};base64,${buffer.toString("base64")}`;
  const data = await page.evaluate(
    async ({ imageSource, maxSize, square }) => {
      const image = new globalThis.Image();
      image.src = imageSource;
      await image.decode();
      if (square) {
        // Small vector marks are scaled up and centered on a transparent square canvas.
        const canvas = globalThis.document.createElement("canvas");
        canvas.width = square;
        canvas.height = square;
        const inner = square * 0.86;
        const fit = inner / Math.max(image.naturalWidth, image.naturalHeight);
        const width = image.naturalWidth * fit;
        const height = image.naturalHeight * fit;
        canvas
          .getContext("2d")
          .drawImage(
            image,
            (square - width) / 2,
            (square - height) / 2,
            width,
            height,
          );
        return canvas.toDataURL("image/webp", 0.95);
      }
      const scale = Math.min(
        1,
        maxSize / Math.max(image.naturalWidth, image.naturalHeight),
      );
      const width = Math.max(1, Math.round(image.naturalWidth * scale));
      const height = Math.max(1, Math.round(image.naturalHeight * scale));
      const canvas = globalThis.document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d").drawImage(image, 0, 0, width, height);
      return canvas.toDataURL("image/webp", 0.95);
    },
    {
      imageSource: source,
      maxSize: sourceAsset.max,
      square: sourceAsset.square,
    },
  );

  return {
    key: sourceAsset.key,
    filename: sourceAsset.filename,
    mimeType: "image/webp",
    data,
  };
}

async function main() {
  const outputPath = "shared/packages/examples/sprout.openquiz.json";
  const existingPackage = JSON.parse(fs.readFileSync(outputPath, "utf8"));
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const assets = [];
    for (const sourceAsset of sourceAssets)
      assets.push(await convertAsset(page, sourceAsset));
    const pkg = {
      schemaVersion: 1,
      package: {
        id: "sprout",
        name: "Sprout",
        version: "1.4.0",
        description:
          "Historical Sprout visual identity using artwork recovered from repository history.",
        author: "open.quiz contributors",
        homepage: null,
      },
      theme: {
        appName: sproutLanding.appName,
        tokens,
        trail: { style: "vine", decorationCount: 2 },
        landing: sproutLanding.landing,
        assets: {
          logo: "brand.logo",
          favicon: null,
          hero: null,
          progressBar: "progress.flower",
          progressFrame: "progress.frame",
          answerCorrect: "feedback.correct",
          answerIncorrect: "feedback.incorrect",
          avatars: [
            { key: "abigail", name: "Abigail", assetKey: "avatar.abigail" },
            { key: "ramona", name: "Ramona", assetKey: "avatar.ramona" },
            { key: "beaver", name: "Beaver guide", assetKey: "avatar.beaver" },
            { key: "guide", name: "Beaver guide", assetKey: "avatar.beaver" },
          ],
        },
      },
      assets,
      ...(existingPackage.content ? { content: existingPackage.content } : {}),
    };
    const {
      validateOpenQuizPackage,
    } = require("../backend/src/services/openQuizPackage");
    pkg.manifest = validateOpenQuizPackage(pkg).manifest;
    fs.writeFileSync(outputPath, `${JSON.stringify(pkg, null, 2)}\n`);
    console.log(
      `Generated Sprout example with ${assets.length} embedded raster assets.`,
    );
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
