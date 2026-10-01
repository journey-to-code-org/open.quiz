# Sprout Instance

This instance combines the optional finance-literacy content package with Sprout's app name and
theme. Its settings are supplied through `settings.env`; they do not change the neutral platform
defaults.

## Run Locally

1. Run `npm run setup` to install dependencies and create local environment files, including this
   instance's ignored `.env` file.
2. Set a private `JWT_SECRET` and any OAuth/email credentials in the root `.env`. The instance-local
   file selects the separate `openquiz_sprout` MongoDB database by default; replace its `MONGO_URI`
   for a hosted database.
3. Start the instance with `npm run dev:sprout`.
4. In another terminal, run `npm run instance:seed:sprout` to import the optional finance curriculum
   into the isolated database. The configured default module ID is `cashFlow`.
5. Register an account and promote the first administrator through a trusted database bootstrap
   process. The platform does not yet include first-admin onboarding.

The finance package supplies its specialized lesson blocks and character artwork only when
`VITE_CONTENT_PACKAGE=finance-literacy` is selected. Other deployments can choose different content
packages and theme values without editing core source.
