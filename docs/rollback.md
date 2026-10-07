# Rollback Procedure

How to roll back a bad deploy on `main` (production). The frontend and backend are built and
deployed together as one Render service.

## 1. Identify the last good commit

```bash
git log --oneline main -10
```

Find the last commit/tag known to work in production (release tags look like `v0.8.x`).

## 2. Roll back the Render service

1. Open the backend service in the Render dashboard.
2. Go to the **Events**/**Deploys** tab and find the last successful deploy for the
   good commit.
3. Click **Rollback to this deploy** (or **Redeploy**) on that entry.

If the dashboard option isn't available, redeploy from git instead. `main` and `dev` are
protected branches, so the fix has to land through a PR rather than a direct push:

```bash
git checkout -b rollback/revert-<bad-commit-sha> main
git revert <bad-commit-sha>
git push -u origin rollback/revert-<bad-commit-sha>
```

Open a PR from `rollback/revert-<bad-commit-sha>` into `dev` and/or `main` and merge once it
passes checks. Render auto-deploys `main` on merge, so the merged revert triggers a fresh,
working deploy.

## 3. Verify

- Load the production URL and confirm the console has no errors.
- Hit `GET /health` on the backend to confirm it responds `200`.
- Spot-check the affected feature from the incident.

## Notes

- Prefer the dashboard rollback (steps 2–3) over a git revert when possible — it's faster
  and doesn't require a new deploy to build.
- The frontend and backend deploy together, so a single Render rollback restores both.
