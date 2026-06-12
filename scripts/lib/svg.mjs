import { USERNAME, LANGUAGE_COLORS, TOKYO_NEON_PALETTE } from "./config.mjs";
import { escapeHtml, relativeTime, shortText } from "./utils.mjs";

export const PANEL_ACCENTS = {
  TypeScript: "#CC8800",
  Python: "#CC8800",
  Shell: "#995C00",
  PowerShell: "#995C00",
  Other: "#7A5200",
};

const SIGN_COLORS = {
  textPrimary: "#FFB300",
  textSecondary: "#CC8800",
  accentAmber: "#FF3333",
  accentCyan: "#00FFCC",
  accentMagenta: "#FF00FF",
  marunouchiRed: "#E60012",
  ruleLine: "#222222",
};

const DISPLAY_ROUTE_CODE = "M03";
const STATUS_LED_GREEN = "#39FF14";
const TEXT_FONT_FAMILY = "'VT323','Courier New',monospace";
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
  return `@font-face{font-family:"VT323";src:url("${fontDataUrl}") format("truetype");font-weight:400;font-display:block;}`;
}

function svgHeader({ width, height, viewWidth, viewHeight, fontCss, fontDataUrl }) {
  return `<svg width="${width}" height="${height}" viewBox="0 0 ${viewWidth} ${viewHeight}" xmlns="http://www.w3.org/2000/svg">
<defs>
  <clipPath id="display-clip" clipPathUnits="userSpaceOnUse">
    <rect x="0" y="0" width="${viewWidth}" height="${viewHeight}"/>
  </clipPath>
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
  const dotX = 106;
  const dotY = detailY - 4;
  return `${text(updated, { x: 92, y, size: 16.1, fill: SIGN_COLORS.accentAmber, weight: 600, anchor: "end", opacity: emissiveOnly ? 0.86 : 0.88, style: "letter-spacing:0.025em" })}
${text(repoDisplayName(repo.name, true), { x: 118, y, size: 20.4, fill: SIGN_COLORS.textPrimary, weight: 600, opacity: emissiveOnly ? 0.9 : 0.96, style: "letter-spacing:0" })}
${text(language, { x: 430, y, size: 13.1, fill: SIGN_COLORS.textSecondary, weight: 500, anchor: "end", opacity: emissiveOnly ? 0.8 : 0.84, style: "letter-spacing:0.025em" })}
${emissiveOnly ? "" : `<circle data-status-led="${status}" cx="${dotX}" cy="${dotY}" r="4" fill="${dotColor}" opacity="${statusOpacity}" filter="url(#soft-glow)"/>`}
${text(status, { x: 118, y: detailY, size: 14.7, fill: statusFill, weight: 600, opacity: emissiveOnly ? Math.min(0.82, statusOpacity + 0.04) : Math.max(0.68, statusOpacity - 0.03), style: "letter-spacing:0.035em" })}
${text(`★ ${stars}`, { x: 430, y: detailY, size: 13.1, fill: SIGN_COLORS.textSecondary, weight: 600, anchor: "end", opacity: emissiveOnly ? 0.8 : 0.84, style: "letter-spacing:0.02em" })}`;
}

function stationCodeLabel({ emissiveOnly = false } = {}) {
  return `<g data-station-code="${DISPLAY_ROUTE_CODE}">
${text(DISPLAY_ROUTE_CODE, { x: 36, y: 39, size: 12.4, fill: SIGN_COLORS.textSecondary, weight: 600, opacity: emissiveOnly ? 0.8 : 0.76, style: "letter-spacing:0.045em" })}
</g>`;
}

export function renderRepositorySignSvg({ repos, allRepos, fontCss, fontDataUrl, width, height, outputWidth = width, outputHeight = height, emissiveOnly = false }) {
  const rowBaselines = [82, 126];
  const detailBaselines = [102, 146];

  const rows = repos.map((repo, index) => {
    const baseline = rowBaselines[index] ?? rowBaselines[rowBaselines.length - 1];
    const detailBaseline = detailBaselines[index] ?? detailBaselines[detailBaselines.length - 1];
    return `<g data-repo="${escapeHtml(repo.name)}">
  ${repoRowText(repo, { y: baseline, detailY: detailBaseline, index, emissiveOnly })}
</g>`;
  }).join("");

  const surface = "";
  const structure = emissiveOnly ? "" : `<line x1="36" y1="50" x2="456" y2="50" stroke="${SIGN_COLORS.marunouchiRed}" stroke-opacity="0.14" stroke-width="2" filter="url(#soft-glow)"/>
<line x1="36" y1="112" x2="456" y2="112" stroke="${SIGN_COLORS.ruleLine}" stroke-opacity="0.09"/>`;
  const displayTexture = "";

  return `${svgHeader({ width: outputWidth, height: outputHeight, viewWidth: width, viewHeight: height, fontCss, fontDataUrl })}
<rect width="${width}" height="${height}" fill="transparent"/>
<g clip-path="url(#display-clip)">
${surface}
<g>
${stationCodeLabel({ emissiveOnly })}
${text("REPOSITORY SIGNALS", { x: 72, y: 39, size: 12.4, fill: SIGN_COLORS.textPrimary, weight: 500, opacity: emissiveOnly ? 0.78 : 0.72, style: "letter-spacing:0.045em" })}
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
  const rowBaselines = [132, 166, 200, 234];
  const codeOpacities = [0.98, 0.96, 0.94, 0.92];
  const valueOpacities = [0.98, 0.96, 0.94, 0.92];
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
  ${text(compactName, { x: 20, y, size: 17.3, fill: SIGN_COLORS.textPrimary, weight: 600, opacity: emissiveOnly ? 0.88 : codeOpacities[index], style: "letter-spacing:0.012em" })}
  ${text(`${String(lang.pct)}%`, { x: 107, y, size: 13.2, fill: SIGN_COLORS.textPrimary, weight: 600, anchor: "end", opacity: emissiveOnly ? 0.88 : valueOpacities[index], style: "letter-spacing:0" })}
</g>`;
  }).join("");
  const surface = "";
  const displayTexture = "";

  return `${svgHeader({ width: outputWidth, height: outputHeight, viewWidth: width, viewHeight: height, fontCss, fontDataUrl })}
<rect width="${width}" height="${height}" fill="transparent"/>
<g clip-path="url(#display-clip)">
${surface}
<g>
${emissiveOnly ? "" : `<line x1="19" y1="58" x2="108" y2="58" stroke="${SIGN_COLORS.marunouchiRed}" stroke-opacity="0.17" stroke-width="2" filter="url(#soft-glow)"/>`}
${text("M03 SERVICE", { x: 20, y: 84, size: 11.7, fill: SIGN_COLORS.accentAmber, weight: 600, opacity: emissiveOnly ? 0.84 : 0.88, style: "letter-spacing:0.05em" })}
${text("CODE LINES", { x: 20, y: 111, size: 15.9, fill: SIGN_COLORS.textPrimary, weight: 600, opacity: emissiveOnly ? 0.92 : 0.98, style: "letter-spacing:0.04em" })}
${emissiveOnly ? "" : `<line x1="19" y1="146" x2="108" y2="146" stroke="${SIGN_COLORS.ruleLine}" stroke-opacity="0.085"/>
<line x1="19" y1="180" x2="108" y2="180" stroke="${SIGN_COLORS.ruleLine}" stroke-opacity="0.075"/>
<line x1="19" y1="214" x2="108" y2="214" stroke="${SIGN_COLORS.ruleLine}" stroke-opacity="0.065"/>`}
${signalRows}
</g>
${displayTexture}
</g>
</svg>`;
}
