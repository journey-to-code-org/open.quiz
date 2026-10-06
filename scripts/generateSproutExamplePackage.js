const fs = require("node:fs");
const { execFileSync } = require("node:child_process");
const { chromium } = require("playwright");

const sourceCommit = "d431787";
const sourceAssets = [
  {
    key: "brand.logo",
    filename: "sprout-logo.webp",
    path: "frontend/src/assets/logo.svg",
    max: 256,
  },
  {
    key: "progress.flower",
    filename: "flower-progress.webp",
    path: "frontend/src/assets/flower-progress.webp",
    max: 128,
  },
  {
    key: "avatar.abigail",
    filename: "abigail.webp",
    path: "frontend/src/assets/abigail.webp",
    max: 96,
  },
  {
    key: "avatar.ramona",
    filename: "ramona.webp",
    path: "frontend/src/assets/ramona.webp",
    max: 96,
  },
];

const tokens = {
  primary: "#18816a",
  primaryHover: "#105647",
  primaryAlt: "#41e3c0",
  accent: "#54dec0",
  success: "#18816a",
  heading: "#105647",
  foreground: "#061e19",
  surfaceApp: "#f2fcfa",
  surfaceRaised: "#eafbf7",
  surfaceInset: "#d4f7ef",
  learningPathSurface: "#f2fcfa",
  learningPathText: "#061e19",
  learningPathHeading: "#105647",
  learningPathLine: "#18816a",
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
  const mimeType = sourceAsset.path.endsWith(".svg")
    ? "image/svg+xml"
    : "image/webp";
  const source = `data:${mimeType};base64,${buffer.toString("base64")}`;
  const data = await page.evaluate(
    async ({ imageSource, maxSize }) => {
      const image = new globalThis.Image();
      image.src = imageSource;
      await image.decode();
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
      return canvas.toDataURL("image/webp", 0.72);
    },
    { imageSource: source, maxSize: sourceAsset.max },
  );

  return {
    key: sourceAsset.key,
    filename: sourceAsset.filename,
    mimeType: "image/webp",
    data,
  };
}

async function main() {
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
        version: "1.0.0",
        description:
          "Historical Sprout visual identity using artwork recovered from repository history.",
        author: "open.quiz contributors",
        homepage: null,
      },
      theme: {
        tokens,
        assets: {
          logo: "brand.logo",
          favicon: null,
          hero: null,
          progressBar: "progress.flower",
          avatars: [
            { key: "abigail", name: "Abigail", assetKey: "avatar.abigail" },
            { key: "ramona", name: "Ramona", assetKey: "avatar.ramona" },
          ],
        },
      },
      assets,
    };
    fs.writeFileSync(
      "shared/packages/examples/sprout.openquiz.json",
      `${JSON.stringify(pkg, null, 2)}\n`,
    );
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
