# open.quiz Orientation Instance

This instance uses the open.quiz introduction package and a green palette. Its
identity, logo, favicon, default module, and theme are configured independently from the platform
core.

## Run Locally

1. Run `npm run setup` to install dependencies and create local environment files, including this
   instance's ignored `.env` file.
2. Set a private `JWT_SECRET` and any OAuth/email credentials in the root `.env`. The instance-local
   file selects the separate `openquiz_instance` MongoDB database by default; replace its `MONGO_URI`
   for a hosted database.
3. Start the instance with `npm run dev:openquiz`; the site uses `http://localhost:5180` and the API
   uses `http://localhost:8081`.
4. Sign in to initialize administrator access. The first successful password, Google, or GitHub
   sign-in becomes administrator on a fresh installation. For password accounts, register and
   verify the email using the development link before signing in.
5. The orientation content is installed automatically at server startup, along with inactive
   Learning Garden and Sprout themes. Add your own modules or choose a theme from the admin
   dashboard. `npm run instance:seed:openquiz` remains available to explicitly reimport and
   overwrite the orientation module when needed.
6. Open the site and choose **Explore lessons** to preview the first lesson without an account.

## Brand Assets

The preset keeps its existing environment-configured branding as the fallback. Administrators can
import, preview, and explicitly activate `.openquiz.json` experience packages from the admin
Appearance section; restoring defaults returns to this instance's environment configuration.
See [`docs/themes.md`](../../docs/themes.md) for the package schema and asset limits. The package
also supplies Nova and Kit as lesson character avatars.
