# Train-Station Overlay Mockup Spec

**Target image size:** `1672 × 941 px`  
**Coordinate system:** top-left origin, `x` increases right, `y` increases downward.  
**Goal:** make the **Repository Signals** and **Toolchain** overlays feel like dim, in-world Tokyo train-station display hardware, not dashboard UI accidentally dropped into a subway scene because the universe enjoys mockery.

This spec assumes the current 16:9 subway background composition and the same two screen locations. If the base image is resized, scale all absolute coordinates by:

```txt
scaleX = actualImageWidth  / 1672
scaleY = actualImageHeight / 941
```

---

## 1. Success Criteria

The overlays pass only if all of this is true:

1. They read first as **station signage / service display hardware**.
2. The train, platform lighting, official signage, and station atmosphere remain visually dominant.
3. The overlays do **not** look like GitHub cards, dashboard widgets, charts, infographics, terminal panels, or SaaS observability UI.
4. The text looks emitted through old dark glass, not pasted as crisp SVG on top.
5. The Toolchain panel is quieter than the Repository board.
6. The Repository board feels like an overhead operations board, not a repo analytics table.

Expected full-image visual priority:

```txt
1. train / station lighting / official signage
2. Repository Signals board
3. Toolchain panel
```

If the Toolchain panel attracts the eye before the yellow exit sign or train destination display, it is too strong.

---

## 2. Implementation Model

Use **two transparent overlay canvases**, then perspective-warp each canvas onto its physical screen.

Do **not** draw opaque cards, panels, rounded boxes, dashboard containers, or chart backgrounds. The physical black display surface already exists in the artwork. The overlay should be text and subtle surface treatment only.

ImageMagick 7.1.2-25 `magick` CLI is the required raster pipeline. JavaScript may fetch public data and emit SVG/text templates, but ImageMagick owns SVG rasterization, opacity/glass composition, blur/softness, perspective distortion, scene compositing, resizing, metadata inspection, PNG optimization, and debug crops. Do not use custom JavaScript homography/pixel sampling, Sharp, resvg, browser screenshots, or dashboard renderers for these raster steps.

### Recommended render pipeline

1. Render each SVG overlay to a transparent PNG canvas with `magick`.
2. Keep the main overlay canvas visually bound to glyphs, status dots, faint divider marks, and the intentionally subtle screen-surface layers defined in `scripts/lib/svg.mjs`.
3. Avoid opaque full-canvas cards, heavy haze, scanlines, or new black panels. The source photo owns the sign surface.
4. Perspective-warp the canvas into the screen quad with `magick +distort Perspective`.
5. Composite with normal/source-over blending through `magick -compose Over -composite`.
6. Add a final unified grain/noise pass with `magick` only if needed.

### Oversampling

Render overlays at **2×** their design canvas size, then downsample before final warp. Higher oversampling made the station text look mushy after the perspective pass.

```txt
Repository design canvas: 500 × 160 px
Repository render canvas: 1000 × 320 px

Toolchain design canvas: 131 × 420 px
Toolchain render canvas: 262 × 840 px
```

All coordinates below are given in **design-canvas pixels**, not 2× render pixels.

---

## 3. Physical Screen Geometry

`config/layouts/subway-default.json` is the authoritative geometry source. Its
`board.quad` and `toolchain.quad` values are inner-screen targets, not outer
frame targets. Update that file when tuning perspective; do not copy those
numbers into scripts or prose.

The Repository board uses a mild homography. The Toolchain panel uses a stronger
side-view homography, with the left edge treated as the edge receding away from
the viewer. Rectangle fallback is only for emergency debugging because it makes
the right panel read as a flat HUD.

---

## 4. Global Visual Tokens

These colors are intentionally muted. Bright cyan and pure white are banned from this design family, because the goal is train-station hardware, not a conference demo about microservices.

### Color tokens

```txt
--text-primary:      #D6A33A
--text-secondary:    #A56F22
--alert-red:         #D94132
--marunouchi-red:    #D91F2B
--rule-line:         #242018
--status-led-green:  #7FB95A
--glow-tint:         #C98524
```

Exact opacity and compositing values live in `scripts/lib/svg.mjs` and
`scripts/generate-overlays.mjs`.

### Absolute prohibitions

Do not use:

```txt
#FFFFFF
bright cyan
saturated magenta
large neon glow
pure chart colors
filled language badges
rounded dashboard cards
```

---

## 5. Global Typography Tokens

### Preferred font feel

Use a font that feels like public transit display hardware:

```txt
industrial sans
condensed LCD-ish signage
calm mono or semi-mono
softly rasterized
```

### Avoid

```txt
arcade pixel fonts
game HUD fonts
heavy terminal fonts
GitHub-looking monospace UI
anything too playful
```

### Suggested font stack

Use the first available option from this stack:

```css
font-family:
  "Noto Sans JP",
  "Source Han Sans JP",
  "Hiragino Sans",
  "Yu Gothic",
  "Helvetica Neue",
  Arial,
  sans-serif;
```

### Rendering behavior

```txt
font smoothing:     ImageMagick raster anti-aliasing, tiny text softening, and perspective resampling
letter spacing:     0 to +0.045em
weight:             500–600, depending on font
line contrast:      low-to-medium
```

The type should be readable, but it should not look freshly exported from Figma and stapled to glass by a committee.

---

## 6. Global Screen-Surface Treatment

Apply this to both overlay canvases before warping.

### Surface layer

The renderer now uses a very low-opacity unlit LED pattern, glass wash, and
screen falloff inside the sign clip. Keep these subtle and code-owned in
`scripts/lib/svg.mjs`. Do not cover the baked-in black screen with an opaque
rectangle or new black card. If the base sign needs more material texture,
repair the base image or add a masked reflection layer.

### Edge falloff

Add a subtle inner vignette:

```txt
top/bottom/side edge darkening opacity: 0.08–0.16
radius/feather:                       20–40 px on design canvas
```

### Softness

Use only a tiny readable-layer soften pass.

```txt
primary readable layer soften: 0.08 sigma
emissive glow blur:           0.75 sigma
```

Do not blur the primary text enough to make it muddy. The intent is to remove vector-perfect edges, not hide the text.

### Noise / grain

Do not add uniform sign-level noise. The base image already owns dark-glass texture and station grime. If more texture is needed, use a tiny text-layer ImageMagick noise pass only.

```txt
text-layer Gaussian noise attenuation: 0.012
sign-level noise rectangles:          off
```

### Through-glass absorption

Use only the tiny clipped glass wash in the SVG renderer. Keep it below the
threshold where the panel becomes muddy or reads as a black rectangle. Exact
values are code-owned.

### Environmental reflection

Use the source-image reflections by default. Add a separate warm reflection pass
only if it is masked to real reflected-light shapes and does not reduce text
opacity.

```txt
color:       warm fluorescent amber / off-white
shape:       thin tube-like streaks plus soft spill
placement:   near visible station fluorescent tubes and lit frame edges
blend:       screen/lighten style only for the reflection layer
purpose:     make the glass interact with station lighting
```

### Scanline texture

Default is off for full panels. If needed, apply texture only to text/mark alpha
so transparent areas stay transparent.

### Glow

Glow should be present but restrained.

```txt
Repository text glow: subtle, warmer than white
Toolchain text glow:  subtle, with diagonal chromatic split on the steep sign
accent glow:       0.000–0.020
```

Avoid additive neon. The displays should feel like old dark LCDs, not a cursed cyberpunk HUD overlay pack.

---

# 7. Repository Signals Panel

## 7.1 Design Canvas

```txt
canvas width:  500 px
canvas height: 160 px
```

The Repository board should feel like an **overhead station operations board**. It should be mostly text, with calm rows and minimal visual decoration.

---

## 7.2 Layout Grid

```txt
exact margins:      code-owned in scripts/lib/svg.mjs
screen geometry:    config/layouts/subway-default.json
```

### Column positions

```txt
time:       64 px, right-aligned
status dot: 88 px
status:     98 px
repo:       178 px
language:   405 px, right-aligned
stars:      455 px, right-aligned
```

### Row baselines

```txt
Japanese title:     27 px
English title:      43 px
row 1:              91 px
row 2:              127 px
```

### Divider lines

Use one station-style red rule and faint row discipline:

```txt
Marunouchi stripe y: 47 px
row rule y:         107 px
```

Both should be extremely faint. No visible table grid.

---

## 7.3 Repository Text Content

Representative static text block:

```txt
リポジトリ状況
M03 REPOSITORY SIGNALS

32m  ● ACTIVE      JobSentinel             TypeScript  ★ 28

2w   ● DEPS CHECK  PyGuard                 Python      ★ 19
```

Show the two most recently updated public owner repositories. This should read like a station/service board, not like repository analytics.

---

## 7.4 Repository Line-by-Line Element Spec

### Title row

| Element | Text | x | y baseline | Align | Size | Tracking | Color | Opacity |
|---|---:|---:|---:|---|---:|---:|---|---:|
| Japanese title | `リポジトリ状況` | 58 | 27 | left | 10.7 px | 0.08em | `--text-secondary` | code-owned |
| English title | `M03 REPOSITORY SIGNALS` | 58 | 43 | left | 12.8 px | 0.045em | `--text-primary` | code-owned |

### Header stripe

```txt
x1: 36
x2: 456
y: 47
stroke: --marunouchi-red
opacity: 0.20
width: 2 px
softness: 0.2–0.3 px
```

---

### Repository Rows

Render the two most recent public owner repositories as one row each:

```txt
time | status LED + status | repository | language | stars
```

Preferred statuses are `ACTIVE` for the freshest repo and `DEPS CHECK` when the
row needs review. Status can also come from repository metadata when provided.
Keep recency and status subordinate to the repository name. Keep the language
and star metadata in a strict right-side column.

---

### Footer

Default recommendation: **off**. Do not render `ACTIVE REPOS` or `TOTAL` metrics on the Repository board unless a later pass proves the board needs them.

---

## 7.5 Repository Status LEDs

Render only the small status LEDs beside status text. These are physical
indicator dots paired with the status word, not chart marks or row bullets.
Use muted green for healthy active rows and controlled red only for review or
dependency-check states. Exact geometry and opacity live in the renderer.

---

## 7.6 Repository Styling Rules

### Keep

```txt
simple rows
large calm title
M03 route label
minimal status text
one faint title divider
faint row discipline
warm off-white / amber palette
```

### Remove / avoid

```txt
charts
sparklines
bar graphs
language badges
filled chips
KPI metric header row
rounded cards
dashboard grids
bright cyan/magenta accents
```

---

# 8. Toolchain Panel

## 8.1 Design Canvas

```txt
canvas width:  131 px
canvas height: 420 px
```

The Toolchain panel should feel like a **narrow station maintenance / subsystem readout**. It should be much quieter than the Repository board.

---

## 8.2 Toolchain Layout

The right wall panel uses a compact code-mix readout:

```txt
コード構成
M03 CODE MIX

PYTHON       35%
TYPESCRIPT   25%
SHELL        25%
POWERSHELL   15%
```

Keep `M03 CODE MIX` exact. Keep the language-name column and percentage column
aligned, with generous side padding inside the black panel. Use full language
names when they fit; the renderer owns any necessary compacting.

Exact positions, sizing, opacity, row spacing, and perspective fit live in the
renderer and layout config. Do not duplicate those values here.

---

## 8.6 Toolchain Styling Rules

### Keep

```txt
minimal text
left alignment
large empty dark glass area
quiet status-readout feeling
low contrast
warm primary text
```

### Remove / avoid

```txt
donut chart
bar chart
route diagram
nodes and lines
separate legend
detached value columns
bright cyan title
SPECTRUM subtitle
footer unless absolutely necessary
```

---

# 9. Full Compositing Values

## Overlay opacity

The readable plate is transparent except for text, status dots, faint divider
marks, and subtle screen-surface layers. Opacity, glow, chromatic aberration,
and text-layer noise live in `scripts/generate-overlays.mjs` and
`scripts/lib/svg.mjs`; exact values are code-owned.

Toolchain should remain quieter than Repository even when closer to camera.

## Blend mode

Use normal/source-over for main content.

```txt
main text:             normal/source-over
text glow:             screen before warp
surface treatment:     clipped low-opacity SVG surface layers
uniform sign noise:    off
```

Do not use heavy `screen`, `plus`, or additive blending for primary text.

---

# 10. Perspective Warp Instructions

## Warp mapping

Map each canvas corner to the matching `quad` corner from
`config/layouts/subway-default.json`.

Use ImageMagick perspective distortion. The concept is:

```txt
0,0        targetTL
W,0        targetTR
W,H        targetBR
0,H        targetBL
```

Use a transparent virtual pixel and an explicit cropped output viewport:

```txt
-virtual-pixel transparent -background none
-define distort:viewport=${cropWidth}x${cropHeight}+${cropLeft}+${cropTop}
+distort Perspective '<source/target control points>'
```

Do the warp after rendering and softening the overlay canvas. Composite the cropped warped overlay over the resized background with explicit `-geometry +${cropLeft}+${cropTop}` and `-compose Over -composite`.

---

# 11. QA Checklist

## Full-image squint test

Blur your eyes or zoom out to thumbnail size. The overlays should not jump out first.

Expected focal order:

```txt
train and lighting > official signage > Repository board > Toolchain panel
```

## Grayscale test

Convert the final image to grayscale. The overlay brightness should be comparable to or dimmer than:

```txt
train destination display
yellow exit sign
small official platform signs
```

If the overlay becomes a bright white dashboard in grayscale, reduce primary text opacity.

## Crop test

Only after the full image works, inspect crops.

Crops should show:

```txt
legible text
warm fluorescent reflection
not-perfect black levels
no flat artificial noise
no dashboard-card boundary
no chart-like objects
```

## GitHub profile scale test

Resize the final image to about 1070 px wide, matching the common desktop
profile display width. The two repository names and the four Toolchain rows
should still be readable without opening the image in a new tab.

## Failure signs

The overlay is wrong if you see any of these:

```txt
looks like a GitHub profile graphic
looks like an observability widget
looks like a terminal dashboard
looks like a presentation slide
looks like an infographic
looks too clean compared to station signs
Toolchain becomes a focal object
Repository rows look like a spreadsheet
```

---

# 12. Recommended First Implementation Pass

Use these current defaults as guidance. Exact values live in code so the docs
do not drift from the renderer.

## Repository defaults

```txt
canvas:              500 × 160
primary text:         dim amber, repo names strongest
secondary text:       muted amber/brown
accent status:        muted green for ACTIVE, controlled red for DEPS CHECK
softness:             tiny readable-layer soften, stronger glow blur
surface treatment:    subtle unlit LEDs, glass wash, screen falloff
uniform noise:        off; text-layer noise attenuation code-owned
reflection:           handled by source image unless separately masked
layer opacity:        code-owned
text glow:            code-owned
status LEDs:          small paired dots only
footer:               off
```

## Toolchain defaults

```txt
canvas:              131 × 420
primary text:         dim amber, quieter than Repository board
secondary opacity:    code-owned per row
softness:             tiny readable-layer soften, stronger glow blur
surface treatment:    subtle unlit LEDs, glass wash, screen falloff
uniform noise:        off; text-layer noise attenuation code-owned
reflection:           handled by source image unless separately masked
layer opacity:        code-owned
text glow:            code-owned
chromatic split:      diagonal red `+2+1`, blue `-1-1`
ticks:                off
footer:               off
divider:              faint schedule rows
```

---

# 13. What Changed From the Previous Attempts

This spec intentionally removes the design patterns that kept making the overlays feel foreign:

```txt
Removed donut chart.
Removed bar chart.
Removed route diagram.
Removed dashboard table density.
Removed language badge boxes.
Removed bright UI cyan/magenta.
Removed high-contrast vector sharpness.
Removed widget/card thinking.
```

The new visual language is:

```txt
station operations board + quiet maintenance readout
```

That is the north star. The overlays should feel like they were installed by a tired transit technician, not exported by a product designer with twelve nested auto-layout frames.
