---
name: profile-media-rendering
description: "Use for cboyd0319 profile README media work: assets/signals.png generation, README image contract, public GitHub data overlays, static vs live renders, visual QA, and preserving the Tokyo subway profile image system."
---

# Profile Media Rendering

Use this skill first for broad work on the `cboyd0319` profile media repo.

## Contract

- `README.md` stays limited to exactly two centered images.
- `assets/tokyo-neon-city.png` is static. Do not regenerate it unless user asks for an art-direction change.
- `assets/signals.png` is generated from `assets/subway_blank_original.png`, public GitHub data, checked-in fonts, config, and layout geometry.
- `assets/signals.png` remains committed because GitHub serves the profile image from this repo.
- Public GitHub data only. Do not expose private repo names, employer data, raw logs, tokens, emails, or anything implying private access.

## Read First

- `AGENTS.md`
- `README.md`
- `package.json`
- `config/scene.json`
- `config/static-data.json`
- `config/layouts/subway-default.json`
- `docs/train_station_overlay_mockup_spec.md`
- `docs/tokyo_subway_design_reference.md`
- `.github/workflows/update-profile.yml`
- `.github/workflows/ci.yml`

## Workflow

1. Identify whether work is docs-only, data logic, renderer/layout, image asset, or automation.
2. Prefer static mode for deterministic review: `STATIC=1 npm run generate`.
3. Use live mode only when checking public GitHub API behavior or preparing final live `assets/signals.png`.
4. Preserve current visual priority: station/train first, Repository Signals second, Code Lines third.
5. Reject outputs that look like dashboards, GitHub cards, terminal panes, bright HUDs, opaque sign cards, or overlays stronger than official station signage.

## Verification

- Docs-only or instruction changes: `git diff --check` and `npm run check`.
- Script/data changes: `npm run check` and `npm test`.
- Renderer/layout/image changes: `npm run check`, `npm test`, `STATIC=1 npm run generate`, `npm run validate`, `npm run optimize-signals`, then inspect `assets/signals.png`.
- If final committed image should be live, rerun `npm run generate`, `npm run optimize-signals`, and `npm run validate` after static checks.
- Do not dispatch GitHub Actions unless user explicitly asks.
