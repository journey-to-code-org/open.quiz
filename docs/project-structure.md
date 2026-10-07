# Project Structure

This page describes the main folders and files in the open.quiz repository.

```text
open.quiz/
├── .github/                          # GitHub repository configuration
│   ├── ISSUE_TEMPLATE/               # Templates for creating GitHub issues
│   ├── workflows/                    # GitHub Actions workflow files
│   ├── CODEOWNERS                    # Defines repository code owners
│   ├── CODE_OF_CONDUCT.md            # Community behavior guidelines
│   ├── CONTRIBUTING.md               # Contribution guidelines and workflow
│   ├── dependabot.yml                # Dependabot dependency update configuration
│   ├── PULL_REQUEST_TEMPLATE.md      # Default pull request template
│   └── SECURITY.md                   # Security policy and reporting guidelines
├── backend/                          # Backend Node.js/Express application
│   ├── scripts/                     # Lesson import and public demo reset tools
│   ├── src/
│   │   ├── config/                   # Application and service configuration
│   │   ├── controllers/              # Request handling and business logic
│   │   ├── jobs/                     # Scheduled leaderboard processing
│   │   ├── middleware/               # Express middleware functions
│   │   ├── models/                   # Database models and schemas
│   │   ├── routes/                   # API route definitions
│   │   ├── services/                 # Authentication, rewards, content, and theme services
│   │   ├── utils/                    # Shared backend helper functions
│   │   └── validation/               # Request and data validation
│   ├── test/                         # Backend tests and test utilities
│   ├── eslint.config.cjs             # Backend ESLint configuration
│   ├── package.json                  # Backend dependencies and scripts
│   └── server.js                     # Backend application entry point
├── docs/                             # Project documentation and development resources
│   └── postman/                      # Postman collections and environments
├── e2e/                              # Playwright end-to-end and latency tests
│   └── fixtures/                     # Shared browser test fixtures
├── frontend/                         # Frontend React application
│   ├── src/                          # Application source code
│   │   ├── app/                      # Application configuration and routing
│   │   ├── assets/                   # Images, documents, and content
│   │   ├── constants/                # Shared frontend constants
│   │   ├── contentPackages/          # Content package artwork and renderers
│   │   ├── context/                  # Authentication state
│   │   ├── reducers/                 # Shared state reducers
│   │   ├── hooks/                    # Shared custom React hooks
│   │   ├── services/                 # API requests
│   │   ├── features/                 # Domain-specific UI and logic
│   │   ├── shared/                   # Reusable UI components
│   │   ├── pages/                    # Route-level views
│   │   ├── utils/                    # Shared helper functions
│   │   ├── test/                     # Frontend tests and test utilities
│   │   └── styles/                   # Reset and theme styles
│   ├── public/                       # Static files served directly
│   ├── eslint.config.js              # Frontend ESLint configuration
│   ├── index.html                    # Frontend HTML entry point
│   └── package.json                  # Frontend dependencies and scripts
├── instances/                        # Instance-specific configuration and branding
│   ├── openquiz/                     # open.quiz instance
│   └── sprout/                       # Sprout instance
├── scripts/                          # Instance launcher and example package tools
├── shared/
│   ├── content/                      # Canonical lesson schema and example curricula
│   ├── packages/                     # Bundled portable experience packages
│   └── schemas/                      # Portable package JSON schema
├── .env.example                      # Example environment variable configuration
├── .gitignore                        # Files and folders ignored by Git
├── .nvmrc                            # Recommended Node.js version
├── CHANGELOG.md                      # Record of project changes
├── CONTRIBUTORS.md                   # Project contributors
├── package-lock.json                 # Locked dependency versions
├── package.json                      # Root-level dependencies and scripts
├── playwright.config.js              # Browser test projects and server configuration
├── render.yaml                       # Single-service Render deployment Blueprint
├── setup.sh                          # Creates missing local environment files
└── README.md                         # Project overview and setup instructions
```
