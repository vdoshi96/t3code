# Custom Fork Workflow

This fork keeps upstream code and local customization separate:

- `main` is the fork administration branch. It contains the upstream-sync
  workflow and should otherwise stay close to `pingdotgg/t3code:main`.
- `custom-main` is the long-lived branch for local customizations.
- Feature work should happen in an isolated worktree/branch, then merge back
  into `custom-main`.

## Sync Fork Main

The sync workflow is committed on the fork's `main` branch at
`.github/workflows/sync-upstream.yml`. It runs on a schedule and through
`workflow_dispatch`, fetches `pingdotgg/t3code:main`, merges it into the fork's
`main`, and pushes the result with `contents: write` permission only.

GitHub Actions scheduled workflows on forks may need to be enabled manually from
the fork's Actions tab before the schedule runs.

## Update Custom Branch

From a clean checkout:

```sh
scripts/update-custom-from-upstream.sh
```

The script fetches `upstream/main`, switches to `custom-main`, merges upstream
without rewriting history, and runs:

```sh
vp i
vp check
vp run typecheck
vp test
vp run build:desktop
vp run test:desktop-smoke
```

Use `scripts/update-custom-from-upstream.sh --push` to perform a normal push
after checks pass. The script never force-pushes.
