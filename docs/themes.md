# Portable Experience Packages

open.quiz uses one `.openquiz.json` file to move a complete reusable experience between installations. A package may include a visual theme, embedded image assets, and canonical lesson modules. `theme`, `assets`, and `content` remain separate domains in the package; content is optional, and content-only packages are supported.

The application version, package schema version, and package's own version are independent. `schemaVersion: 1` selects this format; `package.version` is the publisher's semantic version and does not track the open.quiz release. The machine-readable v1 outline is [`shared/schemas/openquiz-package.schema.json`](../shared/schemas/openquiz-package.schema.json).

## Package Shape

```json
{
  "schemaVersion": 1,
  "package": {
    "id": "learning-garden",
    "name": "Learning Garden",
    "version": "1.0.0",
    "description": "Optional description",
    "author": "Optional author",
    "homepage": null
  },
  "theme": {
    "tokens": { "primary": "#18816a", "heading": "#105647" },
    "assets": {
      "logo": "brand.logo",
      "favicon": null,
      "hero": null,
      "progressBar": null,
      "avatars": [
        { "key": "guide", "name": "Guide", "assetKey": "avatar.guide" }
      ]
    }
  },
  "assets": [
    {
      "key": "brand.logo",
      "filename": "logo.png",
      "mimeType": "image/png",
      "data": "data:image/png;base64,..."
    }
  ],
  "content": { "modules": [] },
  "manifest": {
    "includes": { "theme": true, "content": true },
    "counts": {
      "assets": 1,
      "avatars": 1,
      "modules": 0,
      "lessons": 0,
      "knowledgeChecks": 0
    }
  }
}
```

`theme` and `content` are both optional individually, but at least one must be present. Package `id`, `name`, and `version` may be omitted; the server assigns a generated ID, a generic name, and version `1.0.0`. `assets` is an optional package-local image table. All theme slots and content references use stable `assetKey` values, never database IDs. A lesson character can include `characterId`, `name`, and `assetKey`; the importer writes a newly-created persistent asset URL into the canonical character `imagePath` field. Export reverses that mapping and embeds the bytes again.

The content section uses the application's existing `LessonModule` documents unchanged: module `id`, `title`, `lessons`, and module metadata such as `characters`, `glossary`, and `worksCited`. Lessons retain their `microLessons`, `microLessonContent`, and nested `knowledgeCheck` question records. The format does not define a parallel question schema or a global question list.

## Theme Values And Assets

V1 allows a fixed token vocabulary: primary/hover/alternate/accent/success colors; heading, foreground, on-primary, surface, and focus colors; learning-path colors; heading/body font stacks and bounded heading/body font sizes; and small/medium/large/pill radii. Colors must be 3- or 6-digit hexadecimal values. Font stacks are constrained strings; remote font loading and CSS directives are not supported. Font sizes are limited to 8–96 px or 0.5–6 rem. Radii use `px` or `rem` values.

Image assets support PNG, JPEG, and WebP. SVG is intentionally not supported. Each decoded image is limited to 4 MB, all decoded package assets together to 12 MB, package JSON to 16 MB, and theme avatars to 20. The MIME type is checked against the actual file signature. Assets are stored through the existing `ContentAsset` collection and served by immutable asset IDs.

## Admin Workflow

An administrator uploads a package, reviews the metadata and server-calculated manifest, chooses `all`, `theme`, or `content`, and installs it. Installation never activates a theme automatically. The preview applies candidate values only to its isolated sample. Administrators explicitly activate a theme later or restore environment/default branding.

For mixed packages, theme-only import leaves lessons untouched; content-only import leaves active branding untouched. Content conflicts use a conservative skip policy: any module whose ID already exists is reported and skipped. Existing modules are never silently replaced. Replacing content requires an administrator to remove or otherwise manage the existing module explicitly before importing under that ID.

Installed packages can be exported as theme-only, content-only, or a combined package. Combined export can include all package-owned modules or a selected subset. Package removal is blocked while it still owns imported modules so an uninstall cannot silently delete or orphan curriculum.

## Validation And Security

The server recalculates manifest counts and ignores submitted counts as authority. It validates token names and values, image base64 and signatures, asset keys, module/lesson/micro-lesson IDs, supported question types, answer choices and correct responses, character links, glossary entries, citations, and asset relationships. Module and lesson records remain canonical application data.

Packages are untrusted data, even when uploaded by an administrator. They cannot provide JavaScript, raw CSS, HTML, remote resource URLs, or application code. Package validation rejects user/authentication/deployment secrets and private operational records such as credentials, learner progress, attempts, sessions, and analytics. No imported property is spread into DOM styles; runtime tokens map through an explicit allowlist.

The current deployment configuration does not rely on MongoDB transactions. Import therefore tracks newly-created assets and modules and compensates by removing them if a later operation fails. A package record is only created after the selected assets and modules have installed successfully. Existing conflicting module records are never part of rollback.

## Examples And Sprout Portability

[`shared/packages/examples/sprout.openquiz.json`](../shared/packages/examples/sprout.openquiz.json) is a theme-only package using the verified Sprout palette and repository-owned historical artwork: the Sprout logo, flower progress image, and Abigail/Ramona character images. The original logo SVG was rasterized to WebP for this package because executable-capable SVG import is not supported. The reproducible conversion utility is [`scripts/generateSproutExamplePackage.js`](../scripts/generateSproutExamplePackage.js); it reads the source assets from commit `d431787`.

[`shared/packages/examples/learning-garden.openquiz.json`](../shared/packages/examples/learning-garden.openquiz.json) remains a generic theme-only fixture. The legacy Sprout finance curriculum is not included in the Sprout theme example: its historical presentation also depended on a separate code-based finance content renderer. The new package format can carry canonical modules, questions, characters, glossary, citations, and assets without bundling executable code, but recreating every legacy Sprout block presentation requires converting those blocks to supported open.quiz content types. This is an explicit follow-up, not hidden Sprout behavior in core.
