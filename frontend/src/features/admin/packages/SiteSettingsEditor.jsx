import { useState } from "react";
import { applyInstanceTheme, DEFAULT_APP_NAME } from "../../../app/instanceTheme";
import { normalizeColorModeSettings } from "../../../app/colorMode";
import { DEFAULT_LANDING, LANDING_LIMITS, resolveLanding } from "../../../app/landingContent";
import { updateAdminSiteSettings } from "../../../services/api";
import Button from "../../../shared/Button/Button.component";

const inputClass = "w-full rounded-md border border-neutral-300 bg-surface-input px-2 py-1.5";
const LIST_SECTIONS = [
  {
    id: "benefits",
    label: "Benefits",
    itemLabel: "Benefit",
    fields: [
      { name: "icon", label: "Icon (emoji)", max: LANDING_LIMITS.icon, short: true },
      { name: "title", label: "Title", max: LANDING_LIMITS.title },
      { name: "body", label: "Text", max: LANDING_LIMITS.body, multiline: true },
    ],
    empty: { icon: "", title: "", body: "" },
  },
  {
    id: "steps",
    label: "How it works",
    itemLabel: "Step",
    fields: [
      { name: "title", label: "Title", max: LANDING_LIMITS.title },
      { name: "body", label: "Text", max: LANDING_LIMITS.body, multiline: true },
    ],
    empty: { title: "", body: "" },
  },
  {
    id: "faq",
    label: "FAQ",
    itemLabel: "Question",
    fields: [
      { name: "question", label: "Question", max: LANDING_LIMITS.question },
      { name: "answer", label: "Answer", max: LANDING_LIMITS.answer, multiline: true },
    ],
    empty: { question: "", answer: "" },
  },
];

const COLOR_MODE_OPTIONS = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "Follow each visitor's device setting" },
];
const TOGGLE_POSITION_OPTIONS = [
  { value: "header", label: "Header, next to the menu" },
  { value: "footer", label: "Footer" },
  { value: "bottom-right", label: "Floating, bottom right" },
  { value: "bottom-left", label: "Floating, bottom left" },
];

let nextItemKey = 0;
const withKey = (item) => ({ ...item, _key: `item-${(nextItemKey += 1)}` });
const editableLanding = (landing) => {
  const resolved = resolveLanding(landing);
  for (const section of LIST_SECTIONS) {
    resolved[section.id] = {
      ...resolved[section.id],
      items: resolved[section.id].items.map(withKey),
    };
  }
  return resolved;
};

function TextField({ label, value, max, multiline = false, onChange, className = "" }) {
  const Field = multiline ? "textarea" : "input";
  return (
    <label className={`space-y-1 text-sm ${className}`}>
      <span className="block font-semibold text-heading">{label}</span>
      <Field
        className={inputClass}
        value={value}
        maxLength={max}
        rows={multiline ? 3 : undefined}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function ListSection({ section, value, onChange }) {
  const limit = LANDING_LIMITS[section.id];
  const setItem = (index, patch) =>
    onChange({
      ...value,
      items: value.items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    });
  const move = (index, offset) => {
    const items = [...value.items];
    const [item] = items.splice(index, 1);
    items.splice(index + offset, 0, item);
    onChange({ ...value, items });
  };
  return (
    <fieldset className="space-y-3 rounded-md border border-neutral-200 p-3">
      <legend className="px-1 font-semibold text-heading">{section.label}</legend>
      <TextField
        label={`${section.label} heading`}
        value={value.heading}
        max={LANDING_LIMITS.heading}
        onChange={(heading) => onChange({ ...value, heading })}
      />
      {value.items.map((item, index) => (
        <div key={item._key} className="space-y-2 border-t border-neutral-200 pt-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-semibold text-heading">
              {section.itemLabel} {index + 1}
            </span>
            <div className="flex gap-3 text-sm">
              <button
                type="button"
                className="text-primary underline disabled:opacity-40"
                disabled={index === 0}
                aria-label={`Move ${section.itemLabel.toLowerCase()} ${index + 1} up`}
                onClick={() => move(index, -1)}
              >
                Up
              </button>
              <button
                type="button"
                className="text-primary underline disabled:opacity-40"
                disabled={index === value.items.length - 1}
                aria-label={`Move ${section.itemLabel.toLowerCase()} ${index + 1} down`}
                onClick={() => move(index, 1)}
              >
                Down
              </button>
              <button
                type="button"
                className="text-primary underline"
                aria-label={`Remove ${section.itemLabel.toLowerCase()} ${index + 1}`}
                onClick={() =>
                  onChange({ ...value, items: value.items.filter((_, i) => i !== index) })
                }
              >
                Remove
              </button>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-[6rem_minmax(0,1fr)]">
            {section.fields.map((field) => (
              <TextField
                key={field.name}
                label={`${section.itemLabel} ${index + 1} ${field.label.toLowerCase()}`}
                value={item[field.name] || ""}
                max={field.max}
                multiline={field.multiline}
                className={field.short ? "" : "sm:col-span-2"}
                onChange={(next) => setItem(index, { [field.name]: next })}
              />
            ))}
          </div>
        </div>
      ))}
      <Button
        variant="secondary"
        disabled={value.items.length >= limit}
        onClick={() => onChange({ ...value, items: [...value.items, withKey(section.empty)] })}
      >
        Add {section.itemLabel.toLowerCase()}
      </Button>
      <p className="text-xs text-foreground">
        Up to {limit}. Remove every item to hide this section.
      </p>
    </fieldset>
  );
}

function toPayload(landing) {
  const clean = (items, fields) =>
    items
      .map((item) =>
        Object.fromEntries(
          fields.map((field) => [field, (item[field] || "").trim()]).filter(([, text]) => text),
        ),
      )
      .filter((item) => Object.keys(item).some((key) => key !== "icon"));
  return {
    hero: {
      heading: landing.hero.heading.trim() || DEFAULT_LANDING.hero.heading,
      body: landing.hero.body.trim() || DEFAULT_LANDING.hero.body,
      showAvatars: landing.hero.showAvatars,
    },
    ...Object.fromEntries(
      LIST_SECTIONS.map((section) => [
        section.id,
        {
          heading: landing[section.id].heading.trim() || DEFAULT_LANDING[section.id].heading,
          items: clean(
            landing[section.id].items,
            section.fields.map((field) => field.name),
          ),
        },
      ]),
    ),
  };
}

export default function SiteSettingsEditor({ csrfToken, settings, onSaved }) {
  const [appName, setAppName] = useState(settings?.appName || "");
  const [landing, setLanding] = useState(() => editableLanding(settings?.landing));
  const [colorMode, setColorMode] = useState(() => normalizeColorModeSettings(settings?.colorMode));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  async function save(body, successMessage) {
    setBusy(true);
    setError("");
    setStatus("");
    try {
      const saved = await updateAdminSiteSettings({ ...body, csrfToken });
      setAppName(saved.appName || "");
      setLanding(editableLanding(saved.landing));
      setColorMode(normalizeColorModeSettings(saved.colorMode));
      await applyInstanceTheme();
      await onSaved?.(saved);
      setStatus(successMessage);
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-4" aria-labelledby="site-settings-heading">
      <div>
        <h3 id="site-settings-heading" className="font-semibold text-heading">
          Site name and landing page
        </h3>
        <p className="text-sm text-foreground">
          These apply to the whole site no matter which theme is active. Activating a theme that
          includes its own name or landing page replaces them, and every export can carry them.
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

      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          void save({ appName }, appName.trim() ? "App name saved." : "App name reset.");
        }}
      >
        <div className="min-w-64 flex-1 space-y-1 text-sm">
          <label htmlFor="site-app-name" className="block font-semibold text-heading">
            App name
          </label>
          <input
            id="site-app-name"
            className={inputClass}
            value={appName}
            maxLength={60}
            placeholder={DEFAULT_APP_NAME}
            aria-describedby="site-app-name-help"
            onChange={(event) => setAppName(event.target.value)}
          />
          <p id="site-app-name-help" className="text-foreground">
            Used in the browser title bar, header, footer, legal pages, and image descriptions.
            Leave blank to use {DEFAULT_APP_NAME}.
          </p>
        </div>
        <Button type="submit" variant="primary" disabled={busy}>
          Save app name
        </Button>
      </form>

      <form
        className="space-y-3 rounded-md border border-neutral-200 p-3"
        aria-labelledby="site-color-mode-heading"
        onSubmit={(event) => {
          event.preventDefault();
          void save({ colorMode }, "Color mode saved.");
        }}
      >
        <div>
          <h4 id="site-color-mode-heading" className="font-semibold text-heading">
            Light and dark mode
          </h4>
          <p className="text-sm text-foreground">
            Every theme has a light and a dark palette. Edit the dark palette in the theme
            customizer.
          </p>
        </div>
        <fieldset className="space-y-1 text-sm">
          <legend className="font-semibold text-heading">Default appearance</legend>
          {COLOR_MODE_OPTIONS.map((option) => (
            <label key={option.value} className="flex items-center gap-2">
              <input
                type="radio"
                name="site-color-mode-default"
                value={option.value}
                checked={colorMode.default === option.value}
                onChange={() => setColorMode({ ...colorMode, default: option.value })}
              />
              {option.label}
            </label>
          ))}
        </fieldset>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={colorMode.showToggle}
            onChange={(event) => setColorMode({ ...colorMode, showToggle: event.target.checked })}
          />
          Show a light/dark toggle so learners can choose for themselves
        </label>
        <label className="block max-w-sm space-y-1 text-sm">
          <span className="block font-semibold text-heading">Toggle position</span>
          <select
            className={inputClass}
            value={colorMode.togglePosition}
            disabled={!colorMode.showToggle}
            onChange={(event) => setColorMode({ ...colorMode, togglePosition: event.target.value })}
          >
            {TOGGLE_POSITION_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" variant="primary" disabled={busy}>
          Save color mode
        </Button>
      </form>

      <details className="rounded-md border border-neutral-200 p-3">
        <summary className="cursor-pointer font-semibold text-heading">Edit landing page</summary>
        <form
          className="mt-3 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void save({ landing: toPayload(landing) }, "Landing page saved.");
          }}
        >
          <fieldset className="space-y-3 rounded-md border border-neutral-200 p-3">
            <legend className="px-1 font-semibold text-heading">Hero</legend>
            <TextField
              label="Headline"
              value={landing.hero.heading}
              max={LANDING_LIMITS.heading}
              onChange={(heading) => setLanding({ ...landing, hero: { ...landing.hero, heading } })}
            />
            <TextField
              label="Introduction"
              value={landing.hero.body}
              max={LANDING_LIMITS.heroBody}
              multiline
              onChange={(body) => setLanding({ ...landing, hero: { ...landing.hero, body } })}
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={landing.hero.showAvatars}
                onChange={(event) =>
                  setLanding({
                    ...landing,
                    hero: { ...landing.hero, showAvatars: event.target.checked },
                  })
                }
              />
              Show up to three theme avatars beside the headline (a theme hero image takes priority)
            </label>
          </fieldset>
          {LIST_SECTIONS.map((section) => (
            <ListSection
              key={section.id}
              section={section}
              value={landing[section.id]}
              onChange={(next) => setLanding({ ...landing, [section.id]: next })}
            />
          ))}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="primary" disabled={busy}>
              Save landing page
            </Button>
            <Button
              variant="secondary"
              disabled={busy || !settings?.landing}
              onClick={() => void save({ landing: null }, "Landing page reset to the default.")}
            >
              Reset to default
            </Button>
          </div>
        </form>
      </details>
    </section>
  );
}
