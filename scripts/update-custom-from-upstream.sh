#!/usr/bin/env bash
set -Eeuo pipefail

CUSTOM_BRANCH="${CUSTOM_BRANCH:-custom-main}"
UPSTREAM_REMOTE="${UPSTREAM_REMOTE:-upstream}"
UPSTREAM_BRANCH="${UPSTREAM_BRANCH:-main}"
PUSH_AFTER_UPDATE=0

usage() {
  cat <<'USAGE'
Usage: scripts/update-custom-from-upstream.sh [--push]

Fetch upstream/main, merge it into custom-main, then run the standard local
verification commands. The script never force-pushes. Passing --push performs a
normal push of custom-main after checks pass.

Environment overrides:
  CUSTOM_BRANCH    branch to update (default: custom-main)
  UPSTREAM_REMOTE  upstream remote name (default: upstream)
  UPSTREAM_BRANCH  upstream branch name (default: main)
USAGE
}

while (($#)); do
  case "$1" in
    --push)
      PUSH_AFTER_UPDATE=1
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
  shift
done

repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root"

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Working tree is dirty. Commit or stash changes before updating $CUSTOM_BRANCH." >&2
  exit 1
fi

git fetch --prune "$UPSTREAM_REMOTE" "$UPSTREAM_BRANCH"
git switch "$CUSTOM_BRANCH"
git merge --no-edit "$UPSTREAM_REMOTE/$UPSTREAM_BRANCH"

resolve_vp() {
  if command -v vp >/dev/null 2>&1; then
    command -v vp
    return
  fi
  if [[ -x "$repo_root/node_modules/.bin/vp" ]]; then
    printf '%s\n' "$repo_root/node_modules/.bin/vp"
    return
  fi
  if command -v corepack >/dev/null 2>&1; then
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0 corepack pnpm install --frozen-lockfile >&2
    if [[ -x "$repo_root/node_modules/.bin/vp" ]]; then
      printf '%s\n' "$repo_root/node_modules/.bin/vp"
      return
    fi
  fi
  echo "Could not find vp. Install dependencies with Corepack/pnpm, then rerun." >&2
  exit 1
}

VP="$(resolve_vp)"

"$VP" i
"$VP" check
"$VP" run typecheck
"$VP" test
"$VP" run build:desktop
"$VP" run test:desktop-smoke

if ((PUSH_AFTER_UPDATE)); then
  git push origin "$CUSTOM_BRANCH"
else
  echo "Update complete. Review changes, then push $CUSTOM_BRANCH when ready."
fi
