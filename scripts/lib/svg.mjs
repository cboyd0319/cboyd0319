import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rasterizeSvg, runMagick } from "./imagemagick.mjs";
import { DISPLAY_ROUTE_CODE, USERNAME } from "./config.mjs";
import { escapeHtml, relativeTime, shortText } from "./utils.mjs";

const SIGN_COLORS = {
  textPrimary: "#D6A33A",
  textSecondary: "#A56F22",
  alertRed: "#D94132",
  marunouchiRed: "#D91F2B",
  ruleLine: "#242018",
};

const STATUS_LED_GREEN = "#7FB95A";
const TEXT_FONT_FAMILY = "'Noto Sans JP','Source Han Sans JP','Hiragino Sans','Yu Gothic','Helvetica Neue',Arial,sans-serif";
const REPOSITORY_BOARD_NAME_MAX = 18;
const REPOSITORY_NAME_WIDTH = 142;
const REPOSITORY_LANGUAGE_WIDTH = 75;
const REPOSITORY_NAME_TEXT = { size: 15.6, weight: 600, style: "letter-spacing:0", shadow: true };
const REPOSITORY_LANGUAGE_TEXT = { size: 10.4, weight: 500, style: "letter-spacing:0.018em" };
const BOARD_COLS = {
  time: 64,
  statusDot: 88,
  status: 98,
  repo: 178,
  language: 405,
  stars: 455,
};

export function ownActiveRepos(allRepos) {
  return allRepos.filter((repo) => repo && typeof repo.name === "string" && repo.name.trim()
    && !repo.fork && !repo.archived && !repo.private && (!repo.visibility || repo.visibility === "public")
    && repo.name.toLowerCase() !== USERNAME.toLowerCase());
}

export function languageSummary(allRepos) {
  const activeRepos = ownActiveRepos(allRepos);
  const languageMaps = activeRepos.map((repo) => repo.languages).filter(isLanguageMap);

  // Live collection requires every active repository's byte map.
  if (languageMaps.length) {
    const totals = new Map();
    for (const languages of languageMaps) {
      for (const [language, bytes] of Object.entries(languages)) {
        const count = bytes;
        if (!Number.isSafeInteger(count) || count <= 0) continue;
        totals.set(language, (totals.get(language) || 0) + count);
      }
    }
    return summarizeLanguageEntries([...totals.entries()]);
  }

  const weighted = activeRepos.filter((repo) => typeof repo.language === "string" && repo.language
    && Number.isFinite(repo.language_pct) && repo.language_pct > 0);

  if (weighted.length) {
    const totals = new Map();
    for (const repo of weighted) {
      totals.set(repo.language, (totals.get(repo.language) || 0) + repo.language_pct);
    }

    return summarizeLanguageEntries([...totals.entries()], { sort: false });
  }

  return [];
}

function isLanguageMap(value) {
  return value && !Array.isArray(value) && typeof value === "object";
}

function summarizeLanguageEntries(entries, { sort = true } = {}) {
  const sorted = sort || entries.length > 4 ? entries.sort((a, b) => b[1] - a[1]) : entries;
  const total = sorted.reduce((sum, [, count]) => sum + count, 0) || 1;
  const summarized = sorted.length > 4
    ? [
        ...sorted.slice(0, 3),
        ["Other", sorted.slice(3).reduce((sum, [, count]) => sum + count, 0)],
      ]
    : sorted;

  const shares = summarized.map(([, count]) => count / total * 100);
  const percentages = shares.map(Math.floor);
  const remainderOrder = shares.map((_, index) => index)
    .sort((a, b) => (shares[b] - percentages[b]) - (shares[a] - percentages[a]));
  const remainder = 100 - percentages.reduce((sum, value) => sum + value, 0);
  for (const index of remainderOrder.slice(0, remainder)) percentages[index]++;
  return summarized.map(([name], index) => ({
    name,
    pct: percentages[index],
  }));
}

function svgHeader({ width, height, viewWidth, viewHeight }) {
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
text{font-family:${TEXT_FONT_FAMILY};text-rendering:geometricPrecision}
</style>`;
}

function text(value, { x, y, size, fill = SIGN_COLORS.textPrimary, weight = 600, anchor = "start", opacity = 1, style = "", extra = "", shadow = false, clipWidth }) {
  const styleAttr = style ? `style="${escapeHtml(style)}"` : "";
  const mainText = `<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" font-family="${TEXT_FONT_FAMILY}" text-anchor="${anchor}" fill="${fill}" opacity="${opacity}" ${styleAttr} ${extra}>${escapeHtml(value)}</text>`;
  const shadowText = `<text x="${x + 1.5}" y="${y + 1.5}" font-size="${size}" font-weight="${weight}" font-family="${TEXT_FONT_FAMILY}" text-anchor="${anchor}" fill="#000000" opacity="0.6" ${styleAttr} ${extra}>${escapeHtml(value)}</text>`;
  const glyphs = shadow ? `${shadowText}\n${mainText}` : mainText;
  if (!clipWidth) return glyphs;
  const left = anchor === "end" ? x - clipWidth : x;
  return `<svg x="${left}" y="${y - 22}" width="${clipWidth}" height="32" viewBox="${left} ${y - 22} ${clipWidth} 32" overflow="hidden">${glyphs}</svg>`;
}

function repoDisplayName(name, compact) {
  const displayName = String(name ?? "").replace(/-fix$/i, "");
  return shortText(displayName, compact ? REPOSITORY_BOARD_NAME_MAX : 24);
}

export async function fitRepositoryRows(repos) {
  const directory = await mkdtemp(join(tmpdir(), "signals-text-"));
  const svgPath = join(directory, "text.svg");
  const rasterPath = join(directory, "text.png");
  const fit = async (value, maxWidth, options) => {
    const measure = async (label) => {
      await writeFile(svgPath, `${svgHeader({ width: 500, height: 40, viewWidth: 500, viewHeight: 40 })}${text(label, { x: 0, y: 24, ...options })}</svg>`);
      await rasterizeSvg(svgPath, rasterPath, { width: 500, height: 40 });
      const { stdout } = await runMagick([rasterPath, "-trim", "-format", "%w %X", "info:"]);
      const [width, left] = stdout.trim().split(" ").map(Number);
      if (!Number.isFinite(width + left) || width <= 0) throw new Error("Invalid repository text width.");
      return width + left;
    };
    if (await measure(value) <= maxWidth - 4) return value;
    const full = value.replace(/\.\.\.$/, "");
    let low = 0;
    let high = full.length;
    while (low < high) {
      const middle = Math.ceil((low + high) / 2);
      if (await measure(`${full.slice(0, middle)}...`) <= maxWidth - 4) low = middle;
      else high = middle - 1;
    }
    return `${full.slice(0, low)}...`;
  };
  try {
    const fitted = [];
    for (const repo of repos) {
      const displayName = await fit(repoDisplayName(repo.name, true), REPOSITORY_NAME_WIDTH, REPOSITORY_NAME_TEXT);
      const displayLanguage = await fit(shortText(repo.language || "PUBLIC", 14), REPOSITORY_LANGUAGE_WIDTH, REPOSITORY_LANGUAGE_TEXT);
      fitted.push({ ...repo, display_name: displayName, display_language: displayLanguage });
    }
    return fitted;
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

function statusForRepo(repo) {
  return String(repo?.status || "").trim().toUpperCase() || "ACTIVE";
}

function repoRowText(repo, { y, emissiveOnly = false }) {
  const updated = (repo.updated_label || relativeTime(repo.pushed_at)).replace(/\s+ago$/i, "");
  const status = statusForRepo(repo);
  const alertStatus = /CHECK|WARN|REVIEW|FAIL|ARCHIVED/.test(status);
  const statusFill = alertStatus ? SIGN_COLORS.alertRed : SIGN_COLORS.textSecondary;
  const dotColor = status === "ACTIVE" ? STATUS_LED_GREEN : statusFill;
  const statusOpacity = status === "IDLE" ? 0.58 : alertStatus ? 0.8 : 0.7;
  const language = repo.display_language ?? shortText(repo.language || "PUBLIC", 14);
  const stars = Math.max(0, Number(repo.stargazers_count) || 0);
  const dotX = BOARD_COLS.statusDot;
  const dotY = y - 5;
  const statusSize = status.length > 7 ? 9.4 : 10.8;
  return `${text(updated, { x: BOARD_COLS.time, y, size: 12.5, fill: SIGN_COLORS.textSecondary, weight: 600, anchor: "end", opacity: emissiveOnly ? 0.68 : 0.64, style: "letter-spacing:0.025em" })}
${emissiveOnly ? "" : `<circle cx="${dotX + 1.5}" cy="${dotY + 1.5}" r="3" fill="#000000" opacity="0.55"/>`}
${emissiveOnly ? "" : `<circle data-status-led="${escapeHtml(status)}" cx="${dotX}" cy="${dotY}" r="3" fill="${dotColor}" opacity="${statusOpacity}" filter="url(#soft-glow)"/>`}
${text(status, { x: BOARD_COLS.status, y, size: statusSize, fill: statusFill, weight: 600, opacity: emissiveOnly ? Math.min(0.78, statusOpacity + 0.04) : Math.max(0.7, statusOpacity), style: "letter-spacing:0.01em" })}
${text(repo.display_name ?? repoDisplayName(repo.name, true), { ...REPOSITORY_NAME_TEXT, x: BOARD_COLS.repo, y, fill: SIGN_COLORS.textPrimary, opacity: emissiveOnly ? 0.88 : 0.96, shadow: !emissiveOnly, clipWidth: REPOSITORY_NAME_WIDTH })}
${text(language, { ...REPOSITORY_LANGUAGE_TEXT, x: BOARD_COLS.language, y, fill: SIGN_COLORS.textSecondary, anchor: "end", opacity: emissiveOnly ? 0.74 : 0.82, clipWidth: REPOSITORY_LANGUAGE_WIDTH })}
${text(`★ ${stars}`, { x: BOARD_COLS.stars, y, size: 10.4, fill: SIGN_COLORS.textSecondary, weight: 600, anchor: "end", opacity: emissiveOnly ? 0.74 : 0.82, style: "letter-spacing:0.02em", shadow: !emissiveOnly })}`;
}

export function renderRepositorySignSvg({ repos, width, height, outputWidth = width, outputHeight = height, emissiveOnly = false }) {
  const rowBaselines = [91, 127];

  const rows = repos.map((repo, index) => {
    const baseline = rowBaselines[index] ?? rowBaselines[rowBaselines.length - 1];
    return `<g data-repo="${escapeHtml(repo.name)}">
  ${repoRowText(repo, { y: baseline, emissiveOnly })}
</g>`;
  }).join("");

  const surface = emissiveOnly ? "" : `<rect width="${width}" height="${height}" fill="url(#unlit-leds)" opacity="0.11"/>`;
  const glassWash = emissiveOnly ? "" : `<rect width="${width}" height="${height}" fill="#050403" opacity="0.08"/>`;
  const screenFalloff = emissiveOnly ? "" : `<rect width="${width}" height="${height}" fill="url(#screen-falloff)" opacity="0.16"/>`;
  const structure = emissiveOnly ? "" : `<line x1="37.5" y1="51.5" x2="457.5" y2="51.5" stroke="#000000" stroke-opacity="0.4" stroke-width="2"/>
<line x1="36" y1="50" x2="456" y2="50" stroke="${SIGN_COLORS.marunouchiRed}" stroke-opacity="0.55" stroke-width="2" filter="url(#soft-glow)"/>
<line x1="37.5" y1="113.5" x2="457.5" y2="113.5" stroke="#000000" stroke-opacity="0.3" stroke-width="1"/>
<line x1="36" y1="112" x2="456" y2="112" stroke="${SIGN_COLORS.ruleLine}" stroke-opacity="0.09"/>`;

  return `${svgHeader({ width: outputWidth, height: outputHeight, viewWidth: width, viewHeight: height })}
<rect width="${width}" height="${height}" fill="transparent"/>
<g clip-path="url(#display-clip)">
${surface}
${glassWash}
${screenFalloff}
<g>
<g data-station-code="${DISPLAY_ROUTE_CODE}">
${text("リポジトリ状況", { x: 58, y: 27, size: 10.7, fill: SIGN_COLORS.textSecondary, weight: 600, opacity: emissiveOnly ? 0.7 : 0.66, style: "letter-spacing:0.08em" })}
${text(`${DISPLAY_ROUTE_CODE} REPOSITORY SIGNALS`, { x: 58, y: 43, size: 12.8, fill: SIGN_COLORS.textPrimary, weight: 600, opacity: emissiveOnly ? 0.78 : 0.74, style: "letter-spacing:0.045em" })}
</g>
${text("LANG  ★", { x: BOARD_COLS.stars, y: 67, size: 8.2, fill: SIGN_COLORS.textSecondary, weight: 600, anchor: "end", opacity: emissiveOnly ? 0.54 : 0.52, style: "letter-spacing:0.08em" })}
${structure}
${rows}
</g>
</g>
</svg>`;
}

export function renderToolchainSpectrumSvg({ allRepos, width, height, outputWidth = width, outputHeight = height, emissiveOnly = false }) {
  const langs = languageSummary(allRepos)
    .map((lang, index) => ({ ...lang, index }))
    .sort((a, b) => b.pct - a.pct || a.index - b.index);
  const rowBaselines = [142, 178, 214, 250];
  const codeOpacities = [0.96, 0.94, 0.92, 0.9];
  const valueOpacities = [0.96, 0.94, 0.92, 0.9];
  const signalRows = langs.map((lang, index) => {
    const y = rowBaselines[index] ?? rowBaselines[rowBaselines.length - 1];
    const displayName = shortText(
      lang.name === "Dockerfile" ? "DOCKER" : lang.name === "Makefile" ? "MAKE" : lang.name.toUpperCase(),
      10,
    );
    const labelSize = displayName.length > 8 ? 8.4 : 9.4;
    return `<g data-lang="${escapeHtml(lang.name)}">
  ${text(displayName, { x: 20, y, size: labelSize, fill: SIGN_COLORS.textPrimary, weight: 600, opacity: emissiveOnly ? 0.86 : codeOpacities[index], style: "letter-spacing:0.035em" })}
  ${text(`${String(lang.pct)}%`, { x: 112, y, size: 10.8, fill: SIGN_COLORS.textPrimary, weight: 600, anchor: "end", opacity: emissiveOnly ? 0.86 : valueOpacities[index], style: "letter-spacing:0", shadow: !emissiveOnly })}
</g>`;
  }).join("");
  const surface = emissiveOnly ? "" : `<rect width="${width}" height="${height}" fill="url(#unlit-leds)" opacity="0.08"/>`;
  const glassWash = emissiveOnly ? "" : `<rect width="${width}" height="${height}" fill="#050403" opacity="0.09"/>`;
  const screenFalloff = emissiveOnly ? "" : `<rect width="${width}" height="${height}" fill="url(#screen-falloff)" opacity="0.18"/>`;

  return `${svgHeader({ width: outputWidth, height: outputHeight, viewWidth: width, viewHeight: height })}
<rect width="${width}" height="${height}" fill="transparent"/>
<g clip-path="url(#display-clip)">
${surface}
${glassWash}
${screenFalloff}
<g>
${emissiveOnly ? "" : `<line x1="20.5" y1="59.5" x2="109.5" y2="59.5" stroke="#000000" stroke-opacity="0.4" stroke-width="2"/>
<line x1="19" y1="58" x2="108" y2="58" stroke="${SIGN_COLORS.marunouchiRed}" stroke-opacity="0.55" stroke-width="2" filter="url(#soft-glow)"/>`}
${text("コード構成", { x: 22, y: 92, size: 10.4, fill: SIGN_COLORS.marunouchiRed, weight: 600, opacity: emissiveOnly ? 0.82 : 0.86, style: "letter-spacing:0.08em" })}
${text(`${DISPLAY_ROUTE_CODE} CODE MIX`, { x: 22, y: 109, size: 11.7, fill: SIGN_COLORS.textPrimary, weight: 600, opacity: emissiveOnly ? 0.86 : 0.92, style: "letter-spacing:0.045em" })}
${emissiveOnly ? "" : `<line x1="20.5" y1="106.5" x2="109.5" y2="106.5" stroke="#000000" stroke-opacity="0.3" stroke-width="1"/>
<line x1="19" y1="105" x2="108" y2="105" stroke="${SIGN_COLORS.ruleLine}" stroke-opacity="0.085"/>
<line x1="20.5" y1="135.5" x2="109.5" y2="135.5" stroke="#000000" stroke-opacity="0.26" stroke-width="1"/>
<line x1="19" y1="134" x2="108" y2="134" stroke="${SIGN_COLORS.ruleLine}" stroke-opacity="0.065"/>
<line x1="20.5" y1="203.5" x2="109.5" y2="203.5" stroke="#000000" stroke-opacity="0.24" stroke-width="1"/>
<line x1="19" y1="202" x2="108" y2="202" stroke="${SIGN_COLORS.ruleLine}" stroke-opacity="0.055"/>`}
${signalRows}
</g>
</g>
</svg>`;
}
