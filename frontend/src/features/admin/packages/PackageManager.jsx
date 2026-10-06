import { useEffect, useState } from "react";
import { applyInstanceTheme } from "../../../app/instanceTheme";
import {
  activateAdminPackage,
  activateDefaultAdminTheme,
  deleteAdminPackage,
  downloadAdminPackage,
  getAdminPackages,
  inspectAdminPackage,
  importAdminPackage,
} from "../../../services/api";
import Button from "../../../shared/Button/Button.component";
import Card from "../../../shared/Card/Card.component";

const previewProperties = {
  primary: "--preview-primary",
  primaryHover: "--preview-primary-hover",
  accent: "--preview-accent",
  heading: "--preview-heading",
  foreground: "--preview-foreground",
  surfaceApp: "--preview-surface",
  surfaceRaised: "--preview-raised",
  fontHeading: "--preview-font-heading",
  fontBody: "--preview-font-body",
};

function inspectPackage(packageData) {
  if (
    !packageData ||
    packageData.schemaVersion !== 1 ||
    !packageData.package ||
    typeof packageData.package !== "object"
  ) {
    throw new Error("This file is not a supported open.quiz package.");
  }
  if (!packageData.theme && !packageData.content)
    throw new Error("Package must include a theme or content.");
  for (const [name, value] of Object.entries(packageData.theme?.tokens || {})) {
    if (
      /^(primary|primaryHover|primaryAlt|accent|success|heading|foreground|onPrimary|surfaceApp|surfaceRaised|surfaceInset|surfaceInput|focus|learningPathSurface|learningPathText|learningPathHeading|learningPathLine)$/.test(
        name,
      )
    ) {
      if (typeof value !== "string" || !/^#[\da-f]{3}(?:[\da-f]{3})?$/i.test(value)) {
        throw new Error(`Theme color ${name} is invalid.`);
      }
    } else if (/^fontSize/.test(name)) {
      const match = typeof value === "string" && /^(\d{1,2}(?:\.\d+)?)(px|rem)$/.exec(value);
      const size = match ? Number(match[1]) : 0;
      const maximum = match?.[2] === "px" ? 96 : 6;
      const minimum = match?.[2] === "px" ? 8 : 0.5;
      if (!match || size < minimum || size > maximum) {
        throw new Error(`Theme font size ${name} is invalid.`);
      }
    } else if (/^font/.test(name)) {
      if (
        typeof value !== "string" ||
        value.length > 120 ||
        !/^[\w\s,"'-]+$/.test(value) ||
        /url|import/i.test(value)
      ) {
        throw new Error(`Theme font stack ${name} is invalid.`);
      }
    } else if (/^radius/.test(name)) {
      if (typeof value !== "string" || !/^(?:\d{1,3}px|\d{1,2}(?:\.\d+)?rem|9999px)$/.test(value)) {
        throw new Error(`Theme radius ${name} is invalid.`);
      }
    } else {
      throw new Error(`Theme token ${name} is not supported.`);
    }
  }
  const modules = packageData.content?.modules || [];
  const lessons = modules.flatMap((module) => module.lessons || []);
  const knowledgeChecks = lessons.reduce(
    (count, lesson) =>
      count +
      (lesson.microLessons || []).reduce(
        (microCount, micro) =>
          microCount +
          (micro.microLessonContent || []).filter((block) => block.type === "knowledgeCheck")
            .length,
        0,
      ),
    0,
  );
  return {
    packageData: {
      ...packageData,
      package: {
        ...packageData.package,
        name: packageData.package.name || "Imported open.quiz package",
        version: packageData.package.version || "1.0.0",
      },
    },
    counts: {
      assets: packageData.assets?.length || 0,
      avatars: packageData.theme?.assets?.avatars?.length || 0,
      modules: modules.length,
      lessons: lessons.length,
      knowledgeChecks,
    },
  };
}

function getAsset(packageData, assetKey) {
  const asset = packageData.assets?.find((entry) => entry.key === assetKey);
  return /^(?:data:image\/(?:png|jpeg|webp);base64,)/i.test(asset?.data || "") ? asset.data : null;
}

function ThemePreview({ inspected }) {
  const theme = inspected?.packageData.theme;
  if (!theme) return null;
  const previewStyle = Object.fromEntries(
    Object.entries(previewProperties)
      .filter(([token]) => typeof theme.tokens?.[token] === "string")
      .map(([token, property]) => [property, theme.tokens[token]]),
  );
  const logoKey = theme.assets?.logo;
  const logo = logoKey ? getAsset(inspected.packageData, logoKey) : null;
  const guide = theme.assets?.avatars?.[0];
  const avatar = guide ? getAsset(inspected.packageData, guide.assetKey) : null;
  return (
    <div className="space-y-3 rounded-md border border-neutral-200 p-4" aria-label="Theme preview">
      <div className="flex items-center gap-3">
        {logo ? <img src={logo} alt="" className="h-10 max-w-32 object-contain" /> : null}
        <h3 className="font-heading text-lg font-bold text-heading">
          {inspected.packageData.package.name}
        </h3>
      </div>
      <div
        className="grid gap-3 rounded-md bg-[var(--preview-surface,#f5f7fa)] p-4 sm:grid-cols-2"
        style={previewStyle}
      >
        <div className="space-y-2">
          <h4
            className="font-bold text-[var(--preview-heading,#213c60)]"
            style={{ fontFamily: "var(--preview-font-heading, inherit)" }}
          >
            A short lesson
          </h4>
          <p
            className="text-sm text-[var(--preview-foreground,#263244)]"
            style={{ fontFamily: "var(--preview-font-body, inherit)" }}
          >
            Practice one idea at a time.
          </p>
          <button
            type="button"
            className="rounded-md bg-[var(--preview-primary,#315f9e)] px-3 py-2 text-sm font-semibold text-white"
          >
            Continue
          </button>
        </div>
        <div className="flex items-center gap-3 rounded-md bg-[var(--preview-raised,#fff)] p-3">
          {avatar ? (
            <img src={avatar} alt="" className="h-12 w-12 rounded-full object-cover" />
          ) : null}
          <span className="text-sm text-[var(--preview-accent,#d8795f)]">
            {guide?.name || "Progress"}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function PackageManager({ csrfToken, modules = [] }) {
  const [packages, setPackages] = useState([]);
  const [activePackageId, setActivePackageId] = useState(null);
  const [inspected, setInspected] = useState(null);
  const [selectedMode, setSelectedMode] = useState("all");
  const [selectedModuleIds, setSelectedModuleIds] = useState({});
  const [fileError, setFileError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function refreshPackages() {
    const packagePayload = await getAdminPackages();
    setPackages(packagePayload.packages || []);
    setActivePackageId(packagePayload.activePackageId || null);
  }

  useEffect(() => {
    let active = true;
    getAdminPackages()
      .then((packagePayload) => {
        if (!active) return;
        setPackages(packagePayload.packages || []);
        setActivePackageId(packagePayload.activePackageId || null);
      })
      .catch((error) => {
        if (active) setFileError(error.message);
      });
    return () => {
      active = false;
    };
  }, []);

  async function choosePackage(file) {
    setFileError("");
    setMessage("");
    setInspected(null);
    if (!file) return;
    if (file.size > 16 * 1024 * 1024) {
      setFileError("Package exceeds the 16 MB upload limit.");
      return;
    }
    setBusy(true);
    try {
      const inspection = inspectPackage(JSON.parse(await file.text()));
      inspection.file = file;
      inspection.server = await inspectAdminPackage({ file, csrfToken });
      inspection.counts = inspection.server.manifest.counts;
      setInspected(inspection);
      setSelectedMode("all");
    } catch (error) {
      setFileError(
        error instanceof SyntaxError ? "Package file contains invalid JSON." : error.message,
      );
    } finally {
      setBusy(false);
    }
  }

  async function installPackage() {
    if (!inspected) return;
    setBusy(true);
    setFileError("");
    try {
      const result = await importAdminPackage({
        file: inspected.file,
        mode: selectedMode,
        csrfToken,
      });
      const skipped = result.skippedModules?.length
        ? ` Skipped existing module IDs: ${result.skippedModules.join(", ")}.`
        : "";
      setMessage(`Package installed. The active theme was not changed.${skipped}`);
      await refreshPackages();
    } catch (error) {
      setFileError(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function runPackageAction(action, successMessage) {
    setBusy(true);
    setFileError("");
    try {
      await action();
      await refreshPackages();
      setMessage(successMessage);
    } catch (error) {
      setFileError(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function activateTheme(packageId) {
    await activateAdminPackage({ packageId, csrfToken });
    setActivePackageId(packageId);
    await applyInstanceTheme();
  }

  async function restoreDefaults() {
    await activateDefaultAdminTheme(csrfToken);
    setActivePackageId(null);
    await applyInstanceTheme();
  }

  async function exportPackage(installed, mode) {
    const selected = (
      selectedModuleIds[installed.packageId] ||
      installed.importedModuleIds ||
      []
    ).filter((id) => installed.importedModuleIds?.includes(id));
    await downloadAdminPackage({ packageId: installed.packageId, mode, moduleIds: selected });
  }

  return (
    <Card className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-heading text-h3 font-bold text-heading">Appearance and packages</h2>
          <p className="text-sm text-foreground">
            Runtime branding and reusable learning experiences.
          </p>
        </div>
        <Button
          variant="secondary"
          disabled={busy || !activePackageId}
          onClick={() =>
            void runPackageAction(restoreDefaults, "Default instance branding restored.")
          }
        >
          Restore defaults
        </Button>
      </header>

      {fileError ? (
        <p role="alert" className="text-sm text-danger">
          {fileError}
        </p>
      ) : null}
      {message ? (
        <p role="status" className="text-sm text-success">
          {message}
        </p>
      ) : null}

      <section className="space-y-3" aria-labelledby="installed-packages-heading">
        <h3 id="installed-packages-heading" className="font-semibold text-heading">
          Installed packages
        </h3>
        {packages.length ? (
          packages.map((installed) => {
            const includesTheme = installed.installedSections?.includes("theme");
            const packageModules = modules.filter((module) =>
              installed.importedModuleIds?.includes(module.id),
            );
            return (
              <article
                key={installed.packageId}
                className="space-y-3 border-t border-neutral-200 py-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h4 className="font-semibold text-heading">
                      {installed.name}{" "}
                      <span className="text-sm font-normal text-foreground">
                        v{installed.version}
                      </span>
                    </h4>
                    <p className="text-sm text-foreground">
                      {installed.description || installed.packageId} ·{" "}
                      {installed.installedSections.join(" + ")}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {includesTheme && activePackageId !== installed.packageId ? (
                      <Button
                        variant="primary"
                        disabled={busy}
                        onClick={() =>
                          void runPackageAction(
                            () => activateTheme(installed.packageId),
                            `${installed.name} activated.`,
                          )
                        }
                      >
                        Activate
                      </Button>
                    ) : null}
                    {includesTheme ? (
                      <Button
                        variant="secondary"
                        disabled={busy}
                        onClick={() =>
                          void runPackageAction(
                            () => exportPackage(installed, "theme"),
                            "Theme package exported.",
                          )
                        }
                      >
                        Export theme
                      </Button>
                    ) : null}
                    {installed.installedSections?.includes("content") ? (
                      <Button
                        variant="secondary"
                        disabled={busy}
                        onClick={() =>
                          void runPackageAction(
                            () => exportPackage(installed, includesTheme ? "all" : "content"),
                            "Package exported.",
                          )
                        }
                      >
                        {includesTheme ? "Export package" : "Export content"}
                      </Button>
                    ) : null}
                    {!packageModules.length ? (
                      <Button
                        variant="ghost"
                        disabled={busy}
                        onClick={() =>
                          void runPackageAction(
                            () => deleteAdminPackage({ packageId: installed.packageId, csrfToken }),
                            "Package uninstalled.",
                          )
                        }
                      >
                        Remove
                      </Button>
                    ) : null}
                  </div>
                </div>
                {installed.themePreview ? (
                  <div className="flex flex-wrap items-center gap-3 rounded-md bg-surface-inset p-3">
                    {installed.themePreview.assets.logo ? (
                      <img
                        src={installed.themePreview.assets.logo}
                        alt=""
                        className="h-10 max-w-32 object-contain"
                      />
                    ) : null}
                    <div className="flex gap-2" aria-label={`${installed.name} color preview`}>
                      {["primary", "accent", "heading", "surfaceApp"].map((token) => {
                        const color = installed.themePreview.tokens[token];
                        return color ? (
                          <span
                            key={token}
                            title={token}
                            className="h-6 w-6 rounded-full border border-neutral-300"
                            style={{ backgroundColor: color }}
                          />
                        ) : null;
                      })}
                    </div>
                    <span className="text-sm text-foreground">
                      {Object.keys(installed.themePreview.assets.avatars || {}).length} theme
                      avatars
                    </span>
                  </div>
                ) : null}
                {activePackageId === installed.packageId ? (
                  <p className="text-sm font-semibold text-success">Active theme</p>
                ) : null}
                {packageModules.length ? (
                  <fieldset className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
                    <legend className="mb-2 text-foreground">
                      Content included in package export
                    </legend>
                    {packageModules.map((module) => {
                      const selected = (
                        selectedModuleIds[installed.packageId] || installed.importedModuleIds
                      ).includes(module.id);
                      return (
                        <label key={module.id} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={(event) =>
                              setSelectedModuleIds((current) => ({
                                ...current,
                                [installed.packageId]: event.target.checked
                                  ? [
                                      ...(current[installed.packageId] ||
                                        installed.importedModuleIds),
                                      module.id,
                                    ]
                                  : (
                                      current[installed.packageId] || installed.importedModuleIds
                                    ).filter((id) => id !== module.id),
                              }))
                            }
                          />
                          {module.title}
                        </label>
                      );
                    })}
                  </fieldset>
                ) : null}
              </article>
            );
          })
        ) : (
          <p className="text-sm text-foreground">No packages installed.</p>
        )}
      </section>

      <section
        className="space-y-4 border-t border-neutral-200 pt-4"
        aria-labelledby="import-package-heading"
      >
        <h3 id="import-package-heading" className="font-semibold text-heading">
          Import package
        </h3>
        <label className="inline-flex w-fit cursor-pointer items-center rounded-md border border-primary px-4 py-2 font-semibold text-primary">
          Choose .openquiz.json
          <input
            className="sr-only"
            type="file"
            accept=".openquiz.json,.openquiz,application/json"
            disabled={busy}
            onChange={(event) => {
              void choosePackage(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
        </label>
        {inspected ? (
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold text-heading">{inspected.packageData.package.name}</h4>
              <p className="text-sm text-foreground">
                Version {inspected.packageData.package.version}
              </p>
              {inspected.packageData.package.description ? (
                <p className="text-sm text-foreground">
                  {inspected.packageData.package.description}
                </p>
              ) : null}
            </div>
            <ul className="grid gap-1 text-sm text-foreground sm:grid-cols-2">
              {inspected.packageData.theme ? <li>✓ Visual theme and branding</li> : null}
              {inspected.counts.assets ? <li>✓ {inspected.counts.assets} visual assets</li> : null}
              {inspected.counts.avatars ? (
                <li>✓ {inspected.counts.avatars} character avatars</li>
              ) : null}
              {inspected.packageData.content ? (
                <li>
                  ✓ {inspected.counts.modules} modules, {inspected.counts.lessons} lessons
                </li>
              ) : null}
              {inspected.counts.knowledgeChecks ? (
                <li>✓ {inspected.counts.knowledgeChecks} knowledge checks</li>
              ) : null}
              {inspected.packageData.content?.modules?.some((module) => module.glossary?.length) ? (
                <li>✓ Glossary</li>
              ) : null}
              {inspected.packageData.content?.modules?.some(
                (module) => module.worksCited?.length,
              ) ? (
                <li>✓ Citations</li>
              ) : null}
            </ul>
            {inspected.server.conflicts.length ? (
              <p role="status" className="text-sm text-warning">
                Existing module IDs will be skipped:{" "}
                {inspected.server.conflicts.map((item) => item.id).join(", ")}.
              </p>
            ) : null}
            <ThemePreview inspected={inspected} />
            <fieldset className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
              <legend className="mb-2 font-semibold text-heading">Install scope</legend>
              {inspected.packageData.theme && inspected.packageData.content ? (
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="package-mode"
                    checked={selectedMode === "all"}
                    onChange={() => setSelectedMode("all")}
                  />
                  Theme + content
                </label>
              ) : null}
              {inspected.packageData.theme ? (
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="package-mode"
                    checked={selectedMode === "theme"}
                    onChange={() => setSelectedMode("theme")}
                  />
                  Theme only
                </label>
              ) : null}
              {inspected.packageData.content ? (
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="package-mode"
                    checked={selectedMode === "content"}
                    onChange={() => setSelectedMode("content")}
                  />
                  Content only
                </label>
              ) : null}
            </fieldset>
            <Button variant="primary" loading={busy} onClick={() => void installPackage()}>
              Install selected scope
            </Button>
          </div>
        ) : null}
      </section>
    </Card>
  );
}
