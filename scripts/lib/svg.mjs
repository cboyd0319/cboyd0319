import { USERNAME, LANGUAGE_COLORS, TOKYO_NEON_PALETTE } from "./config.mjs";
import { escapeHtml, relativeTime, shortText } from "./utils.mjs";

export const PANEL_ACCENTS = {
  TypeScript: "#B8AD92",
  Python: "#B8AD92",
  Shell: "#9C917A",
  PowerShell: "#9C917A",
  Other: "#8B887A",
};

const SIGN_COLORS = {
  glassHaze: "#172327",
  poweredWash: "#2F3C35",
  edgeDarken: "#000000",
  textPrimary: "#D8BE8C",
  textSecondary: "#B99C76",
  accentAmber: "#E0A047",
  accentCyan: "#6F817A",
  accentMagenta: "#6F5E68",
  marunouchiRed: "#78312E",
  ruleLine: "#2B3432",
};

const DISPLAY_ROUTE_CODE = "M03";
const STATUS_LED_GREEN = "#39FF14";
const TEXT_FONT_FAMILY = "'Noto Sans JP','Source Han Sans JP','Hiragino Sans','Yu Gothic','Helvetica Neue',Arial,sans-serif";
const REPOSITORY_BOARD_NAME_MAX = 17;

export function ownActiveRepos(allRepos) {
  return allRepos.filter((repo) => repo && !repo.fork && !repo.archived && repo.name !== USERNAME);
}

export function languageSummary(allRepos) {
  const activeRepos = ownActiveRepos(allRepos);
  const languageMaps = activeRepos.map((repo) => repo.languages).filter(isLanguageMap);

  if (languageMaps.length && languageMaps.length === activeRepos.length) {
    const totals = new Map();
    for (const languages of languageMaps) {
      for (const [language, bytes] of Object.entries(languages)) {
        const count = Number(bytes);
        if (!Number.isFinite(count) || count <= 0) continue;
        totals.set(language, (totals.get(language) || 0) + count);
      }
    }
    if (totals.size) return summarizeLanguageEntries([...totals.entries()]);
  }

  const weighted = activeRepos.filter((repo) => repo.language && Number.isFinite(Number(repo.language_pct)));

  if (weighted.length) {
    const totals = new Map();
    for (const repo of weighted) {
      totals.set(repo.language, (totals.get(repo.language) || 0) + Math.max(0, Number(repo.language_pct)));
    }

    return summarizeLanguageEntries([...totals.entries()], { sort: false });
  }

  const counts = new Map();
  for (const repo of activeRepos) {
    if (!repo.language) continue;
    counts.set(repo.language, (counts.get(repo.language) || 0) + 1);
  }

  return summarizeLanguageEntries([...counts.entries()]);
}

function isLanguageMap(value) {
  return value && !Array.isArray(value) && typeof value === "object";
}

function summarizeLanguageEntries(entries, { sort = true } = {}) {
  const sorted = sort ? entries.sort((a, b) => b[1] - a[1]) : entries;
  const total = sorted.reduce((sum, [, count]) => sum + count, 0) || 1;
  const summarized = sorted.length > 4
    ? [
        ...sorted.slice(0, 3),
        ["Other", sorted.slice(3).reduce((sum, [, count]) => sum + count, 0)],
      ]
    : sorted;

  return summarized.map(([name, count]) => ({
    name,
    pct: Math.round((count / total) * 100),
    color: PANEL_ACCENTS[name] || LANGUAGE_COLORS.get(name) || TOKYO_NEON_PALETTE.lavender,
  }));
}

function svgFontFace({ fontCss, fontDataUrl }) {
  if (fontCss) return fontCss;
  if (!fontDataUrl) return "";
  return `@font-face{font-family:"Noto Sans JP";src:url("${fontDataUrl}") format("woff2");font-weight:500 700;font-display:block;}`;
}

function svgHeader({ width, height, viewWidth, viewHeight, fontCss, fontDataUrl }) {
  return `<svg width="${width}" height="${height}" viewBox="0 0 ${viewWidth} ${viewHeight}" xmlns="http://www.w3.org/2000/svg">
<defs>
  <clipPath id="display-clip" clipPathUnits="userSpaceOnUse">
    <rect x="0" y="0" width="${viewWidth}" height="${viewHeight}"/>
  </clipPath>
  <radialGradient id="edge-falloff" cx="50%" cy="46%" r="82%">
    <stop offset="0%" stop-color="${SIGN_COLORS.edgeDarken}" stop-opacity="0"/>
    <stop offset="72%" stop-color="${SIGN_COLORS.edgeDarken}" stop-opacity="0.02"/>
    <stop offset="100%" stop-color="${SIGN_COLORS.edgeDarken}" stop-opacity="0.14"/>
  </radialGradient>
  <radialGradient id="panel-life" cx="44%" cy="48%" r="86%">
    <stop offset="0%" stop-color="${SIGN_COLORS.poweredWash}" stop-opacity="0.075"/>
    <stop offset="56%" stop-color="${SIGN_COLORS.poweredWash}" stop-opacity="0.028"/>
    <stop offset="100%" stop-color="${SIGN_COLORS.poweredWash}" stop-opacity="0"/>
  </radialGradient>
  <linearGradient id="glass-sheen" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="${SIGN_COLORS.textPrimary}" stop-opacity="0.04"/>
    <stop offset="30%" stop-color="${SIGN_COLORS.textPrimary}" stop-opacity="0.006"/>
    <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
  </linearGradient>
  <pattern id="ui-scanline" width="1" height="5" patternUnits="userSpaceOnUse">
    <rect x="0" y="0" width="1" height="1" fill="${SIGN_COLORS.textPrimary}" opacity="0.11"/>
  </pattern>
  <filter id="soft-glow" x="-20%" y="-40%" width="140%" height="180%">
    <feGaussianBlur stdDeviation="0.18" result="blur"/>
    <feMerge>
      <feMergeNode in="blur"/>
      <feMergeNode in="SourceGraphic"/>
    </feMerge>
  </filter>
</defs>
<style>
${svgFontFace({ fontCss, fontDataUrl })}
text{font-family:${TEXT_FONT_FAMILY};text-rendering:geometricPrecision}
</style>`;
}

function text(value, { x, y, size, fill = SIGN_COLORS.textPrimary, weight = 600, anchor = "start", opacity = 1, style = "", extra = "" }) {
  const styleAttr = style ? `style="${escapeHtml(style)}"` : "";
  return `<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" font-family="${TEXT_FONT_FAMILY}" text-anchor="${anchor}" fill="${fill}" opacity="${opacity}" ${styleAttr} ${extra}>${escapeHtml(value)}</text>`;
}

function repoDisplayName(name, compact) {
  return shortText(name, compact ? REPOSITORY_BOARD_NAME_MAX : 24);
}

function statusForRepo(index) {
  return ["ON", "CHECK", "IDLE"][index] ?? "IDLE";
}

function repoRowText(repo, { y, detailY, index, emissiveOnly = false }) {
  const updated = (repo.updated_label || relativeTime(repo.pushed_at)).replace(/\s+ago$/i, "");
  const status = statusForRepo(index);
  const statusFill = status === "CHECK" ? SIGN_COLORS.accentAmber : SIGN_COLORS.textSecondary;
  const dotColor = status === "ON" ? STATUS_LED_GREEN : statusFill;
  const statusOpacity = status === "IDLE" ? 0.64 : status === "CHECK" ? 0.86 : 0.74;
  const language = shortText(repo.language || "PUBLIC", 14);
  const stars = Math.max(0, Number(repo.stargazers_count) || 0);
  const dotX = 98;
  const dotY = detailY - 4;
  return `${text(updated, { x: 82, y, size: 16.6, fill: SIGN_COLORS.accentAmber, weight: 600, anchor: "end", opacity: emissiveOnly ? 1 : 0.96, style: "letter-spacing:0.025em" })}
${text(repoDisplayName(repo.name, true), { x: 110, y, size: 22.2, fill: SIGN_COLORS.textPrimary, weight: 600, opacity: emissiveOnly ? 1 : 0.99, style: "letter-spacing:0" })}
${text(language, { x: 420, y, size: 14.8, fill: SIGN_COLORS.textSecondary, weight: 500, anchor: "end", opacity: emissiveOnly ? 0.98 : 0.94, style: "letter-spacing:0.025em" })}
${emissiveOnly ? "" : `<circle data-status-led="${status}" cx="${dotX}" cy="${dotY}" r="4" fill="${dotColor}" opacity="${statusOpacity}" filter="url(#soft-glow)"/>`}
${text(status, { x: 110, y: detailY, size: 15.2, fill: statusFill, weight: 600, opacity: emissiveOnly ? Math.min(0.92, statusOpacity + 0.08) : statusOpacity, style: "letter-spacing:0.035em" })}
${text(`★ ${stars}`, { x: 420, y: detailY, size: 14.8, fill: SIGN_COLORS.textSecondary, weight: 600, anchor: "end", opacity: emissiveOnly ? 0.98 : 0.94, style: "letter-spacing:0.02em" })}`;
}

function stationCodeLabel({ emissiveOnly = false } = {}) {
  return `<g data-station-code="${DISPLAY_ROUTE_CODE}">
${text(DISPLAY_ROUTE_CODE, { x: 36, y: 29, size: 12.8, fill: SIGN_COLORS.textSecondary, weight: 600, opacity: emissiveOnly ? 0.94 : 0.86, style: "letter-spacing:0.045em" })}
</g>`;
}

export function renderRepositorySignSvg({ repos, allRepos, fontCss, fontDataUrl, width, height, outputWidth = width, outputHeight = height, emissiveOnly = false }) {
  const rowBaselines = [72, 123];
  const detailBaselines = [96, 147];

  const rows = repos.map((repo, index) => {
    const baseline = rowBaselines[index] ?? rowBaselines[rowBaselines.length - 1];
    const detailBaseline = detailBaselines[index] ?? detailBaselines[detailBaselines.length - 1];
    return `<g data-repo="${escapeHtml(repo.name)}">
  ${repoRowText(repo, { y: baseline, detailY: detailBaseline, index, emissiveOnly })}
</g>`;
  }).join("");

  const surface = emissiveOnly ? "" : `<rect width="${width}" height="${height}" fill="${SIGN_COLORS.poweredWash}" opacity="0.012"/>
<rect width="${width}" height="${height}" fill="url(#panel-life)" opacity="0.72"/>
<rect width="${width}" height="${height}" fill="url(#edge-falloff)" opacity="0.08"/>`;
  const structure = emissiveOnly ? "" : `<line x1="36" y1="47" x2="456" y2="47" stroke="${SIGN_COLORS.marunouchiRed}" stroke-opacity="0.2" stroke-width="2" filter="url(#soft-glow)"/>
<line x1="36" y1="107" x2="456" y2="107" stroke="${SIGN_COLORS.ruleLine}" stroke-opacity="0.12"/>`;
  const displayTexture = emissiveOnly ? "" : `<rect width="${width}" height="${height}" fill="url(#ui-scanline)" opacity="0.018"/>`;

  return `${svgHeader({ width: outputWidth, height: outputHeight, viewWidth: width, viewHeight: height, fontCss, fontDataUrl })}
<rect width="${width}" height="${height}" fill="transparent"/>
<g clip-path="url(#display-clip)">
${surface}
<g>
${stationCodeLabel({ emissiveOnly })}
${text("REPOSITORY SIGNALS", { x: 72, y: 29, size: 12.8, fill: SIGN_COLORS.textPrimary, weight: 500, opacity: emissiveOnly ? 0.86 : 0.78, style: "letter-spacing:0.045em" })}
${structure}
${rows}
</g>
${displayTexture}
</g>
</svg>`;
}

export function renderToolchainSpectrumSvg({ allRepos, fontCss, fontDataUrl, width, height, outputWidth = width, outputHeight = height, emissiveOnly = false }) {
  const langs = languageSummary(allRepos)
    .map((lang, index) => ({ ...lang, index }))
    .sort((a, b) => b.pct - a.pct || a.index - b.index);
  const rowBaselines = [118, 156, 194, 232];
  const codeOpacities = [1, 0.99, 0.98, 0.97];
  const nameOpacities = [0.93, 0.92, 0.91, 0.9];
  const valueOpacities = [1, 0.99, 0.98, 0.97];
  const signalRows = langs.map((lang, index) => {
    const y = rowBaselines[index] ?? rowBaselines[rowBaselines.length - 1];
    const compactName = {
      TypeScript: "TS",
      JavaScript: "JS",
      Python: "PY",
      Shell: "SH",
      PowerShell: "PS",
      Rust: "RS",
      Ruby: "RB",
      Dockerfile: "DK",
      Makefile: "MK",
      Other: "OT",
    }[lang.name] ?? lang.name;
    return `<g data-lang="${escapeHtml(lang.name)}">
  ${text(compactName, { x: 16, y, size: 17.2, fill: SIGN_COLORS.textPrimary, weight: 600, opacity: emissiveOnly ? 1 : codeOpacities[index], style: "letter-spacing:0.012em" })}
  ${text(shortText(lang.name, 10), { x: 39, y, size: 6.4, fill: SIGN_COLORS.textSecondary, weight: 500, opacity: emissiveOnly ? 0.94 : nameOpacities[index], style: "letter-spacing:0" })}
  ${text(`${String(lang.pct)}%`, { x: 114, y, size: 13.2, fill: SIGN_COLORS.textPrimary, weight: 600, anchor: "end", opacity: emissiveOnly ? 1 : valueOpacities[index], style: "letter-spacing:0" })}
</g>`;
  }).join("");
  const surface = emissiveOnly ? "" : `<rect width="${width}" height="${height}" fill="${SIGN_COLORS.poweredWash}" opacity="0.018"/>
<rect width="${width}" height="${height}" fill="url(#panel-life)" opacity="0.62"/>
<rect width="${width}" height="${height}" fill="${SIGN_COLORS.glassHaze}" opacity="0.006"/>
<rect width="${width}" height="${height}" fill="url(#edge-falloff)" opacity="0.22"/>`;
  const displayTexture = emissiveOnly ? "" : `<rect width="${width}" height="${height}" fill="url(#ui-scanline)" opacity="0.016"/>`;

  return `${svgHeader({ width: outputWidth, height: outputHeight, viewWidth: width, viewHeight: height, fontCss, fontDataUrl })}
<rect width="${width}" height="${height}" fill="transparent"/>
<g clip-path="url(#display-clip)">
${surface}
<g>
${emissiveOnly ? "" : `<line x1="16" y1="44" x2="114" y2="44" stroke="${SIGN_COLORS.marunouchiRed}" stroke-opacity="0.2" stroke-width="2" filter="url(#soft-glow)"/>`}
${text("M03 SERVICE", { x: 16, y: 66, size: 11.8, fill: SIGN_COLORS.accentAmber, weight: 600, opacity: emissiveOnly ? 0.98 : 0.94, style: "letter-spacing:0.05em" })}
${text("CODE LINES", { x: 16, y: 91, size: 15.8, fill: SIGN_COLORS.textPrimary, weight: 600, opacity: emissiveOnly ? 1 : 0.98, style: "letter-spacing:0.04em" })}
${emissiveOnly ? "" : `<line x1="16" y1="135" x2="114" y2="135" stroke="${SIGN_COLORS.ruleLine}" stroke-opacity="0.1"/>
<line x1="16" y1="173" x2="114" y2="173" stroke="${SIGN_COLORS.ruleLine}" stroke-opacity="0.085"/>
<line x1="16" y1="211" x2="114" y2="211" stroke="${SIGN_COLORS.ruleLine}" stroke-opacity="0.07"/>`}
${signalRows}
</g>
${displayTexture}
</g>
</svg>`;
}
