# GitHub Copilot Instructions

Use [AGENTS.md](../AGENTS.md) as the primary repository guidance. This file
exists as the GitHub Copilot entrypoint and keeps Copilot aligned without
duplicating the full instruction set.

Core rules:

- Keep `README.md` limited to exactly two centered images:
  `assets/tokyo-neon-city.png` and `assets/signals.png`.
- Do not regenerate or replace `assets/tokyo-neon-city.png` unless explicitly
  asked for an art-direction change.
- Generate `assets/signals.png` from `assets/subway_blank_original.png`, public
  GitHub data, checked-in fonts, config, and layout geometry.
- Use ImageMagick 7.1.2-25 for all raster work. Do not reintroduce Sharp,
  resvg, browser screenshots, or custom JavaScript pixel compositing.
- Keep sign overlays as transparent text/mark plates. The source photo owns the
  dark sign glass, grime, frames, shadows, and ambient reflections.
- Use local validation for routine work. Do not manually dispatch GitHub
  Actions unless explicitly asked.
- Preserve hard pinning for Node, npm, ImageMagick, GitHub Actions, runners, and
  downloaded tools.
- Use public GitHub data only; never expose private repo names, tokens, raw logs,
  email addresses, employer data, or anything implying private access.

Task-specific repo skills live in `.agents/skills/`. Inspect the matching
`SKILL.md` before substantial profile media, ImageMagick, or automation work.
