# open.quiz

open.quiz is an open-source learning platform for creating and delivering structured lessons,
interactive quizzes, and learner progress tracking. Content modules are managed independently from
the core authentication, assessment, and progress services.

## Project Areas

- **Core:** accounts, roles, lesson delivery, quiz scoring, and progress.
- **Content:** create modules in the admin area or import a package. The open.quiz instructional
  module is installed automatically; other example curricula under `shared/content/examples`
  remain opt-in.
- **Presentation:** the frontend accepts instance-level app-name and theme CSS overrides.
  Administrators can also customize the site name, landing page, and theme at runtime.
- **Dark mode:** every theme has a light and a dark palette. Administrators pick the default (light, dark, or follow the device) and whether learners get a light/dark toggle, and where it sits. See [dark mode](docs/themes.md#dark-mode).
- **Portable experiences:** administrators can import and export `.openquiz.json` packages containing a runtime theme and optional canonical lesson modules. See [portable package documentation](docs/themes.md).

## 🤝 Community Standards

- [Contributing Guidelines](.github/CONTRIBUTING.md)
- [Code of Conduct](.github/CODE_OF_CONDUCT.md)
- [Security Policy](.github/SECURITY.md)
- [Support](SUPPORT.md)

## ✅ Content Standards

- [Content Accuracy Policy](docs/content-accuracy-policy.md)
- [Content Accuracy Checklist](docs/content-accuracy-checklist.md)

## Purpose

The platform supports different subjects and visual identities without requiring source changes for
each curriculum. The included open.quiz orientation package demonstrates the platform; deployments
can import their own content packages.

## 🎯 Features

- Password authentication with email verification, plus optional Google and GitHub sign-in
- Structured lesson modules, guided learning paths, interactive quizzes, and glossary entries
- Learner dashboards, progress tracking, XP, badges, streaks, and leaderboards
- Public weekly leaderboard at `/leaderboard`, showing only opted-in learners
- Administrator tools for managing users, editing lessons, importing content, and customizing themes
- Portable `.openquiz.json` packages for sharing themes and lesson modules
- Customizable branding, landing pages, character artwork, and light/dark palettes
- Responsive layouts for mobile and desktop
- Optional public demo mode with administrator access for visitors and a daily reset

## 🛠 Tech Stack

### Frontend

- React
- JavaScript (ES6+)
- HTML5
- CSS3 / Tailwind
- Vite
- Vitest + Testing Library

### Backend

- Node.js
- Express.js
- REST API
- Jest + Supertest

### Database

- MongoDB (Mongoose)

### Tooling

- Git & GitHub
- dotenv
- ESLint / Prettier
- Playwright for end-to-end, throttled-network, and latency tests

## 📁 Project Structure

```text
open.quiz/
├── .github/              # GitHub configuration and community policies
├── backend/              # Node.js/Express API
├── docs/                 # Documentation and Postman resources
├── frontend/             # React application
├── e2e/                  # Playwright end-to-end and latency tests
├── instances/            # Instance-specific configuration and branding
├── scripts/              # Instance launcher and example package tools
├── shared/               # Content, portable packages, and JSON schemas
├── package.json          # Root scripts and project metadata
├── playwright.config.js  # Browser test projects and server configuration
├── render.yaml           # Single-service Render deployment Blueprint
├── setup.sh              # Creates missing local environment files
├── CHANGELOG.md          # Record of project changes
├── CONTRIBUTORS.md       # Project contributors
└── README.md             # Project overview and setup instructions
```

See the [full project structure](docs/project-structure.md) for the detailed
folder and file breakdown.

## ⚙️ Setup & Installation

### Deploy to Render with a Blueprint

open.quiz includes a [Render Blueprint](render.yaml) for easy deployment as a single Node.js
Web Service. No separate frontend hosting service is needed: Render installs dependencies,
builds the Vite frontend, and starts Express, which serves both the frontend and API.

1. Fork this repository if you want your own deployment and connect it to your Render account.
2. In the Render dashboard, choose **New > Blueprint**, select the repository and branch,
   and deploy using the included `render.yaml`.
3. In the created service's **Environment** settings, add `MONGO_URI` and `JWT_SECRET`,
   plus any email or OAuth credentials you use, then redeploy.

The Blueprint does not provision MongoDB or prompt for these secrets. Have a production MongoDB
database ready and allow connections from your Render service. The application cannot start
successfully until its required environment variables are configured.

See [Render deployment instructions](docs/development-setup.md#render-deployment) for details,
manual service settings, and OAuth configuration. To host a public showcase where every visitor
can sign in as an admin and the site resets daily, see
[public demo mode](docs/development-setup.md#public-demo-mode).

### Quick Start

Prerequisites: **Node.js 24+**, npm, and a local or hosted MongoDB database.
The setup script requires Bash; on Windows, run it from Git Bash or WSL.

```bash
git clone https://github.com/journey-to-code-org/open.quiz.git
cd open.quiz
npm run setup
```

Before starting the app, edit `backend/.env`: configure `MONGO_URI` and replace the
example `JWT_SECRET` with a strong secret. Configure email delivery and OAuth providers
as needed; never commit credentials. The setup script preserves existing environment files.
See [environment setup](docs/development-setup.md#environment-setup) for details.

```bash
npm run dev
```

- Frontend runs on: http://localhost:5173
- Backend runs on: http://localhost:8080

The first successful password, Google, or GitHub sign-in initializes administrator access
on a fresh installation. Complete your own initial sign-in before opening it to the public.
Learning Garden and Sprout are preinstalled as inactive themes; an administrator can choose
one in the admin dashboard's **Theming** tab without finding or uploading a package. The open.quiz
instructional lessons are installed automatically for new learners to explore. See
[initial setup details](docs/development-setup.md#first-sign-in-and-built-in-themes).

Before opening a pull request, run the full verification pipeline:

```bash
npm run verify
```

This runs formatting, linting, the backend and frontend unit suites, and every Playwright project,
including the throttled-network and learn flow latency runs. Formatting uses Prettier's write mode
and may modify files. To check formatting without changing files, run
`npm --prefix backend run format:check` and `npm --prefix frontend run format:check`.

For full setup, scripts, testing, and API details, see:

- [Documentation Index](docs/README.md)
- [Development Setup](docs/development-setup.md)
- [Postman Backend Testing](docs/testing-postman.md)
- [API Overview](docs/api-overview.md)
- [Team and Collaboration Workflow](docs/contributing-workflow.md)
- [Roadmap and Known Limitations](docs/roadmap.md)

## 🙌 Acknowledgments

- Code the Dream mentors and practicum staff for guidance and review support
- Contributors for collaborative design, implementation, and testing
- The maintainers of key open-source tools used in this project, including React, Vite, Express, MongoDB, Jest, Vitest, and Postman

## 📄 License

This project uses the license in the root [LICENSE](LICENSE) file.
