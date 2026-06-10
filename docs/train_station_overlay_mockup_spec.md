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
2. Add very faint screen-surface effects with `magick` alpha/compose operations.
3. Do not apply extra text blur. Use normal raster anti-aliasing plus perspective resampling only.
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

Use these quads for final placement. These are inner-screen targets, not outer frame targets.

### Repository board target quad

```txt
Repository screen inner quad, full-image pixels:
TL: (445, 55)
TR: (945, 64)
BR: (945, 207)
BL: (445, 220)
```

### Repository fallback rectangle

Use only if perspective warping is unavailable:

```txt
x: 445
y: 55
width: 500
height: 165
```

The fallback is acceptable because this board is close to rectangular. Still, perspective warp is preferred.

---

### Toolchain panel target quad

```txt
Toolchain screen inner quad, full-image pixels:
TL: (1416, 203)
TR: (1518, 184)
BR: (1500, 604)
BL: (1412, 583)
```

### Toolchain fallback rectangle

Use only if perspective warping is unavailable:

```txt
x: 1412
y: 184
width: 106
height: 420
```

The fallback will look less convincing on the right panel because the panel is visibly skewed. Use the quad if at all possible.

---

## 4. Global Visual Tokens

These colors are intentionally muted. Bright cyan and pure white are banned from this design family, because the goal is train-station hardware, not a conference demo about microservices.

### Color tokens

```txt
--text-primary:      #D8BE8C   opacity 0.86–1.00
--text-secondary:    #B99C76   opacity 0.84–0.98
--accent-amber:      #E0A047   opacity 0.94–1.00
--accent-cyan:       #6F817A   opacity 0.20–0.35, avoid on Repository board
--accent-magenta:    #6F5E68   opacity 0.12–0.24, default off
--marunouchi-red:    #78312E   opacity 0.18–0.28
--rule-line:         #2B3432   opacity 0.15–0.25
--glass-haze:        #172327   opacity 0.006–0.012
--edge-darken:       #000000   opacity 0.08–0.22
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

Add a near-transparent full-canvas wash. Do not cover the baked-in black screen with a new opaque rectangle.

```txt
Repository powered wash:  #2F3C35 at 0.012, plus panel-life at 0.72
Toolchain powered wash:   #2F3C35 at 0.018, plus panel-life at 0.62
Toolchain glass haze:     #172327 at 0.006
blend:                    normal/source-over
```

This should barely lift the black display surface after compositing.

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

After text is rendered, apply a very slight dark glass pass over the full display canvas:

```txt
Repository opacity: off
Toolchain opacity:  off
blend:              normal/source-over
content:            reserved for future source-specific dark glass repair
```

This pass is currently disabled because it made the panels muddy and added fake grain. Use reflected-light passes instead.

### Environmental reflection

Add a separate warm reflection pass to both signs. This must not reduce text opacity.

```txt
color:       warm fluorescent amber / off-white
shape:       thin tube-like streaks plus soft spill
placement:   near visible station fluorescent tubes and lit frame edges
blend:       screen/lighten style only for the reflection layer
purpose:     make the glass interact with station lighting
```

### Scanline texture

Use only a faint content-level scanline layer. It should read as display refresh texture, not as a visible graphic pattern.

```txt
line height: 1 px
gap:         4 px
Repository opacity: 0.018
Toolchain opacity:  0.016
```

### Glow

Glow should be present but close to zero.

```txt
Repository text glow opacity: 0.008
Toolchain text glow opacity:  0.014
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
left margin:       24 px visual edge
right margin:      62 px visual edge
top margin:        19 px
bottom margin:     12 px
usable width:      414 px
```

### Column positions

```txt
time column x:      82 px, right-aligned
repo name x:        110 px
detail/status x:    110 px
language x:         420 px, right-aligned
star count x:       420 px, right-aligned
```

### Row baselines

```txt
title baseline:     29 px
row 1 repo:         72 px
row 1 detail:       96 px
row 2 repo:         123 px
row 2 detail:       147 px
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

Final text block:

```txt
M03 REPOSITORY SIGNALS

32m   JobSentinel                         TypeScript
      ● ON                                ★ 28

2w    PyGuard                                 Python
      ● CHECK                             ★ 19
```

Show the two most recently updated public owner repositories. This should read like a station/service board, not like repository analytics.

---

## 7.4 Repository Line-by-Line Element Spec

### Title row

| Element | Text | x | y baseline | Align | Size | Tracking | Color | Opacity |
|---|---:|---:|---:|---|---:|---:|---|---:|
| Route label | `M03` | 36 | 29 | left | 12.8 px | 0.045em | `--text-secondary` | 0.86 |
| English title | `REPOSITORY SIGNALS` | 72 | 29 | left | 12.8 px | 0.045em | `--text-primary` | 0.78 |

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

### Row 1

| Element | Text | x | y baseline | Align | Size | Tracking | Color | Opacity |
|---|---:|---:|---:|---|---:|---:|---|---:|
| Time | `32m` | 82 | 72 | right | 16.6 px | 0.025em | `--accent-amber` | 0.96 |
| Repo | `JobSentinel` | 110 | 72 | left | 22.2 px | 0 | `--text-primary` | 0.99 |
| Language | `TypeScript` | 420 | 72 | right | 14.8 px | 0.025em | `--text-secondary` | 0.94 |
| LED | `●` | 98 | 92 | center | 4 px radius | n/a | `#39FF14` | 0.74 |
| Status | `ON` | 110 | 96 | left | 15.2 px | 0.035em | `--text-secondary` | 0.74 |
| Stars | `★ 28` | 420 | 96 | right | 14.8 px | 0.02em | `--text-secondary` | 0.94 |

### Row 2

| Element | Text | x | y baseline | Align | Size | Tracking | Color | Opacity |
|---|---:|---:|---:|---|---:|---:|---|---:|
| Time | `2w` | 82 | 123 | right | 16.6 px | 0.025em | `--accent-amber` | 0.96 |
| Repo | `PyGuard` | 110 | 123 | left | 22.2 px | 0 | `--text-primary` | 0.99 |
| Language | `Python` | 420 | 123 | right | 14.8 px | 0.025em | `--text-secondary` | 0.94 |
| LED | `●` | 98 | 143 | center | 4 px radius | n/a | `--accent-amber` | 0.86 |
| Status | `CHECK` | 110 | 147 | left | 15.2 px | 0.035em | `--accent-amber` | 0.86 |
| Stars | `★ 19` | 420 | 147 | right | 14.8 px | 0.02em | `--text-secondary` | 0.94 |

---

### Footer

Default recommendation: **off**. Do not render `ACTIVE REPOS` or `TOTAL` metrics on the Repository board unless a later pass proves the board needs them.

---

## 7.5 Repository Status LEDs

Default recommendation: render only the two small status LEDs beside status text.

These are physical indicator dots paired with the status word, not chart marks or row bullets.

### LED geometry

```txt
dot radius:     4 px
dot x:          98 px
row 1 dot y:    92 px
row 2 dot y:    143 px
filter:         soft-glow
```

### Status mapping

```txt
ON:     #39FF14 at 0.74
CHECK:  --accent-amber at 0.86
IDLE:   --text-secondary at 0.64
```

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

## 8.2 Toolchain Layout Grid

```txt
left margin:       18 px
right margin:      17 px for value column
top visual center: slightly above center
```

### Column positions

```txt
line code x:        16 px
line name x:        39 px
share x:            114 px, right-aligned
```

### Baselines

```txt
header rule y:       44 px
header baseline:    66 px
title baseline:     91 px
row 1 baseline:     118 px
row 2 baseline:     156 px
row 3 baseline:     194 px
row 4 baseline:     232 px
```

This top-anchors the text block like a service readout and leaves enough dark glass beneath it to preserve secondary-panel restraint.

---

## 8.3 Toolchain Text Content

Final text block:

```txt
M03 SERVICE
CODE LINES

PY   Python      35%
TS   TypeScript  25%
SH   Shell       25%
PS   PowerShell  15%
```

---

## 8.4 Toolchain Line-by-Line Element Spec

### Header

| Element | Text | x | y baseline | Align | Size | Tracking | Color | Opacity |
|---|---:|---:|---:|---|---:|---:|---|---:|
| Header | `M03 SERVICE` | 16 | 66 | left | 11.8 px | 0.05em | `--accent-amber` | 0.86 |
| Title | `CODE LINES` | 16 | 91 | left | 15.8 px | 0.04em | `--text-primary` | 0.94 |

### Header rule

Use a thin station-style red rule above the header.

```txt
x1: 16
x2: 114
y: 44
stroke: --marunouchi-red
opacity: 0.20
width: 2 px
```

Do not make the rule obvious. If it looks like UI furniture, dim it.

---

### Row 1

| Element | Text | x | y baseline | Align | Size | Tracking | Color | Opacity |
|---|---:|---:|---:|---|---:|---:|---|---:|
| Code | `PY` | 16 | 118 | left | 17.2 px | 0.012em | `--text-primary` | 0.98 |
| Name | `Python` | 39 | 118 | left | 6.4 px | 0 | `--text-secondary` | 0.88 |
| Share | `35%` | 114 | 118 | right | 13.2 px | 0 | `--text-primary` | 0.98 |

### Row 2

| Element | Text | x | y baseline | Align | Size | Tracking | Color | Opacity |
|---|---:|---:|---:|---|---:|---:|---|---:|
| Code | `TS` | 16 | 156 | left | 17.2 px | 0.012em | `--text-primary` | 0.97 |
| Name | `TypeScript` | 39 | 156 | left | 6.4 px | 0 | `--text-secondary` | 0.87 |
| Share | `25%` | 114 | 156 | right | 13.2 px | 0 | `--text-primary` | 0.97 |

### Row 3

| Element | Text | x | y baseline | Align | Size | Tracking | Color | Opacity |
|---|---:|---:|---:|---|---:|---:|---|---:|
| Code | `SH` | 16 | 194 | left | 17.2 px | 0.012em | `--text-primary` | 0.96 |
| Name | `Shell` | 39 | 194 | left | 6.4 px | 0 | `--text-secondary` | 0.86 |
| Share | `25%` | 114 | 194 | right | 13.2 px | 0 | `--text-primary` | 0.96 |

### Row 4

| Element | Text | x | y baseline | Align | Size | Tracking | Color | Opacity |
|---|---:|---:|---:|---|---:|---:|---|---:|
| Code | `PS` | 16 | 232 | left | 17.2 px | 0.012em | `--text-primary` | 0.94 |
| Name | `PowerShell` | 39 | 232 | left | 6.4 px | 0 | `--text-secondary` | 0.84 |
| Share | `15%` | 114 | 232 | right | 13.2 px | 0 | `--text-primary` | 0.94 |

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
overall layer opacity: 0.98
glass reflection:     0.12
absorption/noise:     off
```

## Toolchain overlay opacity

```txt
overall layer opacity: 1.00
text glow:            0.012
glass reflection:     0.13
absorption/noise:     off
```

Toolchain should be quieter than Repository.

## Blend mode

Use normal/source-over for main content.

```txt
main text:             normal/source-over
surface haze:          normal/source-over
reflection/glare:      screen
uniform sign noise:    off
```

Do not use heavy `screen`, `plus`, or additive blending for primary text.

---

# 10. Perspective Warp Instructions

## Repository warp mapping

Map Repository canvas corners:

```txt
canvas (0, 0)       -> image (445, 55)
canvas (500, 0)     -> image (945, 64)
canvas (500, 160)   -> image (945, 207)
canvas (0, 160)     -> image (445, 220)
```

## Toolchain warp mapping

Map Toolchain canvas corners:

```txt
canvas (0, 0)       -> image (1416, 203)
canvas (131, 0)     -> image (1518, 184)
canvas (131, 420)   -> image (1500, 604)
canvas (0, 420)     -> image (1412, 583)
```

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

Use these exact defaults first. Do not tune until you see the full-image result.

## Repository defaults

```txt
canvas:              500 × 160
primary text opacity: 0.78 title, 0.95 repo names
secondary opacity:    0.78–0.82
accent opacity:       0.84
softness:             0.08 sigma readable layer, 0.75 sigma glow layer
surface haze:         off
uniform noise:        off; text-layer noise attenuation 0.012
reflection:           warm fluorescent streaks
layer opacity:        0.98
text glow:            0.008
status lamps:         off
footer:               off
```

## Toolchain defaults

```txt
canvas:              131 × 420
primary text opacity: 0.98 title, 0.97–1.00 code/value rows
secondary opacity:    0.90–0.93 names
softness:             0.08 sigma readable layer, 0.75 sigma glow layer
surface haze:         glass haze 0.006 plus powered wash 0.018
uniform noise:        off; text-layer noise attenuation 0.012
reflection:           warm fluorescent reflection above text
layer opacity:        1.00
text glow:            0.014
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
