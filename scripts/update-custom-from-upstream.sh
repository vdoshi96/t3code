#!/usr/bin/env bash
set -Eeuo pipefail

CUSTOM_BRANCH="${CUSTOM_BRANCH:-custom-main}"
MAIN_BRANCH="${MAIN_BRANCH:-main}"
ORIGIN_REMOTE="${ORIGIN_REMOTE:-origin}"
UPSTREAM_REMOTE="${UPSTREAM_REMOTE:-upstream}"
UPSTREAM_BRANCH="${UPSTREAM_BRANCH:-main}"
PUSH_AFTER_UPDATE=0

usage() {
  cat <<'USAGE'
Usage: scripts/update-custom-from-upstream.sh [--push]

Fetch upstream/main, merge it into the fork admin branch and custom-main, then
run the standard local verification commands. The script never force-pushes.
Passing --push performs normal pushes of main and custom-main after checks pass.

Environment overrides:
  MAIN_BRANCH      fork admin branch to sync first (default: main)
  ORIGIN_REMOTE    fork remote name (default: origin)
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

upstream_ref="$UPSTREAM_REMOTE/$UPSTREAM_BRANCH"

run_merge() {
  local target_branch="$1"
  local source_ref="$2"

  git switch "$target_branch"
  if git merge-base --is-ancestor "$source_ref" "$target_branch"; then
    echo "$target_branch already contains $source_ref."
    return
  fi

  if ! git merge --no-edit "$source_ref"; then
    echo "Merge failed while updating $target_branch from $source_ref." >&2
    echo "Resolve the conflicts shown by 'git status', review the favorite-model behavior if touched, then rerun this script." >&2
    git status --short >&2 || true
    exit 1
  fi
}

load_gh_token_from_dotenv() {
  if [[ -n "${GH_TOKEN:-}" || ! -f "$repo_root/.env" ]]; then
    return
  fi

  local line value
  line="$(grep -E '^GH_TOKEN=' "$repo_root/.env" | tail -n 1 || true)"
  if [[ -z "$line" ]]; then
    return
  fi

  value="${line#GH_TOKEN=}"
  value="${value%$'\r'}"
  if [[ "$value" == \"*\" && "$value" == *\" ]]; then
    value="${value:1:${#value}-2}"
  elif [[ "$value" == \'*\' && "$value" == *\' ]]; then
    value="${value:1:${#value}-2}"
  fi

  export GH_TOKEN="$value"
}

has_favorite_reordering_markers() {
  local ref="$1"
  git grep -E -q \
    "moveProviderModelFavorite|modelKeyOrder|Move .+ up in favorites|Move .+ down in favorites" \
    "$ref" -- \
    apps/web/src/modelOrdering.ts \
    apps/web/src/components/chat/ModelListRow.tsx \
    apps/web/src/components/chat/ModelPickerContent.tsx \
    apps/web/src/components/settings/SettingsPanels.logic.ts \
    2>/dev/null
}

git fetch --prune "$ORIGIN_REMOTE"
git fetch --prune "$UPSTREAM_REMOTE" "$UPSTREAM_BRANCH"

if has_favorite_reordering_markers "$upstream_ref" && has_favorite_reordering_markers "$CUSTOM_BRANCH"; then
  cat >&2 <<EOF
Upstream $upstream_ref appears to include native favorite-model reordering while
$CUSTOM_BRANCH still contains the custom favorite-reordering implementation.

Aborting before merge so the feature is not duplicated. Human review needed:
1. Compare upstream's native favorite-reordering behavior with the custom fork behavior.
2. If upstream is equivalent, remove the custom-only reordering patch from $CUSTOM_BRANCH.
3. Update docs/custom-fork.md to say favorite reordering is upstream-native.
4. Rerun this script.

No branch was pushed.
EOF
  exit 3
fi

run_merge "$MAIN_BRANCH" "$upstream_ref"
git switch "$CUSTOM_BRANCH"
run_merge "$CUSTOM_BRANCH" "$upstream_ref"

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
  load_gh_token_from_dotenv

  if [[ -z "${GH_TOKEN:-}" ]]; then
    echo "GH_TOKEN is required for --push. Set it in the environment or repo .env. Refusing to use GITHUB_TOKEN or interactive auth." >&2
    exit 1
  fi

  askpass="$(mktemp)"
  chmod 700 "$askpass"
  cat >"$askpass" <<'ASKPASS'
#!/usr/bin/env bash
case "$1" in
  *Username*) printf '%s\n' "x-access-token" ;;
  *Password*) printf '%s\n' "$GH_TOKEN" ;;
  *) printf '\n' ;;
esac
ASKPASS
  trap 'rm -f "$askpass"' EXIT

  GIT_ASKPASS="$askpass" GIT_TERMINAL_PROMPT=0 git push "$ORIGIN_REMOTE" "$MAIN_BRANCH"
  GIT_ASKPASS="$askpass" GIT_TERMINAL_PROMPT=0 git push "$ORIGIN_REMOTE" "$CUSTOM_BRANCH"
else
  echo "Update complete. Review changes, then push $MAIN_BRANCH and $CUSTOM_BRANCH when ready."
fi
