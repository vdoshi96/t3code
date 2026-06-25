# T3 Code Custom Fork

This fork is intended to live beside the official T3 Code app as a separate
clickable desktop app.

## Custom Desktop Identity

- App name: `T3 Code Custom`
- Development app name: `T3 Code Custom (Dev)`
- macOS bundle ID: `com.vdoshi.t3code.custom`
- Development bundle ID prefix: `com.vdoshi.t3code.custom.dev`
- App URL scheme: `t3code-custom`
- Development URL scheme: `t3code-custom-dev`
- Electron userData folder: `~/Library/Application Support/t3code-custom`
- App/server state folder: `~/.t3code-custom/userdata`
- Development state folder: `~/.t3code-custom/dev`

`T3CODE_HOME` still overrides the app/server state root. Use a custom path if
you set it manually; pointing it at `~/.t3` will intentionally share state with
the official app.

## Launch The Custom Dev App

From the repo root:

```sh
vp i
vp run dev:desktop
```

The dev launcher creates/registers a clickable macOS app named
`T3 Code Custom (Dev)` and uses the `t3code-custom-dev` renderer scheme. Its
default state is under `~/.t3code-custom/dev`.

## Build The Clickable Mac App

Build desktop code first, then package the macOS app/DMG:

```sh
vp run build:desktop
vp run dist:desktop:dmg
```

The packaged app is named `T3 Code Custom.app`; the DMG/artifact names use the
`T3-Code-Custom-...` prefix.

The packaged app registers the production URL scheme `t3code-custom`. The dev
scheme `t3code-custom-dev` is reserved for the dev launcher so the production
app does not claim development callbacks.

For Apple Silicon only:

```sh
vp run dist:desktop:dmg:arm64
```

## Install Beside Original T3 Code

Open the generated DMG from `release/`, then drag `T3 Code Custom.app` into
`/Applications`.

The official app and the custom app can coexist because they use different app
names, bundle IDs, URL schemes, Electron userData directories, app state
directories, browser preview partitions, and artifact names.

## Auth, Signing, And Passkeys

For Clerk desktop OAuth allowlists, use:

- Development: `t3code-custom-dev://app/`
- Production: `t3code-custom://app/`

For macOS signing, provisioning profiles, and passkey/AASA setup, use the custom
bundle ID `com.vdoshi.t3code.custom`. The AASA `webcredentials.apps` entry must
match `<TEAM_ID>.com.vdoshi.t3code.custom`.

## Updating From Upstream

Branch roles:

- `main` is the fork administration branch. It carries fork-only admin files
  such as the upstream-sync workflow and should stay merged with
  `pingdotgg/t3code:main`.
- `custom-main` is the long-lived branch for customizations.
- Feature work should happen in an isolated worktree/branch and merge back into
  `custom-main`.

From a clean checkout:

```sh
scripts/update-custom-from-upstream.sh
```

The script:

1. Fetches `origin` and `upstream/main`.
2. Merges `upstream/main` into local `main` without rewriting history.
3. Merges `upstream/main` into local `custom-main` without rewriting history.
4. Aborts before merging if upstream appears to include native favorite-model
   reordering while `custom-main` still has the custom implementation.
5. Runs:

```sh
vp i
vp check
vp run typecheck
vp test
vp run build:desktop
vp run test:desktop-smoke
```

Use `scripts/update-custom-from-upstream.sh --push` to push after checks pass.
That path requires `GH_TOKEN` from the environment or repo `.env`; it refuses
to use `GITHUB_TOKEN`, interactive auth, or force-push.

If the script reports upstream-native favorite reordering, stop and compare
upstream behavior with the custom fork. If upstream is equivalent, retire the
custom-only favorite-reordering patch and update this document to say the
feature is now upstream-native before rerunning the script.

If a merge conflict occurs, the script stops with `git status` output. Resolve
the conflict manually, review any favorite-model files carefully, then rerun the
checks.

## Current Custom Behavior

The custom branch currently keeps the favorite model reordering behavior from
the custom fork: favorites can be moved up/down, the favorites view follows the
persisted order, hidden/custom models continue to use the existing filtering
rules, and the ordering persists through the normal settings store.
