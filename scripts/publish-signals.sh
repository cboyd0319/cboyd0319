#!/usr/bin/env bash
set -euo pipefail

: "${GITHUB_REPOSITORY:?}"
: "${GITHUB_SHA:?}"
: "${UPDATE_BRANCH:?}"
: "${GH_TOKEN:?PROFILE_UPDATE_TOKEN is required to trigger push CI before publication.}"

if [[ "$UPDATE_BRANCH" != automation/update-signals-panel ]]; then
  echo "Only automation/update-signals-panel may stage image updates." >&2
  exit 1
fi
if ! git diff --cached --quiet; then
  echo "The index must be clean before publishing an image." >&2
  exit 1
fi

if git diff --quiet -- assets/signals.png; then
  echo "No image changes."
  exit 0
fi

# Keep credentials in gh's environment, never in the remote URL or Git config.
remote_git() {
  git -c credential.helper= -c 'credential.helper=!gh auth git-credential' "$@"
}

base_sha="$(git rev-parse HEAD)"
if [[ "$base_sha" != "$GITHUB_SHA" ]]; then exit 1; fi
remote_git fetch origin main
if [[ "$(git rev-parse origin/main)" != "$base_sha" ]]; then
  echo "main changed during rendering; refusing a stale image."
  exit 1
fi
old_sha="$(remote_git ls-remote origin "refs/heads/$UPDATE_BRANCH" | cut -f1)"
git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
git checkout -B "$UPDATE_BRANCH"
git add -- assets/signals.png
git commit -m "Update signals panel"
commit_sha="$(git rev-parse HEAD)"
remote_git push --force-with-lease="refs/heads/$UPDATE_BRANCH:$old_sha" origin "HEAD:refs/heads/$UPDATE_BRANCH"

# Only push checks qualify for the protected main update; poll Actions REST for fine-grained PATs.
run_id=""
validated=false
for attempt in {1..180}; do
  run="$(gh api "repos/$GITHUB_REPOSITORY/actions/workflows/ci.yml/runs?head_sha=$commit_sha&branch=$UPDATE_BRANCH&event=push&per_page=100" \
    --jq "[.workflow_runs[] | select(.path == \".github/workflows/ci.yml\" and .head_sha == \"$commit_sha\" and .head_branch == \"$UPDATE_BRANCH\" and .event == \"push\")] | first | [.id // \"\", .status // \"\", .conclusion // \"\"] | @tsv")"
  IFS=$'\t' read -r run_id run_status conclusion <<< "$run"
  if [[ "$run_status" == completed ]]; then
    if [[ "$conclusion" == success ]]; then
      validated="$(gh api "repos/$GITHUB_REPOSITORY/actions/runs/$run_id/jobs?filter=latest&per_page=100" \
        --jq "any(.jobs[]; .head_sha == \"$commit_sha\" and .name == \"validate\" and .status == \"completed\" and .conclusion == \"success\")")"
    fi
    break
  fi
  sleep 5
done
if [[ "$validated" != true ]]; then
  echo "Push CI did not validate $commit_sha within the polling window."
  exit 1
fi
remote_git fetch origin main
if [[ "$(git rev-parse origin/main)" != "$base_sha" ]]; then
  echo "main changed during validation; refusing a stale image."
  exit 1
fi
remote_git push --force-with-lease="refs/heads/main:$base_sha" origin "HEAD:refs/heads/main"
if [[ "$(remote_git ls-remote origin refs/heads/main | cut -f1)" != "$commit_sha" ]]; then exit 1; fi
echo "Updated main with validated signals panel: $commit_sha (CI run $run_id)"
