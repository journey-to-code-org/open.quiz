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
      "progressFrame": null,
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

V1 allows a fixed token vocabulary: primary/hover/alternate/accent/success colors; heading, foreground, on-primary, surface, and focus colors; learning-path colors; illustrated progress colors; heading/body font stacks and bounded heading/body font sizes; and small/medium/large/pill radii. Colors must be 3- or 6-digit hexadecimal values. Font stacks are constrained strings; remote font loading and CSS directives are not supported. Font sizes are limited to 8–96 px or 0.5–6 rem. Radii use `px` or `rem` values.

The learning-path page has its own color tokens, and every color on that page can be themed:

| Token                       | Used for                                                  | Default when omitted |
| --------------------------- | --------------------------------------------------------- | -------------------- |
| `learningPathSurface`       | Page background                                           | `#f1f5fa`            |
| `learningPathHeading`       | Module title, section heading, footer text                | `#23446f`            |
| `learningPathText`          | Body text                                                 | `#334760`            |
| `learningPathMuted`         | Secondary text and lesson durations                       | `#53657a`            |
| `learningPathLabel`         | Step titles under each node                               | `#344b6a`            |
| `learningPathDivider`       | Lines beside the section heading                          | `#98a6b8`            |
| `learningPathLine`          | Trail between steps                                       | `#34475f`            |
| `learningPathNodeCompleted` | Completed step fill (text uses `heading`)                 | `surfaceApp`         |
| `learningPathNodeCurrent`   | Current and locked step fill; locked steps are grayed out | `primary`            |
| `learningPathNodeBorder`    | Completed step outline and status badge outline           | `#b4c7c2`            |
| `learningPathFooterSurface` | Sticky footer bar                                         | `#e0e8f2`            |
| `learningPathFooterBorder`  | Footer top border                                         | `#c0cddd`            |

The footer button uses `primary`/`primaryHover`, and the hero card's decorative circle uses `primaryAlt`. The admin preview renders the same step component as the learning-path page, so it shows these colors exactly.

Image assets support PNG, JPEG, and WebP. SVG is intentionally not supported. Each decoded image is limited to 4 MB, all decoded package assets together to 12 MB, package JSON to 16 MB, and theme avatars to 20. The MIME type is checked against the actual file signature. Assets are stored through the existing `ContentAsset` collection and served by immutable asset IDs.

### App Name And Landing Page

A theme may also carry site branding text. Both fields are optional:

```json
"theme": {
  "appName": "Sprout",
  "landing": {
    "hero": { "heading": "…", "body": "…", "showAvatars": true },
    "benefits": { "heading": "Why Sprout", "items": [{ "icon": "🌱", "title": "…", "body": "…" }] },
    "steps": { "heading": "How it works", "items": [{ "title": "…", "body": "…" }] },
    "faq": { "heading": "Questions", "items": [{ "question": "…", "answer": "…" }] }
  }
}
```

- `appName`: 1–60 characters, whitespace collapsed, no control characters. It replaces
  `open.quiz` in the browser title, header, footer, legal pages, image alt text, the
  production `index.html` metadata, and `site.webmanifest`. `VITE_APP_NAME` is only the
  fallback when no name is configured.
- `landing`: plain text only (newlines are kept, no HTML or Markdown). Every section is
  optional; a section that is present needs its heading and its body or item list. Limits:
  headings 120, hero text 500, item titles 80, item text 600, icons 8, FAQ questions 200,
  FAQ answers 1,200 characters; up to 6 benefits, 6 steps, and 10 FAQ entries. An empty
  `items` list hides that section. Omitted sections use the built-in defaults.
- `hero.showAvatars` (default `true`) shows up to three theme avatars (the `guide` first)
  beside the headline when the theme has no `hero` image.

These values are site settings, not theme styles: administrators edit them under
**Appearance and packages → Site name and landing page**, and they persist across theme
changes. Activating a theme that includes `appName` or `landing` copies them into the site
settings unless the administrator clears **Use this theme's app name and landing page**.
Sprout ships its original name and landing copy this way.

### Image Slots And Authoring Specifications

Use the [package JSON Schema](../shared/schemas/openquiz-package.schema.json) in your editor
and start from the [Sprout example](../shared/packages/examples/sprout.openquiz.json) for a
complete working theme and curriculum. Replace the embedded asset bytes and colors with
your own; no application code or CSS is needed. The dimensions below are recommendations,
not upload validation limits. Keep assets within the byte limits above.

| Slot                 | Purpose                                            | Recommended image                                                         | Display behavior                                                                           |
| -------------------- | -------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `logo`               | Header wordmark                                    | Transparent PNG/WebP, about 512 x 216 px                                  | 112-144 CSS px wide, intrinsic aspect ratio preserved                                      |
| `favicon`            | Browser tab icon                                   | Square PNG/WebP, 64 x 64 or 128 x 128 px                                  | Browser-controlled icon size                                                               |
| `hero`               | Homepage illustration                              | About 1200 x 800 px, centered subject                                     | Homepage artwork, not a lesson character                                                   |
| `progressBar`        | Moving marker above the illustrated progress track | Transparent square PNG/WebP, about 256 x 256 px; flower, mascot, or badge | Moves from the beginning to the end of the bar; never replaces the track                   |
| `progressFrame`      | Optional outline around the progress track         | Transparent PNG/WebP, about 900 x 147 px (6.1:1 aspect ratio)             | Full-width frame over the animated gradient; transparent center required to see the colors |
| `avatars[].assetKey` | Lesson and quiz guide characters                   | Transparent square PNG/WebP, at least 352 x 352 px                        | Aspect ratio preserved, up to 176 CSS px wide below the speech bubble                      |

At least 352 px supports the 176 CSS px character display on a 2x-density screen; prefer
512 px or larger original artwork when possible. Do not enlarge a 96 px thumbnail and
expect added detail. Preserve original raster bytes when they already meet the limits,
and rasterize vector sources at the target resolution rather than downsampling thumbnails.

`progressFrame` is optional and defaults to the built-in outline. Its center should be
transparent, with the track spanning approximately 8%-88% of its width, so the marker
aligns with it. An opaque rectangle hides the animated gradient. Do not put a complete
progress bar in `progressBar`: that slot contains only the moving illustration.
Without `progressBar`, the application uses a large, theme-colored star at the same responsive
scale as a custom illustration, along with its brand-color track. Supplying a marker replaces
the star without changing its sizing or movement.

Use transparent backgrounds for isolated characters and markers so they blend into the
lesson card. Do not embed captions or lesson text in images; lesson text stays readable,
selectable, and accessible in canonical content. Supply a meaningful avatar `name` for
image alternative text.

Each avatar's `key` matches a content block or question's `characterId`. For example:

```json
{
  "avatars": [
    { "key": "abigail", "name": "Abigail", "assetKey": "avatar.abigail" },
    { "key": "guide", "name": "Your guide", "assetKey": "avatar.guide" }
  ]
}
```

An active theme's matching avatar overrides the module or bundled character image in both
lessons and quiz feedback. The reserved `guide` key supplies a default for content without
a character or an unknown character with no other artwork. Otherwise, existing module
and bundled character images continue to work. Use the same keys in a replacement theme
to reskin a curriculum without editing its lessons.

If a supplied lesson/quiz character image fails to load in a production build, the image
and speech-bubble pointer are removed while the lesson text remains visible. The browser
must first try loading the URL to detect a missing image. Development builds keep the
broken image and alternative text visible so authors can identify missing artwork. Both
build modes log the failed image URL. Changing the URL allows the replacement image to load.

### Illustrated Progress Colors

With a custom marker, six optional hex color tokens control the original Sprout progression:

| Stage                                              | Left color token        | Right color token     | Sprout values        |
| -------------------------------------------------- | ----------------------- | --------------------- | -------------------- |
| Start to 70%                                       | `progressStart`         | `progressEnd`         | `#ffbf1f`, `#ffd254` |
| 70%-92%, interpolated from start colors            | `progressNearStart`     | `progressNearEnd`     | `#ffc618`, `#ffdd4f` |
| 92%-100%, interpolated from near-completion colors | `progressCompleteStart` | `progressCompleteEnd` | `#ea6fee`, `#c989f7` |

These values are also the defaults when omitted. The theme preview shows the separate
frame, moving marker, and character artwork without activating the candidate theme.

## Admin Workflow

Server startup preinstalls Learning Garden and Sprout as theme-only packages, including
Sprout's logo, progress artwork, and character avatars. These remain inactive: the default
instance branding stays in place until an administrator selects a theme. No finance lessons
are installed automatically. Theme activation remains an admin-only, site-wide action.
The beaver is stored as an avatar asset, so it appears in the avatar library even when
Sprout is not the active theme. Abigail and Ramona retain their original 400 x 400 WebP
bytes without lossy recompression, and the vector beaver is rasterized at 512 x 512 px.
Older Sprout installations missing this entry are repaired
at startup without replacing their theme colors.

An administrator uploads a package, reviews the metadata and server-calculated manifest, chooses `all`, `theme`, or `content`, and installs it. Installation never activates a theme automatically. The preview applies candidate values only to its isolated sample. Administrators explicitly activate a theme later or restore environment/default branding.

For mixed packages, theme-only import leaves lessons untouched; content-only import leaves active branding untouched. Content conflicts use a conservative skip policy: any module whose ID already exists is reported and skipped. Existing modules are never silently replaced. Replacing content requires an administrator to remove or otherwise manage the existing module explicitly before importing under that ID.

Installed packages can be exported as theme-only, content-only, or a combined package. Combined export can include all package-owned modules or a selected subset. Check **Include this site's app name and landing page** to export the site's current name and landing copy inside the theme, so they transfer with any theme. **Export entire site** always includes them. The theme customizer can also package an app name and the current landing page into a new theme. Package removal is blocked while it still owns imported modules so an uninstall cannot silently delete or orphan curriculum.

## Validation And Security

The server recalculates manifest counts and ignores submitted counts as authority. It validates token names and values, image base64 and signatures, asset keys, module/lesson/micro-lesson IDs, supported question types, answer choices and correct responses, character links, glossary entries, citations, and asset relationships. Module and lesson records remain canonical application data.

Packages are untrusted data, even when uploaded by an administrator. They cannot provide JavaScript, raw CSS, HTML, remote resource URLs, or application code. Package validation rejects user/authentication/deployment secrets and private operational records such as credentials, learner progress, attempts, sessions, and analytics. No imported property is spread into DOM styles; runtime tokens map through an explicit allowlist.

The current deployment configuration does not rely on MongoDB transactions. Import therefore tracks newly-created assets and modules and compensates by removing them if a later operation fails. A package record is only created after the selected assets and modules have installed successfully. Existing conflicting module records are never part of rollback.

## Examples And Sprout Portability

[`shared/packages/examples/sprout.openquiz.json`](../shared/packages/examples/sprout.openquiz.json)
includes the Sprout palette, logo, separate flower marker and progress frame, Abigail/Ramona/beaver
character images, and the converted finance curriculum. Its lesson layout follows the original
Sprout implementation on `main`: a mint card, illustrated track, white speech bubble, character
below it, and Previous/Continue controls. SVG source artwork is rasterized to WebP because
executable-capable SVG imports are not supported.

The conversion utility is [`scripts/generateSproutExamplePackage.js`](../scripts/generateSproutExamplePackage.js).
It reads historical artwork from commit `d431787`, preserves the example's canonical content,
and recalculates its manifest. Run `node scripts/generateSproutExamplePackage.js` to regenerate
the embedded artwork. Financial tables and text use generic canonical content types instead
of executable finance-specific renderers.

To use Sprout's appearance on a fresh installation, activate the preinstalled Sprout theme.
To also install its finance lessons, upload the example with a new `package.id` (for example
`sprout-curriculum`) and choose the `content` scope; the built-in `sprout` package ID is
already installed. A `theme`-only import changes presentation but does not install the
finance lessons. Existing module IDs are skipped, not replaced. If an older
Sprout package is already installed, import the updated theme with a new `package.id` (for
example `sprout-visual-1-1`) using the `theme` scope, then activate it; this leaves existing
curriculum and learner progress intact. Package versions alone do not overwrite an installed
package with the same ID.

Bundled theme setup is idempotent and does not overwrite installed theme settings or an
active selection. If a bundled package is removed, the next server restart installs it
again as an inactive theme-only package. Bundled assets are system-owned; no synthetic
user account is created to install them.

[`shared/packages/examples/learning-garden.openquiz.json`](../shared/packages/examples/learning-garden.openquiz.json)
remains a generic theme-only fixture. Both examples use the same public slots and tokens:
there is no Sprout-only rendering branch.
