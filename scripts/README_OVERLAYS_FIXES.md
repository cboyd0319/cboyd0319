# Overlay Generator Fixes

This update addresses the remaining active issues in `generate-overlays.mjs`:

- Replaced invalid `TOKYO_NEON_PALETTE.paleHaze` fallback with `TOKYO_NEON_PALETTE.haze`.
- Added dynamic weekly streak calculation from participation sparklines.
- Added screenshot validation before writing `assets/signals.png`.
- Added a main-module execution guard so importing the module does not immediately run generation.
- Made overlay panel backgrounds fully opaque to reduce ghosting from the base image sign art.
- Patched `optimize-signals.mjs` to exit gracefully when `assets/signals.png` does not exist yet.

Run from the repo root with:

```bash
npm run generate
```

For alignment tuning, keep using the environment variables already supported by the overlay script, such as `BOARD_LEFT`, `BOARD_TOP`, `BOARD_WIDTH`, `BOARD_HEIGHT`, `TOOLCHAIN_LEFT`, `TOOLCHAIN_TOP`, `TOOLCHAIN_WIDTH`, and `TOOLCHAIN_HEIGHT`.
