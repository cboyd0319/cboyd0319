#!/usr/bin/env bash
set -euo pipefail

: "${GITHUB_REPOSITORY:?}"
: "${GITHUB_SHA:?}"
: "${UPDATE_BRANCH:?}"

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

# Select only this workflow's run for the exact image commit and branch.
run_id=""
for attempt in {1..180}; do
  run_id="$(gh api "repos/$GITHUB_REPOSITORY/actions/workflows/ci.yml/runs?head_sha=$commit_sha&branch=$UPDATE_BRANCH&per_page=100" \
    --jq "[.workflow_runs[] | select(.head_sha == \"$commit_sha\" and .head_branch == \"$UPDATE_BRANCH\" and (.event == \"push\" or .event == \"workflow_dispatch\"))] | first | .id // empty")"
  if [[ -n "$run_id" ]]; then break; fi
  if [[ "$attempt" -eq 6 ]]; then
    gh workflow run ci.yml --ref "$UPDATE_BRANCH"
  fi
  sleep 5
done
if [[ -z "$run_id" ]]; then
  echo "Timed out waiting for CI on $commit_sha"
  exit 1
fi

gh run watch "$run_id" --exit-status
validated="$(gh run view "$run_id" --json headSha,headBranch,status,conclusion,jobs \
  --jq ".headSha == \"$commit_sha\" and .headBranch == \"$UPDATE_BRANCH\" and .status == \"completed\" and .conclusion == \"success\" and any(.jobs[]; .name == \"validate\" and .conclusion == \"success\")")"
if [[ "$validated" != true ]]; then
  echo "CI did not validate $commit_sha"
  exit 1
fi
remote_git fetch origin main
if [[ "$(git rev-parse origin/main)" != "$base_sha" ]]; then
  echo "main changed during validation; refusing a stale image."
  exit 1
fi
remote_git push origin "HEAD:refs/heads/main"
if [[ "$(remote_git ls-remote origin refs/heads/main | cut -f1)" != "$commit_sha" ]]; then exit 1; fi
echo "Updated main with validated signals panel: $commit_sha (CI run $run_id)"
