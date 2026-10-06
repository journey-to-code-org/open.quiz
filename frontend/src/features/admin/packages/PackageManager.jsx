import { useEffect, useState } from "react";
import { applyInstanceTheme } from "../../../app/instanceTheme";
import {
  activateAdminPackage,
  activateDefaultAdminTheme,
  deleteAdminPackage,
  downloadAdminPackage,
  getAdminSiteSettings,
  downloadAdminSiteExport,
  getAdminPackages,
  inspectAdminPackage,
  importAdminPackage,
  installAdminPackageContent,
} from "../../../services/api";
import Button from "../../../shared/Button/Button.component";
import Card from "../../../shared/Card/Card.component";
import ThemePreview from "./ThemePreview";
import SiteSettingsEditor from "./SiteSettingsEditor";
import ThemeCustomizer from "./ThemeCustomizer";

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
      /^(primary|primaryHover|primaryAlt|accent|success|progressStart|progressEnd|progressNearStart|progressNearEnd|progressCompleteStart|progressCompleteEnd|heading|foreground|onPrimary|surfaceApp|surfaceRaised|surfaceInset|surfaceInput|focus|learningPathSurface|learningPathText|learningPathHeading|learningPathLine)$/.test(
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

function InspectedThemePreview({ inspected }) {
  const theme = inspected?.packageData.theme;
  if (!theme) return null;
  const guide = theme.assets?.avatars?.[0];
  const asset = (key) => (key ? getAsset(inspected.packageData, key) : null);
  return (
    <ThemePreview
      name={inspected.packageData.package.name}
      tokens={theme.tokens || {}}
      trail={theme.trail}
      logo={asset(theme.assets?.logo)}
      progressBar={asset(theme.assets?.progressBar)}
      progressFrame={asset(theme.assets?.progressFrame)}
      trailDecoration={asset(theme.assets?.trailDecoration)}
      answerCorrect={asset(theme.assets?.answerCorrect)}
      answerIncorrect={asset(theme.assets?.answerIncorrect)}
      guideAvatar={asset(guide?.assetKey)}
      guideName={guide?.name}
    />
  );
}
export default function PackageManager({ csrfToken, modules = [], onModulesChanged }) {
  const [packages, setPackages] = useState([]);
  const [activePackageId, setActivePackageId] = useState(null);
  const [inspected, setInspected] = useState(null);
  const [selectedMode, setSelectedMode] = useState("all");
  const [selectedModuleIds, setSelectedModuleIds] = useState({});
  const [includeBundledLessons, setIncludeBundledLessons] = useState({});
  const [skipSiteContent, setSkipSiteContent] = useState({});
  const [includeSiteInExport, setIncludeSiteInExport] = useState(false);
  const [siteSettings, setSiteSettings] = useState(null);
  const [siteSettingsVersion, setSiteSettingsVersion] = useState(0);
  const [siteSettingsError, setSiteSettingsError] = useState("");
  const [fileError, setFileError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function refreshPackages() {
    const packagePayload = await getAdminPackages();
    setPackages(packagePayload.packages || []);
    setActivePackageId(packagePayload.activePackageId || null);
  }

  async function refreshSiteSettings() {
    try {
      setSiteSettings(await getAdminSiteSettings());
      setSiteSettingsVersion((version) => version + 1);
      setSiteSettingsError("");
    } catch (error) {
      setSiteSettingsError(error.message);
    }
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
    getAdminSiteSettings()
      .then((settings) => {
        if (!active) return;
        setSiteSettings(settings);
        setSiteSettingsVersion((version) => version + 1);
      })
      .catch((error) => {
        if (active) setSiteSettingsError(error.message);
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
      await onModulesChanged?.();
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
      const result = await action();
      await refreshPackages();
      setMessage(typeof successMessage === "function" ? successMessage(result) : successMessage);
    } catch (error) {
      setFileError(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function activateTheme(installed) {
    const packageId = installed.packageId;
    const includeContent = Boolean(
      installed.bundledContent &&
      !installed.bundledContent.installed &&
      includeBundledLessons[packageId],
    );
    const applySiteContent = !skipSiteContent[packageId];
    const result = await activateAdminPackage({
      packageId,
      includeContent,
      applySiteContent,
      csrfToken,
    });
    setActivePackageId(packageId);
    await applyInstanceTheme();
    await refreshSiteSettings();
    if (includeContent) await onModulesChanged?.();
    return result;
  }

  async function installBundledLessons(packageId) {
    const result = await installAdminPackageContent({ packageId, csrfToken });
    await onModulesChanged?.();
    return result;
  }

  function lessonInstallSummary(result) {
    if (!result?.importedModules && !result?.skippedModules) return "";
    const imported = result.importedModules?.length || 0;
    const skipped = result.skippedModules?.length
      ? ` Skipped existing module IDs: ${result.skippedModules.join(", ")}.`
      : "";
    return ` Installed ${imported} lesson module${imported === 1 ? "" : "s"}.${skipped}`;
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
    await downloadAdminPackage({
      packageId: installed.packageId,
      mode,
      moduleIds: selected,
      includeSite: includeSiteInExport && mode !== "content",
    });
  }

  return (
    <Card className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-heading text-h3 font-bold text-heading">Appearance and packages</h2>
          <p className="text-sm text-foreground">
            Runtime branding and reusable learning experiences.
          </p>
          <p className="text-sm text-foreground">
            Use transparent PNG/WebP artwork: square progress markers (256 px), character images
            (352 px or larger), and an optional transparent progress frame (900 x 147 px). Avatar
            keys match lesson character IDs; use guide for the default character.{" "}
            <a
              href="https://github.com/journey-to-code-org/open.quiz/blob/development/docs/themes.md#image-slots-and-authoring-specifications"
              className="text-primary underline"
              target="_blank"
              rel="noreferrer"
            >
              Image specifications and package schema
            </a>
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

      {siteSettings ? (
        <SiteSettingsEditor
          key={siteSettingsVersion}
          csrfToken={csrfToken}
          settings={siteSettings}
          onSaved={(saved) => setSiteSettings(saved)}
        />
      ) : siteSettingsError ? (
        <p className="text-sm text-danger">
          Site name and landing page settings could not be loaded: {siteSettingsError}
        </p>
      ) : null}

      <section
        className="space-y-3 border-t border-neutral-200 pt-4"
        aria-labelledby="installed-packages-heading"
      >
        <h3 id="installed-packages-heading" className="font-semibold text-heading">
          Installed packages
        </h3>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={includeSiteInExport}
            onChange={(event) => setIncludeSiteInExport(event.target.checked)}
          />
          Include this site&apos;s app name and landing page when exporting a theme
        </label>
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
                            () => activateTheme(installed),
                            (result) =>
                              `${installed.name} activated.${lessonInstallSummary(result)}`,
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
                {includesTheme &&
                activePackageId !== installed.packageId &&
                (installed.themePreview?.appName || installed.themePreview?.landing) ? (
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={!skipSiteContent[installed.packageId]}
                      onChange={(event) =>
                        setSkipSiteContent((current) => ({
                          ...current,
                          [installed.packageId]: !event.target.checked,
                        }))
                      }
                    />
                    Use this theme&apos;s{" "}
                    {[
                      installed.themePreview.appName
                        ? `app name (\u201C${installed.themePreview.appName}\u201D)`
                        : null,
                      installed.themePreview.landing ? "landing page" : null,
                    ]
                      .filter(Boolean)
                      .join(" and ")}{" "}
                    when activating
                  </label>
                ) : null}
                {installed.bundledContent && !installed.bundledContent.installed ? (
                  <div className="flex flex-wrap items-center gap-3 text-sm">
                    {activePackageId === installed.packageId ? (
                      <Button
                        variant="secondary"
                        disabled={busy}
                        onClick={() =>
                          void runPackageAction(
                            () => installBundledLessons(installed.packageId),
                            (result) =>
                              `${installed.name} lessons added.${lessonInstallSummary(result)}`,
                          )
                        }
                      >
                        Install {installed.name} lessons
                      </Button>
                    ) : (
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={Boolean(includeBundledLessons[installed.packageId])}
                          onChange={(event) =>
                            setIncludeBundledLessons((current) => ({
                              ...current,
                              [installed.packageId]: event.target.checked,
                            }))
                          }
                        />
                        Also install {installed.name} lessons when activating
                      </label>
                    )}
                    <span className="text-foreground">
                      {installed.bundledContent.modules
                        .map((module) => `${module.title} (${module.lessonCount} lessons)`)
                        .join(", ")}{" "}
                      — editable under Lesson modules once installed.
                    </span>
                  </div>
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
            <InspectedThemePreview inspected={inspected} />
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

      <ThemeCustomizer
        csrfToken={csrfToken}
        packages={packages}
        siteSettings={siteSettings}
        onSaved={async () => {
          await refreshPackages();
        }}
      />

      <section
        className="space-y-3 border-t border-neutral-200 pt-4"
        aria-labelledby="site-export-heading"
      >
        <h3 id="site-export-heading" className="font-semibold text-heading">
          Export everything
        </h3>
        <p className="text-sm text-foreground">
          Download one .openquiz.json file containing the active theme (with its artwork and
          avatars) and every lesson module on this site. Import it on another open.quiz instance to
          copy the whole learning experience. Accounts, progress, and secrets are never included.
        </p>
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() => void runPackageAction(downloadAdminSiteExport, "Site export downloaded.")}
        >
          Export entire site
        </Button>
      </section>
    </Card>
  );
}
