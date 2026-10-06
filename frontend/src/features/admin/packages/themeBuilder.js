export const DEFAULT_THEME_TOKENS = Object.freeze({
  primary: "#315f9e",
  primaryHover: "#244a7d",
  primaryAlt: "#e8b34c",
  accent: "#d8795f",
  success: "#287a65",
  heading: "#213c60",
  foreground: "#263244",
  onPrimary: "#ffffff",
  surfaceApp: "#f5f7fa",
  surfaceRaised: "#ffffff",
  surfaceInset: "#edf1f6",
  surfaceInput: "#ffffff",
  focus: "#244a7d",
  progressStart: "#ffbf1f",
  progressEnd: "#ffd254",
  progressNearStart: "#ffc618",
  progressNearEnd: "#ffdd4f",
  progressCompleteStart: "#ea6fee",
  progressCompleteEnd: "#c989f7",
  learningPathSurface: "#f1f5fa",
  learningPathText: "#334760",
  learningPathHeading: "#23446f",
  learningPathLine: "#34475f",
  fontHeading: '"Poppins", sans-serif',
  fontBody: '"Inter", sans-serif',
});

export const COLOR_GROUPS = [
  {
    label: "Brand",
    tokens: [
      ["primary", "Primary"],
      ["primaryHover", "Primary hover"],
      ["onPrimary", "Text on primary"],
      ["primaryAlt", "Highlight"],
      ["accent", "Accent"],
      ["success", "Success"],
      ["focus", "Focus ring"],
    ],
  },
  {
    label: "Text and surfaces",
    tokens: [
      ["heading", "Headings"],
      ["foreground", "Body text"],
      ["surfaceApp", "Page background"],
      ["surfaceRaised", "Cards"],
      ["surfaceInset", "Inset panels"],
      ["surfaceInput", "Inputs"],
    ],
  },
  {
    label: "Progress bar",
    tokens: [
      ["progressStart", "Fill start"],
      ["progressEnd", "Fill end"],
      ["progressNearStart", "Almost done start"],
      ["progressNearEnd", "Almost done end"],
      ["progressCompleteStart", "Complete start"],
      ["progressCompleteEnd", "Complete end"],
    ],
  },
  {
    label: "Learning path",
    tokens: [
      ["learningPathSurface", "Background"],
      ["learningPathHeading", "Heading"],
      ["learningPathText", "Text"],
      ["learningPathLine", "Trail"],
    ],
  },
];

export const PALETTES = [
  { id: "default", label: "open.quiz", tokens: {} },
  {
    id: "ocean",
    label: "Ocean",
    tokens: {
      primary: "#1f6f8b",
      primaryHover: "#175569",
      primaryAlt: "#f2b544",
      accent: "#e07a5f",
      success: "#2a9d8f",
      heading: "#123c4f",
      foreground: "#22313a",
      surfaceApp: "#f2f8fa",
      surfaceInset: "#e3eff3",
      focus: "#175569",
      progressStart: "#2bb3c0",
      progressEnd: "#7fd8e0",
      progressNearStart: "#f2b544",
      progressNearEnd: "#f7cf7a",
      progressCompleteStart: "#2a9d8f",
      progressCompleteEnd: "#6fcf97",
      learningPathSurface: "#eaf4f7",
      learningPathText: "#2a4552",
      learningPathHeading: "#123c4f",
      learningPathLine: "#2a5566",
    },
  },
  {
    id: "forest",
    label: "Forest",
    tokens: {
      primary: "#2f6b3a",
      primaryHover: "#234f2b",
      primaryAlt: "#e3b23c",
      accent: "#c8553d",
      success: "#3a7d44",
      heading: "#1f3d24",
      foreground: "#26332a",
      surfaceApp: "#f4f7f1",
      surfaceInset: "#e6eee0",
      focus: "#234f2b",
      progressStart: "#8cc63f",
      progressEnd: "#c5e17a",
      progressNearStart: "#f2c94c",
      progressNearEnd: "#f7dc7f",
      progressCompleteStart: "#e86fa0",
      progressCompleteEnd: "#f2a7c3",
      learningPathSurface: "#eef4ea",
      learningPathText: "#324a36",
      learningPathHeading: "#1f3d24",
      learningPathLine: "#3b5a3f",
    },
  },
  {
    id: "sunset",
    label: "Sunset",
    tokens: {
      primary: "#c2410c",
      primaryHover: "#9a3412",
      primaryAlt: "#fbbf24",
      accent: "#db2777",
      success: "#15803d",
      heading: "#7c2d12",
      foreground: "#3b2a22",
      surfaceApp: "#fff7ed",
      surfaceInset: "#ffedd5",
      focus: "#9a3412",
      progressStart: "#fb923c",
      progressEnd: "#fdba74",
      progressNearStart: "#f59e0b",
      progressNearEnd: "#fcd34d",
      progressCompleteStart: "#db2777",
      progressCompleteEnd: "#f472b6",
      learningPathSurface: "#fff1e6",
      learningPathText: "#5a3a2a",
      learningPathHeading: "#7c2d12",
      learningPathLine: "#8a4b2f",
    },
  },
  {
    id: "grape",
    label: "Grape",
    tokens: {
      primary: "#6d28d9",
      primaryHover: "#5b21b6",
      primaryAlt: "#f59e0b",
      accent: "#ec4899",
      success: "#059669",
      heading: "#3b0764",
      foreground: "#2e2440",
      surfaceApp: "#f7f5fc",
      surfaceInset: "#ede9fe",
      focus: "#5b21b6",
      progressStart: "#a78bfa",
      progressEnd: "#c4b5fd",
      progressNearStart: "#f59e0b",
      progressNearEnd: "#fcd34d",
      progressCompleteStart: "#ec4899",
      progressCompleteEnd: "#f9a8d4",
      learningPathSurface: "#f3effc",
      learningPathText: "#3f3456",
      learningPathHeading: "#3b0764",
      learningPathLine: "#4c3d6e",
    },
  },
  {
    id: "slate",
    label: "Slate (high contrast)",
    tokens: {
      primary: "#1f2937",
      primaryHover: "#111827",
      primaryAlt: "#facc15",
      accent: "#0ea5e9",
      success: "#047857",
      heading: "#111827",
      foreground: "#1f2937",
      surfaceApp: "#f8fafc",
      surfaceInset: "#e2e8f0",
      focus: "#0ea5e9",
      progressStart: "#0ea5e9",
      progressEnd: "#7dd3fc",
      progressNearStart: "#facc15",
      progressNearEnd: "#fde68a",
      progressCompleteStart: "#22c55e",
      progressCompleteEnd: "#86efac",
      learningPathSurface: "#f1f5f9",
      learningPathText: "#334155",
      learningPathHeading: "#0f172a",
      learningPathLine: "#334155",
    },
  },
];

export const FONT_PAIRS = [
  {
    id: "default",
    label: "Poppins + Inter (default)",
    fontHeading: DEFAULT_THEME_TOKENS.fontHeading,
    fontBody: DEFAULT_THEME_TOKENS.fontBody,
  },
  {
    id: "system",
    label: "System UI",
    fontHeading: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    fontBody: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  },
  {
    id: "classic",
    label: "Georgia (serif)",
    fontHeading: 'Georgia, "Times New Roman", serif',
    fontBody: 'Georgia, "Times New Roman", serif',
  },
  {
    id: "friendly",
    label: "Trebuchet + Verdana",
    fontHeading: '"Trebuchet MS", "Segoe UI", sans-serif',
    fontBody: 'Verdana, "Segoe UI", sans-serif',
  },
];

const outline = (color) =>
  `stroke="${color}" stroke-width="10" stroke-linejoin="round" stroke-linecap="round"`;

/** Shapes drawn in a 256 x 256 viewBox, pointing up, so they work as markers and trail decorations. */
export const SHAPE_PRESETS = [
  {
    id: "star",
    label: "Star",
    draw: ({ fill, line }) =>
      `<path d="M128 18 L159 92 L238 98 L178 150 L196 228 L128 186 L60 228 L78 150 L18 98 L97 92 Z" fill="${fill}" ${outline(line)}/>`,
  },
  {
    id: "heart",
    label: "Heart",
    draw: ({ fill, line }) =>
      `<path d="M128 224 C60 172 22 132 22 88 C22 54 48 30 80 30 C102 30 120 42 128 62 C136 42 154 30 176 30 C208 30 234 54 234 88 C234 132 196 172 128 224 Z" fill="${fill}" ${outline(line)}/>`,
  },
  {
    id: "flower",
    label: "Flower",
    draw: ({ fill, line, accent }) =>
      [0, 72, 144, 216, 288]
        .map((angle) => {
          const radians = ((angle - 90) * Math.PI) / 180;
          const cx = (128 + Math.cos(radians) * 60).toFixed(1);
          const cy = (128 + Math.sin(radians) * 60).toFixed(1);
          return `<circle cx="${cx}" cy="${cy}" r="48" fill="${fill}" ${outline(line)}/>`;
        })
        .join("") + `<circle cx="128" cy="128" r="38" fill="${accent}" ${outline(line)}/>`,
  },
  {
    id: "leaf",
    label: "Leaf",
    draw: ({ fill, line }) =>
      `<path d="M128 234 C46 182 38 94 128 22 C218 94 210 182 128 234 Z" fill="${fill}" ${outline(line)}/><path d="M128 234 V70 M128 150 L92 118 M128 120 L164 92" fill="none" ${outline(line)}/>`,
  },
  {
    id: "rocket",
    label: "Rocket",
    draw: ({ fill, line, accent }) =>
      `<path d="M104 178 L128 238 L152 178 Z" fill="${accent}" ${outline(line)}/><path d="M90 138 L50 198 L94 184 Z M166 138 L206 198 L162 184 Z" fill="${accent}" ${outline(line)}/><path d="M128 18 C172 58 182 120 168 180 H88 C74 120 84 58 128 18 Z" fill="${fill}" ${outline(line)}/><circle cx="128" cy="100" r="22" fill="#ffffff" ${outline(line)}/>`,
  },
  {
    id: "trophy",
    label: "Trophy",
    draw: ({ fill, line }) =>
      `<path d="M72 60 H40 C40 104 58 122 80 122 M184 60 H216 C216 104 198 122 176 122" fill="none" ${outline(line)}/><path d="M70 34 H186 V94 C186 140 160 166 128 166 C96 166 70 140 70 94 Z" fill="${fill}" ${outline(line)}/><path d="M114 166 H142 V198 H114 Z M78 198 H178 V228 H78 Z" fill="${fill}" ${outline(line)}/>`,
  },
  {
    id: "lightning",
    label: "Lightning",
    draw: ({ fill, line }) =>
      `<path d="M150 14 L56 146 H120 L104 242 L202 104 H136 Z" fill="${fill}" ${outline(line)}/>`,
  },
];

export const MARKER_SPEC = { size: 256, label: "Transparent square PNG or WebP, 256 x 256 px" };
export const DECORATION_SPEC = {
  size: 128,
  label: "Transparent square PNG or WebP, 128 x 128 px, drawn pointing up",
};
export const FRAME_SPEC = { width: 900, height: 147, label: "Transparent PNG, 900 x 147 px" };
export const LOGO_SPEC = { width: 512, height: 216, label: "Transparent PNG, about 512 x 216 px" };

export function shapeSvg(shapeId, { fill, line, accent }) {
  const shape = SHAPE_PRESETS.find((entry) => entry.id === shapeId) || SHAPE_PRESETS[0];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">${shape.draw({
    fill,
    line,
    accent: accent || fill,
  })}</svg>`;
}

export const svgDataUrl = (svg) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

function channel(value) {
  const normalized = value / 255;
  return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
}

function luminance(hex) {
  let value = String(hex || "").replace("#", "");
  if (value.length === 3)
    value = value
      .split("")
      .map((character) => character + character)
      .join("");
  if (!/^[\da-f]{6}$/i.test(value)) return null;
  const [r, g, b] = [0, 2, 4].map((index) => channel(parseInt(value.slice(index, index + 2), 16)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(first, second) {
  const a = luminance(first);
  const b = luminance(second);
  if (a === null || b === null) return null;
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

const CONTRAST_PAIRS = [
  ["onPrimary", "primary", "Text on primary buttons"],
  ["foreground", "surfaceApp", "Body text on the page background"],
  ["heading", "surfaceApp", "Headings on the page background"],
  ["foreground", "surfaceRaised", "Body text on cards"],
  ["learningPathText", "learningPathSurface", "Learning path text"],
];

export function contrastWarnings(tokens) {
  return CONTRAST_PAIRS.flatMap(([text, background, label]) => {
    const ratio = contrastRatio(tokens[text], tokens[background]);
    return ratio !== null && ratio < 4.5
      ? [`${label} has a contrast ratio of ${ratio.toFixed(1)}:1 (aim for at least 4.5:1).`]
      : [];
  });
}

export function createThemeId(name, now = Date.now()) {
  const slug =
    String(name || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "theme";
  return `custom-${slug}-${now.toString(36)}`;
}

const PORTABLE_IMAGE = /^data:(image\/(?:png|jpeg|webp));base64,/i;
const EXTENSIONS = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

/**
 * Builds an .openquiz.json theme package. Every image must already be a PNG, JPEG, or WebP data URL.
 */
export function buildThemePackage({
  id,
  name,
  description = "",
  tokens,
  trail,
  images = {},
  avatars = [],
  appName = "",
  landing = null,
}) {
  const assets = [];
  const themeAssets = {};
  const addAsset = (key, data) => {
    const match = PORTABLE_IMAGE.exec(data || "");
    if (!match) throw new Error(`Image ${key} must be a PNG, JPEG, or WebP data URL.`);
    const mimeType = match[1].toLowerCase();
    assets.push({ key, mimeType, filename: `${key}.${EXTENSIONS[mimeType]}`, data });
    return key;
  };
  for (const [slot, data] of Object.entries(images)) {
    if (data) themeAssets[slot] = addAsset(`theme.${slot}`, data);
  }
  const avatarEntries = avatars
    .filter((avatar) => avatar.data)
    .map((avatar) => ({
      key: avatar.key,
      name: avatar.name || avatar.key,
      assetKey: addAsset(`avatar.${avatar.key}`, avatar.data),
    }));
  if (avatarEntries.length) themeAssets.avatars = avatarEntries;
  const trailSettings = { style: trail?.style || "dashed" };
  if (Number.isInteger(trail?.decorationCount))
    trailSettings.decorationCount = trail.decorationCount;
  const siteName = String(appName || "")
    .trim()
    .replace(/\s+/g, " ");
  if (siteName.length > 60) throw new Error("App name must be 60 characters or fewer.");
  return {
    schemaVersion: 1,
    package: {
      id,
      name: String(name || "").trim() || "Custom theme",
      version: "1.0.0",
      ...(description.trim() ? { description: description.trim() } : {}),
    },
    theme: {
      ...(siteName ? { appName: siteName } : {}),
      tokens: { ...tokens },
      trail: trailSettings,
      ...(landing ? { landing } : {}),
      assets: themeAssets,
    },
    assets,
  };
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("An image could not be loaded."));
    image.src = src;
  });
}

function readBlob(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("An image could not be read."));
    reader.readAsDataURL(blob);
  });
}

async function rasterize(src, width, height) {
  const image = await loadImage(src);
  const canvas = document.createElement("canvas");
  canvas.width = width || image.naturalWidth || 256;
  canvas.height = height || image.naturalHeight || 256;
  canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/png");
}

/** Converts SVG presets and server asset URLs into package-ready PNG/JPEG/WebP data URLs. */
export async function toPortableImage(src, size) {
  if (!src) return null;
  if (PORTABLE_IMAGE.test(src)) return src;
  if (src.startsWith("data:image/svg+xml")) return rasterize(src, size?.width, size?.height);
  const response = await fetch(src, { credentials: "include" });
  if (!response.ok) throw new Error("A base theme image could not be downloaded.");
  const blob = await response.blob();
  if (EXTENSIONS[blob.type]) return readBlob(blob);
  const objectUrl = URL.createObjectURL(blob);
  try {
    return await rasterize(objectUrl, size?.width, size?.height);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/** Reads an uploaded image and reports its size so the UI can compare it to the recommended spec. */
export async function readImageUpload(file) {
  if (!file) return null;
  if (!EXTENSIONS[file.type]) throw new Error("Upload a PNG, JPEG, or WebP image.");
  if (file.size > 4 * 1024 * 1024) throw new Error("Images must be 4 MB or smaller.");
  const data = await readBlob(file);
  const image = await loadImage(data);
  return { data, width: image.naturalWidth, height: image.naturalHeight };
}
