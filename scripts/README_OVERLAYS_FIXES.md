# Overlay Generator Fixes

This update addresses the remaining active issues in `generate-overlays.mjs`:

- Replaced the browser screenshot path with generated SVG panels composited by `sharp`.
- Writes preview SVGs to `assets/generated/repository-sign.svg` and `assets/generated/toolchain-spectrum.svg`.
- Replaced invalid `TOKYO_NEON_PALETTE.paleHaze` fallback with `TOKYO_NEON_PALETTE.haze`.
- Added dynamic weekly streak calculation from participation sparklines.
- Added PNG validation before writing `assets/signals.png`.
- Added a main-module execution guard so importing the module does not immediately run generation.
- Patched `optimize-signals.mjs` to exit gracefully when `assets/signals.png` does not exist yet.

Run from the repo root with:

```bash
npm run generate
```

Smoke tests now use the committed static data by default so CI can verify generator wiring without depending on the live GitHub API. To force a live API smoke test, run:

```bash
npm run smoke -- --live
# or
LIVE_SMOKE=1 npm run smoke
```

For alignment tuning, keep using the environment variables already supported by the overlay script, such as `BOARD_LEFT`, `BOARD_TOP`, `BOARD_WIDTH`, `BOARD_HEIGHT`, `TOOLCHAIN_LEFT`, `TOOLCHAIN_TOP`, `TOOLCHAIN_WIDTH`, and `TOOLCHAIN_HEIGHT`.
