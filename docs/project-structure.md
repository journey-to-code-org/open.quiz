# Project Structure

This page describes the main folders and files in the open.quiz repository.

```text
summer-26-js-practicum-team2/
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
│   ├── src/
│   │   ├── config/                   # Application and service configuration
│   │   ├── controllers/              # Request handling and business logic
│   │   ├── middleware/               # Express middleware functions
│   │   ├── models/                   # Database models and schemas
│   │   ├── routes/                   # API route definitions
│   │   ├── utils/                    # Shared backend helper functions
│   │   └── validation/               # Request and data validation
│   ├── test/                         # Backend tests and test utilities
│   ├── eslint.config.cjs             # Backend ESLint configuration
│   ├── package.json                  # Backend dependencies and scripts
│   └── server.js                     # Backend application entry point
├── docs/                             # Project documentation and development resources
│   └── postman/                      # Postman collections and environments
├── frontend/                         # Frontend React application
│   ├── src/                          # Application source code
│   │   ├── app/                      # Application configuration and routing
│   │   ├── assets/                   # Images, documents, and content
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
├── shared/
│   └── content/                      # Content shared by the frontend and backend
├── .env.example                      # Example environment variable configuration
├── .gitignore                        # Files and folders ignored by Git
├── .nvmrc                            # Recommended Node.js version
├── CHANGELOG.md                      # Record of project changes
├── CONTRIBUTORS.md                   # Project contributors
├── package-lock.json                 # Locked dependency versions
├── package.json                      # Root-level dependencies and scripts
└── README.md                         # Project overview and setup instructions
```
