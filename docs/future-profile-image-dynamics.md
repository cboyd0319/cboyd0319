# Dynamic Profile Image Options

## Scope

This document explores ways to make the two GitHub profile images more dynamic:

- `assets/tokyo-neon-city.png`: the top street-scene image.
- `assets/signals.png`: the bottom subway-signals image.

Current repository contract:

- The profile README contains exactly two centered images.
- `assets/signals.png` is generated from `assets/subway_blank_original.png`, public GitHub data, checked-in fonts, config, and layout geometry.
- `assets/tokyo-neon-city.png` is currently static and should not be regenerated unless the art direction intentionally changes.
- ImageMagick owns raster work. JavaScript should collect data, calculate layout, validate contracts, and emit SVG/text templates.
- Public GitHub data only. Do not expose private repo names, employer data, tokens, raw logs, emails, or anything implying private access.

The goal is not "more dashboard." The goal is more life, movement, and current context while preserving the cinematic image system.

## Current Dynamic Baseline

`signals.png` is already dynamic.

Current behavior:

- Daily workflow runs at `23:00 UTC`.
- It fetches public owner repositories from GitHub.
- It sorts by `pushed_at` descending.
- It excludes forks, archived repos, and the profile repo.
- It displays the top two most recently pushed public owner repos.
- It builds the Code Mix panel from public language data.
- It commits the generated `assets/signals.png` only if the image changes.

Current static behavior:

- `tokyo-neon-city.png` does not update.
- It is a committed static PNG.
- There is no script-generated overlay for it today.

## GitHub Profile Constraints

Useful constraints:

- GitHub README image rendering is static from the client point of view.
- No client-side JavaScript runs in a profile README.
- A committed PNG is reliable and cache-friendly.
- GIF/APNG can work as image files, but file size and visual noise can get ugly quickly.
- SVG can be dynamic only if served externally, which creates reliability, privacy, and caching concerns.
- Scheduled GitHub Actions are the cleanest path for low-cost, repo-owned updates.

Implication:

The best dynamic model is not "live in browser." It is "regenerate deterministic image assets on a schedule or trigger."

## Dynamic Data Sources

### Already In Use

Public GitHub REST data:

- Public owner repositories.
- `pushed_at`.
- Stars.
- Primary language.
- Language byte totals.

### Low-Risk Additions

Public GitHub repository metadata:

- Latest release tag and date.
- Open issue count for public repos.
- Repository description.
- Topics.
- Default branch.
- License.
- Created date.
- Last workflow status for public workflows, if accessible.

Derived local data:

- Previous render snapshot.
- Star delta since last render.
- Repo newly appeared since last render.
- Language share delta.
- Last displayed repo set.
- Last update timestamp.

Manual config:

- Featured project override.
- Pinned repo list.
- Seasonal visual theme.
- Preferred status vocabulary.
- Image-specific overlay copy.

### Riskier Additions

External data:

- Weather.
- Time of day.
- Calendar.
- Blog/RSS.
- Package registry downloads.
- Vulnerability/advisory data.

Risks:

- More API tokens.
- More failure modes.
- More privacy review.
- More chance profile feels gimmicky.

Recommendation:

Stay with GitHub public data and a small local snapshot first.

## Dynamic Dimensions

"Dynamic" can mean several different things. These are separate knobs.

| Dimension | Meaning | Low-risk example |
| --- | --- | --- |
| Data | Values change | Repo rows, stars, language mix |
| Selection | Which items appear changes | Latest two repos |
| State | Change since last render appears | `NEW`, `+3 stars`, language delta |
| Time | Display reacts to schedule | Nightly timestamp, weekly rotation |
| Theme | Visual treatment shifts | Amber intensity based on activity |
| Location narrative | In-world signage changes | Shop board shows current repo |
| Motion | Animated output | Usually avoid for this repo |
| Interaction | Viewer can query/change | Not practical in GitHub README |

## Option Set

## Option 1: Make `signals.png` More Data-Reactive

This preserves the current architecture and visual design.

Ideas:

- Add small `UPDATED 23:00 UTC` text somewhere quiet.
- Show `NEW` when a repo appears in the top two for the first time.
- Show `WATCH` / `ACTIVE` / `DEPS CHECK` based on public metadata or configured status.
- Show `RELEASE` if one of the displayed repos has a recent public release.
- Show star deltas from previous snapshot, for example `star +2`.
- Show language-share deltas in Code Mix, for example `Python 29% +1`.
- Show "route delay" metaphor if no public repo activity in N days.
- Rotate second row among recently active repos while first row remains latest.
- Add a tiny footer with local render timestamp.

Implementation shape:

- Add `config/profile-state.json`.
- During generation, fetch current public GitHub data.
- Compare against previous state.
- Render state markers into existing SVG layout.
- After successful render and validation, update state file in the same commit.

Pros:

- Uses existing pipeline.
- Low visual risk.
- Low CI cost.
- Easy to test with static fixtures.

Cons:

- Only bottom image changes.
- Too much metadata can make the sign feel like a dashboard.

Best first additions:

- Previous-state snapshot.
- New repo marker.
- Star delta.
- Quiet `UPDATED` timestamp.

## Option 2: Add Deterministic Overlays To `tokyo-neon-city.png`

This makes the top image dynamic without regenerating the whole artwork.

Candidate surfaces in the street image:

- Left chalkboard near bottom-left.
- Large `ShowBoat` sign.
- Center hanging street sign.
- Right-side menu boards.
- Small placards around the alley.
- Beer/restaurant signage areas.
- Crates or small tabletop cards.

Potential overlay concepts:

- A chalkboard line with current active repo.
- A small menu item showing top language.
- A hanging sign that changes between latest repo names.
- A tiny alley placard saying `BUILD PASS` or `INDEXED`.
- A shop-board route label that mirrors `M03 CODE MIX`.
- A small "tonight" board with `PyGuard`, `JobSentinel`, etc.

Implementation shape:

- Preserve original top image as a base, for example:
  - `assets/tokyo-neon-city_base.png`
  - generated output remains `assets/tokyo-neon-city.png`
- Add `config/layouts/tokyo-neon-city.json` with quads for chosen surfaces.
- Add `scripts/generate-city-overlays.mjs`.
- Reuse public GitHub data collection helpers.
- Render small SVG text plates.
- Perspective-warp with ImageMagick.
- Composite onto the top image.
- Validate output dimensions and README contract.

Pros:

- Both profile images feel alive.
- Keeps full image stable.
- Can be very subtle.
- Reuses the sign-compositing approach that now works.

Cons:

- Changes current "top image is static" repo contract.
- Requires careful surface selection and masking.
- Risk of clutter in already-dense street scene.

Recommendation:

If pursued, use only one or two tiny surfaces. The left chalkboard is likely the safest first target because it already contains readable text and is visually subordinate.

## Option 3: Shared Daily Data Snapshot Across Both Images

Both images update from the same public GitHub snapshot.

Example daily snapshot:

```json
{
  "generated_at": "2026-06-13T23:00:00Z",
  "featured_repo": "PyGuard",
  "secondary_repo": "WormsWMD-macOS",
  "top_language": "Python",
  "language_mix": {
    "Python": 29,
    "TypeScript": 26,
    "Rust": 24,
    "Other": 21
  }
}
```

Use in `signals.png`:

- Main board rows.
- Code Mix percentages.
- Status text.

Use in `tokyo-neon-city.png`:

- One small sign or chalkboard with `featured_repo`.
- One tiny marker for `top_language`.
- Maybe a quiet date or route code.

Pros:

- Cohesive.
- Easy to reason about.
- One data fetch for both assets.

Cons:

- Requires top-image generator.
- Requires snapshot and validation changes.

Recommendation:

This is the best medium-term direction if the top image should become dynamic.

## Option 4: Stateful Change Indicators

This makes the images reflect change over time, not just current state.

State file can track:

- Last displayed repos.
- Last star counts.
- Last language percentages.
- Last generated timestamp.
- Last release tags.

Possible visual language:

- `NEW ROUTE` for a newly displayed repo.
- `star +2` for star delta.
- `MIX SHIFT` for language change.
- `RELEASE` for a new public release.
- `STALE` if latest public push is older than threshold.

Pros:

- Feels genuinely dynamic.
- Makes daily changes meaningful.
- Works even if repo list stays same.

Cons:

- More logic and tests.
- State conflicts possible if manual edits and automation overlap.
- Needs deterministic behavior in static tests.

Implementation notes:

- Write state only after validation succeeds.
- Keep state small and public-safe.
- Never store raw API payloads.
- Store only what appears or what is needed for deltas.

## Option 5: Event-Triggered Refreshes

Current flow is daily plus manual dispatch.

Potential triggers:

- Daily schedule.
- Manual workflow dispatch.
- Repository dispatch from other repos.
- Push to any owned repo through a webhook or GitHub App.
- Release published event from selected repos.

Recommended triggers:

- Keep daily schedule.
- Keep manual dispatch.
- Add optional repository dispatch later if there is a strong need.

Avoid:

- Running on every push to every repo.
- Frequent cron, such as hourly.
- Expensive broad CI.

Reason:

Profile image updates are cosmetic. Daily is enough unless the image becomes a status board with a real operational purpose.

## Option 6: Rotating Content Modes

Instead of only "latest repos," rotate between modes.

Possible modes:

1. Latest activity.
2. Recently released.
3. Language mix.
4. Security tooling focus.
5. Repo maintenance.
6. Weekend static art mode.

Examples:

- Monday: latest activity.
- Wednesday: language mix.
- Friday: release/status board.
- Weekend: quieter image with fewer overlays.

Pros:

- More variety without more API sources.
- Can keep each image sparse.

Cons:

- Viewer may not understand why content changed.
- More test fixture permutations.
- More room for visual drift.

Recommendation:

Use only after the basic dynamic overlay system is stable.

## Option 7: Theme Shifts Without Text Changes

Make visuals respond subtly to data.

Examples:

- Higher recent activity slightly increases amber glow.
- Language family changes tiny accent color.
- A new repo adds a small red stamp.
- No recent activity dims the display slightly.
- Recent release adds a small warm reflection.

Pros:

- Feels alive without adding text.
- Good for top image.

Cons:

- Harder to validate.
- Easy to overdo.
- Users may not understand meaning.

Recommendation:

Good as supporting detail, not primary dynamic feature.

## Option 8: Generated Variants From A Stable Base

Keep several pre-approved base variants and rotate them.

Examples:

- `tokyo-neon-city-night.png`
- `tokyo-neon-city-rain-light.png`
- `tokyo-neon-city-late.png`
- `subway_blank_original.png`
- `subway_blank_alt-platform.png`

Pros:

- Visual freshness.
- No generative AI during scheduled runs.
- Easy to control quality.

Cons:

- Larger repo.
- More layout quads to maintain.
- More visual QA.

Recommendation:

Only worth it if current two-image look starts feeling stale.

## Option 9: Animation

Potential formats:

- GIF.
- APNG.
- Animated WebP if GitHub renders it reliably in context.

Possible animation:

- Very subtle flicker.
- Alternating sign rows.
- Slow scanline.
- Two-frame "board refresh."

Pros:

- Most obvious dynamic effect.

Cons:

- File size grows quickly.
- Can feel cheap.
- Distracts from profile.
- Harder to optimize.
- GitHub rendering and caching can be inconsistent across clients.

Recommendation:

Avoid for now. If tested, make it a separate experiment branch and keep under strict size limits.

## Option 10: External Live Image Endpoint

Serve image from a dynamic endpoint instead of committing PNG.

Examples:

- Cloudflare Worker returns generated SVG or PNG.
- GitHub README references external URL.
- Endpoint renders based on current data.

Pros:

- Truly dynamic.
- No commit churn.
- Can update on every page load or cache interval.

Cons:

- New service to maintain.
- More privacy/security surface.
- More caching ambiguity.
- External dependency on profile rendering.
- Goes against current repo-local simplicity.

Recommendation:

Do not use unless there is a strong reason to move beyond committed assets.

## Recommended Roadmap

## Phase 1: Strengthen `signals.png` Dynamics

Low-risk changes:

1. Add `config/profile-state.json`.
2. Track previous displayed repos and stars.
3. Add `NEW` marker when a repo first appears on the board.
4. Add tiny `UPDATED` footer or timestamp.
5. Add tests for state transitions.

Why first:

- Existing renderer already supports the bottom image.
- No new image surface selection.
- Most direct value.

## Phase 2: Add One Dynamic Top-Image Surface

Best candidate:

- Bottom-left chalkboard in `tokyo-neon-city.png`.

First overlay:

```text
TONIGHT
PyGuard
Python 29%
```

Alternative:

```text
LATEST ROUTE
PyGuard
ACTIVE
```

Implementation:

- Preserve `tokyo-neon-city.png` art as base or introduce `tokyo-neon-city_base.png`.
- Generate final `tokyo-neon-city.png` from the base.
- Use one quad.
- Keep overlay dim and in-world.
- Add visual validation crop.

Why second:

- More visually interesting.
- Still controllable.
- Proves top-image pipeline with minimal risk.

## Phase 3: Shared Snapshot

Create one snapshot used by both image generators.

Files:

- `assets/signals.png`
- `assets/tokyo-neon-city.png`
- `config/profile-state.json`
- `assets/generated/profile-data.json` or similar debug artifact, if ignored.

The snapshot should include only public-safe compact fields.

## Phase 4: Optional Release/Status Signals

Add public release or workflow status markers only if they remain visually calm.

Examples:

- `RELEASE`
- `BUILD OK`
- `WATCH`
- `DEPS CHECK`

Do not turn profile images into a CI dashboard.

## Best Candidate Features

Ranked by value:

1. `NEW` repo marker on `signals.png`.
2. Star delta from previous render.
3. `UPDATED` timestamp.
4. One top-image chalkboard overlay.
5. Shared daily snapshot.
6. Recent release marker.
7. Subtle theme shift based on activity.
8. Rotating content modes.
9. Pre-approved base variants.
10. Animation.
11. External live endpoint.

## Ranking By Looks Good And Easy

Scoring:

- `Looks good`: 1 is weak visual payoff, 5 is strong visual payoff.
- `Easy`: 1 is hard, 5 is easy.
- `Combined`: simple total of both scores.

This ranking favors changes that improve the profile visually without adding a fragile image pipeline.

| Rank | Option | Looks good | Easy | Combined | Why |
| --- | --- | ---: | ---: | ---: | --- |
| 1 | Tiny `UPDATED` timestamp on `signals.png` | 3 | 5 | 8 | Very easy, makes image feel current, low visual risk. |
| 2 | `NEW` marker for newly displayed repo | 4 | 4 | 8 | Feels alive and fits transit-board language. Needs small state file. |
| 3 | Star delta from previous render | 3 | 4 | 7 | Useful dynamic signal, easy once state exists. Keep visually tiny. |
| 4 | Shared daily data snapshot | 4 | 3 | 7 | Strong foundation for both images. More architecture than visual work. |
| 5 | One top-image chalkboard overlay | 5 | 2 | 7 | Best visual payoff, but needs new layout quad and city overlay QA. |
| 6 | Recent release marker | 4 | 3 | 7 | Good if repos use releases. Can feel empty if releases are rare. |
| 7 | Subtle activity-based theme shift | 4 | 2 | 6 | Could look excellent, but subjective and harder to validate. |
| 8 | Rotating content modes | 3 | 2 | 5 | Adds variety, but can confuse the meaning of the signs. |
| 9 | Pre-approved base variants | 5 | 1 | 6 | Strong visual change, but asset/layout maintenance cost is high. |
| 10 | Animation | 4 | 1 | 5 | Obvious dynamism, but likely too distracting and file-heavy. |
| 11 | External live image endpoint | 3 | 1 | 4 | Technically dynamic, but adds service risk and caching ambiguity. |

## Ranking By Visual Payoff Only

If the only criterion is "looks good":

1. One top-image chalkboard overlay.
2. Pre-approved base variants.
3. Subtle activity-based theme shift.
4. `NEW` marker for newly displayed repo.
5. Recent release marker.
6. Shared daily data snapshot.
7. Animation.
8. Star delta from previous render.
9. Tiny `UPDATED` timestamp.
10. Rotating content modes.
11. External live image endpoint.

Interpretation:

The top-image overlay wins visually because it makes both images participate in the same daily fiction. Base variants could look great too, but every variant creates new compositing and QA work.

## Ranking By Ease Only

If the only criterion is "easy":

1. Tiny `UPDATED` timestamp on `signals.png`.
2. `NEW` marker for newly displayed repo.
3. Star delta from previous render.
4. Recent release marker.
5. Shared daily data snapshot.
6. Rotating content modes.
7. One top-image chalkboard overlay.
8. Subtle activity-based theme shift.
9. Pre-approved base variants.
10. Animation.
11. External live image endpoint.

Interpretation:

Anything confined to `signals.png` is easier because the generator, layout, validation, and workflow already exist. Anything touching `tokyo-neon-city.png` needs new geometry, crops, and visual QA.

## Best First Batch

Best practical batch based on both looks and ease:

1. Add shared state file.
2. Add tiny `UPDATED` timestamp.
3. Add `NEW` marker for newly displayed repo.
4. Add star delta only when nonzero.

Then second batch:

1. Add one top-image chalkboard overlay.
2. Feed it from the same daily snapshot.
3. Keep it to one or two short lines.

Do not start with animation, external endpoints, or base variants. Those have bad effort-to-quality ratios right now.

## Suggested Visual Grammar

For `signals.png`:

- Keep transit-board table layout.
- Keep two repo rows.
- Use `ACTIVE`, `DEPS CHECK`, `NEW`, `RELEASE`, `WATCH`.
- Keep markers small.
- No charts.
- No badges.
- No full dashboard sections.

For `tokyo-neon-city.png`:

- Use existing real-world sign surfaces.
- Put dynamic content on one surface at a time.
- Keep text short.
- Use warm amber or chalkboard beige.
- Apply perspective warp.
- Add mild blur/noise.
- Never paste flat screen-space text.
- Avoid changing main street composition.

## Possible File Layout

If top image becomes generated:

```text
assets/tokyo-neon-city_base.png
assets/tokyo-neon-city.png
config/layouts/tokyo-neon-city.json
config/profile-state.json
scripts/generate-profile-data.mjs
scripts/generate-city-overlays.mjs
scripts/generate-overlays.mjs
scripts/optimize-signals.mjs
scripts/optimize-profile-images.mjs
```

Keep debug output ignored:

```text
assets/generated/
```

## Validation Needs

For `signals.png`:

- Existing `npm run validate`.
- Existing image dimensions.
- Generated SVG semantic checks.
- Static data fixtures.

For `tokyo-neon-city.png` if generated:

- Dimension check.
- README still has exactly two images.
- Overlay region changed only within approved sign surfaces.
- No output blankness.
- Debug crops generated for chosen surfaces.
- File size limit.
- Visual scale preview at 1000 px and 640 px widths.

For shared state:

- State schema validation.
- No private fields.
- Stable behavior when state missing.
- Stable behavior when GitHub API fails.
- Static mode deterministic tests.

## CI And Cost Guidance

Keep current principle:

- Local validation first.
- GitHub Actions minimal.
- No broad push/PR CI.
- Scheduled profile update remains image-scoped.
- Avoid manual workflow runs unless intentional.

Recommended frequency:

- Daily at `23:00 UTC` remains enough.

Potential manual path:

- `workflow_dispatch` after creating a new repo or release.

Avoid:

- Hourly schedule.
- Running full image generation on every commit.
- Calling many external APIs.
- Large matrix builds.

## Privacy And Security Rules

Use only:

- Public owner repositories.
- Public repo language data.
- Public releases.
- Public workflow/status data if used.

Do not use:

- Private repo names.
- Organization-only data.
- Employer/client names.
- Raw logs.
- Secret scanning details.
- Vulnerability details that imply private access.
- Tokens or emails.

State file must not become a raw cache. Store compact public-safe display facts only.

## Decision Matrix

| Option | Dynamic feel | Visual risk | Build complexity | CI cost | Recommended |
| --- | --- | --- | --- | --- | --- |
| Signals state markers | Medium | Low | Low | Low | Yes |
| Top chalkboard overlay | Medium | Medium | Medium | Low | Yes |
| Shared data snapshot | High | Low | Medium | Low | Yes |
| Release markers | Medium | Low | Medium | Low | Maybe |
| Theme shifts | Medium | Medium | Medium | Low | Maybe |
| Rotating modes | Medium | Medium | Medium | Low | Later |
| Base variants | High | Medium | High | Medium | Later |
| Animation | High | High | High | Medium | No |
| External endpoint | High | High | High | External | No |

## Recommended First Implementation Spec

Build a small dynamic layer without changing the current visual direction.

### Signals changes

Add:

- Previous-render state file.
- `NEW` marker for newly displayed repo.
- Optional star delta.
- Tiny `UPDATED` timestamp.

Keep:

- Two-row board.
- Code Mix panel.
- Current perspective and compositing.
- Current daily schedule.

### City image changes

Add:

- A checked-in clean base, for example `assets/tokyo-neon-city_base.png`, if the top image becomes generated.
- One deterministic overlay on the bottom-left chalkboard or another low-risk sign surface.
- Content derived from the same featured repo as `signals.png`.

Example:

```text
TONIGHT
PyGuard
ACTIVE
```

Keep:

- Full scene unchanged.
- No AI regeneration.
- One subtle overlay only.
- Top image mostly environmental, not software-heavy.

### State

Create:

```json
{
  "version": 1,
  "last_generated_at": "ISO timestamp",
  "displayed_repos": [
    {
      "name": "repo name",
      "stars": 0,
      "pushed_at": "ISO timestamp"
    }
  ],
  "language_mix": {
    "Python": 29
  }
}
```

Rules:

- Public-safe fields only.
- Missing state means no deltas, not failure.
- State updates only after render and validation.

## Answered Decisions

Answered decisions:

1. `tokyo-neon-city.png` can become generated, but only from a checked-in static base image. Treat it like the subway image: stable base plus deterministic ImageMagick overlay. Do not repeatedly regenerate the full artwork.
2. Show change markers. `NEW` and small star deltas are desirable because they prove the profile is alive without turning it into a dashboard.
3. Daily commit churn is acceptable. Keep the existing once-daily `23:00 UTC` cadence.
4. Keep both daily cron and `workflow_dispatch`. Manual dispatch is useful after a major release or new repo push, but daily automation should remain the default.
5. Keep top image content mostly environmental. Use one subtle projection/sign overlay tied to repo state, but preserve the gritty street-scene mood. Do not make the top image a literal software infographic.

Implementation consequence:

- Use the same ImageMagick perspective-warp method for the city overlay that already works for `signals.png`.
- Store only public-safe state in `state.json` or equivalent.
- Missing state should degrade gracefully: no deltas, no failure.
- Keep top-image overlay text short, dim, and physically attached to an existing sign surface.

## Bottom Line

Best path:

1. Keep the full artwork stable.
2. Make both images deterministic outputs from public GitHub data.
3. Add a small state snapshot for deltas.
4. Start with one subtle top-image overlay and a few tiny `signals.png` state markers.
5. Avoid animation, external live endpoints, and frequent CI.

This gives dynamic behavior without sacrificing the current visual quality.
