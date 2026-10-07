import { useMemo, useState } from "react";
import { applyInstanceTheme, resolveRuntimeAssetUrl } from "../../../app/instanceTheme";
import { toPortableLanding } from "../../../app/landingContent";
import { activateAdminPackage, importAdminPackage, saveBlob } from "../../../services/api";
import Button from "../../../shared/Button/Button.component";
import ThemePreview from "./ThemePreview";
import {
  COLOR_GROUPS,
  DECORATION_SPEC,
  DEFAULT_DARK_THEME_TOKENS,
  DEFAULT_THEME_TOKENS,
  FONT_PAIRS,
  FRAME_SPEC,
  LOGO_SPEC,
  MARKER_SPEC,
  PALETTES,
  SHAPE_PRESETS,
  buildThemePackage,
  contrastWarnings,
  createThemeId,
  readImageUpload,
  shapeSvg,
  svgDataUrl,
  toPortableImage,
} from "./themeBuilder";

const TRAIL_STYLE_LABELS = {
  vine: "Leafy vine",
  dashed: "Dashed",
  dotted: "Dotted",
  solid: "Solid",
  double: "Double line",
};
const ANSWER_SPEC = { size: 128, label: "Transparent square PNG or WebP, 128 x 128 px" };
const IMAGE_SLOTS = ["logo", "progressFrame", "answerCorrect", "answerIncorrect"];

function initialState(site = {}) {
  return {
    name: "My theme",
    description: "",
    appName: site.appName || "",
    landing: null,
    includeLanding: true,
    tokens: { ...DEFAULT_THEME_TOKENS },
    darkTokens: { ...DEFAULT_DARK_THEME_TOKENS },
    trail: { style: "dashed", decorationCount: null },
    marker: { type: "builtin", preset: "star", src: null },
    decoration: { type: "none", preset: "leaf", src: null },
    images: { logo: null, progressFrame: null, answerCorrect: null, answerIncorrect: null },
    avatars: [],
    includeAvatars: true,
  };
}

function stateFromInstalled(installed, site = {}) {
  const preview = installed.themePreview || {};
  const assets = preview.assets || {};
  const url = (value) => (value ? resolveRuntimeAssetUrl(value) : null);
  return {
    ...initialState(site),
    name: `${installed.name} (custom)`,
    appName: preview.appName || site.appName || "",
    landing: preview.landing || null,
    tokens: { ...DEFAULT_THEME_TOKENS, ...(preview.tokens || {}) },
    darkTokens: { ...DEFAULT_DARK_THEME_TOKENS, ...(preview.darkTokens || {}) },
    trail: {
      style: preview.trail?.style || "dashed",
      decorationCount: Number.isInteger(preview.trail?.decorationCount)
        ? preview.trail.decorationCount
        : null,
    },
    marker: assets.progressBar
      ? { type: "image", preset: "star", src: url(assets.progressBar) }
      : { type: "builtin", preset: "star", src: null },
    decoration: assets.trailDecoration
      ? { type: "image", preset: "leaf", src: url(assets.trailDecoration) }
      : { type: "none", preset: "leaf", src: null },
    images: Object.fromEntries(IMAGE_SLOTS.map((slot) => [slot, url(assets[slot])])),
    avatars: Object.entries(assets.avatars || {})
      .filter(([, avatar]) => avatar?.url)
      .map(([key, avatar]) => ({ key, name: avatar.name || key, url: url(avatar.url) })),
  };
}

function sizeHint(upload, spec) {
  const width = spec.width || spec.size;
  const height = spec.height || spec.size;
  if (!upload || (upload.width === width && upload.height === height)) return "";
  return `Uploaded ${upload.width} x ${upload.height} px; recommended ${width} x ${height} px. It will be scaled to fit.`;
}

function ImageUpload({ label, spec, src, onChange, onError, allowRemove = true }) {
  const [hint, setHint] = useState("");
  return (
    <div className="space-y-1 text-sm">
      <div className="flex flex-wrap items-center gap-3">
        {src ? (
          <img
            src={src}
            alt=""
            className="h-12 w-12 rounded border border-neutral-200 object-contain"
          />
        ) : null}
        <label className="inline-flex cursor-pointer items-center rounded-md border border-primary px-3 py-1.5 font-semibold text-primary">
          {src ? `Replace ${label.toLowerCase()}` : `Upload ${label.toLowerCase()}`}
          <input
            className="sr-only"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            aria-label={`Upload ${label.toLowerCase()}`}
            onChange={async (event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              try {
                const upload = await readImageUpload(file);
                if (!upload) return;
                setHint(sizeHint(upload, spec));
                onChange(upload.data);
              } catch (error) {
                onError(error.message);
              }
            }}
          />
        </label>
        {src && allowRemove ? (
          <button
            type="button"
            className="text-sm text-primary underline"
            onClick={() => {
              setHint("");
              onChange(null);
            }}
          >
            Remove
          </button>
        ) : null}
      </div>
      <p className="text-foreground">{spec.label}</p>
      {hint ? <p className="text-foreground">{hint}</p> : null}
    </div>
  );
}

function ShapeChoices({ name, value, colors, onSelect }) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={name}>
      {SHAPE_PRESETS.map((shape) => (
        <button
          key={shape.id}
          type="button"
          role="radio"
          aria-checked={value === shape.id}
          aria-label={shape.label}
          title={shape.label}
          onClick={() => onSelect(shape.id)}
          className={`h-12 w-12 rounded-md border-2 p-1 ${
            value === shape.id ? "border-primary bg-surface-inset" : "border-neutral-200"
          }`}
        >
          <img src={svgDataUrl(shapeSvg(shape.id, colors))} alt="" className="h-full w-full" />
        </button>
      ))}
    </div>
  );
}

export default function ThemeCustomizer({ csrfToken, packages = [], siteSettings, onSaved }) {
  const site = siteSettings || {};
  const [state, setState] = useState(() => initialState(site));
  const [baseId, setBaseId] = useState("default");
  const [editMode, setEditMode] = useState("light");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  const themePackages = packages.filter((item) => item.themePreview);
  const update = (patch) => setState((current) => ({ ...current, ...patch }));
  const paletteKey = editMode === "dark" ? "darkTokens" : "tokens";
  const paletteDefaults = editMode === "dark" ? DEFAULT_DARK_THEME_TOKENS : DEFAULT_THEME_TOKENS;
  const editedTokens = state[paletteKey];
  const setToken = (token, value) =>
    setState((current) => ({
      ...current,
      [paletteKey]: { ...current[paletteKey], [token]: value },
    }));
  const setImage = (slot, value) =>
    setState((current) => ({ ...current, images: { ...current.images, [slot]: value } }));

  const markerColors = {
    fill: state.tokens.primaryAlt,
    line: state.tokens.heading,
    accent: state.tokens.accent,
  };
  const decorationColors = {
    fill: state.tokens.primaryAlt,
    line: state.tokens.learningPathLine,
    accent: state.tokens.accent,
  };
  const markerSrc =
    state.marker.type === "preset"
      ? svgDataUrl(shapeSvg(state.marker.preset, markerColors))
      : state.marker.type === "image"
        ? state.marker.src
        : null;
  const decorationSrc =
    state.decoration.type === "preset"
      ? svgDataUrl(shapeSvg(state.decoration.preset, decorationColors))
      : state.decoration.type === "image"
        ? state.decoration.src
        : null;
  const warnings = useMemo(
    () => [
      ...contrastWarnings(state.tokens).map((warning) => `Light: ${warning}`),
      ...contrastWarnings(state.darkTokens).map((warning) => `Dark: ${warning}`),
    ],
    [state.tokens, state.darkTokens],
  );
  const previewTokens =
    editMode === "dark" ? { ...state.tokens, ...state.darkTokens } : state.tokens;
  const fontPair = FONT_PAIRS.find(
    (pair) =>
      pair.fontHeading === state.tokens.fontHeading && pair.fontBody === state.tokens.fontBody,
  );

  function chooseBase(nextBaseId) {
    setBaseId(nextBaseId);
    setError("");
    const installed = themePackages.find((item) => item.packageId === nextBaseId);
    setState(installed ? stateFromInstalled(installed, site) : initialState(site));
  }

  async function buildPackage() {
    const images = {
      progressBar: await toPortableImage(markerSrc, {
        width: MARKER_SPEC.size,
        height: MARKER_SPEC.size,
      }),
      trailDecoration: await toPortableImage(decorationSrc, {
        width: DECORATION_SPEC.size,
        height: DECORATION_SPEC.size,
      }),
    };
    for (const slot of IMAGE_SLOTS) images[slot] = await toPortableImage(state.images[slot]);
    const avatars = state.includeAvatars
      ? await Promise.all(
          state.avatars.map(async (avatar) => ({
            key: avatar.key,
            name: avatar.name,
            data: await toPortableImage(avatar.url),
          })),
        )
      : [];
    return buildThemePackage({
      id: createThemeId(state.name),
      name: state.name,
      description: state.description,
      tokens: state.tokens,
      darkTokens: state.darkTokens,
      trail: state.trail,
      images,
      avatars,
      appName: state.appName,
      landing: state.includeLanding ? toPortableLanding(state.landing || site.landing) : null,
    });
  }

  async function run(task) {
    setBusy(true);
    setError("");
    setStatus("");
    try {
      await task();
    } catch (taskError) {
      setError(taskError.message);
    } finally {
      setBusy(false);
    }
  }

  const save = (activate) =>
    run(async () => {
      const pkg = await buildPackage();
      const json = JSON.stringify(pkg, null, 2);
      const file = new File([json], `${pkg.package.id}.openquiz.json`, {
        type: "application/json",
      });
      await importAdminPackage({ file, mode: "theme", csrfToken });
      if (activate) {
        await activateAdminPackage({ packageId: pkg.package.id, csrfToken });
        await applyInstanceTheme();
      }
      await onSaved?.(pkg.package.id);
      setStatus(
        activate
          ? `${pkg.package.name} saved and activated.`
          : `${pkg.package.name} saved. Activate it from Installed packages.`,
      );
    });

  const download = () =>
    run(async () => {
      const pkg = await buildPackage();
      saveBlob(
        new Blob([JSON.stringify(pkg, null, 2)], { type: "application/json" }),
        `${pkg.package.id}.openquiz.json`,
      );
      setStatus("Theme package downloaded.");
    });

  return (
    <section
      className="space-y-5 border-t border-neutral-200 pt-4"
      aria-labelledby="theme-customizer-heading"
    >
      <div>
        <h3 id="theme-customizer-heading" className="font-semibold text-heading">
          Create a theme
        </h3>
        <p className="text-sm text-foreground">
          Start from the default look or an installed theme, adjust colors and artwork, then save it
          as a new theme package. The live site does not change until you activate it.
        </p>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      {status ? (
        <p role="status" className="text-sm text-success">
          {status}
        </p>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <fieldset className="grid gap-3 sm:grid-cols-2">
            <legend className="mb-2 font-semibold text-heading">Basics</legend>
            <label className="space-y-1 text-sm">
              <span className="block font-semibold text-heading">Start from</span>
              <select
                className="w-full rounded-md border border-neutral-300 bg-surface-input px-2 py-1.5"
                value={baseId}
                onChange={(event) => chooseBase(event.target.value)}
              >
                <option value="default">open.quiz default</option>
                {themePackages.map((item) => (
                  <option key={item.packageId} value={item.packageId}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span className="block font-semibold text-heading">Theme name</span>
              <input
                className="w-full rounded-md border border-neutral-300 bg-surface-input px-2 py-1.5"
                value={state.name}
                maxLength={120}
                onChange={(event) => update({ name: event.target.value })}
              />
            </label>
            <label className="space-y-1 text-sm sm:col-span-2">
              <span className="block font-semibold text-heading">Description (optional)</span>
              <input
                className="w-full rounded-md border border-neutral-300 bg-surface-input px-2 py-1.5"
                value={state.description}
                maxLength={300}
                onChange={(event) => update({ description: event.target.value })}
              />
            </label>
            <label className="space-y-1 text-sm sm:col-span-2">
              <span className="block font-semibold text-heading">App name (optional)</span>
              <input
                className="w-full rounded-md border border-neutral-300 bg-surface-input px-2 py-1.5"
                value={state.appName}
                maxLength={60}
                placeholder="Leave blank to keep the site's current name"
                onChange={(event) => update({ appName: event.target.value })}
              />
              <span className="block text-foreground">
                Shown in the browser title, header, footer, and image descriptions when this theme
                is activated.
              </span>
            </label>
            <label className="flex items-start gap-2 text-sm sm:col-span-2">
              <input
                type="checkbox"
                className="mt-1"
                checked={state.includeLanding}
                onChange={(event) => update({ includeLanding: event.target.checked })}
              />
              <span>
                <span className="block font-semibold text-heading">Include landing page</span>
                <span className="block text-foreground">
                  Packages the {state.landing ? "starting theme's" : "site's current"} landing page
                  copy (“{toPortableLanding(state.landing || site.landing).hero.heading}”). Edit the
                  copy under Site name and landing page.
                </span>
              </span>
            </label>
          </fieldset>

          <div className="space-y-2">
            <div
              className="inline-flex rounded-md border border-neutral-300 p-1"
              role="group"
              aria-label="Palette to edit"
            >
              {[
                ["light", "Light mode colors"],
                ["dark", "Dark mode colors"],
              ].map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={editMode === mode}
                  onClick={() => setEditMode(mode)}
                  className={`rounded px-3 py-1.5 text-sm font-semibold ${
                    editMode === mode ? "bg-primary text-on-primary" : "text-heading"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="text-sm text-foreground">
              Every theme has both palettes. Learners see the dark one when the site is in dark
              mode; choose the default and the learner toggle under Site name and landing page.
            </p>
          </div>

          {editMode === "dark" ? (
            <Button
              variant="secondary"
              onClick={() => update({ darkTokens: { ...DEFAULT_DARK_THEME_TOKENS } })}
            >
              Reset dark colors to the defaults
            </Button>
          ) : null}

          <fieldset className={editMode === "dark" ? "hidden" : "space-y-3"}>
            <legend className="mb-2 font-semibold text-heading">Palette</legend>
            <div className="flex flex-wrap gap-2">
              {PALETTES.map((palette) => {
                const swatch = { ...DEFAULT_THEME_TOKENS, ...palette.tokens };
                return (
                  <button
                    key={palette.id}
                    type="button"
                    onClick={() =>
                      setState((current) => ({
                        ...current,
                        tokens: {
                          ...current.tokens,
                          ...Object.fromEntries(
                            Object.entries(DEFAULT_THEME_TOKENS).filter(
                              ([token]) => !token.startsWith("font"),
                            ),
                          ),
                          ...palette.tokens,
                        },
                      }))
                    }
                    className="flex items-center gap-2 rounded-md border border-neutral-300 px-3 py-1.5 text-sm"
                  >
                    <span className="flex">
                      {["primary", "primaryAlt", "accent", "surfaceApp"].map((token) => (
                        <span
                          key={token}
                          className="-ml-1 h-4 w-4 rounded-full border border-surface-raised first:ml-0"
                          style={{ backgroundColor: swatch[token] }}
                        />
                      ))}
                    </span>
                    {palette.label}
                  </button>
                );
              })}
            </div>
            <p className="text-sm text-foreground">
              Applying a palette replaces colors only; fonts and artwork stay as they are.
            </p>
          </fieldset>

          {COLOR_GROUPS.map((group) => (
            <fieldset key={group.label} className="space-y-2">
              <legend className="mb-2 font-semibold text-heading">
                {group.label} colors{editMode === "dark" ? " (dark mode)" : ""}
              </legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {group.tokens.map(([token, label]) => (
                  <label key={token} className="flex items-center gap-2 text-sm">
                    <input
                      type="color"
                      aria-label={label}
                      className="h-8 w-10 cursor-pointer rounded border border-neutral-300"
                      value={
                        /^#[\da-f]{6}$/i.test(editedTokens[token] || "")
                          ? editedTokens[token]
                          : paletteDefaults[token]
                      }
                      onChange={(event) => setToken(token, event.target.value)}
                    />
                    <span>{label}</span>
                    <code className="ml-auto text-xs text-foreground">{editedTokens[token]}</code>
                  </label>
                ))}
              </div>
            </fieldset>
          ))}

          {warnings.length ? (
            <ul className="space-y-1 rounded-md bg-surface-inset p-3 text-sm text-foreground">
              {warnings.map((warning) => (
                <li key={warning}>⚠ {warning}</li>
              ))}
            </ul>
          ) : null}

          <label className="block space-y-1 text-sm">
            <span className="block font-semibold text-heading">Fonts</span>
            <select
              className="w-full rounded-md border border-neutral-300 bg-surface-input px-2 py-1.5"
              value={fontPair?.id || "custom"}
              onChange={(event) => {
                const pair = FONT_PAIRS.find((entry) => entry.id === event.target.value);
                if (pair)
                  setState((current) => ({
                    ...current,
                    tokens: {
                      ...current.tokens,
                      fontHeading: pair.fontHeading,
                      fontBody: pair.fontBody,
                    },
                  }));
              }}
            >
              {!fontPair ? <option value="custom">Keep current fonts</option> : null}
              {FONT_PAIRS.map((pair) => (
                <option key={pair.id} value={pair.id}>
                  {pair.label}
                </option>
              ))}
            </select>
          </label>

          <fieldset className="space-y-3">
            <legend className="mb-2 font-semibold text-heading">Progress marker</legend>
            <div className="flex flex-wrap gap-4 text-sm">
              {[
                ["builtin", "Built-in star"],
                ["preset", "Choose a shape"],
                ["image", "Upload image"],
              ].map(([type, label]) => (
                <label key={type} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="marker-type"
                    checked={state.marker.type === type}
                    onChange={() => update({ marker: { ...state.marker, type } })}
                  />
                  {label}
                </label>
              ))}
            </div>
            {state.marker.type === "preset" ? (
              <ShapeChoices
                name="Progress marker shape"
                value={state.marker.preset}
                colors={markerColors}
                onSelect={(preset) => update({ marker: { ...state.marker, preset } })}
              />
            ) : null}
            {state.marker.type === "preset" ? (
              <p className="text-sm text-foreground">
                Shapes use your highlight, accent, and heading colors and are saved as 256 x 256
                PNGs.
              </p>
            ) : null}
            {state.marker.type === "image" ? (
              <ImageUpload
                label="Marker"
                spec={MARKER_SPEC}
                src={state.marker.src}
                allowRemove={false}
                onError={setError}
                onChange={(src) => update({ marker: { ...state.marker, src } })}
              />
            ) : null}
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="mb-2 font-semibold text-heading">Learning path trail</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span className="block">Line style</span>
                <select
                  className="w-full rounded-md border border-neutral-300 bg-surface-input px-2 py-1.5"
                  value={state.trail.style}
                  onChange={(event) =>
                    update({ trail: { ...state.trail, style: event.target.value } })
                  }
                >
                  {Object.entries(TRAIL_STYLE_LABELS).map(([style, label]) => (
                    <option key={style} value={style}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-sm">
                <span className="block">Decorations per connector</span>
                <select
                  className="w-full rounded-md border border-neutral-300 bg-surface-input px-2 py-1.5"
                  value={state.trail.decorationCount ?? "auto"}
                  onChange={(event) =>
                    update({
                      trail: {
                        ...state.trail,
                        decorationCount:
                          event.target.value === "auto" ? null : Number(event.target.value),
                      },
                    })
                  }
                >
                  <option value="auto">Automatic</option>
                  {[0, 1, 2, 3].map((count) => (
                    <option key={count} value={count}>
                      {count}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="flex flex-wrap gap-4 text-sm">
              {[
                ["none", state.trail.style === "vine" ? "Built-in leaves" : "None"],
                ["preset", "Choose a shape"],
                ["image", "Upload image"],
              ].map(([type, label]) => (
                <label key={type} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="decoration-type"
                    checked={state.decoration.type === type}
                    onChange={() => update({ decoration: { ...state.decoration, type } })}
                  />
                  {label}
                </label>
              ))}
            </div>
            {state.decoration.type === "preset" ? (
              <ShapeChoices
                name="Trail decoration shape"
                value={state.decoration.preset}
                colors={decorationColors}
                onSelect={(preset) => update({ decoration: { ...state.decoration, preset } })}
              />
            ) : null}
            {state.decoration.type === "image" ? (
              <ImageUpload
                label="Decoration"
                spec={DECORATION_SPEC}
                src={state.decoration.src}
                allowRemove={false}
                onError={setError}
                onChange={(src) => update({ decoration: { ...state.decoration, src } })}
              />
            ) : null}
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="mb-2 font-semibold text-heading">Quiz answer marks</legend>
            <p className="text-sm text-foreground">
              Leave empty to use the built-in round check and cross badges in your success color.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-heading">Correct answer</p>
                <ImageUpload
                  label="Correct mark"
                  spec={ANSWER_SPEC}
                  src={state.images.answerCorrect}
                  onError={setError}
                  onChange={(src) => setImage("answerCorrect", src)}
                />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-heading">Incorrect answer</p>
                <ImageUpload
                  label="Incorrect mark"
                  spec={ANSWER_SPEC}
                  src={state.images.answerIncorrect}
                  onError={setError}
                  onChange={(src) => setImage("answerIncorrect", src)}
                />
              </div>
            </div>
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="mb-2 font-semibold text-heading">Branding artwork</legend>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-heading">Logo</p>
              <ImageUpload
                label="Logo"
                spec={LOGO_SPEC}
                src={state.images.logo}
                onError={setError}
                onChange={(src) => setImage("logo", src)}
              />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-heading">Progress bar frame</p>
              <ImageUpload
                label="Frame"
                spec={FRAME_SPEC}
                src={state.images.progressFrame}
                onError={setError}
                onChange={(src) => setImage("progressFrame", src)}
              />
            </div>
            {state.avatars.length ? (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={state.includeAvatars}
                  onChange={(event) => update({ includeAvatars: event.target.checked })}
                />
                Keep {state.avatars.length} character avatars from the starting theme
              </label>
            ) : null}
          </fieldset>
        </div>

        <div className="space-y-4 xl:sticky xl:top-4 xl:self-start">
          <ThemePreview
            name={state.name}
            tokens={previewTokens}
            colorMode={editMode}
            trail={state.trail}
            logo={state.images.logo}
            progressBar={markerSrc}
            progressFrame={state.images.progressFrame}
            trailDecoration={decorationSrc}
            answerCorrect={state.images.answerCorrect}
            answerIncorrect={state.images.answerIncorrect}
            guideAvatar={
              state.includeAvatars
                ? (state.avatars.find((avatar) => avatar.key === "guide") || state.avatars[0])
                    ?.url || null
                : null
            }
            guideName={
              state.includeAvatars
                ? (state.avatars.find((avatar) => avatar.key === "guide") || state.avatars[0])?.name
                : ""
            }
          />
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" disabled={busy} onClick={() => void save(true)}>
              Save and activate
            </Button>
            <Button variant="secondary" disabled={busy} onClick={() => void save(false)}>
              Save theme
            </Button>
            <Button variant="secondary" disabled={busy} onClick={() => void download()}>
              Download .openquiz.json
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
