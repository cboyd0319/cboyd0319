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
  textPrimary: "#D6A33A",
  textSecondary: "#A56F22",
  alertRed: "#D94132",
  marunouchiRed: "#D91F2B",
  ruleLine: "#242018",
};

const DISPLAY_ROUTE_CODE = "M03";
const STATUS_LED_GREEN = "#7FB95A";
const TEXT_FONT_FAMILY = "'Noto Sans JP','Source Han Sans JP','Hiragino Sans','Yu Gothic','Helvetica Neue',Arial,sans-serif";
const REPOSITORY_BOARD_NAME_MAX = 18;
const BOARD_COLS = {
  time: 64,
  statusDot: 88,
  status: 98,
  repo: 178,
  language: 405,
  stars: 455,
};

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
  <filter id="soft-glow" x="-20%" y="-40%" width="140%" height="180%">
    <feGaussianBlur stdDeviation="0.18" result="blur"/>
    <feMerge>
      <feMergeNode in="blur"/>
      <feMergeNode in="SourceGraphic"/>
    </feMerge>
  </filter>
  <pattern id="unlit-leds" width="4" height="4" patternUnits="userSpaceOnUse">
    <circle cx="2" cy="2" r="1.35" fill="#111111" opacity="0.22"/>
  </pattern>
  <radialGradient id="screen-falloff" cx="50%" cy="45%" r="75%">
    <stop offset="0%" stop-color="white" stop-opacity="0"/>
    <stop offset="100%" stop-color="#000000" stop-opacity="0.22"/>
  </radialGradient>
</defs>
<style>
${svgFontFace({ fontCss, fontDataUrl })}
text{font-family:${TEXT_FONT_FAMILY};text-rendering:geometricPrecision}
</style>`;
}

function text(value, { x, y, size, fill = SIGN_COLORS.textPrimary, weight = 600, anchor = "start", opacity = 1, style = "", extra = "", shadow = false }) {
  const styleAttr = style ? `style="${escapeHtml(style)}"` : "";
  const mainText = `<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" font-family="${TEXT_FONT_FAMILY}" text-anchor="${anchor}" fill="${fill}" opacity="${opacity}" ${styleAttr} ${extra}>${escapeHtml(value)}</text>`;
  if (!shadow) return mainText;
  const shadowText = `<text x="${x + 1.5}" y="${y + 1.5}" font-size="${size}" font-weight="${weight}" font-family="${TEXT_FONT_FAMILY}" text-anchor="${anchor}" fill="#000000" opacity="0.6" ${styleAttr} ${extra}>${escapeHtml(value)}</text>`;
  return `${shadowText}
${mainText}`;
}

function repoDisplayName(name, compact) {
  const displayName = String(name ?? "").replace(/-fix$/i, "");
  return shortText(displayName, compact ? REPOSITORY_BOARD_NAME_MAX : 24);
}

function statusForRepo(repo, index) {
  const configured = String(repo?.security_status || repo?.status || "").trim();
  if (configured) return configured.toUpperCase();
  const alerts = Number(repo?.dependabot_alerts ?? repo?.security_alerts ?? repo?.vulnerability_alerts ?? 0);
  if (Number.isFinite(alerts) && alerts > 0) return "DEPS CHECK";
  if (repo?.archived) return "ARCHIVED";
  return index === 0 ? "ACTIVE" : "DEPS CHECK";
}

function repoRowText(repo, { y, index, emissiveOnly = false }) {
  const updated = (repo.updated_label || relativeTime(repo.pushed_at)).replace(/\s+ago$/i, "");
  const status = statusForRepo(repo, index);
  const alertStatus = /CHECK|WARN|REVIEW|FAIL|ARCHIVED/.test(status);
  const statusFill = alertStatus ? SIGN_COLORS.alertRed : SIGN_COLORS.textSecondary;
  const dotColor = status === "ACTIVE" ? STATUS_LED_GREEN : statusFill;
  const statusOpacity = status === "IDLE" ? 0.58 : alertStatus ? 0.8 : 0.7;
  const language = shortText(repo.language || "PUBLIC", 14);
  const stars = Math.max(0, Number(repo.stargazers_count) || 0);
  const dotX = BOARD_COLS.statusDot;
  const dotY = y - 5;
  const statusSize = status.length > 7 ? 9.4 : 10.8;
  return `${text(updated, { x: BOARD_COLS.time, y, size: 12.5, fill: SIGN_COLORS.textSecondary, weight: 600, anchor: "end", opacity: emissiveOnly ? 0.68 : 0.64, style: "letter-spacing:0.025em" })}
${emissiveOnly ? "" : `<circle cx="${dotX + 1.5}" cy="${dotY + 1.5}" r="3" fill="#000000" opacity="0.55"/>`}
${emissiveOnly ? "" : `<circle data-status-led="${status}" cx="${dotX}" cy="${dotY}" r="3" fill="${dotColor}" opacity="${statusOpacity}" filter="url(#soft-glow)"/>`}
${text(status, { x: BOARD_COLS.status, y, size: statusSize, fill: statusFill, weight: 600, opacity: emissiveOnly ? Math.min(0.78, statusOpacity + 0.04) : Math.max(0.7, statusOpacity), style: "letter-spacing:0.01em" })}
${text(repoDisplayName(repo.name, true), { x: BOARD_COLS.repo, y, size: 15.6, fill: SIGN_COLORS.textPrimary, weight: 600, opacity: emissiveOnly ? 0.88 : 0.96, style: "letter-spacing:0", shadow: !emissiveOnly })}
${text(language, { x: BOARD_COLS.language, y, size: 10.4, fill: SIGN_COLORS.textSecondary, weight: 500, anchor: "end", opacity: emissiveOnly ? 0.74 : 0.82, style: "letter-spacing:0.018em" })}
${text(`★ ${stars}`, { x: BOARD_COLS.stars, y, size: 10.4, fill: SIGN_COLORS.textSecondary, weight: 600, anchor: "end", opacity: emissiveOnly ? 0.74 : 0.82, style: "letter-spacing:0.02em", shadow: !emissiveOnly })}`;
}

export function renderRepositorySignSvg({ repos, allRepos, fontCss, fontDataUrl, width, height, outputWidth = width, outputHeight = height, emissiveOnly = false }) {
  const rowBaselines = [91, 127];

  const rows = repos.map((repo, index) => {
    const baseline = rowBaselines[index] ?? rowBaselines[rowBaselines.length - 1];
    return `<g data-repo="${escapeHtml(repo.name)}">
  ${repoRowText(repo, { y: baseline, index, emissiveOnly })}
</g>`;
  }).join("");

  const surface = emissiveOnly ? "" : `<rect width="${width}" height="${height}" fill="url(#unlit-leds)" opacity="0.11"/>`;
  const glassWash = emissiveOnly ? "" : `<rect width="${width}" height="${height}" fill="#050403" opacity="0.08"/>`;
  const screenFalloff = emissiveOnly ? "" : `<rect width="${width}" height="${height}" fill="url(#screen-falloff)" opacity="0.16"/>`;
  const structure = emissiveOnly ? "" : `<line x1="37.5" y1="51.5" x2="457.5" y2="51.5" stroke="#000000" stroke-opacity="0.4" stroke-width="2"/>
<line x1="36" y1="50" x2="456" y2="50" stroke="${SIGN_COLORS.marunouchiRed}" stroke-opacity="0.55" stroke-width="2" filter="url(#soft-glow)"/>
<line x1="37.5" y1="113.5" x2="457.5" y2="113.5" stroke="#000000" stroke-opacity="0.3" stroke-width="1"/>
<line x1="36" y1="112" x2="456" y2="112" stroke="${SIGN_COLORS.ruleLine}" stroke-opacity="0.09"/>`;
  const displayTexture = "";

  return `${svgHeader({ width: outputWidth, height: outputHeight, viewWidth: width, viewHeight: height, fontCss, fontDataUrl })}
<rect width="${width}" height="${height}" fill="transparent"/>
<g clip-path="url(#display-clip)">
${surface}
${glassWash}
${screenFalloff}
<g>
<g data-station-code="${DISPLAY_ROUTE_CODE}">
${text("リポジトリ状況", { x: 58, y: 27, size: 10.7, fill: SIGN_COLORS.textSecondary, weight: 600, opacity: emissiveOnly ? 0.76 : 0.72, style: "letter-spacing:0.08em" })}
${text(`${DISPLAY_ROUTE_CODE} REPOSITORY SIGNALS`, { x: 58, y: 43, size: 12.8, fill: SIGN_COLORS.textPrimary, weight: 600, opacity: emissiveOnly ? 0.82 : 0.8, style: "letter-spacing:0.045em" })}
</g>
${text("LANG  ★", { x: BOARD_COLS.stars, y: 67, size: 8.2, fill: SIGN_COLORS.textSecondary, weight: 600, anchor: "end", opacity: emissiveOnly ? 0.54 : 0.52, style: "letter-spacing:0.08em" })}
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
  const rowBaselines = [130, 164, 198, 232];
  const codeOpacities = [0.96, 0.94, 0.92, 0.9];
  const valueOpacities = [0.96, 0.94, 0.92, 0.9];
  const signalRows = langs.map((lang, index) => {
    const y = rowBaselines[index] ?? rowBaselines[rowBaselines.length - 1];
    const displayName = {
      TypeScript: "TYPESCRIPT",
      JavaScript: "JAVASCRIPT",
      Python: "PYTHON",
      Shell: "SHELL",
      PowerShell: "POWERSHELL",
      Rust: "RUST",
      Ruby: "RUBY",
      Dockerfile: "DOCKER",
      Makefile: "MAKE",
      Other: "OTHER",
    }[lang.name] ?? lang.name;
    const labelSize = displayName.length > 8 ? 8.4 : 9.4;
    return `<g data-lang="${escapeHtml(lang.name)}">
  ${text(displayName, { x: 20, y, size: labelSize, fill: SIGN_COLORS.textPrimary, weight: 600, opacity: emissiveOnly ? 0.86 : codeOpacities[index], style: "letter-spacing:0.035em" })}
  ${text(`${String(lang.pct)}%`, { x: 116, y, size: 10.8, fill: SIGN_COLORS.textPrimary, weight: 600, anchor: "end", opacity: emissiveOnly ? 0.86 : valueOpacities[index], style: "letter-spacing:0", shadow: !emissiveOnly })}
</g>`;
  }).join("");
  const surface = emissiveOnly ? "" : `<rect width="${width}" height="${height}" fill="url(#unlit-leds)" opacity="0.08"/>`;
  const glassWash = emissiveOnly ? "" : `<rect width="${width}" height="${height}" fill="#050403" opacity="0.09"/>`;
  const screenFalloff = emissiveOnly ? "" : `<rect width="${width}" height="${height}" fill="url(#screen-falloff)" opacity="0.18"/>`;
  const displayTexture = "";

  return `${svgHeader({ width: outputWidth, height: outputHeight, viewWidth: width, viewHeight: height, fontCss, fontDataUrl })}
<rect width="${width}" height="${height}" fill="transparent"/>
<g clip-path="url(#display-clip)">
${surface}
${glassWash}
${screenFalloff}
<g>
${emissiveOnly ? "" : `<line x1="20.5" y1="59.5" x2="109.5" y2="59.5" stroke="#000000" stroke-opacity="0.4" stroke-width="2"/>
<line x1="19" y1="58" x2="108" y2="58" stroke="${SIGN_COLORS.marunouchiRed}" stroke-opacity="0.55" stroke-width="2" filter="url(#soft-glow)"/>`}
${text("コード構成", { x: 22, y: 82, size: 10.4, fill: SIGN_COLORS.marunouchiRed, weight: 600, opacity: emissiveOnly ? 0.82 : 0.86, style: "letter-spacing:0.08em" })}
${text(`${DISPLAY_ROUTE_CODE} CODE MIX`, { x: 22, y: 98, size: 11.7, fill: SIGN_COLORS.textPrimary, weight: 600, opacity: emissiveOnly ? 0.86 : 0.92, style: "letter-spacing:0.045em" })}
${emissiveOnly ? "" : `<line x1="20.5" y1="106.5" x2="109.5" y2="106.5" stroke="#000000" stroke-opacity="0.3" stroke-width="1"/>
<line x1="19" y1="105" x2="108" y2="105" stroke="${SIGN_COLORS.ruleLine}" stroke-opacity="0.085"/>
<line x1="20.5" y1="135.5" x2="109.5" y2="135.5" stroke="#000000" stroke-opacity="0.26" stroke-width="1"/>
<line x1="19" y1="134" x2="108" y2="134" stroke="${SIGN_COLORS.ruleLine}" stroke-opacity="0.065"/>
<line x1="20.5" y1="203.5" x2="109.5" y2="203.5" stroke="#000000" stroke-opacity="0.24" stroke-width="1"/>
<line x1="19" y1="202" x2="108" y2="202" stroke="${SIGN_COLORS.ruleLine}" stroke-opacity="0.055"/>`}
${signalRows}
</g>
${displayTexture}
</g>
</svg>`;
}
