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
4. Register the first account; the first registered account is automatically made an administrator.
   Verify its email using the development link printed by the backend.
5. Import a lesson module JSON and upload avatar images from the admin dashboard. To install the
   included orientation content instead, run `npm run instance:seed:openquiz` in another terminal.
6. Open the site and choose **Explore lessons** to preview the first lesson without an account.

## Brand Assets

The preset keeps its existing environment-configured branding as the fallback. Administrators can
import, preview, and explicitly activate `.openquiz.json` experience packages from the admin
Appearance section; restoring defaults returns to this instance's environment configuration.
See [`docs/themes.md`](../../docs/themes.md) for the package schema and asset limits. The package
also supplies Nova and Kit as lesson character avatars.
