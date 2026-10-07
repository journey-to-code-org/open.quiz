const fs = require("node:fs");
const path = require("node:path");
const ThemeConfiguration = require("../models/ThemeConfiguration.model");

const DEFAULT_APP_NAME = "open.quiz";

const escapeHtml = (value) =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character],
  );

async function getConfiguredAppName() {
  try {
    const configuration = await ThemeConfiguration.findOne({ key: "active" })
      .select("appName")
      .lean();
    return configuration?.appName || null;
  } catch {
    return null;
  }
}

function renderIndexHtml(html, appName) {
  if (!appName || appName === DEFAULT_APP_NAME) return html;
  const safe = escapeHtml(appName);
  const jsonName = JSON.stringify(appName).replace(/</g, "\\u003c");
  return html
    .replace(/<title>open\.quiz<\/title>/, `<title>${safe}</title>`)
    .replace(/(<meta[^>]+content=")open\.quiz/g, `$1${safe}`)
    .replace(/"name":\s*"open\.quiz"/, `"name": ${jsonName}`);
}

function renderManifest(manifestJson, appName) {
  if (!appName) return manifestJson;
  const manifest = JSON.parse(manifestJson);
  manifest.name = appName;
  manifest.short_name = appName.length <= 12 ? appName : appName.slice(0, 12).trim();
  return JSON.stringify(manifest, null, 2);
}

function createSiteShellHandlers(frontendBuildPath) {
  const indexPath = path.join(frontendBuildPath, "index.html");
  const manifestPath = path.join(frontendBuildPath, "site.webmanifest");
  let indexHtml = null;
  let manifestJson = null;
  const readIndex = () => (indexHtml ??= fs.readFileSync(indexPath, "utf8"));
  const readManifest = () => (manifestJson ??= fs.readFileSync(manifestPath, "utf8"));

  return {
    async sendIndex(_req, res, next) {
      try {
        const html = renderIndexHtml(readIndex(), await getConfiguredAppName());
        res.set("Cache-Control", "no-cache");
        return res.type("html").send(html);
      } catch (error) {
        return next(error);
      }
    },
    async sendManifest(_req, res, next) {
      try {
        if (!fs.existsSync(manifestPath)) return next();
        const manifest = renderManifest(readManifest(), await getConfiguredAppName());
        res.set("Cache-Control", "no-cache");
        return res.type("application/manifest+json").send(manifest);
      } catch (error) {
        return next(error);
      }
    },
  };
}

module.exports = { createSiteShellHandlers, renderIndexHtml, renderManifest };
