import { USERNAME, LANGUAGE_COLORS, TOKYO_NEON_PALETTE } from "./config.mjs";
import { escapeHtml, relativeTime, shortText } from "./utils.mjs";

export const PANEL_ACCENTS = {
  TypeScript: "#70bedd",
  Python: "#238dbf",
  Shell: "#8977b3",
  PowerShell: "#7b2d69",
  Other: "#cdcae1",
};

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

function iconLabel(language, index) {
  if (language === "TypeScript") return "TS";
  if (language === "JavaScript") return "JS";
  if (language === "Python") return "Py";
  if (language === "Shell") return ">_";
  if (language === "PowerShell") return ">";
  return String(index + 1);
}

function svgFontFace(fontDataUrl) {
  if (!fontDataUrl) return "";
  return `@font-face{font-family:SpaceMono;src:url("${fontDataUrl}") format("woff2");font-weight:400 700;font-display:block;}`;
}

function svgHeader({ width, height, viewWidth, viewHeight, fontDataUrl }) {
  return `<svg width="${width}" height="${height}" viewBox="0 0 ${viewWidth} ${viewHeight}" xmlns="http://www.w3.org/2000/svg">
<defs>
  <pattern id="scan" width="1" height="4" patternUnits="userSpaceOnUse">
    <rect x="0" y="0" width="1" height="1" fill="#ffffff" opacity="0.022"/>
  </pattern>
  <radialGradient id="display-vignette" cx="50%" cy="42%" r="78%">
    <stop offset="0%" stop-color="#70bedd" stop-opacity="0.045"/>
    <stop offset="72%" stop-color="#071011" stop-opacity="0"/>
    <stop offset="100%" stop-color="#000000" stop-opacity="0.2"/>
  </radialGradient>
  <filter id="soft-glow" x="-20%" y="-40%" width="140%" height="180%">
    <feGaussianBlur stdDeviation="1.1" result="blur"/>
    <feMerge>
      <feMergeNode in="blur"/>
      <feMergeNode in="SourceGraphic"/>
    </feMerge>
  </filter>
</defs>
<style>
${svgFontFace(fontDataUrl)}
text{font-family:SpaceMono,"Courier New",monospace}
</style>`;
}

function sparklineSvg(values, color, { x, y, width, height }) {
  const padded = Array.from({ length: 10 }, (_, i) => Math.max(0, Number(values?.[i] ?? 0) || 0));
  const max = Math.max(...padded, 1);
  const barWidth = 4;
  const gap = (width - barWidth * padded.length) / (padded.length - 1);
  return padded.map((value, i) => {
    const barHeight = Math.round(4 + (value / max) * (height - 4));
    const bx = x + i * (barWidth + gap);
    const by = y + height - barHeight;
    const opacity = (0.36 + i * 0.055).toFixed(2);
    return `<rect x="${bx.toFixed(2)}" y="${by}" width="${barWidth}" height="${barHeight}" rx="1.4" fill="${color}" opacity="${opacity}"/>`;
  }).join("");
}

function text(value, { x, y, size, fill = "#f0dec5", weight = 400, anchor = "start", opacity = 1, extra = "" }) {
  return `<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}" fill="${fill}" opacity="${opacity}" ${extra}>${escapeHtml(value)}</text>`;
}

export function renderRepositorySignSvg({ repos, allRepos, sparklines, fontDataUrl, width, height, outputWidth = width, outputHeight = height }) {
  const latest = repos[0] ? relativeTime(repos[0].pushed_at).toUpperCase() : "—";
  const activeRepos = ownActiveRepos(allRepos);
  const totalStars = activeRepos.reduce((sum, repo) => sum + Math.max(0, Number(repo.stargazers_count) || 0), 0);
  const streak = weeklyStreak(sparklines);

  const rowTop = 82;
  const rowBottom = height - 40;
  const rowHeight = (rowBottom - rowTop) / Math.max(repos.length, 1);
  const sparkX = width - 90;
  const nameX = 45;
  const langX = width - 260;
  const timeX = width - 184;
  const lineStart = 14;
  const lineEnd = width - 14;

  const rows = repos.map((repo, index) => {
    const language = repo.language || "Code";
    const color = PANEL_ACCENTS[language] || LANGUAGE_COLORS.get(language) || TOKYO_NEON_PALETTE.lavender;
    const cy = rowTop + rowHeight * index + rowHeight / 2;
    const baseline = cy + 5;
    return `<g>
  <line x1="${lineStart}" y1="${rowTop + rowHeight * index}" x2="${lineEnd}" y2="${rowTop + rowHeight * index}" stroke="#b5d5dc" stroke-opacity="0.15"/>
  <rect x="14" y="${cy - 10}" width="20" height="20" rx="3" fill="${color}" opacity="0.95"/>
  ${text(iconLabel(language, index), { x: 24, y: baseline - 1, size: 8.5, fill: "#07101a", weight: 700, anchor: "middle" })}
  ${text(shortText(repo.name, 22), { x: nameX, y: baseline, size: 14.8, fill: "#ead8be", weight: 700, extra: 'filter="url(#soft-glow)"' })}
  ${text(shortText(language, 11), { x: langX, y: baseline, size: 11.8, fill: color, extra: 'filter="url(#soft-glow)"' })}
  ${text(`Updated ${relativeTime(repo.pushed_at)}`, { x: timeX, y: baseline, size: 11.8, fill: "#d7c2dc" })}
  <g>${sparklineSvg(sparklines[index], color, { x: sparkX, y: cy - 10, width: 76, height: 20 })}</g>
</g>`;
  }).join("");

  return `${svgHeader({ width: outputWidth, height: outputHeight, viewWidth: width, viewHeight: height, fontDataUrl })}
<rect width="${width}" height="${height}" fill="transparent"/>
<rect width="${width}" height="${height}" fill="url(#scan)" opacity="0.72"/>
<rect width="${width}" height="${height}" fill="url(#display-vignette)" opacity="0.85"/>
${text("REPOSITORY SIGNALS", { x: 16, y: 30, size: 23, fill: "#f0dec5", weight: 700, extra: 'filter="url(#soft-glow)"' })}
${text("SHIBUYA SIGNAL", { x: width - 14, y: 30, size: 12, fill: "#d7c2dc", anchor: "end", extra: 'filter="url(#soft-glow)"' })}
<line x1="14" y1="42" x2="${lineEnd}" y2="42" stroke="#b5d5dc" stroke-opacity="0.24"/>
<line x1="14" y1="72" x2="${lineEnd}" y2="72" stroke="#b5d5dc" stroke-opacity="0.16"/>
<line x1="${width / 3}" y1="45" x2="${width / 3}" y2="72" stroke="#b5d5dc" stroke-opacity="0.16"/>
<line x1="${(width / 3) * 2}" y1="45" x2="${(width / 3) * 2}" y2="72" stroke="#b5d5dc" stroke-opacity="0.16"/>
${text(`LATEST  ${latest}`, { x: width / 6, y: 61, size: 12, fill: "#f0dec5", weight: 700, anchor: "middle" })}
${text(`${activeRepos.length}  ACTIVE REPOS`, { x: width / 2, y: 61, size: 12, fill: "#f0dec5", weight: 700, anchor: "middle" })}
${text(`${totalStars}  STARS TOTAL`, { x: (width / 6) * 5, y: 61, size: 12, fill: "#f0dec5", weight: 700, anchor: "middle" })}
${rows}
<line x1="${lineStart}" y1="${rowBottom}" x2="${lineEnd}" y2="${rowBottom}" stroke="#b5d5dc" stroke-opacity="0.15"/>
${text(`${totalStars} STAR SIGNAL`, { x: 14, y: height - 19, size: 12, fill: "#ec6cc8", weight: 700, extra: 'filter="url(#soft-glow)"' })}
${text(`${activeRepos.length} ACTIVE REPOS`, { x: width / 2, y: height - 19, size: 12, fill: "#1fc7e6", weight: 700, anchor: "middle", extra: 'filter="url(#soft-glow)"' })}
${text(`${streak}W STREAK`, { x: width - 14, y: height - 19, size: 12, fill: "#1fc7e6", weight: 700, anchor: "end", extra: 'filter="url(#soft-glow)"' })}
</svg>`;
}

function polarToCartesian(cx, cy, r, angleDeg) {
  const angle = (angleDeg - 90) * Math.PI / 180;
  return {
    x: cx + r * Math.cos(angle),
    y: cy + r * Math.sin(angle),
  };
}

function donutSlice(cx, cy, outerR, innerR, startAngle, endAngle, color) {
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  const startOuter = polarToCartesian(cx, cy, outerR, startAngle);
  const endOuter = polarToCartesian(cx, cy, outerR, endAngle);
  const startInner = polarToCartesian(cx, cy, innerR, endAngle);
  const endInner = polarToCartesian(cx, cy, innerR, startAngle);
  return `<path d="M ${startOuter.x.toFixed(2)} ${startOuter.y.toFixed(2)} A ${outerR} ${outerR} 0 ${largeArc} 1 ${endOuter.x.toFixed(2)} ${endOuter.y.toFixed(2)} L ${startInner.x.toFixed(2)} ${startInner.y.toFixed(2)} A ${innerR} ${innerR} 0 ${largeArc} 0 ${endInner.x.toFixed(2)} ${endInner.y.toFixed(2)} Z" fill="${color}"/>`;
}

export function renderToolchainSpectrumSvg({ allRepos, fontDataUrl, width, height, outputWidth = width, outputHeight = height }) {
  const langs = languageSummary(allRepos);
  let barX = 8;
  let angle = 0;
  const barWidth = width - 16;
  const barSegments = langs.map((lang) => {
    const segmentWidth = Math.max(1, (lang.pct / 100) * barWidth);
    const rect = `<rect x="${barX.toFixed(2)}" y="31" width="${segmentWidth.toFixed(2)}" height="7" fill="${lang.color}"/>`;
    barX += segmentWidth;
    return rect;
  }).join("");

  const donut = langs.map((lang) => {
    const next = angle + (lang.pct / 100) * 360;
    const path = donutSlice(38, 74, 23, 13, angle, next, lang.color);
    angle = next;
    return path;
  }).join("");

  const legend = langs.map((lang, index) => {
    const y = 58 + index * 18;
    return `<g>
  <circle cx="72" cy="${y - 4}" r="3.4" fill="${lang.color}"/>
  ${text(lang.name, { x: 80, y, size: 8, fill: "#f0dec5", weight: 700 })}
  ${text(`${lang.pct}%`, { x: width - 8, y, size: 8, fill: "#d7c2dc", anchor: "end", weight: 700 })}
</g>`;
  }).join("");

  return `${svgHeader({ width: outputWidth, height: outputHeight, viewWidth: width, viewHeight: height, fontDataUrl })}
<rect width="${width}" height="${height}" fill="transparent"/>
<rect width="${width}" height="${height}" fill="url(#scan)" opacity="0.55"/>
<rect width="${width}" height="${height}" fill="url(#display-vignette)" opacity="0.65"/>
${text("TOOLCHAIN SPECTRUM", { x: 8, y: 18, size: 9, fill: "#1fc7e6", weight: 700, extra: 'filter="url(#soft-glow)"' })}
<rect x="8" y="31" width="${barWidth}" height="7" fill="#102536"/>
<g clip-path="inset(31px 8px ${height - 38}px 8px round 4px)">${barSegments}</g>
<g filter="url(#soft-glow)">${donut}</g>
${legend}
</svg>`;
}
