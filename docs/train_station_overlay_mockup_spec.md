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

### Recommended render pipeline

1. Render each overlay to its own transparent canvas.
2. Add very faint screen-surface effects to that canvas.
3. Apply slight raster softness.
4. Perspective-warp the canvas into the screen quad.
5. Composite with normal/source-over blending.
6. Add a final unified grain/noise pass over the entire image only if needed.

### Oversampling

Render overlays at **4×** their design canvas size, then downsample before final warp.

```txt
Repository design canvas: 500 × 160 px
Repository render canvas: 2000 × 640 px

Toolchain design canvas: 144 × 420 px
Toolchain render canvas: 576 × 1680 px
```

All coordinates below are given in **design-canvas pixels**, not 4× render pixels.

---

## 3. Physical Screen Geometry

Use these quads for final placement. These are inner-screen targets, not outer frame targets.

### Repository board target quad

```txt
Repository screen inner quad, full-image pixels:
TL: (393, 56)
TR: (893, 60)
BR: (891, 214)
BL: (393, 212)
```

### Repository fallback rectangle

Use only if perspective warping is unavailable:

```txt
x: 393
y: 56
width: 500
height: 158
```

The fallback is acceptable because this board is close to rectangular. Still, perspective warp is preferred.

---

### Toolchain panel target quad

```txt
Toolchain screen inner quad, full-image pixels:
TL: (1324, 217)
TR: (1451, 191)
BR: (1447, 606)
BL: (1320, 582)
```

### Toolchain fallback rectangle

Use only if perspective warping is unavailable:

```txt
x: 1320
y: 191
width: 131
height: 415
```

The fallback will look less convincing on the right panel because the panel is visibly skewed. Use the quad if at all possible.

---

## 4. Global Visual Tokens

These colors are intentionally muted. Bright cyan and pure white are banned from this design family, because the goal is train-station hardware, not a conference demo about microservices.

### Color tokens

```txt
--text-primary:      #D8CFB8   opacity 0.70–0.82
--text-secondary:    #B8AD92   opacity 0.55–0.70
--accent-amber:      #D69A3A   opacity 0.70–0.85
--accent-cyan:       #6F817A   opacity 0.20–0.35, avoid on Repository board
--accent-magenta:    #6F5E68   opacity 0.12–0.24, default off
--marunouchi-red:    #78312E   opacity 0.18–0.28
--rule-line:         #2B3432   opacity 0.15–0.25
--glass-haze:        #172327   opacity 0.025–0.050
--edge-darken:       #000000   opacity 0.08–0.16
```

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
  "IBM Plex Sans Condensed",
  "IBM Plex Sans",
  "DIN Condensed",
  "Arial Narrow",
  sans-serif;
```

### Rendering behavior

```txt
font smoothing:     slightly softened after rasterization
letter spacing:     +0.04em to +0.09em
weight:             500–650, depending on font
line contrast:      low-to-medium
```

The type should be readable, but it should not look freshly exported from Figma and stapled to glass by a committee.

---

## 6. Global Screen-Surface Treatment

Apply this to both overlay canvases before warping.

### Surface layer

Add a transparent full-canvas wash:

```txt
fill:       #172327
opacity:    0.025–0.050
blend:      normal/source-over
```

This should barely lift the black display surface after compositing.

### Edge falloff

Add a subtle inner vignette:

```txt
top/bottom/side edge darkening opacity: 0.08–0.16
radius/feather:                       20–40 px on design canvas
```

### Softness

After rendering the text and surface treatment:

```txt
Gaussian blur / softness: 0.22–0.30 px
```

Start at:

```txt
0.22 px
```

### Noise / grain

Add subtle monochrome screen noise:

```txt
opacity: 0.015–0.025
blend:   overlay or soft-light
scale:   fine, not chunky
```

### Through-glass absorption

After text is rendered, apply a very slight dark glass pass over the full display canvas:

```txt
Repository opacity: 0.04–0.05
Toolchain opacity:  0.055–0.065
blend:              normal/source-over
content:            dark glass tint, top-edge shadow, faint uneven grime
```

This pass should make the content feel behind display glass. It should not become glow, blur, or a visible decorative overlay.

### Scanline texture

Optional. Use only if it is almost invisible.

```txt
line height: 1 px
gap:         3 px
opacity:     0.025–0.04
```

### Glow

Glow should be close to zero.

```txt
text glow opacity: 0.000–0.015
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
left margin:       18 px
right margin:      18 px
top margin:        25 px
bottom margin:     12 px
usable width:      464 px
```

### Column positions

```txt
time column x:      16 px
repo name x:        56 px
status column x:    326 px
right-aligned edge: 482 px
```

### Row baselines

```txt
title baseline:     35 px
row 1 baseline:     70 px
row 2 baseline:     96 px
row 3 baseline:     122 px
row 4 baseline:     148 px
```

### Divider lines

Use one station-style red rule and faint row discipline:

```txt
Marunouchi stripe y: 53 px
row rules y:        83, 109, 135, 154 px
```

Both should be extremely faint. No visible table grid.

---

## 7.3 Repository Text Content

Final text block:

```txt
M03 REPOSITORY SIGNALS                         新高円寺

32m   JobSentinel              ON
2w    PyGuard                  ON
1mo   WormsWMD-macOS-Fix       CHECK
6mo   PoshGuard                IDLE
```

This should read like a station/service board, not like repository analytics.

---

## 7.4 Repository Line-by-Line Element Spec

### Title row

| Element | Text | x | y baseline | Align | Size | Tracking | Color | Opacity |
|---|---:|---:|---:|---|---:|---:|---|---:|
| Route label | `M03` | 16 | 35 | left | 12.8 px | 0.055em | `--text-secondary` | 0.64 |
| English title | `REPOSITORY SIGNALS` | 50 | 35 | left | 12.8 px | 0.06em | `--text-primary` | 0.78 |
| Station label | `新高円寺` | 478 | 35 | right | 9.4 px | 0.045em | `--text-secondary` | 0.68 |

### Header stripe

```txt
x1: 16
x2: 486
y: 53
stroke: --marunouchi-red
opacity: 0.20
width: 2 px
softness: 0.2–0.3 px
```

---

### Row 1

| Element | Text | x | y baseline | Align | Size | Tracking | Color | Opacity |
|---|---:|---:|---:|---|---:|---:|---|---:|
| Time | `32m` | 16 | 70 | left | 12.1 px | 0.035em | `--accent-amber` | 0.72 |
| Repo | `JobSentinel` | 56 | 70 | left | 14.8 px | 0.018em | `--text-primary` | 0.98 |
| Status | `ON` | 326 | 70 | left | 12.0 px | 0.04em | `--text-secondary` | 0.68 |

### Row 2

| Element | Text | x | y baseline | Align | Size | Tracking | Color | Opacity |
|---|---:|---:|---:|---|---:|---:|---|---:|
| Time | `2w` | 16 | 96 | left | 12.1 px | 0.035em | `--accent-amber` | 0.72 |
| Repo | `PyGuard` | 56 | 96 | left | 14.8 px | 0.018em | `--text-primary` | 0.98 |
| Status | `ON` | 326 | 96 | left | 12.0 px | 0.04em | `--text-secondary` | 0.68 |

### Row 3

| Element | Text | x | y baseline | Align | Size | Tracking | Color | Opacity |
|---|---:|---:|---:|---|---:|---:|---|---:|
| Time | `1mo` | 16 | 122 | left | 12.1 px | 0.035em | `--accent-amber` | 0.72 |
| Repo | `WormsWMD-macOS-Fix` | 56 | 122 | left | 14.8 px | 0.018em | `--text-primary` | 0.98 |
| Status | `CHECK` | 326 | 122 | left | 12.0 px | 0.04em | `--accent-amber` | 0.80 |

### Row 4

| Element | Text | x | y baseline | Align | Size | Tracking | Color | Opacity |
|---|---:|---:|---:|---|---:|---:|---|---:|
| Time | `6mo` | 16 | 148 | left | 12.1 px | 0.035em | `--accent-amber` | 0.72 |
| Repo | `PoshGuard` | 56 | 148 | left | 14.8 px | 0.018em | `--text-primary` | 0.98 |
| Status | `IDLE` | 326 | 148 | left | 12.0 px | 0.04em | `--text-secondary` | 0.58 |

---

### Footer

Default recommendation: **off**. Do not render `ACTIVE` or `TOTAL` metrics on the Repository board unless a later pass proves the board needs them.

---

## 7.5 Optional Repository Status Lamps

Default recommendation: **do not render lamps**. Use text statuses first.

If the board still feels too empty after the text-only pass, add tiny hardware-like lamps at far right. These must not look like charts.

### Lamp geometry

```txt
lamp size:      5 × 5 px
lamp gap:       4 px
lamp group x:   438 px
lamp y offset:  baseline - 5 px
lamp count:     4 max
opacity:        0.20–0.34
```

### Lamp patterns

```txt
Row 1: ■ ■ ■ □
Row 2: ■ ■ □ □
Row 3: ■ ■ ■ □
Row 4: ■ □ □ □
```

If lamps are used, reduce status-word opacity by about `0.08` or remove the status words. Do not use both at full strength.

---

## 7.6 Repository Styling Rules

### Keep

```txt
simple rows
large calm title
small Japanese label
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
canvas width:  144 px
canvas height: 420 px
```

The Toolchain panel should feel like a **narrow station maintenance / subsystem readout**. It should be much quieter than the Repository board.

---

## 8.2 Toolchain Layout Grid

```txt
left margin:       30 px
right margin:      28 px
top visual center: slightly above center
```

### Column positions

```txt
code column x:      28 px
value column x:     56 px
```

### Baselines

```txt
header rule y:       45 px
header baseline:    63 px
title baseline:     82 px
row 1 baseline:     106 px
row 2 baseline:     132 px
row 3 baseline:     158 px
row 4 baseline:     184 px
```

This top-anchors the text block like a service readout and leaves enough dark glass beneath it to preserve secondary-panel restraint.

---

## 8.3 Toolchain Text Content

Final text block:

```txt
M03 SERVICE
TOOLCHAIN

TS     25%
PY     35%
SH     25%
PS     15%
```

---

## 8.4 Toolchain Line-by-Line Element Spec

### Header

| Element | Text | x | y baseline | Align | Size | Tracking | Color | Opacity |
|---|---:|---:|---:|---|---:|---:|---|---:|
| Header | `M03 SERVICE` | 28 | 63 | left | 10.6 px | 0.075em | `--accent-amber` | 0.74 |
| Title | `TOOLCHAIN` | 28 | 82 | left | 13.2 px | 0.075em | `--text-primary` | 0.80 |

### Header rule

Use a thin station-style red rule above the header.

```txt
x1: 28
x2: 120
y: 45
stroke: --marunouchi-red
opacity: 0.20
width: 2 px
```

Do not make the rule obvious. If it looks like UI furniture, dim it.

---

### Row 1

| Element | Text | x | y baseline | Align | Size | Tracking | Color | Opacity |
|---|---:|---:|---:|---|---:|---:|---|---:|
| Code | `TS` | 28 | 106 | left | 15.2 px | 0.07em | `--text-secondary` | 0.80 |
| Value | `25%` | 56 | 106 | left | 15.2 px | 0.07em | `--text-secondary` | 0.70 |

### Row 2

| Element | Text | x | y baseline | Align | Size | Tracking | Color | Opacity |
|---|---:|---:|---:|---|---:|---:|---|---:|
| Code | `PY` | 28 | 132 | left | 15.2 px | 0.07em | `--text-secondary` | 0.80 |
| Value | `35%` | 56 | 132 | left | 15.2 px | 0.07em | `--text-secondary` | 0.70 |

### Row 3

| Element | Text | x | y baseline | Align | Size | Tracking | Color | Opacity |
|---|---:|---:|---:|---|---:|---:|---|---:|
| Code | `SH` | 28 | 158 | left | 15.2 px | 0.07em | `--text-secondary` | 0.74 |
| Value | `25%` | 56 | 158 | left | 15.2 px | 0.07em | `--text-secondary` | 0.64 |

### Row 4

| Element | Text | x | y baseline | Align | Size | Tracking | Color | Opacity |
|---|---:|---:|---:|---|---:|---:|---|---:|
| Code | `PS` | 28 | 184 | left | 15.2 px | 0.07em | `--text-secondary` | 0.72 |
| Value | `15%` | 56 | 184 | left | 15.2 px | 0.07em | `--text-secondary` | 0.62 |

---

### Optional footer

Default recommendation: **off**.

If the panel feels too empty after full-image review, use this:

| Element | Text | x | y baseline | Align | Size | Tracking | Color | Opacity |
|---|---:|---:|---:|---|---:|---:|---|---:|
| Footer | `LOCAL LINK` | 30 | 352 | left | 5.6 px | 0.08em | `--text-secondary` | 0.22 |

If the footer makes the panel feel designed or dashboard-like, remove it. The footer is not important. The scene is.

---

## 8.5 Optional Toolchain Tick Marks

Default recommendation: **do not render ticks**.

If the panel needs a tiny amount of subsystem identity, add one tiny tick before each code.

```txt
tick x:      22 px
tick y:      row baseline - 5 px
tick size:   3 × 5 px
opacity:     0.18–0.26
```

Use muted colors:

```txt
TS: --accent-cyan
PY: --accent-cyan at lower opacity
SH: --accent-magenta at lower opacity
PS: --accent-magenta
```

No nodes. No route line. No bar chart. No legend. Tiny ticks only.

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

## Repository overlay opacity

After all text and surface layers are rendered:

```txt
overall layer opacity: 0.78–0.86
recommended start:    0.86
```

## Toolchain overlay opacity

```txt
overall layer opacity: 0.68–0.78
recommended start:    0.78
```

Toolchain should be quieter than Repository.

## Blend mode

Use normal/source-over for main content.

```txt
main text:       normal/source-over
surface haze:    normal/source-over
noise/grain:     overlay or soft-light
very faint glow: screen only if opacity <= 0.015
```

Do not use heavy `screen`, `plus`, or additive blending for primary text.

---

# 10. Perspective Warp Instructions

## Repository warp mapping

Map Repository canvas corners:

```txt
canvas (0, 0)       -> image (393, 56)
canvas (500, 0)     -> image (893, 60)
canvas (500, 160)   -> image (891, 214)
canvas (0, 160)     -> image (393, 212)
```

## Toolchain warp mapping

Map Toolchain canvas corners:

```txt
canvas (0, 0)       -> image (1324, 217)
canvas (144, 0)     -> image (1451, 191)
canvas (144, 420)   -> image (1447, 606)
canvas (0, 420)     -> image (1320, 582)
```

If using ImageMagick-style perspective distortion, the concept is:

```txt
0,0        targetTL
W,0        targetTR
W,H        targetBR
0,H        targetBL
```

Do the warp after rendering and softening the overlay canvas.

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
softened text
slight glass haze
not-perfect black levels
no dashboard-card boundary
no chart-like objects
```

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

Use these exact defaults first. Do not tune until you see the full-image result.

## Repository defaults

```txt
canvas:              500 × 160
primary text opacity: 0.82 title, 0.82 repo names
secondary opacity:    0.48–0.64
accent opacity:       0.38–0.66
softness:             0.22 px
surface haze:         0.035 plus powered wash 0.045
noise:                0.018
layer opacity:        0.86
status lamps:         off
footer:               on
```

## Toolchain defaults

```txt
canvas:              144 × 420
primary text opacity: 0.76 title, 0.60–0.66 rows
secondary opacity:    0.48–0.54 values
softness:             0.24 px
surface haze:         0.040 plus powered wash 0.042
noise:                0.020
layer opacity:        0.78
ticks:                off
footer:               off
divider:              off
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
