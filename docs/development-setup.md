# Development Setup

## Prerequisites

- Node.js (v24+ required)
- npm
- MongoDB

## Node Version Management (Recommended)

This repo includes a `.nvmrc` file set to Node `24`.

- Windows: use `fnm` (recommended)
- macOS/Linux: use `nvm`

### Windows (`fnm`) auto-switch setup

1. Install `fnm`.
2. Add this to your PowerShell profile so Node auto-switches on folder change:

```powershell
fnm env --use-on-cd --shell powershell | Out-String | Invoke-Expression
```

3. In the project root, run:

```powershell
fnm install
fnm use
```

### macOS/Linux (`nvm`) setup

In the project root, run:

```bash
nvm install
nvm use
```

For auto-switch on directory change, add this to `~/.zshrc` or `~/.bashrc`:

```bash
autoload -U add-zsh-hook
load-nvmrc() {
  local nvmrc_path
  nvmrc_path="$(nvm_find_nvmrc)"
  if [ -n "$nvmrc_path" ]; then
    nvm use
  fi
}
add-zsh-hook chpwd load-nvmrc
load-nvmrc
```

### `nvm-for-windows` note

`nvm-for-windows` does not support automatic `.nvmrc` switching.
If you use it, run this manually in the project root:

```powershell
nvm use 24
```

## Quick Start (Recommended)

```bash
npm run setup
npm run dev
```

- Frontend runs on: http://localhost:5173
- Backend runs on: http://localhost:8080

## Run A Single App

```bash
npm run development:frontend
npm run development:backend
```

Run backend in non-watch mode:

```bash
npm run start:backend
```

## Environment Setup

Copy the backend env template and fill in values:

```bash
copy backend\.env.example backend\.env
```

Mac/Linux:

```bash
cp backend/.env.example backend/.env
```

`backend/.env` is ignored by Git. Keep all OAuth client secrets in that local file or in
the deployment platform's secret store.

## Social Sign-In Setup

Google and GitHub sign-in are optional. A provider cannot complete sign-in until both its
client ID and client secret are set in `backend/.env`.

1. Create a Google OAuth 2.0 client for a web application in Google Cloud and a GitHub
   OAuth App in GitHub Developer Settings.
2. Configure these local callback URLs in the provider dashboards:

```text
Google authorized redirect URI: http://localhost:8080/api/v1/auth/google/callback
GitHub authorization callback URL: http://localhost:8080/api/v1/auth/github/callback
```

3. Add the credentials to `backend/.env`:

```dotenv
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=http://localhost:8080/api/v1/auth/google/callback

GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
GITHUB_CALLBACK_URL=http://localhost:8080/api/v1/auth/github/callback
```

4. Run `npm run dev`, then open `http://localhost:5173/login` and choose a provider. The UI
   checks `/api/v1/auth/providers` and only shows providers whose ID and secret are configured.

OAuth must begin as a browser navigation, not a fetch request or Postman request. After a
successful provider callback, the backend creates an HTTP-only session cookie and redirects
to `/oauth/callback`, where the frontend loads the signed-in user. OAuth start requests also issue a
short-lived, HTTP-only state cookie. The provider callback must return its matching state value,
which is consumed after one use. New OAuth accounts require a verified provider email and the
explicit Terms of Service and Privacy Policy acknowledgement beside the social sign-in buttons.
A failed or cancelled attempt returns to the login page with a safe OAuth error code.

### Render Deployment

open.quiz can be deployed easily using the included [Render Blueprint](../render.yaml). It
creates one Node.js Web Service, installs the backend runtime dependencies and frontend build
dependencies, builds the Vite frontend into `frontend/dist`, and starts the Express server.
In production, Express serves the built frontend and API from the same Render URL, including
frontend routes opened directly or refreshed in the browser. No separate frontend hosting
service is required. Vite remains the local development server.

#### Deploy using the Blueprint

1. Have a production MongoDB database ready, such as a MongoDB Atlas database. Configure its
   network access to allow connections from your Render service.
2. Fork this repository if you want your own deployment, then connect the repository to Render.
3. In the Render dashboard, choose **New > Blueprint** and select the repository and branch.
4. Review and deploy the service defined in the repository-root `render.yaml`.
5. Open the created service's **Environment** settings and add `MONGO_URI`, `JWT_SECRET`,
   and any email or OAuth credentials you use. Save the settings and redeploy.
6. Once the deployment succeeds, open the service URL to load the frontend and check `/health`
   for the server health response.

The current Blueprint sets `NODE_ENV=production`, but does not provision MongoDB or prompt for
secrets. Its initial deployment cannot start successfully until you configure the required
environment variables and MongoDB connectivity.

#### Manual Web Service settings

If you create a Web Service manually instead of using the Blueprint, use these same settings:

| Setting | Value |
| --- | --- |
| Runtime | Node |
| Root Directory | Leave blank (repository root) |
| Node version | 24, matching `.nvmrc` |
| Build Command | `npm ci --omit=dev --prefix backend && npm ci --include=dev --prefix frontend && npm run build` |
| Start Command | `npm run start:backend` |
| Health Check Path | `/health` |
| Environment | `NODE_ENV=production`, plus the required secrets below |

The frontend install explicitly includes development dependencies because Vite and its plugins
are needed during the build. The root build and start scripts do not require installing the
root development tooling. Express uses Render's supplied `PORT`; you do not need to set it.
Leave `VITE_API_BASE_URL` unset for this single-service deployment so browser API requests use
the same origin.

#### Environment and OAuth

Set the required backend secrets and configuration in the Render service environment, including
`MONGO_URI`, `JWT_SECRET`, and any email or OAuth credentials. `CLIENT_URL` and `API_URL`
default to Render's `RENDER_EXTERNAL_URL`, so OAuth redirects and account emails use the deployed
origin. Set `CORS_ORIGINS` only when additional browser origins need access. Register the deployed
callback URL for each OAuth provider:

```text
<API_URL>/api/v1/auth/google/callback
<API_URL>/api/v1/auth/github/callback
```

Use HTTPS in production and update the provider dashboard if the Render URL changes. Session and
OAuth state cookies are marked `Secure` in production. Never put OAuth client secrets in frontend
environment variables.

### Testing OAuth

Automated tests verify the platform's OAuth routes, callback handling, and frontend states without
using real Google or GitHub accounts. Run `npm run test:backend`, `npm run test:frontend`,
and `npm run test:e2e` to include their respective OAuth coverage.

## End-to-End Testing

Playwright builds the frontend and serves it with `vite preview`, so specs run against the same
bundled output that ships to production. Set `E2E_DEV_SERVER=1` to run against the Vite dev server
instead when iterating locally.

```bash
npm run test:e2e           # standard chromium run
npm run test:e2e:slow      # slow 4G, fast 3G, and slow 3G emulation with CPU throttling
npm run test:e2e:latency   # learn flow specs with per-endpoint API delays
npm run test:e2e:all       # every project
```

Throttled projects emulate Chrome DevTools network conditions plus a CPU slowdown, which surfaces
loading-state and race-condition bugs that only appear on slow connections. The latency project
keeps the transport fast and instead delays individual mocked endpoints, so results stay
deterministic.

## Available Scripts

### Root (run from project root)

```bash
npm run setup
npm run dev
npm run development:backend
npm run development:frontend
npm run lint
npm run format
npm run test
npm run test:backend
npm run test:frontend
npm run test:e2e
npm run test:e2e:slow
npm run test:e2e:latency
npm run test:e2e:all
npm run verify
npm run start:backend
npm run build:frontend
```

`npm run verify` is the pre-pull-request check: it formats, lints, runs the backend and frontend
unit suites, and then runs every Playwright project.

### Frontend (run from frontend)

```bash
npm run dev
npm run build
npm run preview
npm run lint
npm run lint:fix
npm run format
npm run format:check
npm run test
npm run test:watch
```

### Backend (run from backend)

```bash
npm run dev
npm run start
npm run test
npm run lint
npm run lint:fix
npm run format
npm run format:check
```
