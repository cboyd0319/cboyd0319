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
  textPrimary: "#D8CFB8",
  textSecondary: "#B8AD92",
  accentAmber: "#D69A3A",
  accentCyan: "#6F817A",
  accentMagenta: "#6F5E68",
  marunouchiRed: "#78312E",
  ruleLine: "#2B3432",
};

const DISPLAY_ROUTE_CODE = "M03";

export function ownActiveRepos(allRepos) {
  return allRepos.filter((repo) => repo && !repo.fork && !repo.archived && repo.name !== USERNAME);
}

export function languageSummary(allRepos) {
  const activeRepos = ownActiveRepos(allRepos);
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

export function weeklyStreak(sparklines) {
  const byWeek = Array.from({ length: 10 }, (_, i) =>
    sparklines.reduce((sum, sparkline) => {
      const value = Number(sparkline?.[i] ?? 0);
      return sum + (Number.isFinite(value) && value > 0 ? value : 0);
    }, 0),
  );

  let streak = 0;
  for (let i = byWeek.length - 1; i >= 0; i--) {
    if (byWeek[i] > 0) streak++;
    else break;
  }
  return streak;
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
  <pattern id="scan" width="1" height="4" patternUnits="userSpaceOnUse">
    <rect x="0" y="0" width="1" height="1" fill="${SIGN_COLORS.textPrimary}" opacity="0.12"/>
  </pattern>
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
  <filter id="soft-glow" x="-20%" y="-40%" width="140%" height="180%">
    <feGaussianBlur stdDeviation="0.18" result="blur"/>
    <feMerge>
      <feMergeNode in="blur"/>
      <feMergeNode in="SourceGraphic"/>
    </feMerge>
  </filter>
  <filter id="displayNoise">
    <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="8" result="noise"/>
    <feColorMatrix in="noise" type="saturate" values="0"/>
    <feComponentTransfer>
      <feFuncA type="table" tableValues="0 0.045"/>
    </feComponentTransfer>
  </filter>
</defs>
<style>
${svgFontFace({ fontCss, fontDataUrl })}
text{font-family:"Noto Sans JP","Source Han Sans JP","IBM Plex Sans Condensed","IBM Plex Sans","DIN Condensed","Arial Narrow",sans-serif;text-rendering:geometricPrecision}
</style>`;
}

function text(value, { x, y, size, fill = SIGN_COLORS.textPrimary, weight = 600, anchor = "start", opacity = 1, style = "", extra = "" }) {
  const styleAttr = style ? `style="${escapeHtml(style)}"` : "";
  return `<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}" fill="${fill}" opacity="${opacity}" ${styleAttr} ${extra}>${escapeHtml(value)}</text>`;
}

function compactLanguage(language) {
  return {
    TypeScript: "TS",
    Python: "PY",
    Shell: "SH",
    PowerShell: "PS",
  }[language] ?? language;
}

function repoDisplayName(name, compact) {
  return shortText(name, compact ? 20 : 22);
}

function statusForRepo(repo, index) {
  if (repo.name === "WormsWMD-macOS-Fix") return "CHECK";
  if (repo.name === "PoshGuard") return "IDLE";
  return ["ON", "ON", "CHECK", "IDLE"][index] ?? "ON";
}

function repoRowText(repo, { y, index, emissiveOnly = false }) {
  const updated = (repo.updated_label || relativeTime(repo.pushed_at)).replace(/\s+ago$/i, "");
  const status = statusForRepo(repo, index);
  const statusFill = status === "CHECK" ? SIGN_COLORS.accentAmber : SIGN_COLORS.textSecondary;
  const statusOpacity = status === "IDLE" ? 0.58 : status === "CHECK" ? 0.8 : 0.68;
  return `${text(updated, { x: 16, y, size: 12.1, fill: SIGN_COLORS.accentAmber, weight: 500, opacity: emissiveOnly ? 0.82 : 0.72, style: "letter-spacing:0.035em" })}
${text(repoDisplayName(repo.name, true), { x: 56, y, size: 14.8, fill: SIGN_COLORS.textPrimary, weight: 500, opacity: emissiveOnly ? 1 : 0.98, style: "letter-spacing:0.018em" })}
${text(status, { x: 326, y, size: 12, fill: statusFill, weight: 500, opacity: emissiveOnly ? Math.min(0.9, statusOpacity + 0.1) : statusOpacity, style: "letter-spacing:0.04em" })}`;
}

function stationCodeLabel({ emissiveOnly = false } = {}) {
  return `<g data-station-code="${DISPLAY_ROUTE_CODE}">
${text(DISPLAY_ROUTE_CODE, { x: 16, y: 35, size: 12.8, fill: SIGN_COLORS.textSecondary, weight: 600, opacity: emissiveOnly ? 0.78 : 0.64, style: "letter-spacing:0.055em" })}
</g>`;
}

export function renderRepositorySignSvg({ repos, allRepos, sparklines, summary = null, fontCss, fontDataUrl, width, height, outputWidth = width, outputHeight = height, emissiveOnly = false }) {
  const activeRepos = ownActiveRepos(allRepos);
  const activeRepoCount = Number.isFinite(Number(summary?.activeRepos)) ? Number(summary.activeRepos) : activeRepos.length;
  const totalStars = Number.isFinite(Number(summary?.starsTotal))
    ? Number(summary.starsTotal)
    : activeRepos.reduce((sum, repo) => sum + Math.max(0, Number(repo.stargazers_count) || 0), 0);
  const rowBaselines = [70, 96, 122, 148];

  const rows = repos.map((repo, index) => {
    const baseline = rowBaselines[index] ?? rowBaselines[rowBaselines.length - 1];
    return `<g data-repo="${escapeHtml(repo.name)}">
  ${repoRowText(repo, { y: baseline, index, emissiveOnly })}
</g>`;
  }).join("");

  const surface = emissiveOnly ? "" : `<rect width="${width}" height="${height}" fill="${SIGN_COLORS.poweredWash}" opacity="0.064"/>
<rect width="${width}" height="${height}" fill="url(#panel-life)"/>
<rect width="${width}" height="${height}" fill="${SIGN_COLORS.glassHaze}" opacity="0.04"/>
<rect width="${width}" height="${height}" fill="url(#edge-falloff)"/>
<rect width="${width}" height="${height}" fill="url(#glass-sheen)" opacity="0.004"/>
<rect width="${width}" height="${height}" fill="url(#scan)" opacity="0.036"/>
<rect width="${width}" height="${height}" filter="url(#displayNoise)" opacity="0.026"/>`;
  const structure = emissiveOnly ? "" : `<line x1="16" y1="53" x2="486" y2="53" stroke="${SIGN_COLORS.marunouchiRed}" stroke-opacity="0.2" stroke-width="2" filter="url(#soft-glow)"/>
<line x1="16" y1="83" x2="486" y2="83" stroke="${SIGN_COLORS.ruleLine}" stroke-opacity="0.16"/>
<line x1="16" y1="109" x2="486" y2="109" stroke="${SIGN_COLORS.ruleLine}" stroke-opacity="0.15"/>
<line x1="16" y1="135" x2="486" y2="135" stroke="${SIGN_COLORS.ruleLine}" stroke-opacity="0.14"/>
<line x1="16" y1="154" x2="486" y2="154" stroke="${SIGN_COLORS.ruleLine}" stroke-opacity="0.12"/>`;

  return `${svgHeader({ width: outputWidth, height: outputHeight, viewWidth: width, viewHeight: height, fontCss, fontDataUrl })}
<rect width="${width}" height="${height}" fill="transparent"/>
<g clip-path="url(#display-clip)">
${surface}
<g>
${stationCodeLabel({ emissiveOnly })}
${text("REPOSITORY SIGNALS", { x: 50, y: 35, size: 12.8, fill: SIGN_COLORS.textPrimary, weight: 500, opacity: emissiveOnly ? 0.82 : 0.72, style: "letter-spacing:0.06em" })}
${text("新高円寺", { x: 478, y: 35, size: 9.4, fill: SIGN_COLORS.textSecondary, weight: 500, anchor: "end", opacity: emissiveOnly ? 0.78 : 0.68, style: 'letter-spacing:0.045em;font-family:"Noto Sans JP","Source Han Sans JP","Hiragino Sans","Yu Gothic",sans-serif' })}
${structure}
${rows}
</g>
</g>
</svg>`;
}

export function renderToolchainSpectrumSvg({ allRepos, fontCss, fontDataUrl, width, height, outputWidth = width, outputHeight = height, emissiveOnly = false }) {
  const langs = languageSummary(allRepos);
  const rowBaselines = [106, 132, 158, 184];
  const codeOpacities = [0.8, 0.8, 0.74, 0.72];
  const valueOpacities = [0.7, 0.7, 0.64, 0.62];
  const signalRows = langs.map((lang, index) => {
    const y = rowBaselines[index] ?? rowBaselines[rowBaselines.length - 1];
    const compactName = {
      TypeScript: "TS",
      Python: "PY",
      Shell: "SH",
      PowerShell: "PS",
    }[lang.name] ?? lang.name;
    return `<g data-lang="${escapeHtml(lang.name)}">
  ${text(compactName, { x: 28, y, size: 15.2, fill: SIGN_COLORS.textSecondary, weight: 500, opacity: emissiveOnly ? Math.min(0.9, codeOpacities[index] + 0.08) : codeOpacities[index], style: "letter-spacing:0.07em" })}
  ${text(`${String(lang.pct)}%`, { x: 56, y, size: 15.2, fill: SIGN_COLORS.textSecondary, weight: 500, opacity: emissiveOnly ? Math.min(0.78, valueOpacities[index] + 0.08) : valueOpacities[index], style: "letter-spacing:0.07em" })}
</g>`;
  }).join("");
  const surface = emissiveOnly ? "" : `<rect width="${width}" height="${height}" fill="${SIGN_COLORS.poweredWash}" opacity="0.076"/>
<rect width="${width}" height="${height}" fill="url(#panel-life)"/>
<rect width="${width}" height="${height}" fill="${SIGN_COLORS.glassHaze}" opacity="0.044"/>
<rect width="${width}" height="${height}" fill="url(#edge-falloff)"/>
<rect width="${width}" height="${height}" fill="url(#glass-sheen)" opacity="0.004"/>
<rect width="${width}" height="${height}" fill="url(#scan)" opacity="0.036"/>
<rect width="${width}" height="${height}" filter="url(#displayNoise)" opacity="0.026"/>`;

  return `${svgHeader({ width: outputWidth, height: outputHeight, viewWidth: width, viewHeight: height, fontCss, fontDataUrl })}
<rect width="${width}" height="${height}" fill="transparent"/>
<g clip-path="url(#display-clip)">
${surface}
<g>
${emissiveOnly ? "" : `<line x1="28" y1="45" x2="120" y2="45" stroke="${SIGN_COLORS.marunouchiRed}" stroke-opacity="0.2" stroke-width="2" filter="url(#soft-glow)"/>`}
${text("M03 SERVICE", { x: 28, y: 63, size: 10.6, fill: SIGN_COLORS.accentAmber, weight: 500, opacity: emissiveOnly ? 0.86 : 0.74, style: "letter-spacing:0.075em" })}
${text("TOOLCHAIN", { x: 28, y: 82, size: 13.2, fill: SIGN_COLORS.textPrimary, weight: 500, opacity: emissiveOnly ? 0.9 : 0.8, style: "letter-spacing:0.075em" })}
${signalRows}
</g>
</g>
</svg>`;
}
