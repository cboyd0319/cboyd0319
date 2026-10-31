export const USERNAME = "cboyd0319";

export const TOKYO_NEON_PALETTE = {
  indigo: "#252a57",
  blue: "#2b4f8b",
  midnight: "#180b26",
  cyan: "#248dbf",
  lavender: "#8a77b3",
  haze: "#cdcae1",
  ice: "#70bedd",
  magenta: "#7a2e69",
};

export const LANGUAGE_COLORS = new Map([
  ["Python",     TOKYO_NEON_PALETTE.cyan],
  ["JavaScript", TOKYO_NEON_PALETTE.haze],
  ["TypeScript", TOKYO_NEON_PALETTE.ice],
  ["PowerShell", TOKYO_NEON_PALETTE.blue],
  ["Shell",      TOKYO_NEON_PALETTE.lavender],
  ["Rust",       TOKYO_NEON_PALETTE.magenta],
  ["Go",         TOKYO_NEON_PALETTE.ice],
  ["Ruby",       TOKYO_NEON_PALETTE.magenta],
  ["C",          TOKYO_NEON_PALETTE.indigo],
  ["C++",        TOKYO_NEON_PALETTE.lavender],
  ["Java",       TOKYO_NEON_PALETTE.blue],
  ["Kotlin",     TOKYO_NEON_PALETTE.lavender],
  ["Swift",      TOKYO_NEON_PALETTE.magenta],
  ["HTML",       TOKYO_NEON_PALETTE.cyan],
  ["CSS",        TOKYO_NEON_PALETTE.indigo],
  ["Dockerfile", TOKYO_NEON_PALETTE.blue],
  ["Makefile",   TOKYO_NEON_PALETTE.cyan],
]);

export const OUTPUT_WIDTH = 1672;

export function envNumber(name, fallback) {
  if (!process.env[name]?.trim()) return fallback;
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
}

function rectQuad(box) {
  return [
    { x: box.left, y: box.top },
    { x: box.left + box.width, y: box.top },
    { x: box.left + box.width, y: box.top + box.height },
    { x: box.left, y: box.top + box.height },
  ];
}

function applyBoxEnv(box, prefix) {
  const adjusted = {
    ...box,
    left: envNumber(`${prefix}_LEFT`, box.left),
    top: envNumber(`${prefix}_TOP`, box.top),
    width: envNumber(`${prefix}_WIDTH`, box.width),
    height: envNumber(`${prefix}_HEIGHT`, box.height),
  };
  const geometryChanged = adjusted.left !== box.left
    || adjusted.top !== box.top
    || adjusted.width !== box.width
    || adjusted.height !== box.height;
  return {
    ...adjusted,
    quad: geometryChanged ? rectQuad(adjusted) : box.quad,
  };
}

export function applyLayoutEnv(layout) {
  return {
    ...layout,
    board: applyBoxEnv(layout.board, "BOARD"),
    toolchain: applyBoxEnv(layout.toolchain, "TOOLCHAIN"),
  };
}

export function staticRepos(staticData) {
  const units = { m: 60_000, h: 3_600_000, d: 86_400_000, w: 604_800_000, mo: 2_592_000_000 };
  return staticData.repos.map((repo) => {
    const age = typeof repo.updated === "string" && repo.updated.match(/^(\d+)(m|h|d|w|mo)\s+ago$/);
    const timestamp = age ? Date.UTC(2026, 0, 1) - Number(age[1]) * units[age[2]] : NaN;
    if (!Number.isFinite(new Date(timestamp).getTime())) throw new Error("Invalid static repository update age.");
    return {
      name: repo.name,
      language: repo.language,
      language_pct: repo.language_pct,
      updated_label: repo.updated,
      status: repo.status,
      pushed_at: new Date(timestamp).toISOString(),
      stargazers_count: repo.stars,
      fork: false,
      archived: false,
    };
  });
}
