# open.quiz

open.quiz is an open-source learning platform for creating and delivering structured lessons,
interactive quizzes, and learner progress tracking. Content modules are managed independently from
the core authentication, assessment, and progress services.

## Project Areas

- **Core:** accounts, roles, lesson delivery, quiz scoring, and progress.
- **Content:** create modules in the admin area or import a package. Example curricula live under
  `shared/content/examples` and are not installed automatically.
- **Presentation:** the frontend accepts instance-level app-name and theme CSS overrides.
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

- User authentication (register, login, logout)
- CRUD operations for core resources
- Protected routes and authorization
- Responsive UI (mobile & desktop)
- Form validation and error handling
- RESTful API integration
- XP, badges, and streak rewards

<!--
## 📸 Screenshots

<!-- Add screenshots or GIFs of key features here. -->

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

## 📁 Project Structure

```text
summer-26-js-practicum-team2/
├── .github/              # GitHub configuration and community policies
├── backend/              # Node.js/Express API
├── docs/                 # Documentation and Postman resources
├── frontend/             # React application
├── shared/               # Content shared across applications
├── package.json          # Root scripts and project metadata
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
manual service settings, and OAuth configuration.

### Quick Start

```bash
npm run setup
npm run dev
```

- Frontend runs on: http://localhost:5173
- Backend runs on: http://localhost:8080

Before opening a pull request, run the full check:

```bash
npm run verify
```

It formats, lints, runs the backend and frontend unit suites, and runs every Playwright project,
including the throttled-network and learn flow latency runs.

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
