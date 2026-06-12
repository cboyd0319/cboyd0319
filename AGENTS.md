# Repository Guidelines

## Project Overview

This is the `cboyd0319` GitHub profile README repository. The profile README must contain exactly two centered images: top `assets/tokyo-neon-city.png` and bottom `assets/signals.png`. The top image is static and should not be regenerated. The bottom image is generated from `assets/subway_blank_original.png` plus overlays based on public GitHub repository data. Keep the repository public and keep root `README.md` non-empty.

ImageMagick 7.1.2-25 `magick` CLI owns all raster image work: SVG rasterization, opacity composition, perspective warp, resizing, metadata inspection, PNG optimization, debug crops, grayscale previews, and image comparison. JavaScript owns public GitHub data collection, deterministic fixtures, layout math, validation rules, and SVG/text template generation only. Sign overlays must stay transparent text/mark plates; the base photo owns the dark sign glass. Do not reintroduce custom JavaScript pixel homography/compositing or Sharp/resvg raster pipelines. Local default command path is `/opt/homebrew/opt/imagemagick-full/bin/magick`; CI installs the pinned source release with `scripts/install-imagemagick-ci.sh` because the official Linux AppImage omits the rsvg delegate needed for this renderer.

## Project Structure

- `README.md`: profile content, limited to the two image tags.
- `assets/`: source and generated profile images. `assets/generated/` is ignored debug output.
- `config/`: scene data, static data, and layout geometry. Main layout: `config/layouts/subway-default.json`.
- `docs/`: visual references. Primary overlay contract: `docs/train_station_overlay_mockup_spec.md`.
- `fonts/`: checked-in fonts used by the renderer.
- `scripts/`: generator, optimizer, validators, and tests. Shared helpers live in `scripts/lib/`.
- `.githooks/`: local pre-commit and pre-push hooks. Enable with `git config core.hooksPath .githooks`.
- `.github/workflows/`: scheduled profile update and lightweight validation workflows.

## Build and Test Commands

Use Node from `.node-version` and install with `npm ci`.
Use ImageMagick 7.1.2-25. Locally, `imagemagick-full` is expected at `/opt/homebrew/opt/imagemagick-full/`; set `MAGICK_BIN` only if `magick` lives elsewhere.

- `npm run generate`: render `assets/signals.png` from live public GitHub data.
- `STATIC=1 npm run generate`: deterministic render using `config/static-data.json`.
- `npm run optimize-signals`: compress `assets/signals.png`.
- `npm run smoke`: run a static generator smoke check.
- `npm run smoke -- --live`: smoke-check live GitHub API access.
- `npm run validate`: validate config, generated SVG semantics, layout, and PNG dimensions.
- `npm test`: run focused custom tests in `scripts/test-utils.mjs`.
- `npm run check`: syntax-check scripts listed in `scripts/check-syntax.mjs`.
- `npm run audit`: run `npm audit --audit-level=moderate`.
- `npm run render-magick-panels`: rasterize generated SVG panels with ImageMagick for inspection.

## Code Style Guidelines

Use ESM JavaScript (`"type": "module"`), two-space indentation, `const`/`let`, and explicit `node:` imports. Prefer small functions, repo-relative paths, deterministic static fixtures, and standard library APIs over ad hoc parsing. Name scripts by action, for example `generate-overlays.mjs`, `validate-signals.mjs`, and `optimize-signals.mjs`. Keep comments short and only where they clarify non-obvious rendering or validation logic. Call ImageMagick through `scripts/lib/imagemagick.mjs` argument arrays; do not build shell command strings for perspective control points or paths.

## Testing Instructions

Add focused assertions to `scripts/test-utils.mjs`; there is no external test framework. Use static data or fixed timestamps for deterministic tests. For script changes, run `npm run check` and `npm test`. For image, layout, or renderer changes, run `STATIC=1 npm run generate`, `npm run validate`, and `npm run optimize-signals`, then inspect `assets/signals.png` at GitHub profile scale. Before pushing, use local hooks or run the same checks manually.

Local hooks are the default guardrail: enable them with `git config core.hooksPath .githooks`. The pre-commit hook runs `npm run check`; the pre-push hook runs `npm test` and `npm run validate`.

## Security Considerations

Use public GitHub data only. Do not display private repository names, private organization data, secrets, raw logs, employer data, tokens, email addresses, or data that implies private access. Do not commit tokens. `GITHUB_TOKEN` can be used locally or in GitHub Actions for live generation; static mode is preferred for review and CI. Keep workflow permissions least-privilege and do not add heavyweight CI such as CodeQL unless the threat model changes.

## Dependency Pinning Contract

All external dependencies must use the latest stable release and be hard pinned. This applies to npm packages, `packageManager`, `.node-version`, `engines.node`, GitHub Actions, runner images, CLIs installed in workflows, Docker images, and script-downloaded tools. Do not use `latest`, semver ranges such as `^` or `~`, branch refs, or major-version action refs. Pin npm direct dependencies exactly in `package.json` and commit `package-lock.json`. Pin GitHub Actions by full commit SHA with a version comment, for example `actions/checkout@<sha> # v6.0.3`. Pin runners, for example `ubuntu-24.04`. Pin ImageMagick to source release `7.1.2-25` and SHA-256 in `scripts/install-imagemagick-ci.sh`; local and CI runs must fail fast on any other `magick` version.

## Assets, Data, and Large Files

Do not replace `assets/tokyo-neon-city.png` unless the profile art direction intentionally changes. Treat `assets/subway_blank_original.png` as the approved blank for generated signals. Keep `assets/signals.png` committed because GitHub serves the README image from the repository. Do not commit large datasets, raw API dumps, or debug renders from `assets/generated/`.

## Deployment and Automation

`.github/workflows/update-profile.yml` refreshes `assets/signals.png` once per day at `23:00 UTC` and supports manual `workflow_dispatch`. It renders, optimizes, validates through the lightweight CI path, and publishes only when the image changes. Keep automation scoped to this profile image workflow.

`.github/workflows/ci.yml` exists only to provide the `validate` check expected by the profile update publisher. It runs for `automation/update-signals-panel` and manual dispatch, not for every push or pull request. Do not restore broad CI without a concrete reason.

## Commit and Pull Request Guidelines

Use short imperative commit subjects, for example `Fix profile update schedule`. Keep changes scoped. PRs should describe intent, affected commands or assets, and verification. Include a screenshot when `assets/signals.png` changes. Prefer local pre-commit and pre-push checks for routine guardrails; keep GitHub Actions minimal and cost-conscious.
