# Tokyo Subway Header
## Design Reference, Art Direction, and Overlay Implementation Guide

**Purpose:** Create a GitHub/profile header image for the `cboyd0319` profile that blends a cinematic Tokyo subway platform scene with readable, script-rendered live repository data.

This guide consolidates the visual direction, reference influences, image-generation constraints, final layout decisions, and production workflow for generating the base image and applying the **Repository Signals** and **Code Lines** overlays.

---

## 1. Core Concept

A cinematic Tokyo-inspired underground subway platform at night, styled as a retro-futurist cyberpunk transit environment.

The scene should feel like a real station that has been gradually upgraded with digital infrastructure. It should not look like a spotless neon showroom, a generic AI cyberpunk street, or an abandoned post-apocalyptic tunnel. The visual priority is:

1. Atmospheric Tokyo subway environment.
2. Readable repository data surface.
3. Clean GitHub/profile-header usability.

### Primary scene elements

- Tokyo-inspired underground subway platform.
- Train stopped or arriving on the right side of the frame.
- Long perspective down the platform.
- Commuters as small silhouettes or quiet background figures.
- One main overhead sign surface for **Repository Signals**.
- One smaller right-side wall panel for **Code Lines**.
- Supporting station signage, including Shin-koenji / Tokyo Metro Marunouchi Line cues.
- Mild floor sheen and subtle reflections, not a soaking-wet mirror surface.
- Industrial ceiling structure, conduits, pipes, fluorescent fixtures, tiled walls, vending machines, and transit clutter.

---

## 2. Final Preferred Direction

The best current direction is:

> A moderately clean but still lived-in Tokyo subway platform, cinematic and slightly melancholic, with controlled cyan/magenta accents, filmic blue-green shadows, soft amber practical lights, and script-rendered repository information integrated onto station signage.

### What worked best

- Subway platform stayed recognizable and grounded.
- Train placement created a strong right-side focal anchor.
- One large overhead sign became the hero data surface.
- Right-side top sign was removed, reducing visual clutter.
- **Code Lines** moved to a smaller right-side wall panel.
- Mood moved closer to classic Japanese cyberpunk animation and cinematic sci-fi.
- Image avoided flat synthwave poster art and excessive neon spectacle.

### What still needs careful control

- Keep the station used, but not filthy.
- Keep reflections subtle, not glassy or flooded.
- Preserve hand-painted / cel-shaded cinematic qualities.
- Avoid excessive magenta neon tubes.
- Avoid modern glossy 3D-render cleanliness.
- Avoid relying on generated text for final important data.

---

## 3. Target Aesthetic Mix

The desired look is not pure neon synthwave. It is more specific: cinematic Japanese cyberpunk transit realism with restrained neon accents and analog texture.

### 3.1 Japanese cyberpunk animation

Influences:

- **Ghost in the Shell (1995)**
- **Akira (1988)**
- **Neo Tokyo (1987)**
- **Ghost in the Shell 2: Innocence (2004)**
- **Neon Genesis Evangelion: The End of Evangelion (1997)**
- **Psycho-Pass**
- **Armitage III**
- **Appleseed**

Design cues:

- Dense urban machinery.
- Cool blue-green shadows.
- Concrete, tile, steel, conduits, and transit infrastructure.
- Carefully framed architecture.
- Slight loneliness and scale.
- Analog texture, grit, and age.
- Soft bloom around practical lights.
- Detailed backgrounds with a hand-painted animation feel.
- Futuristic systems embedded into ordinary public spaces.

### 3.2 Modern cinematic cyberpunk

Influences:

- **Blade Runner**
- **Blade Runner 2049**

Design cues:

- Rain-adjacent atmosphere without requiring heavy rainfall.
- Cinematic contrast.
- Deep shadows with controlled pools of light.
- Occasional amber/orange practical lighting.
- Fog, mist, and atmospheric depth.
- Neon used selectively rather than everywhere.
- Human silhouettes dwarfed by infrastructure.

### 3.3 Contemporary anime city mood

Influences:

- **The Boy and the Beast (2015)**
- **Chainsaw Man - The Movie: Reze Arc (2025)**
- **Perfect Blue (1997)**

Design cues:

- More naturalistic city lighting.
- Human-scale realism.
- Grounded Tokyo atmosphere.
- Less theme-park cyberpunk.
- Subtle emotional quietness.
- Background details that feel observed rather than randomly generated.

### 3.4 Retro-futurist music/anime color

Influence:

- **Daft Punk & Leiji Matsumoto’s Interstella 5555 (2003)**

Design cues:

- Graphic color blocking.
- Clean silhouette readability.
- Cool blues and purples with occasional saturated accent colors.
- Strong shape language.
- Slightly nostalgic sci-fi tone.

---

## 4. Visual Mood

### Keywords

- Cinematic
- Lived-in
- Quiet
- Rain-adjacent
- Retro-futurist
- Hand-painted
- Transit-industrial
- Blue-green cyberpunk
- Controlled neon
- Analog digital signage
- Slightly melancholic
- Public infrastructure upgraded with data systems

### Avoid

- Overly clean 3D render.
- Extreme neon overload.
- Pink/purple everywhere.
- Overly wet floor reflections.
- Filthy abandoned station.
- Random fake Japanese clutter.
- Generic cyberpunk market street.
- Excessive holograms.
- Too many signs competing with the data board.
- Unreadable AI-generated text wherever the viewer is supposed to understand the content.
- Decorative sparkle/star marks that feel like watermarks or UI artifacts.
- Loose random cables or devices unless they have a clear narrative purpose.

---

## 5. Color Palette

The palette should be controlled and cinematic, not carnival-neon. The final image should lean blue-green and concrete-gray, with magenta and amber used as accents.

### Base shadows

| Color | Use |
| --- | --- |
| `#0b1624` | Deep navy shadow, tunnels, ceiling voids |
| `#102536` | Blue-black structural shadow |
| `#183446` | Cool concrete and tile shadows |
| `#243f52` | Mid-tone subway metal / wall panels |

### Cool light

| Color | Use |
| --- | --- |
| `#6faac2` | Fluorescent cyan spill |
| `#9fcbd8` | Pale station light |
| `#5b85a6` | Blue-gray highlights |
| `#b5d5dc` | Data sign text glow |

### Neon accents

| Color | Use |
| --- | --- |
| `#ec6cc8` | Limited magenta signage |
| `#7e5dc8` | Purple route stripe / chart accent |
| `#1fc7e6` | Cyan data bars |
| `#f07848` | Amber/orange train sign and warm lamps |

### Muted environmental tones

| Color | Use |
| --- | --- |
| `#6f6a57` | Aged concrete warmth |
| `#878078` | Worn tile and train body |
| `#4e4a50` | Metal grime and shadows |
| `#c3b89f` | Soft amber practical light |

### Overlay color guidance

The overlay scripts should use the same palette family as the image:

- Panel background: near-black/navy, opaque enough to cover baked-in sign content.
- Primary text: pale haze / warm white.
- Secondary text: muted cool gray-blue.
- TypeScript: cyan-blue.
- Python: blue.
- Shell: lavender/purple.
- PowerShell: magenta/violet.
- Alert or warm accents: restrained amber/orange.

---

## 6. Lighting Direction

The image should be dim enough to feel cinematic, but bright enough to function as a GitHub/profile header.

### Recommended lighting

- Overhead fluorescent station lights in cool white.
- Soft cyan spill from vending machines and station panels.
- Small magenta accents from signs and light strips.
- Warm amber/orange from the train destination sign, headlights, and interior windows.
- Subtle bloom on the main sign area, but not enough to reduce overlay readability.
- Mild atmospheric haze down the platform.
- Floor reflections visible but restrained.

### Brightness target

- Darker than a commercial render.
- Brighter than the early overly dark drafts.
- Enough contrast for text readability.
- No pitch-black corners that swallow important composition.
- The main Repository Signals board should remain readable after the overlay is applied and after resizing.

---

## 7. Surface Treatment

### Station

The station should be aged but functional.

Use:

- Worn tile.
- Light scuffs.
- Subtle stains.
- Exposed pipes.
- Slight grime around seams.
- Small signs and stickers.
- Mild fog/steam near track level.
- Hand-painted concrete texture.
- Sharper linework around pipes, seams, sign frames, ceiling conduits, and train panels.

Avoid:

- Heavy dirt.
- Trash everywhere.
- Moldy walls.
- Puddles across the entire platform.
- Apocalyptic decay.
- Over-polished floors.
- Plastic-looking 3D surfaces.

### Floor

The floor should have a mild sheen, as if recently cleaned or slightly damp from commuter traffic.

Use:

- Soft reflections.
- Occasional subtle wet-looking patches.
- Tile pattern still visible.

Avoid:

- Mirror-like wet pavement.
- Heavy puddles.
- Rain visibly falling inside the station unless intentionally used near entrances.

---

## 8. Composition

### Preferred layout

- Wide cinematic frame suitable for GitHub header use.
- Main overhead sign on the upper-left to upper-center.
- Train enters from or rests on the right, angled slightly toward viewer.
- Platform perspective leads into the center background.
- Vending machines and vertical signage on the left.
- Wall information panels on the right.
- Commuters placed as silhouettes or understated background figures.
- No large character close-up.

### Why this works

The image needs to remain a profile/header asset, not a movie poster. The train and platform establish mood, while the Repository Signals board delivers the actual GitHub/profile data.

---

## 9. Signage System

Important final text should be rendered by code, not trusted to the image model.

The image model can create plausible blank or semi-readable sign surfaces, but final data surfaces should be generated by the overlay pipeline so that text is accurate, readable, and repeatable.

### 9.1 Main sign: Repository Signals

The main sign is the hero data surface.

Final text should be applied through `generate-overlays.mjs`.

Recommended static contents:

```text
M03 REPOSITORY SIGNALS

32m   JobSentinel                         TypeScript
      ACTIVE                              ★ 28

2w    PyGuard                                 Python
      STANDBY                             ★ 19
```

Notes:

- Keep the text aligned and readable.
- Use monospaced or transit-display-inspired typography.
- Keep row icons simple and clean.
- Keep language labels compact.
- Do not overfill the board.
- Use a mostly opaque panel background to prevent baked-in sign text from ghosting through.
- Show the two most recently updated public owner repositories, selected dynamically from GitHub data or from the sorted static fixture.

### 9.2 Right-side wall panel: Code Lines

Since the main overhead right-side sign was removed, this smaller panel carries language-share data as train line service information.

Final text should be applied through `generate-overlays.mjs`.

Current preferred static split:

```text
M03 SERVICE
CODE LINES

PY   Python      35%
TS   TypeScript  25%
SH   Shell       25%
PS   PowerShell  15%
```

Visual options:

- Route-code column, full language line name, right-aligned share.
- Faint schedule-board row separators.
- Keep it secondary. It should not compete with the Repository Signals board.

### 9.3 Station signage

Supporting station signage may be baked into the base image, provided it is simple and plausible.

Preferred supporting text:

```text
新高円寺
Shin-koenji
M03

次は 南阿佐ヶ谷
Next: Minami-asagaya

東京メトロ
Tokyo Metro

丸ノ内線
Marunouchi Line

安全第一
SAFETY FIRST

出口 1-4
EXIT
1-4-5
```

Notes:

- Japanese text should feel plausible and restrained.
- Avoid filling every surface with nonsense glyphs.
- Use the literal Tokyo Metro Marunouchi Line canon already baked into the approved blank.
- Station code should be `M03`, not bare `03`.
- Train destination display should read `荻窪` / `OGIKUBO` if visible.
- Transit signs should sell the environment, not distract from the repository board.
- If generated text is slightly off on secondary signs, it is less critical than errors on the main overlays, but obvious nonsense should still be avoided.

---

## 10. Data Priorities

The image is decorative, but visible data should be internally consistent.

### Must include on final generated overlay

- `Repository Signals`
- `M03`
- `JobSentinel`
- `PyGuard`
- Update age, status, language, and star count for each displayed repository.
- The two rows must be the two most recently updated public owner repositories, not a hard-coded pair in live mode.
- Toolchain split:
  - TypeScript: `25%`
  - Python: `35%`
  - Shell: `25%`
  - PowerShell: `15%`

### Static versus live data

Use static data when producing a design-locked header for consistency.

Use live GitHub data when the profile should refresh automatically, but accept that values may change:

- Displayed repositories can change when another public owner repository becomes more recently updated.
- Update ages may become `1h`, `2h`, etc.
- Stars may increase.
- Streak should be dynamically computed from participation data.
- Language percentages may shift as repository contents change.

### Should avoid

- Random repo names.
- Showing older repositories on the main sign when newer public owner repositories exist.
- Unreadable row labels.
- Fake languages replacing TypeScript / Python / Shell / PowerShell.
- Mixing static and live values inconsistently.

---

## 11. Overlay-Based Production Workflow

The final workflow should separate **base image generation** from **data rendering**.

### 11.1 Recommended file roles

```text
assets/subway_blank_original.png  # clean base image, no final overlays baked in
assets/signals.png                # generated final output with overlays applied
assets/generated/repository-sign.svg
assets/generated/toolchain-spectrum.svg
scripts/generate-overlays.mjs     # active overlay generator
scripts/lib/svg.mjs               # SVG panel renderer
scripts/optimize-signals.mjs      # optional optimization step
```

### 11.2 Base image requirements

The base image should include physical sign surfaces, but should avoid final text where overlays will be placed.

Best base image behavior:

- Main overhead sign surface exists and is dark enough for overlay text.
- Right-side Code Lines wall panel exists and is dark enough for overlay text.
- Baked-in text on these two surfaces is minimal, faint, or absent.
- The sign frames, lighting, and perspective are already part of the art.
- The base image is not a previously generated `signals.png` with overlays already applied.

Do **not** use an already-overlaid output as the next base image unless intentionally compositing. Otherwise, overlay-on-overlay ghosting will appear.

### 11.3 Overlay rendering requirements

The overlay script should:

- Load transit/world signage from `config/scene.json`.
- Load static profile data from `config/static-data.json`.
- Load source-resolution layout boxes from `config/layouts/subway-default.json`.
- Read the real source image dimensions.
- Scale coordinates from source-image pixels.
- Generate SVG panels for the main sign and toolchain sign.
- Rasterize, soften, perspective-warp, composite, resize, optimize, and inspect those panels with ImageMagick 7.1.2-25 `magick`.
- Add readable content plus separate warm sign-face reflection through SVG and ImageMagick alpha/compose steps.
- Validate PNG output before writing.
- Support static data mode for deterministic design output.
- Support live GitHub data mode for automated profile updates.
- Compute streak dynamically when live data is used.
- Avoid running unconditionally when imported.

### 11.3.1 Transit Canon and Signage Consistency

This project currently uses literal Tokyo Metro Marunouchi Line signage because the approved blank image contains that branding. Supporting signs should feel plausible and internally consistent with the configured station details.

All readable sign text should be authored through configuration or overlay rendering. Generated background art may contain non-readable microtexture, but it should not contain important route, station, repository, or toolchain text.

Current canon:

- Current station: `Shin-koenji` / `新高円寺`
- Next direction: `Minami-asagaya` / `南阿佐ヶ谷`
- Station code: `M03`
- Operator: `Tokyo Metro` / `東京メトロ`
- Real Tokyo Metro branding: enabled

### 11.3.2 Validation and Determinism

The production path should be deterministic:

- Local font files in `fonts/` are used before network font fetching.
- `scripts/validate-signals.mjs` checks required repository strings, toolchain strings, static totals, layout bounds, and transit canon contradictions.
- Static mode should preserve configured labels such as `1mo ago` instead of recomputing them into equivalent but visually different strings.
- `assets/generated/` crops should be used for sign-level QA before judging the full image.

### 11.3.3 Rasterization and Optimization

ImageMagick 7.1.2-25 `magick` is the default and required raster pipeline. JavaScript generates SVG/text templates; ImageMagick owns SVG rasterization, panel compositing, perspective distortion, final scene compositing, metadata checks, debug crops, and PNG optimization. `npm run compare-rasterizers` is retained as a compatibility alias and writes ImageMagick raster crops for inspection.

Default optimization should preserve truecolor PNG quality. Palette quantization belongs in the explicit web-size path:

- `npm run optimize`: truecolor PNG optimization.
- `npm run optimize:web`: palette/quantized PNG optimization when size matters more than gradient fidelity.

### 11.4 Coordinate tuning

Coordinates should be tuned in source-image pixels. For the current subway composition, the default coordinate family is approximately:

```bash
BOARD_LEFT=445
BOARD_TOP=55
BOARD_WIDTH=500
BOARD_HEIGHT=165

TOOLCHAIN_LEFT=1412
TOOLCHAIN_TOP=184
TOOLCHAIN_WIDTH=102
TOOLCHAIN_HEIGHT=420
```

These rectangle values are only rough tuning aids. The authoritative perspective quads live in `config/layouts/subway-default.json` and should be updated whenever the base image is regenerated, cropped, resized, or recomposed.

### 11.5 Recommended static render command

For a design-locked output:

```bash
STATIC=1 OUTPUT_WIDTH=1672 npm run generate
```

For live GitHub output:

```bash
GITHUB_TOKEN=your_token_here OUTPUT_WIDTH=1672 npm run generate
```

### 11.6 Optical Integration Rules

The overlay should not appear as a clean SVG sticker. It should feel like emitted data sitting inside a powered display surface embedded in the subway station.

The blank image owns most of the physical sign material: frame, dark glass, reflections, and uneven ambient light. The SVG layer owns the data: text, icons, sparklines, subtle dividers, and local emission. If the SVG paints an opaque display card, the result reads as a sticker even when the typography and coordinates are correct.

Use multi-pass compositing:

1. local shadow
2. faint display stabilizer
3. emissive-only glow layer
4. readable content layer
5. subtle glass reflection layer
6. local environmental wash
7. sign-face reflection pass
8. final whole-image grade/grain

Avoid making the panel smoky or opaque. Integration should come from the native blank sign face, local content glow, subtle structure, environmental color, and final grading.

The primary sign should remain readable at GitHub display size. If integration reduces readability, prioritize readability. Do not fake integration by dropping text opacity until the sign becomes muddy; use glass reflections and source-image lighting instead.

### 11.7 Common overlay problems and fixes

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Old sign text ghosts through overlay | Base image has baked-in text, or panel background is too transparent | Use cleaner base image and/or increase panel opacity |
| Overlay is too large | Coordinates or scale are based on wrong image dimensions | Use source-image dimensions and reduce `BOARD_WIDTH` / `BOARD_HEIGHT` |
| Overlay is shifted | Coordinate mismatch after resizing/cropping | Adjust `BOARD_LEFT`, `BOARD_TOP`, `TOOLCHAIN_LEFT`, `TOOLCHAIN_TOP` |
| Toolchain panel floats off the wall sign | Toolchain coordinates too large or too far left/right | Shrink and align to wall panel frame |
| Text is too small after export | Output width too small or panel too dense | Increase output width, simplify content, or enlarge text |
| Main sign looks pasted on | No local shadow or environmental wash | Add contact shadow, subtle wash, and final unified grade |
| Full rectangle reads as dark card | SVG base layer is doing too much sign-surface work | Reduce SVG base opacity, weaken shadow, increase local emissive glow |
| Sign looks smoky/dim | Too much glass/wash, or SVG panel owns too much surface | Reduce glass/wash, lighten the stabilizer, increase local emissive glow |
| SVG looks too clean | Missing environmental reflection or final grade | Add warm reflection/glare above content; do not add flat sign noise |
| Sign text is muddy | Text opacity was reduced to fake integration | Raise readable text opacity and move integration into reflection/wash layers |
| Data does not feel behind glass | Missing sign-face reflection | Add low-opacity reflection PNGs above content with `screen` blend |
| Text gets blurry | Readable layer blur too high | Blur emissive layer, not primary readable layer |
| Values change unexpectedly | Live mode used instead of static mode | Use `STATIC=1` for final art-locked output |

---

## 12. Recommended Base Image Prompt

Use this prompt when generating a new clean base image. The goal is to create the physical scene and sign surfaces, not final readable data text.

```text
Create a wide cinematic Tokyo subway platform scene at night, inspired by classic Japanese cyberpunk animation and retro-futurist city cinema. The scene should feel like a hand-painted anime background blended with grounded cinematic lighting: blue-green shadows, controlled cyan and magenta accents, subtle amber practical lights, slightly hazy air, exposed pipes, tiled walls, vending machines, station signs, and a stopped subway train on the right.

The platform should look lived-in but not filthy: lightly worn tile, minor scuffs, subtle grime around seams, a faint floor sheen, and only mild reflections. Do not make it extremely wet, abandoned, or dirty.

Place one large overhead dark digital transit-style sign surface near the upper-left / upper-center. This sign should be designed as a blank or lightly marked data board for a later overlay. Do not fill it with fake detailed text. It may have a subtle header-like glow and frame, but the final Repository Signals text will be added by code.

Remove any second large top-right sign. On the right wall, include a smaller secondary dark panel intended for a later Code Lines overlay. Keep this panel simple, dark, and readable as a surface.

Keep supporting signage plausible and consistent with the approved blank: Shin-koenji, Tokyo Metro, Marunouchi Line, Safety First, Next: Minami-asagaya, Exit 1-4. Use Japanese station typography sparingly and naturally.

Aesthetic references: Ghost in the Shell 1995, Akira 1988, Ghost in the Shell 2 Innocence, Neo Tokyo, Perfect Blue, Metropolis 2002, Interstella 5555, The Boy and the Beast, Psycho-Pass, Armitage III, Appleseed, and Blade Runner-style cinematic lighting. Do not copy any exact frame, character, or composition. Use these only as mood references.

Wide header composition, no large foreground character, no motorcycle, no extreme neon overload, no sterile 3D render, no apocalypse grime, no soaking-wet mirror floor, no decorative sparkle icon, no loose random cable/device on the floor.
```

---

## 13. Recommended Overlay Prompt / Edit Prompt

Use this prompt when refining an image that already has the correct composition and sign surfaces.

```text
Refine the provided Tokyo subway platform image without changing the composition, camera angle, train placement, main sign surface, left vertical sign, Shin-koenji pillar sign, right service sign, right metro poster, or small toolchain panel.

Push the image closer to a cinematic Japanese cyberpunk anime background inspired by Ghost in the Shell, Akira, Psycho-Pass, Armitage III, Appleseed, Neo Tokyo, and late-80s/90s sci-fi anime production art. Do not copy any specific character, shot, or scene.

Keep the current warm/cool lighting balance, but reduce magenta neon intensity by about 10–15%. Let the dominant palette be muted blue-gray, green-blue, deep navy, concrete gray, pale cyan, and warm amber from train lights and station lamps. Preserve the calm, urban, slightly futuristic subway atmosphere.

Make the environment feel hand-painted and cinematic rather than glossy or AI-rendered: add subtle film grain, painted concrete texture, sharper ink-like linework, flatter cel-style shading, and stronger edge definition around pipes, train panels, signage frames, columns, ceiling conduits, and tile seams.

Keep the platform only lightly polished with mild reflections. Do not make it rainy, soaked, grimy, or dirty. The station should feel clean but lived-in.

Make the train look like working public transit: lightly worn metal, panel seams, small scuffs, tiny scratches, and warm interior window glow. Do not make it rusty, abandoned, or overly dirty.

Simplify commuters into understated anime-background figures: mostly silhouettes, minimal facial detail, subtle rim lighting, quiet urban mood.

Remove these elements:
- white sparkle/star icon in the bottom-right corner
- loose floor cable/device near the foreground person
- decorative starburst emblem on the train
- fake, garbled, or nonsensical text on the primary overlay surfaces

Leave the main overhead sign and smaller right-side toolchain panel as clean dark surfaces suitable for script-rendered overlays. Do not attempt to render the final Repository Signals text directly in the image.
```

---

## 14. Negative Prompt / Guardrails

Use these constraints to keep future iterations from drifting.

```text
Avoid: excessive neon, glossy synthwave poster look, clean sterile 3D render, heavy rain inside the station, flooded platform, mirror-like wet floor, abandoned decay, mold, trash piles, cyberpunk street market, giant hologram person, motorcycle, large anime protagonist close-up, unreadable text, fake gibberish on the main sign, random repository names, extra large top-right sign, too much magenta, too many signs, overly dark image, overly bright commercial lighting, decorative sparkle watermark, loose unexplained cable/device on the floor, duplicate overlay text baked into the base image.
```

---

## 15. Iteration Notes From Prior Versions

### Version: heavy neon subway

Result:

- Strong energy.
- Too much neon.
- Too clean and game-like.
- Felt more like a cyberpunk theme park than a believable station.

Keep:

- Vibrant color accents.
- Strong readable signage.

Discard:

- Excessive magenta/cyan saturation.
- Overcrowded sign system.
- Glossy hyper-clean finish.

### Version: Blade Runner / Ghost in the Shell darker platform

Result:

- Mood moved in the right direction.
- Too dark.
- Too dirty and wet in some versions.

Keep:

- Cinematic darkness.
- Industrial detail.
- Gritty transit atmosphere.

Adjust:

- Slightly more brightness.
- Less grime.
- Less wet floor.

### Version: cleaner subway

Result:

- More usable and readable.
- Less atmospheric.
- Slightly too clean and modern.

Keep:

- Legible sign placement.
- Balanced layout.
- Clear platform structure.

Adjust:

- Add back subtle film grain, hand-painted texture, haze, and analog mood.

### Version: preferred subway base with physical sign surfaces

Result:

- Good composition.
- Good sign placement.
- Right-side wall panel works.
- Better balance of readable and atmospheric.

Adjust:

- Shift away from modern glossy digital art.
- Add cel-painted anime background texture.
- Reduce slick reflection.
- Keep neon accents selective.
- Add subtle amber/orange contrast.
- Leave final sign content to overlays.

### Version: overlay-generated output

Result:

- Accurate text became possible.
- Repository Signals and Code Lines became reusable and script-driven.
- Some ghosting appeared when overlaying on a base image with baked-in text.
- Toolchain panel required tighter coordinate tuning.

Keep:

- Script-rendered data.
- Opaque sign panels.
- Static mode for design-locked output.
- Live mode for automated GitHub refresh.

Adjust:

- Use clean base image without duplicate overlay text.
- Tune coordinates in source-image pixels.
- Validate final image before writing.

---

## 16. Final Art Direction Summary

The ideal final image should feel like:

> A quiet late-night Shin-koenji subway platform from a lost 1990s cyberpunk anime film, later upgraded with a GitHub repository status board. The image should be cinematic, blue-green, slightly hazy, lightly worn, and readable. Neon exists, but it is not the entire personality. The station is alive, not abandoned; futuristic, not sterile; damp-looking, not flooded; detailed, not cluttered.

The final production image should separate mood and data:

- **Base image:** cinematic subway environment and sign surfaces.
- **Overlay script:** accurate Repository Signals and Code Lines content.

That separation is what prevents AI text corruption while preserving the image’s atmosphere.

---

## 17. Practical Export Guidance

### Recommended dimensions

For a GitHub-style social/profile header:

- Minimum: `1280 × 640`
- Preferred: `1600 × 800`
- Wider option: `1920 × 960`
- Current working asset family: approximately `1672 × 941`

### Composition safety

Keep the main sign readable at:

- 50% scale.
- GitHub preview crop.
- Mobile-width crop if applicable.

### Contrast check

Before final use:

- Desaturate the image briefly to check shape readability.
- Shrink to 640px wide and verify that the main sign still reads.
- Confirm there is no fake text corruption in the key sign areas.
- Confirm repo names and numbers are consistent.
- Confirm overlay panels align to physical sign surfaces.

### Recommended output process

1. Generate or choose the clean base subway image.
2. Save it as `assets/subway_blank_original.png`.
3. Run `generate-overlays.mjs` in static mode for a design-locked render.
4. Inspect `assets/signals.png` at full size and reduced preview size.
5. Run optimization if desired.
6. Commit only after validation passes.

---

## 18. Final Checklist

Before accepting a final render:

### Base image

- [ ] Subway platform composition is strong.
- [ ] Only one large top sign surface remains.
- [ ] Code Lines area appears on the smaller right wall panel.
- [ ] Scene is not too wet.
- [ ] Scene is not too dirty.
- [ ] Scene is not too clean.
- [ ] Neon is controlled.
- [ ] Overall palette leans blue-green with magenta and amber accents.
- [ ] The image feels cinematic and transit-real, not generic cyberpunk.
- [ ] No copyrighted characters, exact movie frames, or directly copied compositions.
- [ ] No decorative bottom-right sparkle icon.
- [ ] No loose unexplained floor cable/device.
- [ ] Station code is consistently `M03`, not bare `03`.
- [ ] No stale station text from earlier concepts remains.
- [ ] Tokyo Metro Marunouchi Line signage stays consistent with the approved blank.
- [ ] Service panel has one `24H OPEN`, not duplicate baked-in text.
- [ ] Small hanging sign is authored or visually non-readable.

### Overlay output

- [ ] Main overhead sign overlay is readable.
- [ ] Overlay coordinates align with the physical sign surface.
- [ ] Base image does not contain duplicate baked-in overlay text behind the generated overlay.
- [ ] No ghosting from previous generated overlays.
- [ ] Repo names are correct.
- [ ] Main sign shows the two most recently updated public owner repositories.
- [ ] Code Lines percentages are correct for the chosen mode.
- [ ] `JobSentinel` and `PyGuard` are visible in current static mode.
- [ ] Update ages are visible in static mode, or dynamic latest activity is intentional.
- [ ] Code Lines text is readable and not competing with the main sign.
- [ ] Sign overlays do not contain flat artificial noise or obvious scanline filters.
- [ ] Sign surfaces show some warm station-light reflection.
- [ ] Generated output passes PNG validation.
- [ ] Final output is checked at GitHub display size.

### README-scale QA

Inspect `assets/generated/debug-full-small.png` at 640px width:

- [ ] `REPOSITORY SIGNALS` reads.
- [ ] Repo names read.
- [ ] Key metrics read.
- [ ] Code Lines title is recognizable.
- [ ] Supporting signs do not look like AI text mush.

---

## 19. Maintenance Notes

### Static mode

Use static mode when the visual design should remain locked:

```bash
STATIC=1 OUTPUT_WIDTH=1672 npm run generate
```

Static mode is best for:

- final art review
- design consistency
- avoiding surprise metric changes
- comparing overlay alignment

### Live mode

Use live mode when the image should reflect current GitHub data:

```bash
GITHUB_TOKEN=your_token_here OUTPUT_WIDTH=1672 npm run generate
```

Live mode is best for:

- scheduled profile updates
- current repository activity
- real stars and activity timestamps
- dynamic language mix

### When to retune coordinates

Retune overlay coordinates when:

- the base image changes
- the image is cropped
- the image is resized before overlay generation
- sign surfaces move
- the model regenerates sign frames at slightly different sizes
- text looks pasted on rather than seated in the sign

### When to regenerate the base image

Regenerate the base image only if:

- composition is wrong
- sign surfaces are not usable
- generated text is too visible under overlays
- the image is too wet, too dirty, too clean, or too neon
- the train/platform relationship no longer works

Do not regenerate the base image just because overlay data changes. That is the overlay script’s job.
