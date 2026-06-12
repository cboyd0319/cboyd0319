---
name: signals-imagemagick-compositing
description: "Use for ImageMagick-owned rendering of assets/signals.png: SVG rasterization, transparent overlay plates, perspective quads, alpha checks, sign compositing, debug crops, optimization, and ImageMagick CI install behavior."
---

# Signals ImageMagick Compositing

Use this skill for precise image-renderer, perspective, and compositing work in this repo.

## Non-Negotiables

- ImageMagick 7.1.2-25 `magick` owns raster work.
- Local default: `/opt/homebrew/opt/imagemagick-full/bin/magick`.
- CI installs pinned source via `scripts/install-imagemagick-ci.sh`; do not swap to Linux AppImage because it lacks the needed rsvg delegate behavior.
- JavaScript may fetch data, calculate layout, validate contracts, and emit SVG/text templates.
- Do not add custom JavaScript pixel homography/compositing, Sharp, resvg, browser screenshots, or dashboard renderers.

## Renderer Shape

- Main generator: `scripts/generate-overlays.mjs`.
- ImageMagick helper: `scripts/lib/imagemagick.mjs`.
- SVG/text templates: `scripts/lib/svg.mjs`.
- Layout quads: `config/layouts/subway-default.json`.
- Visual contract: `docs/train_station_overlay_mockup_spec.md`.

## Compositing Rules

- Overlay canvases must be transparent except for text, status dots, faint divider marks, and local text glow.
- Do not paint full-panel black, haze, glass, scanline, or noise rectangles over sign faces.
- Base photo owns sign glass, grime, frame, shadows, and ambient station reflections.
- Warp overlays with ImageMagick perspective distortion using configured quads.
- Composite warped overlays with source-over onto the resized background.
- Keep text warm, dim, slightly softened, and subordinate to train and official station signage.

## Debug Checks

Use focused ImageMagick checks before judging the full image:

```bash
/opt/homebrew/opt/imagemagick-full/bin/magick assets/generated/toolchain-overlay.png -alpha extract -threshold 0 -format 'tool nonzero alpha ratio=%[fx:mean]\n' info:
/opt/homebrew/opt/imagemagick-full/bin/magick assets/generated/repository-overlay.png -alpha extract -threshold 0 -format 'repo nonzero alpha ratio=%[fx:mean]\n' info:
/opt/homebrew/opt/imagemagick-full/bin/magick assets/signals.png -crop 690x285+360+0 /tmp/cboyd-top-sign.png
/opt/homebrew/opt/imagemagick-full/bin/magick assets/signals.png -crop 340x690+1305+90 /tmp/cboyd-right-sign.png
/opt/homebrew/opt/imagemagick-full/bin/magick assets/signals.png -resize 1000x /tmp/cboyd-signals-preview.png
```

High nonzero alpha across most of an overlay canvas means the matte-box bug is back.

## Verification

Run:

```bash
npm run check
npm test
STATIC=1 npm run generate
npm run validate
npm run optimize-signals
```

For a live final asset, follow with:

```bash
npm run generate
npm run optimize-signals
npm run validate
```
