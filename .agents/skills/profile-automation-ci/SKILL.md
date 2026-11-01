---
name: profile-automation-ci
description: "Use for cboyd0319 profile automation, GitHub Actions, scheduled signal refreshes, local-first validation, pinned dependencies, Dependabot, CODEOWNERS, branch protection, and avoiding unnecessary CI spend."
---

# Profile Automation CI

Use this skill for workflow, CI, dependency pinning, and publication changes in this repo.

## Automation Contract

- Keep GitHub Actions minimal and profile-image scoped.
- Prefer local validation. Do not manually dispatch workflows unless user explicitly asks.
- `.github/workflows/update-profile.yml` owns scheduled and manual profile image refresh.
- `.github/workflows/ci.yml` provides required `validate` checks for PRs to `main` and automation-branch pushes; manual dispatch is diagnostic only.
- Keep the PR trigger free of path filters so required checks are always reported.
- Do not restore broad push/PR CI without concrete reason.

## Current Flow

1. `update-profile.yml` runs daily at `23:00 UTC` or by explicit `workflow_dispatch`.
2. Main runs check the publishing credential prerequisite in [AGENTS.md](../../../AGENTS.md#deployment-and-automation), then render installs pinned Node/npm and ImageMagick.
3. Render job runs `npm run generate`, `npm run optimize-signals`, and uploads `assets/signals.png`.
4. Publish job writes changed image to `automation/update-signals-panel`.
5. Publish job polls Actions REST for the exact successful `ci.yml` push run and `validate` job; absent or manual checks cannot publish.
6. Publish job pushes validated `assets/signals.png` to `main`.

## Pinning Rules

- Pin npm direct dependencies exactly and commit `package-lock.json`.
- Pin `packageManager`, `.node-version`, `engines.node`, runner images, GitHub Actions SHAs, and script-downloaded tools.
- Use full GitHub Action commit SHAs with version comments.
- Keep ImageMagick pinned to `7.1.2-34` with SHA-256 in `scripts/install-imagemagick-ci.sh`.
- Do not use `latest`, semver ranges, branch refs, or major-version action refs.

## Repo Files

- `.github/workflows/update-profile.yml`: scheduled render/publish.
- `.github/workflows/ci.yml`: lightweight validate check.
- `.github/dependabot.yml`: weekly npm and GitHub Actions updates.
- `.github/CODEOWNERS`: workflow/dependency ownership.
- `.githooks/pre-commit`: `npm run check`.
- `.githooks/pre-push`: `npm test` and `npm run validate`.

## Verification

- Workflow YAML/dependency docs only: `git diff --check` and `npm run check`.
- Script or workflow behavior changes: `npm run check`, `npm test`, and `npm run validate`.
- For GitHub CLI inspection, use read-only commands first: `gh run list`, `gh workflow view`, `gh api`.
- Avoid `gh workflow run` unless user explicitly requests CI/manual workflow refresh.
