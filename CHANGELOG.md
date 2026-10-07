# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

<!-- ## [Unreleased] -->

<!-- --- -->

## [1.5.0] - 2026-10-07

### Added

- Added dark mode to the default theme, Learning Garden, and Sprout. Every theme now has a light and a dark palette; packages can include an optional `theme.darkTokens` section (colors only). Colors a theme leaves out use built-in dark defaults, and gray borders and muted text follow the dark palette.
- Added **Light and dark mode** site settings under **Theming → Site name and landing page**. Administrators choose the default (light, dark, or each visitor's device setting), whether learners see a light/dark toggle, and where it appears: header, footer, bottom right, or bottom left. A learner's choice is remembered in their browser. These are site settings, so they stay the same when the active theme changes. `/theme` and `/admin/site-settings` include `colorMode`.
- Added a **Light mode colors / Dark mode colors** switch to the theme customizer. The preview shows the palette being edited, contrast warnings are labeled per mode, and saved or downloaded themes include the dark palette.
- Bundled Sprout (v1.6.0) and Learning Garden (v1.3.0) now ship green dark palettes. Existing installs get them at startup.

### Changed

- New sites start in light mode with the learner toggle in the header.
- In dark mode, logos are shown with their lightness flipped so dark logos (such as Sprout's) stay visible on dark headers.
- Replaced hard-coded light colors in buttons, toasts, modals, onboarding, callouts, knowledge checks, and lesson text with theme colors so they adapt to dark mode.

---

## [1.4.0] - 2026-10-06

### Added

- Organized the admin dashboard into **Users**, **Lessons**, and **Theming** tabs. The open tab is kept in the URL hash (for example `/admin/dashboard#theming`), the tabs work with the keyboard (arrow keys, Home, End), and the Users tab shows a badge with the number of pending deletion requests.
- Added a public demo mode (`DEMO_MODE=true`) for showcase deployments. Every verified sign-in, including Google and GitHub, becomes an admin. Other users' emails are hidden and user search matches names only. Admin actions on other accounts return `403`, and the admin dashboard shows a demo notice. `/admin/status` and `/admin/users` report `demoMode`.
- Added a daily **Reset demo site** GitHub Actions workflow and a `npm run demo:reset` script (which requires `DEMO_RESET_CONFIRM=reset-demo-site`). The reset deletes every account and its learner data, then restores lessons, themes, packages, assets, and site settings to the bundled starter content, so the next visitor becomes an admin. The workflow uses the `DEMO_MONGO_URI` repository secret and skips when the secret is missing, so forks are unaffected.

### Changed

- In demo mode, cached lessons expire after 60 seconds, so the outside reset reaches a running server without a restart.

---

## [1.3.1] - 2026-10-06

### Added

- Added learning-path color tokens for secondary text, step titles, divider lines, completed steps, current and upcoming steps, step outlines, the footer bar, and the footer border. The theme customizer, built-in palettes, package schema, and theme docs include them.
- The bundled Sprout (v1.5.0) and Learning Garden (v1.2.0) themes ship green values for the new tokens. Existing installs get any missing tokens filled in at startup without overwriting admin edits.

### Fixed

- Fixed the admin theme preview showing yellow learning-path steps that did not match the live page and could not be changed. The preview now renders the same step component and colors as the learning-path page, and scales to fit narrow columns.
- Removed unused hard-coded yellow step colors. The learning-path hero card now follows the theme's highlight and card colors.
- Fixed an intermittent glossary end-to-end failure by waiting for page requests to settle before recording the lesson baseline.

---

## [1.3.0] - 2026-10-06

### Added

- Added a site-wide app name, configurable in the admin panel. It is used in the page title, header, footer, image alt text, server-rendered `index.html` metadata, and the web app manifest. `VITE_APP_NAME` is now only a fallback.
- Added a customizable landing page (hero, benefits, how it works, and FAQ) with an admin editor that can reorder, add, remove, and reset items. The landing page can optionally show the theme's avatars in the hero.
- Theme packages can now carry `theme.appName` and `theme.landing`. When activating a theme, admins can choose whether to apply its app name and landing page. Exports can include the current site's name and landing page (`includeSite`).
- Bundled the Learning Garden and Sprout themes as installed but inactive packages, so admins can switch to them without finding the package files. The Sprout package (v1.4.0) ships its own app name and landing page.
- Added a checkbox and button to install the Sprout lessons when activating the Sprout theme, so they can be configured like any other lessons.
- Added a full site export and import, plus a theme customizer that builds a portable theme package from the admin panel.
- Added a themeable learning-path trail (for example, vine or dashed) and themeable answer marks: Sprout uses its check and X images, and other themes use accessible built-in badges.

### Changed

- The first verified user to sign in becomes the administrator, including users who sign in with GitHub or Google OAuth.
- Restored the original Sprout presentation for the home, learning-path, and lesson screens.
- Made the progress-bar marker (for example, Sprout's flower) larger so it reads clearly against the bar.
- In production, lessons no longer show missing guide-character images. In development they still appear broken, so missing assets are easy to spot.
- If the site settings fail to load in the admin package manager, the error is shown on its own and package uploads keep working.
- Documented the app name, landing page, and site settings API in the theme and API guides and the package schema.

### Fixed

- Fixed the missing beaver avatar in the Sprout avatar library.
- Restored Jest 30 and nodemon 3 in the backend after an `npm audit fix --force` downgrade broke the test suite.
- Updated stale backend, end-to-end, and smoke-test expectations to match the current theme API and accessible answer marks.

---

## [1.2.2] - 2026-10-06

### Fixed

- Fixed shared-file sync pull requests between `docs` and `development` failing when the `documentation` or `changelog` labels are missing. The workflow now creates missing labels before creating or updating a pull request, preserves existing labels, and requests the required `issues: write` permission.

### Changed

- Documented shared-file synchronization, automatic label creation, and the required GitHub Actions permissions.

---

## [1.2.1] - 2026-10-06

### Added

- Added a Render Blueprint quick-start to the README and detailed deployment instructions covering MongoDB connectivity, required secrets, and manual Web Service settings.

### Changed

- Documented the single-service deployment flow: install backend runtime and frontend build dependencies, build Vite into `frontend/dist`, and start Express to serve the frontend and API from the same origin.
- Clarified that the Blueprint does not provision MongoDB or prompt for secrets, and that the service must be redeployed after configuring its required environment variables.
- Refreshed dependency lockfiles following an npm audit pass, including backend development dependency changes to Jest `^25.0.0` and nodemon `^1.14.10`.

---

## [1.2.0] - 2026-10-01

### Added

- Added administrator-managed portable `.openquiz.json` packages with optional themes, embedded image assets, avatars, and canonical lesson/module content.
- Added runtime theme loading and explicit activation, theme previews, scoped package imports, export, and default-brand restoration.
- Added package manifests, asset-key portability, content conflict reporting, and package format documentation/schema.

### Changed

- Runtime branding now overrides environment-based instance defaults while preserving them as the fallback.
- Persistent content assets now support theme and package-specific image kinds.

### Security

- Package themes accept allowlisted design tokens and signature-checked PNG, JPEG, or WebP assets only; executable code, raw CSS, and private operational data are rejected.

---

## [1.1.0] - 2026-10-01

### Added

- Added an opt-in weekly XP leaderboard with a dashboard top-20 list and a separate current-rank summary.
- Added weekly XP rollups, leaderboard history, and an opt-in profile setting.

### Changed

- Set leaderboard weeks to reset Mondays at 00:00 UTC and documented the schedule.
- Centralized XP awards in UTC daily totals to enforce the daily cap and support weekly rankings.

### Fixed

- Kept leaderboard responses private by returning display names, avatars, ranks, XP totals, and a current-user marker without user IDs or email addresses.

---

## [1.0.4] - 2026-10-01

### Added

- Added a Render deployment that builds the Vite frontend and serves it from the Express backend.
- Added a clickable email verification link to registration when Brevo delivery is unavailable.

### Changed

- Switched production frontend, API, OAuth, and verification flows to a same-origin Render service.
- Removed the Netlify-only redirect configuration.

## [1.0.3] - 2026-10-01

### Added

- Added an open.quiz orientation instance with its own database, preserved green theme, logo, and Nova/Kit lesson avatars.
- Added guest lesson discovery, sample previews, admin lesson JSON guidance, and persistent avatar uploads.
- Added a generic lesson table format and an orientation module covering the platform's core layers.

### Changed

- Replaced the active Sprout finance demo with the open.quiz orientation sample; legacy finance data now exists only as backend test fixtures.
- Added root instance setup and import commands for repeatable local instance creation.

### Fixed

- Restored the homepage's guest lesson exploration flow using public module discovery.

---

## [1.0.2] - 2026-09-09

### Added

- Added Playwright projects that emulate throttled networks and CPU so slow-connection glitches can be reproduced locally.
- Added a learn flow latency end-to-end suite that injects per-endpoint API delays to catch slow-network races.
- Added a `verify` script that formats, lints, and runs the unit and full end-to-end suites in one command.

### Changed

- Changed end-to-end runs to test a production build served by Vite preview instead of the development server.

### Fixed

- Prevented duplicate knowledge check, quiz result, and lesson completion submissions when a button is clicked twice on a slow connection.
- Prevented duplicate admin dashboard requests and onboarding step syncs while a request is still in flight.

---

## [1.0.1] - 2026-09-09

### Added

- Added a branded 500 error page with a refresh call-to-action, shown via a top-level error boundary for uncaught render errors.
- Added a rollback procedure doc covering Netlify and Render dashboard rollback plus a protected-branch PR-based git revert fallback.
- Added a "Report a bug" link to the 404 and 500 pages, opening a pre-filled GitHub issue.

---

## [1.0.0] - 2026-09-09

### Added

- Added a progress-aware browser favicon that changes as authenticated learners complete more of the course.
- Added an installable web app manifest, standalone display configuration, theme metadata, and a completed-plant app icon.
- Added search engine metadata, Open Graph and Twitter sharing cards, canonical URL metadata, and WebApplication structured data.
- Added regression coverage for progress favicon selection and authenticated end-to-end dashboard data fixtures.

### Changed

- Set the completed plant as the default favicon and installed-app icon for visitors and installed clients.

### Fixed

- Prevented signed-out visitors from requesting protected onboarding state and producing expected 401 console errors.
- Updated end-to-end curriculum completion coverage for the dashboard continuation shown after the final lesson.

---

## [0.9.2] - 2026-09-09

### Added

- Added Playwright coverage for completing the full curriculum, including weighted quiz scoring and final-lesson persistence.
- Added backend regression coverage for dashboard progress, final-quiz completion reconciliation, and idempotent quiz rewards.
- Added frontend regression coverage for final-lesson dashboard navigation, completion saves, failed-quiz retries, and learning-path progress states.

### Changed

- Learning-path progress now uses completed lessons, matching the dashboard percentage and completion state.
- Completing the final lesson now takes learners to the dashboard after progress is saved.
- Failed final quizzes can be retried directly from the results screen.

### Fixed

- Restored aggregate lesson scoring so completion is based on the combined question score across the lesson's quizzes instead of requiring every individual quiz to pass.
- Fixed final quiz passes not marking their parent lesson complete, which left completed learners at 83% progress.
- Backfilled completed lessons for existing learners with a recorded passed final quiz.
- Prevented stale dashboard responses after lesson completion by disabling dashboard response caching.
- Prevented duplicate lesson XP when a passed final quiz is submitted again.

---

## [0.9.1] - 2026-09-09

### Fixed

- Fixed dashboard curriculum progress showing 67% after the learning path reached 100% by aligning lesson completion with completed micro-lessons and persisted module completion.
- Fixed final lesson completion when a learner has passed every quiz but resumed from persisted micro-lesson progress. Lesson scoring now requires each knowledge check to pass and includes previously completed quiz micro-lessons.
- Fixed a critical lesson-navigation regression that showed "Lesson unavailable" when learners advanced to the next lesson or opened their current lesson. Access checks now recognize saved lesson and micro-lesson progress, preserving access to previously reached lessons when older completion records are incomplete while keeping future lessons subject to unlock rules.
- Aligned the "Current Lesson" destination with the learning path's step progress, preserving valid saved positions and falling back to an existing lesson when a saved lesson ID is no longer valid.
- Prevented the "Continue" link from opening the next lesson before completion finishes saving.
- Fixed completion of bundled lessons when modules have not been seeded in the database by using the same content lookup as lesson loading.

### Added

- Added a "Saving progress…" state and visible completion errors with a "Retry saving" action.
- Added backend regression coverage for advancing across lesson boundaries, resuming stale progress, reviewing completed lessons, resolving current-lesson redirects, and completing bundled content.
- Added frontend regression coverage for delayed completion saves and retrying failed saves before enabling the next lesson.

### Changed

- Upgraded Vitest and its V8 coverage package to 5.0.0 and updated Playwright, Jest, form handling, validation, database, rate-limiting, and lint dependencies.
- Moved weekly Dependabot updates to Tuesday and grouped Vitest packages into a single dependency update.
- Defined explicit CI token permissions and updated the browser-test dependency cache to use the frontend lockfile.

---

## [0.9.0] - 2026-09-08

### Added

- Added a learning path header card with the module progress bar, percentage complete, guide artwork, and an encouraging trail summary.
- Added regression coverage asserting the learning path scrolls the current lesson into view.
- Added micro-lesson titles, estimated reading time, and completed, current, and locked status icons to each learning path node.
- Added a post-it note variant to the shared modal for lightweight, playful detail panels.
- Added a step details note on the learning path that shows the lesson goal, a content preview, section count, and a status-aware action for starting, resuming, or reviewing a step.
- Added regression coverage for opening the step details note, including the locked-step explanation.
- Added an authenticated endpoint that resumes learners at their most recently touched, currently unlocked lesson, with safe fallbacks for stale or missing progress.
- Added regression coverage for lesson access guards and resume-path fallbacks.

### Changed

- Replaced the straight arrow connectors between learning path nodes with curved, leafy vines that alternate direction along the trail.
- Deferred the scroll to the current lesson until the asynchronously loaded node has rendered, and limited it to a single scroll per visit.
- Increased the spacing between learning path nodes so the new titles and reading times fit without overlapping.
- Anchored the connecting vines to the node circles so the new labels do not shift the lines.
- Selecting a learning path node now opens its details note instead of navigating straight into the lesson, and locked steps can be previewed rather than being unusable.
- Reworded the learning path helper text to invite learners to preview a step before starting it.
- Improved quiz answer feedback with clearer selected, correct, and incorrect answer highlighting.
- Changed the unavailable-lesson link to return learners to their current lesson instead of the home page.

### Removed

- Removed the commented-out onboarding overlay block from the learning path page.
- Removed the "start here" callout bubble from the first learning path node.

### Fixed

- Fixed learning-path node navigation so selecting a micro-lesson opens that exact micro-lesson instead of resuming a different saved step.
- Fixed the landing-page discrepancy so the homepage matches the intended design and presentation.
- Prevented learners from loading locked lessons before completing the previous lesson while preserving access to their saved current position.

---

## [0.8.3] - 2026-09-07

### Fixed

- Resolved quiz submissions before skipping local quiz state updates after unmount, preventing rapid navigation from triggering React updates on unmounted components.

---

## [0.8.2] - 2026-09-06

### Added

- Added the onboarding flow for new users, including progress tracking, skip behavior, retakes, and API coverage.
- Added a self-service profile action for resetting lesson progress.
- Added Playwright, frontend, and backend regression coverage for quiz pass/fail results and retries.

### Changed

- Preserved the best score for each micro-lesson when learners retry a quiz.
- Used the server-reported quiz score when calculating lesson results.
- Allowed learners to start a new quiz attempt after submitting a previous attempt.
- Consolidated duplicate frontend test suites and reused shared validation across profile and account endpoints.
- Reduced the minimum long-password requirement from 16 to 15 characters.

### Removed

- Removed obsolete onboarding implementations, duplicate role-protection code, and stale related test files.

### Fixed

- Prevented failed quiz submissions from displaying a misleading `0% — Fail` result.
- Reset stale quiz attempt state when learners start a lesson over.
- Fixed onboarding initialization and route detection for new and completed tours.

---

## [0.8.1] - 2026-09-05

### Changed

- Removed the duplicate reward toast rendering from the lesson flow so micro-lesson badge and streak notifications appear only once.
- Renamed the onboarding context, hook, and overlay modules to drop the legacy `1` suffix.
- Sourced XP from `UserProgress` in the user API integration tests to match the canonical XP model.

### Removed

- Deleted commented-out code, stale editor notes, and leftover debug logging across the onboarding, quiz, badge, dashboard, and learning path modules.

### Fixed

- Repaired the onboarding context test suite, which imported a renamed module that no longer existed and therefore never ran.

---

## [0.8.0] - 2026-09-05

### Added

- Added reward toasts for XP, streak, and badge updates earned while completing micro-lessons.
- Added regression coverage for UserProgress XP totals, legacy numeric streak migration, and failed micro-lesson completion persistence.

### Changed

- Made UserProgress the canonical source for user XP totals across profile and navigation views.
- Removed the obsolete User XP field and duplicate `current_streak` profile response field.
- Refreshed profile and dashboard data after micro-lesson reward updates.

### Fixed

- Migrated legacy numeric streak values before updating streak details, preventing MongoDB nested-field update errors.
- Prevented failed micro-lesson reward persistence from trapping learners in an endless quiz loop.

---

## [0.7.5] - 2026-09-06

### Changed

- Consolidated duplicate frontend test coverage for the main layout, navbar, and dashboard hook into single canonical suites without changing behavior.

---

## [0.7.4] - 2026-09-05

### Added

- Added a confirmed self-service action for learners to reset their lesson progress from the Profile page.

### Changed

- Updated completed onboarding tours to offer a dashboard retake action instead of an always-visible setup checkbox.
- Updated onboarding skip behavior to disable the workflow and return learners to the dashboard.

### Fixed

- Fixed onboarding state initialization for tours that have not started and prevented the home route from being treated as the dashboard tour.

---

## [0.7.3] - 2026-09-05

### Added

- Added API integration coverage for onboarding progress updates and tour completion behavior.

### Changed

- Consolidated the frontend onboarding context, overlay, constants, and utilities under the shared onboarding feature.
- Simplified protected routing by supporting role checks through the shared protected route.
- Reused shared request validation for profile, avatar, password, and account-deletion endpoints.
- Reduced the long-password minimum from 16 to 15 characters across frontend and backend validation.

### Removed

- Removed the obsolete onboarding implementation, duplicate role-protected route, stale learning-path tour markup, and commented-out code from related backend and lesson-rendering files.

---

## [0.7.2] - 2026-09-05

### Added

- Add core rules implementation and corresponding tests for XP calculations and lesson unlocking

---

## [0.3.4] - 2026-08-19

### Added

- Implemented soft deletion, reactivation, and avatar upload updates
- Integrated Joi validation for profile route
- Added profile and account lifecycle tests to Postman collection
- Added Postman collection tests for Express routes

### Changed

- Updated dashboard, profile, and lesson onboarding descriptions and renamed the sample lesson tour heading to "Lesson Page".
- Cleaned up onboarding comments and standardized formatting across onboarding code, validation, shared layout, and related tests.
- Synchronized frontend and backend lockfile references to the root package's 0.7.1 version.

### Fixed

- Added completed-onboarding API fixtures to the mobile navigation and profile avatar end-to-end tests so those scenarios do not depend on live onboarding state.

---

## [0.7.1] - 2026-09-04

### Added

- Added focused regression coverage for mapping dashboard, profile, learning-path, lesson, and unrelated URLs to onboarding page names.

### Changed

- Centralized onboarding step and route definitions in a shared constants module so the context and standalone hook cannot drift apart.
- Extracted onboarding page detection into a shared utility, preserving exact learning-path matching and nested lesson-route detection.
- Added provider-scoped OAuth failure diagnostics without logging state values or other sensitive callback data.

### Fixed

- Fixed invalid, missing, expired, or reused OAuth state callbacks to return a specific sign-in-session error instead of the generic OAuth failure message.

---

## [0.7.0] - 2026-09-04

### Added

- Added an authenticated, four-step product tour across the dashboard, profile, first lesson, and learning path, with controls to start, skip, resume, and retake the tour.
- Added persistent onboarding state and authenticated APIs for reading, resetting, enabling, disabling, and updating tour progress.
- Added a 50 XP reward for completing every onboarding tour without skipping.
- Added OAuth provider avatars to newly created and linked accounts, with initials displayed when an avatar is missing or fails to load.

### Changed

- Updated the current-user response with avatar, streak, and XP data used by shared account views.
- Updated last-lesson navigation to open the first lesson when no saved or server-provided lesson path is available.
- Updated externally hosted avatars to use a no-referrer request policy.

### Fixed

- Fixed sign-in for existing GitHub-linked accounts when GitHub does not return an email address on a later authorization.
- Fixed OAuth avatar synchronization so returning users receive their current provider avatar.

---

## [0.6.1] - 2026-09-03

### Changed

- Updated OAuth sign-in to carry requested destinations through the complete provider round trip using short-lived, provider-scoped state metadata.
- Centralized post-login destination selection for password and OAuth sign-in flows.

### Fixed

- Fixed post-login routing so administrators without a requested destination reach the admin dashboard instead of the learner dashboard.
- Fixed OAuth sign-in so a valid requested destination survives the provider redirect and is restored only after successful OAuth state validation.
- Fixed an open-redirect risk by rejecting absolute, protocol-relative, malformed, and non-string post-login destinations and falling back to the user's normal dashboard.

### Security

- Prevented provider callback parameters from overriding the destination stored by the application before OAuth authorization.

---

## [0.6.0] - 2026-09-02

### Added

- Added Google and GitHub social sign-in with provider availability detection and account linking.
- Added direct OAuth account-linking coverage and an OAuth provider availability endpoint for the sign-in UI.
- Added OAuth post-login routing that preserves requested destinations (the `next` parameter) just like regular password login.

### Changed

- Updated OAuth sign-in flow to make Terms acceptance optional at the button level, matching password-login UX; Terms acceptance is still required by the backend only during new account creation.
- Updated API and development setup documentation with OAuth configuration and sign-in details.

### Fixed

- Hardened Google and GitHub sign-in with verified-email selection, explicit Terms acknowledgement for new accounts, and one-time OAuth state validation.
- Restored the required User email contract and sparse provider ID behavior so ordinary accounts do not collide on OAuth indexes.

---

## [0.5.0] - 2026-09-02

### Added

- Added module-level glossary terms, definitions, and Works Cited sources for the budgeting curriculum.
- Added a floating Glossary and References action throughout lesson routes, with alphabetical term browsing, filtering, source links, and clear empty states.
- Added unit, integration, API-contract, and Playwright coverage for glossary resources, empty states, focus restoration, responsive layout, and unchanged lesson progress and quiz submission.

### Changed

- Updated the lesson layout to pass the active module's glossary and Works Cited data to the footer instead of falling back to budgeting content.
- Updated glossary search to use the shared accessible input component and accessible controls for switching between glossary and reference views.
- Updated quiz scoring test fixtures to match the current micro-lesson question identifiers.

---

## [0.4.2] - 2026-09-02

### Added

- Added URL-based avatar management on the Profile page, with avatar images shown in the shared navigation and an initials fallback when an image cannot load.
- Added a public quiz answer-check endpoint that returns correctness, correct choices, and an explanation only after a learner submits an answer.
- Added a retry state when profile details cannot be loaded.

### Changed

- Updated account reactivation to use the normalized sign-in credentials, login rate limit, and shared account-deletion lifecycle handling.
- Updated profile, dashboard, and shared navigation state to synchronize learner details and current streaks after profile or learning-progress changes.
- Improved administrator user management filters and in-place updates, and disabled account actions that are not available for accounts scheduled for deletion.
- Standardized profile avatars as validated HTTP(S) URLs rather than file uploads.
- Updated global API rate limits to use production-specific limits while keeping development and test environments practical.

### Fixed

- Fixed stale learning streaks after missed days and kept profile and dashboard streak displays consistent.
- Fixed authentication handling so normal authorization and CSRF errors do not clear local sign-in state; confirmed invalidated, disabled, and deleted accounts now use stable session error codes.
- Fixed profile, password, deletion, and reactivation validation responses to return consistent structured errors.

---

## [0.4.1] - 2026-09-02

### Added

- Added Playwright coverage verifying that saving a display name updates the header avatar.

### Changed

- Redesigned mobile navigation as an anchored dropdown with account details for signed-in learners and a direct account-creation action for visitors.
- Improved mobile navigation accessibility with explicit open and close labels, menu relationships, active-link styling, click-away dismissal, and Escape-key support.
- Updated lesson question normalization to preserve correct choice identifiers from current and legacy lesson payloads.

### Fixed

- Fixed dashboards in fresh environments with no persisted modules so new learners receive the default Cash Flow start action and passed quizzes reconcile into saved progress.

---

## [0.4.0] - 2026-09-02

### Added

- Added full profile management for viewing and updating account details, avatar URLs, goals, notification preferences, passwords, and account deletion requests
- Added role-based administrator authorization with protected backend routes and frontend admin routing
- Added atomic administrator bootstrap behavior that assigns the first successfully registered user the admin role
- Added an administrator control panel for managing users, account status, roles, email verification, progress resets, and account deletion
- Added admin user listing, Ban/Unban controls, role management, progress reset, email verification, and reversible account deletion actions
- Added a 30-day account deletion lifecycle with scheduled deletion metadata and account reactivation support
- Added MongoDB-backed lesson module storage and lesson content management
- Added public lesson content APIs for signed-out lesson previews
- Added server-side quiz answer checking with intentional immediate correct-choice and explanation feedback after an answer is submitted
- Added admin module and nested lesson CRUD APIs with budgeting module seed support
- Added duplicate module and lesson protection with lesson cache invalidation
- Added an admin-only budgeting seed workflow for initializing runtime lesson content
- Added a full lesson JSON editor for lesson metadata, micro-lessons, quizzes, and lesson content blocks
- Added block-type controls for paragraph, callout, formula, list, quiz, table, and budget content
- Added structured editing support for lists, character introductions, knowledge checks, tables, and budget summaries
- Added backend and frontend regression coverage for profile management, account deletion, reactivation, administrator authorization, route guards, session invalidation, lesson content, and admin workflows
- Added Postman coverage for administrator status, user management, module seeding, module CRUD, nested lesson CRUD, public lesson loading, and quiz answer checks
- Added separate public, user, and admin Postman workflows with shared session and CSRF environment variables

### Changed

- Updated authentication to use database-backed user state and token-version checks when validating active sessions
- Updated login behavior to route administrators to the admin panel and learners to the standard dashboard
- Updated shared navigation to expose administrator links only to authorized users and make all navigation links accessible from the mobile menu
- Prevented disabled, banned, and deleted users from signing in or continuing authenticated sessions
- Updated account deletion to use an administrator-reviewed soft-deletion workflow with a recovery period
- Updated signed-out lesson previews to load lesson content through the public lesson API instead of bundled frontend content
- Updated lesson normalization to consume API-provided lesson payloads
- Updated public and authenticated lesson responses to sanitize quiz answers and explanations before the intentional immediate-feedback check request
- Updated quiz state to use correctness metadata returned by the server instead of calculating correctness from bundled answer data
- Made learning-path module discovery database-driven instead of assuming the `cashFlow` module
- Made dashboard next actions and empty states reflect the lesson modules currently available in the database
- Updated unseeded learning-path states to use the shared `EmptyState` presentation and lesson artwork
- Replaced admin panel action controls with the shared `Button` component
- Updated Postman authentication workflows to share user and admin session and CSRF state
- Updated Postman requests to correctly handle login cookies, logout sessions, dashboard events, and multipart lesson imports

### Fixed

- Fixed non-administrator access to protected administrator pages so unauthorized users return to the standard dashboard
- Fixed account reactivation lookups so recently deleted users can be restored during the 30-day recovery period
- Fixed profile deletion and administrator approval/rejection requests so frontend and backend API contracts remain aligned
- Fixed soft-delete validation to accept the deletion state used by the admin panel
- Fixed banned-account login handling to return an explicit account-banned message
- Fixed administrator account actions so admins cannot perform destructive management actions against their own account
- Fixed repeated administrator email verification attempts
- Fixed duplicate lesson and module creation and ensured content caches are invalidated after administrative updates
- Fixed Postman user login cookie capture, logout cookie handling, dashboard event requests, multipart import headers, and collection route coverage

### Security

- Added explicit administrator-role enforcement to all protected admin API routes
- Added database-backed JWT version validation so password changes, account deletion, bans, and other account-state changes can invalidate existing sessions
- Added banned-session enforcement so already authenticated users cannot continue using revoked accounts
- Prevented administrators from targeting their own account with destructive management actions
- Restricted account deletion approval and rejection to users with active pending deletion requests
- Allowlisted administrator API response fields to prevent sensitive user data such as password hashes from being exposed
- Stopped administrator deletion actions from returning complete user documents
- Prevented public and authenticated lesson APIs from exposing quiz `correctResponse` or explanation data in initial lesson payloads; `POST /api/v1/quizzes/check` intentionally returns feedback after an answer is submitted
- Moved quiz correctness validation to the backend instead of trusting client-side lesson content

### Removed

- Removed the frontend dependency on bundled lesson content for signed-out lesson previews
- Removed the `getSampleLesson` preview helper
- Removed automatic runtime loading of arbitrary lesson JSON files in favor of MongoDB-backed module discovery and administrative seeding
- Kept learning-path module discovery database-driven while allowing dashboard and direct `cashFlow` lesson requests to use bundled default content when MongoDB has not been seeded

---

## [0.3.8] - 2026-09-01

### Added

- Added core rule utilities and corresponding tests for XP awards and caps, streak/freeze status, and lesson-unlock gating.
- Added backend API integration, contract, and negative-path coverage for authentication, password reset, logout/CSRF protection, lesson and dashboard progress, quiz persistence and submission, middleware/error responses, security headers, and rate limiting.
- Added shared backend authentication and request helpers to reduce repeated Authorization and session-plus-CSRF setup across integration tests.
- Added backend coverage enforcement through `test:coverage` with global Jest coverage thresholds.
- Added frontend regression and unit coverage for authentication, dashboard caching and refresh, lesson loading and navigation, learning-path state, quiz interactions and review flows, reducers, shared components, accessibility behavior, consent analytics, and email verification.
- Added Playwright end-to-end testing with Chromium, including browser smoke coverage for protected-route redirects and keyboard navigation through the responsive mobile menu.
- Added CI artifacts for frontend test output, frontend builds, backend coverage, and Playwright reports/results to improve failure diagnostics.
- Added a keyboard-accessible "Skip to content" link and main-content target to the shared application layout.

### Changed

- Updated CI pull-request triggers from `docs` to `main`.
- Updated backend CI to enforce coverage thresholds and added browser journey checks to the CI pipeline.
- Updated email-verification errors to use alert semantics so they are announced by assistive technology.
- Updated formatting and test-result ignore configuration for generated coverage, build, and Playwright artifacts.

### Fixed

- Fixed error handler middleware signature to include next parameter
- Fixed the Express error-handler middleware contract to accept `next` and forward errors when response headers have already been sent.

---

## [0.3.7] - 2026-08-25

### Added

- Added chunk-level lesson progress tracking so learners can resume at the exact lesson, micro-lesson, and chunk they left off on
- Added a lesson progress restart endpoint and frontend API helper for restarting saved progress
- Added `LessonControlPanel` with a welcome-back message and --Start Over-- option when resuming saved lesson progress
- Added backend regression and validation tests for lesson progress creation, updates, restarting, and invalid requests
- Added frontend regression tests for lesson resume, restart, progress syncing, and `LessonControlPanel` behavior
- Added the lesson progress restart endpoint to the API documentation and Postman collection

### Changed

- Updated Learning Path navigation to pass the selected micro-lesson into the lesson flow and changed the current lesson action from --Next-- to --Resume--
- Updated lesson progress syncing to save the learner's current chunk along with the lesson and micro-lesson
- Updated global API rate limiting to allow 200 requests per 15 minutes in production and use a higher limit during development

### Fixed

- Fixed lesson resume behavior so saved progress returns learners to the correct micro-lesson and chunk instead of restarting at the beginning of the micro-lesson
- Fixed learning path resume navigation to open the learner's current micro-lesson instead of only opening the containing lesson

---

## [0.3.6] - 2026-08-25

### Added

- Added focused backend integration tests for invalid lesson progress, quiz, password recovery, and dashboard event requests
- Added backend write-endpoint validation tests covering body-less requests and valid schema regression cases
- Added reusable Joi schemas and request validation helpers for backend write endpoint validation
- Added frontend password policy coverage with schema tests and form-level integration tests
- Added shared frontend password helper-text utility for registration and password reset forms
- Added documentation for write endpoint validation and the standard validation error response

### Changed

- Validated backend lesson progress, quiz, password recovery, and dashboard event inputs before processing or persistence
- Updated password validation to accept 16+ character passwords with uppercase, lowercase, and numeric characters; shorter passwords require a special character
- Updated registration and password reset helper text to render conditionally based on password length using shared logic

### Fixed

- Fixed validation behavior for missing request bodies so empty payloads consistently return structured 400 validation responses
- Fixed short-password special-character handling so whitespace does not satisfy the symbol requirement

---

## [0.3.5] - 2026-08-20

### Added

- Added a failing test reproducing the refresh-redirect bug where an authenticated user on the Learn page was sent to login before auth storage finished hydrating

### Fixed

- Fixed LearnPage redirecting authenticated users to login on refresh by waiting for auth hydration before checking authentication state

---

## [0.3.4] - 2026-08-19

### Added

- Added setup script for environment configuration and update package.json

### Changed

- Combines sync-shared-files into a single GitHub workflow file
- Restored functionality from development-backup to optionally inject a port into both frontend and backend

### Removed

- Removed kill-port as devDependency and removes the predev script

---

## [0.3.3] - 2026-08-19

### Added

- Added function to generate random encouraging phrases and words for quiz feedback
- Added ExpandableWhy component for quiz explanation display when the explanation is greater than 30 words
- Added a step-by-step quiz review flow after lesson completion.
- Preserved submitted quiz answers for later review.
- Added read-only answer feedback with correct and incorrect choice indicators.
- Added Previous, Next, and Back to Results navigation during quiz review.
- Added a quiz feedback preference (instant vs. at-the-end) with a toggle on the Profile page.
- Wired the quiz feedback preference into the lesson flow so it controls whether answers are revealed per question or only after quiz submission.
- Added character introductions for Abigail and Ramona in budgeting lessons
- Added additional randomized phrases and words for quiz completion, and catching up on lessons

### Changed

- Extracted the lesson/quiz flow out of LearnPage into a new LearnFlow component, reducing LearnPage's size.
- Refactored CharacterIntro component to only render text
- Refactored Table component for better accessibility and prevent crashes with optional chaining
- Changed the review quiz to only show explanations, not the encouraging text that shows up while taking a quiz

### Fixed

- Resolved a Mongoose deprecation warning by replacing the obsolete `new: true` option with `returnDocument: "after"` in the lesson progress and quiz submission controllers.
- Added `aggregateLessonScore` helper for calculating lesson quiz scores based on the total number of questions
- Added `quizScoring.test.js` tests for weighted scoring, passing and failing scores, and empty submissions
- Added `quiz.scoring.test.js` backend tests to make sure each micro-lesson quiz is still graded on its own

### Fixed

- Fixed lesson quiz scoring to use the total number of questions across all quizzes, preventing incorrect percentages and false "Fail" results

## [0.3.2] - 2026-08-18

### Added

- Added content accuracy review policy document
- Added accuracy review fields to budgeting lessons
- Added lesson accuracy metadata test
- Added content sign-off section to PR template for accuracy review
- Added content accuracy checklist for review process
- Added Content Accuracy section to README files
- Backfilled lesson content with passing metadata when it was completed

## [0.3.1] - 2026-08-18

### Fixed

- Fixed cross-site authentication between the Netlify frontend and Render backend by making session cookie security and `SameSite` settings configurable through environment variables.

---

## [0.3.0] - 2026-08-16

### Added

- Added repository community-standard files: `SUPPORT.md`, `.editorconfig`, `.gitattributes`, and `.nvmrc`
- Added GitHub governance and automation files: `.github/CODEOWNERS`, `.github/SECURITY.md`, `.github/dependabot.yml`, and `.github/workflows/ci.yml`
- Added issue templates for bug reports, feature requests, and security vulnerabilities with issue-chooser contact links
- Added docs index and split guides under `docs/` for setup, API overview, Postman testing, workflow, and roadmap
- Added Postman environment files for remote development and remote production backend testing
- Added GitHub workflows for syncing `docs` with `development` and also `development` with `docs`

### Changed

- Migrated layout into a new folder within `src/shared` called `MainLayout`
- Refactored imports to remove file extensions for consistency
- Established `src/styles/theme.css` as the authoritative frontend design-token source.
- Refactored root `README.md` into a concise landing page that links to detailed docs as the primary source of truth
- Updated contributor guidance and PR template expectations to align with issue-based, `hotfix/`, and `refactor/` workflows
- Updated project structure diagram and provide a link to more detailed ones in project-structure.md

### Fixed

- Resolved a typo within the ConsentBanner component
- Fixed a linting error by removing unused maxAge variable from logout in backend user.controller
- Added optional chaining to content in BudgetSummary component to prevent undefined if json is missing content
- Fixed login rate limiter IP key generation
- In backend/server.js, conditionally sets DNS override only outside of production to prevent the app from crashing in some environments
- Allowed Vite to access shared lesson content by updating the vite.config.js file
- Prevented invalid button props on link components by adding a type check in Button component and confirming isDisable is not undefined
- Fixed Tailwind breakpoint class typo in CharacterIntro component
- Fixed typo with duplicate JWT_SECRET is backend/.env.example
- Improved lesson table rendering by safely handling missing module, table, and budget data, and by selecting the correct budget when a `budgetId` is provided instead of always defaulting to the first budget.

---

## [0.2.9] 2026-08-15

### Added

- Added progress-driven LearningPathPage with lesson and micro-lesson navigation states
- Added LearningPathNode component for current, completed, and locked learning steps
- Added LastLessonRedirect with API lookup and localStorage fallback behavior

### Changed

- Refactor LearningPathPage component to show a callout message

### Fixed

- Switched script runner from concurrently to npm-run-all to prevent multiple "ghost" servers from running.

---

## [0.2.8] - 2026-08-14

### Added

- Added UnitProgressRow component for displaying lesson progress
- Added RecentActivityCard component to display user activity feed
- Added DashboardHero component for user dashboard display
- Added useDashboardData hook for managing dashboard state and caching

### Changed

- Refactor npm scripts for better organization of backend and frontend tests
- Enhanced DashboardPage with loading and error states, dashboard progress summaries, recent activity, and recommended next actions
- Refactored learning-path and last-lesson pages to use the shared authentication context, API services, and feature-based component structure

---

## [0.2.7] - 2026-08-11

### Added

- Added quiz scoring utility functions for normalizing choice IDs and scoring attempts
- Implemented quiz reducer with action handling and initial state setup
- Added useQuiz hook for managing quiz state and interactions
- Added QuizComponent for interactive quiz functionality

### Changed

- Invalidated cached dashboard on quiz submission to ensure progress updates are reflected

---

## [0.2.6] 2026-08-10

### Added

- Added useLessonContent hook for lesson data fetching and state management
- Added normalization functions for lesson content and questions
- Added lesson cash flow JSON fixture for budgeting module

### Changed

- Moved lesson components into features and adds component suffix
- Refactored LearnPage to integrate lesson flow and progress tracking

### Fixed

- Fixes script option in dev command to prevent concurrent failures
- Added SAMPLE_LESSON_LINK to routes

---

## [0.2.5] 2026-08-09

### Added

- Declared @hookform/resolvers as a dependency
- Added validation schemas for authentication and password management
- Added placeholder identities for fun registration experience
- Implemented password reset and email verification forms with error handling and user feedback

---

## [0.2.4] - 2026-08-08

### Added

- Added legal consent utility functions for tracking preferences
- Added ConsentBanner component to handle user consent for analytics
- Added Privacy and Terms pages with detailed content and improved layout
- Added Profile page shell and created routes to reach it

### Changed

- Refactored HomePage component to enhance layout and integrate authentication logic
- Compress images by converting large SVGs into .webp images

---

## [0.2.3] - 2026-08-07

### Added

- Added initial page components for Dashboard, Last Lesson Redirect, Login, Password Reset, Privacy, Register, Terms, and Verify Email
- Added ProtectedRoute component for authentication handling

### Changed

- Refactored main entry point to use BrowserRouter
- Refactored App component to set document title based on route
- Refactored AppRouter to use Routes as taught in curriculum
- Renamed LessonPage to LearnPage
- Refactored HomePage and LearningPathPage to use named exports
- Refactored route definitions and titles in routes.js to support handling titles

---

## [0.2.2] - 2026-08-06

### Added

- Added logo, progress-bar, flower-progress, right, and wrong answer SVG images
- Added useFieldA11y hook for accessible form field management
- Added Footer and Header components with navigation links

### Changed

- Renamed every shared component to have a `.component.jsx` suffix
- Refactored layout components: updated MainLayout import path, enhanced Header with logo and props, and streamlined NavBar structure

### Removed

- Removed unused SVG images

---

## [0.2.1] - 2026-08-05

### Added

- Added auth reducer with action types and initial state
- Implemented authentication context and provider
- Updated environment configuration and API paths
- Added lesson and quiz endpoints

### Changed

- Refactored useAuth hook to improve authentication state management and storage handling
- Disabled react-refresh rule for context files
- Wrapped AppRouter with AuthProvider for authentication context

### Removed

---

## [0.2.0] - 2026-08-04

### Added

- Added `frontend/src/styles/reset.css` with an accessibility-focused reset covering `:focus-visible`, `forced-colors`, and `prefers-reduced-motion`
- Added `frontend/src/styles/theme.css` defining the Tailwind `@theme` design tokens for brand, status, surface, and learning-path colors
- Added `VITE_API_PORT` documentation to `frontend/.env.example`
- Added a `/api` dev-server proxy to `frontend/vite.config.js`, targeting the port set by `VITE_API_PORT` (defaults to `8080`)
- Added `frontend/public/_redirects` so client-side routes resolve correctly on Netlify

### Changed

- Changed `frontend/src/index.css` to import the reset and theme stylesheets alongside Tailwind

### Fixed

- Fixed the misspelled `frontend/.prettieringore`, which left `node_modules`, `dist`, `coverage`, and `package-lock.json` unignored by Prettier

---

## [0.1.3] - 2026-08-03

### Added

- Added Postman collection and environment files for local backend API testing
- Added instructions within `.env.example` to generate a proper JWT token for use in production
- Added ESLint and Prettier configuration for code formatting and linting

### Changed

- Refactored JWT middleware to simplify CSRF token validation logic
- Validated microLessonId in startQuiz and handled empty request body
- Refactored error handler middleware to remove unused next parameter and improved error handling structure

### Fixed

- Prevent server from running in production without a JWT_SECRET
- Enforce JWT authentication on logout to prevent CSRF-triggered logouts and session spoofing

---

## [0.1.2] - 2026-08-02

### Added

- Add Postman collection and environment files for local backend API testing

### Changed

- Moved JWT authentication from individual endpoints to the lesson, dashboard, and quiz route groups

---

## [0.1.1] - 2026-08-01

### Added

- Added JSON 404 responses for unknown API routes

### Changed

- Moved error handling middleware to run after all routes

---

## [0.1.0] - 2026-07-31

### Changed

- Handled JWT secrets more efficiently and allowed authenticated API requests using either a session cookie or Bearer token
- Scoped session cookies to the application root so that authenticated users could access all protected routes
- Signed users in automatically after email verification and password reset, which returned a CSRF token
- Returned a success message when logging out and a message stating that a user was not logged in when applicable
- Approved required install scripts for `mongodb-memory-server` and Jest's `unrs-resolver` dependency

### Added

### Fixed

- Replaced deprecated transitive `glob` and `test-exclude` versions with maintained releases

---

## [0.0.7] - 2026-07-30

### Added

- Added dashboard cache invalidation on quiz submission
- Added shared learning-path helpers
- Added dashboard assembly for hero copy, next action, unit progress, recent activity, and passed-attempt reconciliation
- Added POST /api/v1/dashboard/events; unknown event types are accepted and ignored
- Enabled /api/v1/dashboard and /api/v1/quizzes routes

### Fixed

- Fixed module path for budgeting content

---

## [0.0.6] - 2026-07-29

### Added

- Added content utility functions for managing modules and lessons
- Added lesson routes and controller for lesson management

### Changed

- Trimmed manifest.json to the one module that actually ships lessons
- In shared/content/index.js, exported modules map and utility functions

---

## [0.0.5] - 2026-07-28

### Added

- Added completed_micro_lessons to UserProgress Schema
- Added robust scrypt password hashing/comparison
- Added cookie-based JWT middleware with production CSRF checks
- Added dev verification/reset URLs

### Changed

- Renamed controllers, routes, and model files for consistency
- Replaced SMTP with Brevo and a development logging fallback
- Enabled /api/v1/users

---

## [0.0.4] 2026-07-27

### Added

- Cherry-picks commits from feature branches to keep contributions from team to this point

### Changed

- Temporarily removed features breaking code without supporting dependent files

---

## [0.0.3] 2026-07-26

### Added

- Installed dependencies and wrote scripts for backend
- Configured Express App with middleware and a simple hello route
- Added server and MongoDB connection setup
- Initialized environment example files

---

## [0.0.2] - 2026-07-25

### Added

- Initialized new project scaffolding to run project from root folder

### Removed

- Removed initial project scaffolding

---

## [0.0.1] - 2026-07-12

### Added

- Initial release.
