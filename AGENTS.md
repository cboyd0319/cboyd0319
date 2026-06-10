# Repository Guidelines

## Project Structure & Module Organization

This is the `cboyd0319` GitHub profile README repository. Keep it public, keep root `README.md` non-empty, and keep the README limited to two images: top `assets/tokyo-neon-city.png` (static, do not regenerate) and bottom `assets/signals.png` (generated). The generator starts from `assets/subway_blank_original.png`, overlays live public GitHub repo signals, and writes `assets/signals.png`. Source scripts live in `scripts/`; shared helpers are in `scripts/lib/`. Scene data and overlay geometry live in `config/`, especially `config/layouts/subway-default.json`. The visual contract for train-station overlays is `docs/train_station_overlay_mockup_spec.md`. Fonts live in `fonts/`; visual notes live in `docs/`. `assets/generated/` is ignored debug output.

## Build, Test, and Development Commands

Use Node from `.node-version` and install with `npm ci`.

- `npm run generate`: generate `assets/signals.png` from public GitHub repo data.
- `STATIC=1 npm run generate`: deterministic render from `config/static-data.json`.
- `npm run optimize-signals`: compress `assets/signals.png`.
- `npm run smoke`: static smoke check; use `npm run smoke -- --live` for live API smoke.
- `npm run validate`: validate config, generated SVG semantics, layout, and PNG dimensions.
- `npm test`: run focused custom tests in `scripts/test-utils.mjs`.
- `npm run check`: syntax-check every script listed in `scripts/check-syntax.mjs`.

## Coding Style & Naming Conventions

Use ESM JavaScript (`"type": "module"`), two-space indentation, `const`/`let`, and explicit `node:` imports. Prefer small functions and repo-relative paths. Name scripts by action, such as `generate-overlays.mjs`, `validate-signals.mjs`, and `optimize-signals.mjs`.

## Testing Guidelines

There is no external test framework. Add focused assertions to `scripts/test-utils.mjs`, using static data or fixed timestamps for deterministic tests. For visual changes, run `STATIC=1 npm run generate`, `npm run validate`, `npm run optimize-signals`, and inspect `assets/signals.png` at profile scale.

## Commit & Pull Request Guidelines

Use short imperative commit subjects, for example `Fix CI smoke and workflow pins`. Keep changes scoped. PRs should describe intent, affected commands or assets, and verification. Include a screenshot when `assets/signals.png` changes. Avoid heavyweight CI; this repo only needs enough checks to protect the profile images.

## Security & Configuration Tips

Do not commit tokens. `GITHUB_TOKEN` can be used locally or by GitHub Actions for live generation, but static mode is preferred for review and CI.

## Dependency Pinning Contract

All external dependencies must use the latest stable release and be hard pinned. This applies to npm packages, `packageManager`, `.node-version`, `engines.node`, GitHub Actions, runner images, CLIs installed in workflows, Docker images, and any script-downloaded tool. Do not use `latest`, semver ranges such as `^` or `~`, branch refs, or major-version action refs. Pin npm direct dependencies exactly in `package.json` and commit `package-lock.json`; transitive npm resolutions are pinned by the lockfile `version`, `resolved`, and `integrity` fields, so do not hand-edit upstream package metadata ranges inside lockfile entries. Pin GitHub Actions by full commit SHA with a version comment, for example `actions/checkout@<sha> # v6.0.3`. Pin workflow runners, for example `ubuntu-24.04`.
