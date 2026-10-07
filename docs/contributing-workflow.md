# Team and Collaboration Workflow

## Team

### Practicum Lead

- Frank Stepanski - [@frankstepanski](https://github.com/frankstepanski)

### Mentors

- Mario Martinez - [@mntri4](https://github.com/mntri4)
- Hector Gonzalez - [@hectarek](https://github.com/hectarek)

### Developers

- Berenice Rojas - [@berenicerojas](https://github.com/berenicerojas)
- Danylo Hetmanenko - [@DanyloHet](https://github.com/DanyloHet)
- Kristen Wishart - [@kwishart24](https://github.com/kwishart24)
- Maryzabeth Philip - [@BytesofStrength](https://github.com/BytesOfStrength)
- Mikey Nichols - [@mnichols08](https://github.com/mnichols08)

## Collaboration Workflow

- GitHub Issues for task tracking
- Feature branches for development
- Pull requests required for all merges
- Code reviews before merging to `main`, `development`, or `docs`

### Shared-file synchronization

The [shared-file sync workflow](../.github/workflows/sync-shared-files.yml) opens or updates
pull requests in both directions between `development` and `docs` when shared files change.
Before labeling a sync pull request, it creates the `documentation` and `changelog` labels
if they are missing. Existing labels are left unchanged. Label creation uses `--force` so
simultaneous sync runs can safely create the same missing label.

The workflow's `GITHUB_TOKEN` needs `contents: write`, `pull-requests: write`, and
`issues: write` permissions; the last permission allows repository label creation.
Repository Actions settings must also allow GitHub Actions to create pull requests.

## Development Process

- Agile/sprint-based workflow
- Backend API built before frontend integration
- MVP defined early
- Incremental feature development
