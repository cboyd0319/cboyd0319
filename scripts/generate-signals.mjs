import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFile, writeFile } from "node:fs/promises";

import {
  USERNAME,
  REPO_SUMMARIES,
  LANGUAGE_COLORS,
  TOKYO_NEON_PALETTE,
  ACCENTS,
  OUTPUT_WIDTH,
  DEVICE_SCALE,
} from "./lib/config.mjs";
import { relativeTime, escapeHtml, shortText, selectRepos } from "./lib/utils.mjs";
import { github, githubParticipation } from "./lib/github.mjs";
import { loadFontAsDataUrl } from "./lib/font.mjs";

const SMOKE = process.argv.includes("--smoke");
const REPOS_PER_PAGE = 100;
const MAX_REPO_PAGES = 10;
const MAX_LANGUAGE_ITEMS = 8;
const DEFAULT_LANGUAGE_COLOR = TOKYO_NEON_PALETTE.lavender;
const OTHER_LANGUAGE_LABEL = "Other";
const MIN_SCREENSHOT_BYTES = 10_000;
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ASSET_DIR = join(SCRIPT_DIR, "../assets");

function renderSparkline(sparkline, accent) {
  const padded = Array.from({ length: 10 }, (_, i) => {
    const value = Number(sparkline?.[i] ?? 0);
    return Number.isFinite(value) ? Math.max(0, value) : 0;
  });
  const max = Math.max(...padded, 1);
  const bars = padded
    .map((val, i) => {
      const height = Math.round(6 + (val / max) * 30);
      const x = 6 + i * 11;
      const y = 38 - height;
      const opacity = (0.3 + i * 0.065).toFixed(2);
      return `<rect x="${x}" y="${y}" width="7" height="${height}" rx="2" fill="${accent}" opacity="${opacity}"/>`;
    })
    .join("");

  return `<svg viewBox="0 0 120 42" width="120" height="42" role="img" aria-label="ten week activity sparkline">
    <line x1="4" y1="38" x2="116" y2="38" stroke="${accent}" stroke-opacity="0.18"/>
    ${bars}
  </svg>`;
}

function renderRow(repo, index, sparkline) {
  const accent = ACCENTS[index % ACCENTS.length];
  const language = repo.language || "Code";
  const timestamp = relativeTime(repo.pushed_at);
  const starCount = Number(repo.stargazers_count);
  const stars = Number.isFinite(starCount) && starCount > 0 ? Math.floor(starCount) : 0;

  return `
  <div class="signal-row" style="--accent:${accent};">
    <span class="line-badge">${String(index + 1).padStart(2, "0")}</span>
    <span class="repo-name">${escapeHtml(shortText(repo.name, 24))}</span>
    <span class="language-chip">${escapeHtml(shortText(language, 11))}</span>
    <span class="time-chip">${escapeHtml(timestamp)}</span>
    <span class="star-chip">&#9733; ${stars}</span>
    <div class="sparkline">${renderSparkline(sparkline, accent)}</div>
  </div>`;
}

function activeOwnRepos(allRepos) {
  return allRepos.filter((repo) => {
    if (!repo || typeof repo !== "object") return false;
    if (repo.name === USERNAME) return false;
    return !repo.fork && !repo.archived;
  });
}

export function buildLanguageSection(allRepos) {
  const counts = new Map();
  for (const repo of activeOwnRepos(allRepos)) {
    if (!repo.language) continue;
    counts.set(repo.language, (counts.get(repo.language) ?? 0) + 1);
  }

  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const total = sorted.reduce((sum, [, count]) => sum + count, 0);
  if (total === 0) return "";

  const visible = sorted.slice(0, MAX_LANGUAGE_ITEMS);
  const hiddenCount = sorted
    .slice(MAX_LANGUAGE_ITEMS)
    .reduce((sum, [, count]) => sum + count, 0);
  const languageItems = hiddenCount
    ? [
        ...visible.slice(0, MAX_LANGUAGE_ITEMS - 1),
        [OTHER_LANGUAGE_LABEL, hiddenCount],
      ]
    : visible;

  const barSegments = languageItems
    .map(([lang, count]) => {
      const color = LANGUAGE_COLORS.get(lang) ?? DEFAULT_LANGUAGE_COLOR;
      return `<div style="flex:${count};background:${color};"></div>`;
    })
    .join("");

  const legend = languageItems
    .map(([lang, count]) => {
      const pct = ((count / total) * 100).toFixed(0);
      const color = LANGUAGE_COLORS.get(lang) ?? DEFAULT_LANGUAGE_COLOR;
      return `<div class="language-item">
        <span style="background:${color};"></span>
        <strong>${escapeHtml(lang)}</strong>
        <em>${pct}%</em>
      </div>`;
    })
    .join("");

  return `
<section class="language-panel">
  <div class="section-kicker">TOOLCHAIN SPECTRUM</div>
  <div class="language-bar">${barSegments}</div>
  <div class="language-legend">${legend}</div>
</section>`;
}

async function loadAssetAsDataUrl(filename, mediaType) {
  const buffer = await readFile(join(ASSET_DIR, filename));
  return `data:${mediaType};base64,${buffer.toString("base64")}`;
}

function buildHtml(repos, sparklines, allRepos, fontDataUrl, backgroundDataUrl) {
  const latestActivity = relativeTime(repos[0].pushed_at).toUpperCase();
  const rows = repos.map((repo, i) => renderRow(repo, i, sparklines[i])).join("");
  const fontFace = fontDataUrl
    ? `@font-face { font-family:'Space Mono'; src:url('${fontDataUrl}') format('woff2'); font-weight:400 700; font-display:block; }`
    : "";
  const fontStack = fontDataUrl
    ? "'Space Mono','Courier New',monospace"
    : "'Courier New',Courier,monospace";
  const tokyoCssVars = Object.entries(TOKYO_NEON_PALETTE)
    .map(([name, color]) => `  --tokyo-${name}:${color};`)
    .join("\n");

  const ownRepos = activeOwnRepos(allRepos);
  const totalStars = ownRepos.reduce((sum, repo) => {
    const stars = Number(repo.stargazers_count);
    return sum + (Number.isFinite(stars) && stars > 0 ? Math.floor(stars) : 0);
  }, 0);
  const repoCount = ownRepos.length;

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

  const languageSection = buildLanguageSection(allRepos);

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
${fontFace}
:root {
${tokyoCssVars}
}
* { margin:0; padding:0; box-sizing:border-box; }
html, body {
  width:${OUTPUT_WIDTH}px;
  background:var(--tokyo-midnight);
  color:var(--tokyo-haze);
  font-family:${fontStack};
  -webkit-font-smoothing:antialiased;
}
.panel {
  position:relative;
  overflow:hidden;
  padding:34px 36px 0;
  border:1px solid rgba(112,190,221,0.3);
  background:
    radial-gradient(circle at 16% 4%, rgba(122,46,105,0.45), transparent 28%),
    radial-gradient(circle at 78% 12%, rgba(112,190,221,0.24), transparent 30%),
    linear-gradient(115deg,
      var(--tokyo-midnight) 0%, var(--tokyo-midnight) 13%,
      var(--tokyo-magenta) 13%, var(--tokyo-magenta) 20%,
      var(--tokyo-indigo) 20%, var(--tokyo-indigo) 49%,
      var(--tokyo-blue) 49%, var(--tokyo-blue) 78%,
      var(--tokyo-cyan) 78%, var(--tokyo-cyan) 100%);
}
.panel::before {
  content:"";
  position:absolute;
  inset:0;
  pointer-events:none;
  background-image:
    linear-gradient(rgba(112,190,221,0.08) 1px, transparent 1px),
    linear-gradient(90deg, rgba(36,141,191,0.08) 1px, transparent 1px),
    radial-gradient(rgba(205,202,225,0.16) 1px, transparent 1px);
  background-size:48px 48px, 48px 48px, 28px 28px;
  mask-image:linear-gradient(to bottom, black 0%, black 78%, transparent 100%);
}
.panel::after {
  content:"";
  position:absolute;
  inset:0;
  pointer-events:none;
  background:radial-gradient(ellipse at center, transparent 48%, rgba(24,11,38,0.16) 100%);
}
.content { position:relative; z-index:1; }
.header {
  display:grid;
  grid-template-columns:minmax(0, 1fr) auto;
  align-items:start;
  gap:28px;
  margin-bottom:26px;
}
.kicker {
  color:var(--tokyo-ice);
  font-size:12px;
  font-weight:700;
  letter-spacing:4px;
  margin-bottom:8px;
  opacity:0.86;
}
.title {
  color:var(--tokyo-haze);
  font-size:34px;
  font-weight:700;
  letter-spacing:8px;
  line-height:1;
  text-shadow:0 0 18px rgba(112,190,221,0.76), 0 0 42px rgba(122,46,105,0.42);
}
.subhead {
  max-width:680px;
  margin-top:11px;
  color:var(--tokyo-lavender);
  font-size:13px;
  letter-spacing:1.4px;
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
}
.metrics {
  display:grid;
  grid-template-columns:repeat(3, auto);
  gap:10px;
  justify-content:end;
}
.metric {
  min-width:116px;
  padding:12px 14px 11px;
  border:1px solid rgba(112,190,221,0.28);
  background:rgba(24,11,38,0.62);
  box-shadow:inset 0 0 18px rgba(36,141,191,0.1);
}
.metric strong {
  display:block;
  color:var(--tokyo-haze);
  font-size:18px;
  line-height:1.1;
  letter-spacing:1.5px;
}
.metric span {
  display:block;
  margin-top:5px;
  color:var(--tokyo-ice);
  font-size:10px;
  letter-spacing:2px;
}
.divider {
  height:2px;
  margin-bottom:10px;
  background:linear-gradient(90deg, var(--tokyo-ice) 0%, var(--tokyo-cyan) 36%, var(--tokyo-magenta) 72%, var(--tokyo-haze) 100%);
  opacity:0.82;
}
.signal-stack { position:relative; }
.signal-stack::before {
  content:"";
  position:absolute;
  left:26px;
  top:20px;
  bottom:22px;
  width:2px;
  background:linear-gradient(to bottom, var(--tokyo-ice), var(--tokyo-cyan), var(--tokyo-magenta), var(--tokyo-lavender));
  box-shadow:0 0 18px rgba(112,190,221,0.48);
  opacity:0.85;
}
.signal-row {
  display:grid;
  grid-template-columns:58px minmax(0, 1fr) 292px 132px;
  align-items:center;
  gap:20px;
  min-height:104px;
  padding:17px 0;
  border-bottom:1px solid rgba(112,190,221,0.24);
}
.signal-index {
  position:relative;
  display:flex;
  align-items:center;
  justify-content:center;
}
.signal-index::before {
  content:"";
  width:16px;
  height:16px;
  border-radius:50%;
  background:var(--accent);
  box-shadow:0 0 14px var(--accent), 0 0 34px color-mix(in srgb, var(--accent), transparent 45%);
}
.signal-index span {
  position:absolute;
  left:25px;
  bottom:-21px;
  color:var(--tokyo-lavender);
  font-size:9px;
  letter-spacing:1px;
}
.repo-copy { min-width:0; }
.repo-name {
  color:var(--tokyo-haze);
  font-size:21px;
  font-weight:700;
  letter-spacing:0.3px;
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
  text-shadow:0 0 12px rgba(205,202,225,0.26);
}
.repo-owner { color:var(--tokyo-lavender); font-weight:400; }
.repo-description {
  margin-top:8px;
  color:var(--tokyo-lavender);
  font-size:13px;
  letter-spacing:0.35px;
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
}
.repo-meta {
  display:flex;
  align-items:center;
  justify-content:flex-end;
  gap:10px;
  min-width:0;
}
.language-chip,
.star-chip,
.time-chip {
  display:inline-flex;
  align-items:center;
  min-width:0;
  height:30px;
  padding:0 10px;
  border:1px solid rgba(112,190,221,0.24);
  background:rgba(24,11,38,0.48);
  font-size:11px;
  letter-spacing:1.8px;
  white-space:nowrap;
}
.language-chip { color:var(--tokyo-ice); max-width:132px; overflow:hidden; text-overflow:ellipsis; }
.star-chip { color:var(--tokyo-lavender); }
.time-chip {
  color:var(--accent);
  border-color:color-mix(in srgb, var(--accent), transparent 70%);
  text-shadow:0 0 10px color-mix(in srgb, var(--accent), transparent 35%);
}
.sparkline {
  display:flex;
  justify-content:flex-end;
  opacity:0.95;
}
.summary-strip {
  display:flex;
  justify-content:center;
  align-items:center;
  gap:28px;
  padding:20px 0 24px;
}
.summary-strip span {
  color:var(--tokyo-blue);
  font-size:16px;
}
.summary-strip strong {
  color:var(--tokyo-haze);
  font-size:13px;
  letter-spacing:2.5px;
  font-weight:700;
}
.summary-strip strong:nth-of-type(2) { color:var(--tokyo-ice); }
.summary-strip strong:nth-of-type(3) { color:var(--tokyo-cyan); }
.language-panel {
  padding:23px 36px 28px;
  border:1px solid rgba(112,190,221,0.3);
  border-top:none;
  background:
    linear-gradient(115deg,
      var(--tokyo-indigo) 0%, var(--tokyo-indigo) 30%,
      var(--tokyo-blue) 30%, var(--tokyo-blue) 52%,
      var(--tokyo-lavender) 52%, var(--tokyo-lavender) 70%,
      var(--tokyo-midnight) 70%, var(--tokyo-midnight) 88%,
      var(--tokyo-magenta) 88%, var(--tokyo-magenta) 100%);
}
.section-kicker {
  color:var(--tokyo-ice);
  font-size:13px;
  letter-spacing:5px;
  margin-bottom:16px;
  opacity:0.88;
}
.language-bar {
  display:flex;
  height:10px;
  gap:3px;
  overflow:hidden;
  border-radius:999px;
  background:var(--tokyo-midnight);
  box-shadow:0 0 18px rgba(112,190,221,0.16);
}
.language-legend {
  display:flex;
  flex-wrap:wrap;
  gap:12px 23px;
  margin-top:16px;
}
.language-item {
  display:flex;
  align-items:center;
  gap:8px;
  min-width:0;
}
.language-item span {
  width:10px;
  height:10px;
  border-radius:50%;
  flex-shrink:0;
}
.language-item strong {
  color:var(--tokyo-haze);
  font-size:12px;
  letter-spacing:0.7px;
  font-weight:400;
}
.language-item em {
  color:var(--tokyo-lavender);
  font-size:11px;
  letter-spacing:0.4px;
  font-style:normal;
}
.footer {
  padding:15px 18px 17px;
  color:var(--tokyo-ice);
  background:var(--tokyo-midnight);
  border-top:1px solid rgba(112,190,221,0.22);
  text-align:center;
  font-size:13px;
  letter-spacing:8px;
  text-shadow:0 0 12px rgba(112,190,221,0.48);
}
.scene {
  position:relative;
  width:${OUTPUT_WIDTH}px;
  height:675px;
  overflow:hidden;
  color:#f1dfc5;
  background:#180b26;
}
.station-bg {
  position:absolute;
  inset:0;
  width:100%;
  height:100%;
  object-fit:cover;
  object-position:center center;
}
.scene::before {
  content:"";
  position:absolute;
  inset:0;
  pointer-events:none;
  background:
    linear-gradient(90deg, rgba(11,22,36,0.16), transparent 34%, rgba(11,22,36,0.12)),
    radial-gradient(circle at 44% 72%, rgba(31,199,230,0.1), transparent 36%),
    radial-gradient(circle at 18% 24%, rgba(236,108,200,0.08), transparent 28%);
}
.scene::after {
  content:"";
  position:absolute;
  inset:0;
  pointer-events:none;
  background:
    repeating-linear-gradient(0deg, rgba(205,202,225,0.025) 0, rgba(205,202,225,0.025) 1px, transparent 1px, transparent 5px),
    radial-gradient(ellipse at center, transparent 56%, rgba(11,22,36,0.26) 100%);
  mix-blend-mode:soft-light;
}
.main-board {
  position:absolute;
  left:204px;
  top:20px;
  width:466px;
  height:255px;
  padding:15px 17px 12px;
  overflow:hidden;
  border:1px solid rgba(181,213,220,0.24);
  border-radius:7px;
  color:#ead8be;
  background:rgba(8,14,18,0.985);
  box-shadow:
    0 0 0 2px rgba(11,22,36,0.6),
    0 8px 18px rgba(0,0,0,0.48),
    inset 0 0 26px rgba(31,199,230,0.05);
}
.board-header {
  display:flex;
  align-items:flex-start;
  justify-content:space-between;
  gap:14px;
  padding-bottom:7px;
  border-bottom:1px solid rgba(181,213,220,0.18);
}
.board-title {
  color:#f0dec5;
  font-size:23px;
  line-height:1;
  letter-spacing:1.1px;
  font-weight:700;
  white-space:nowrap;
  text-shadow:0 0 10px rgba(181,213,220,0.28);
}
.board-kana {
  color:#d7c2dc;
  font-size:13px;
  letter-spacing:1.6px;
  white-space:nowrap;
  padding-top:4px;
}
.board-metrics {
  display:grid;
  grid-template-columns:1fr 1fr 1fr;
  border-bottom:1px solid rgba(181,213,220,0.16);
}
.board-metric {
  min-width:0;
  padding:6px 8px 7px;
  border-right:1px solid rgba(181,213,220,0.16);
  color:#ead8be;
  font-size:12px;
  letter-spacing:0.5px;
  text-align:center;
  white-space:nowrap;
}
.board-metric:last-child { border-right:none; }
.main-board .signal-stack { position:relative; }
.main-board .signal-stack::before { display:none; }
.main-board .signal-row {
  display:grid;
  grid-template-columns:22px minmax(0, 1fr) 66px 50px 30px 74px;
  align-items:center;
  gap:6px;
  min-height:31px;
  padding:4px 0;
  border-bottom:1px solid rgba(181,213,220,0.13);
}
.line-badge {
  display:inline-flex;
  align-items:center;
  justify-content:center;
  width:20px;
  height:20px;
  border:1px solid color-mix(in srgb, var(--accent), #cdcae1 25%);
  border-radius:3px;
  color:#07101a;
  background:var(--accent);
  font-size:10px;
  font-weight:700;
  letter-spacing:0;
  box-shadow:0 0 10px color-mix(in srgb, var(--accent), transparent 55%);
}
.main-board .repo-name {
  color:#ead8be;
  font-size:14px;
  line-height:1;
  letter-spacing:0.1px;
  font-weight:400;
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
  text-shadow:none;
}
.main-board .language-chip,
.main-board .time-chip,
.main-board .star-chip {
  display:block;
  height:auto;
  padding:0;
  border:none;
  background:transparent;
  font-size:10px;
  line-height:1;
  letter-spacing:0.3px;
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
}
.main-board .language-chip { color:var(--accent); }
.main-board .time-chip { color:#d7c2dc; text-shadow:none; }
.main-board .star-chip { color:#b5d5dc; }
.main-board .sparkline svg {
  width:74px;
  height:24px;
  display:block;
}
.main-board .summary-strip {
  display:grid;
  grid-template-columns:1fr 1fr 1fr;
  align-items:center;
  gap:0;
  padding:9px 0 0;
}
.main-board .summary-strip span { display:none; }
.main-board .summary-strip strong {
  color:#ec6cc8;
  font-size:13px;
  letter-spacing:0.6px;
  white-space:nowrap;
  font-weight:700;
}
.main-board .summary-strip strong:nth-of-type(2) {
  color:#1fc7e6;
  text-align:center;
}
.main-board .summary-strip strong:nth-of-type(3) {
  color:#1fc7e6;
  text-align:right;
}
.scene .language-panel {
  position:absolute;
  left:964px;
  top:462px;
  width:196px;
  height:130px;
  padding:10px 11px;
  overflow:hidden;
  border:1px solid rgba(181,213,220,0.18);
  border-radius:5px;
  background:rgba(8,14,18,0.96);
  box-shadow:0 6px 16px rgba(0,0,0,0.36), inset 0 0 18px rgba(31,199,230,0.04);
}
.scene .section-kicker {
  margin-bottom:8px;
  color:#1fc7e6;
  font-size:10px;
  letter-spacing:0.6px;
}
.scene .language-bar {
  height:9px;
  gap:2px;
  margin-bottom:8px;
  border-radius:9px;
  background:#102536;
  box-shadow:none;
}
.scene .language-legend {
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:5px 8px;
  margin:0;
}
.scene .language-item {
  display:grid;
  grid-template-columns:8px minmax(0, 1fr) auto;
  align-items:center;
  gap:4px;
}
.scene .language-item span {
  width:7px;
  height:7px;
}
.scene .language-item strong {
  color:#ead8be;
  font-size:8px;
  line-height:1;
  letter-spacing:0;
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;
}
.scene .language-item em {
  color:#d7c2dc;
  font-size:8px;
  line-height:1;
}
</style>
</head>
<body>
<section class="scene">
  <img class="station-bg" src="${backgroundDataUrl}" alt="">
  <section class="main-board">
    <header class="board-header">
      <div class="board-title">REPOSITORY SIGNALS</div>
      <div class="board-kana">リポジトリ・シグナル</div>
    </header>
    <div class="board-metrics">
      <div class="board-metric">LATEST&nbsp; ${latestActivity}</div>
      <div class="board-metric">${repoCount}&nbsp; ACTIVE REPOS</div>
      <div class="board-metric">${totalStars}&nbsp; STARS TOTAL</div>
    </div>
    <div class="signal-stack">${rows}</div>
    <div class="summary-strip">
      <strong>${totalStars} STAR SIGNAL</strong>
      <span>/</span>
      <strong>${repoCount} ACTIVE REPOS</strong>
      <span>/</span>
      <strong>${streak}W STREAK</strong>
    </div>
  </section>
  ${languageSection}
</section>
</body>
</html>`;
}

async function fetchOwnerRepos() {
  const repos = [];
  for (let page = 1; page <= MAX_REPO_PAGES; page++) {
    const chunk = await github(
      `/users/${USERNAME}/repos?type=owner&sort=pushed&direction=desc&per_page=${REPOS_PER_PAGE}&page=${page}`,
    );

    if (!Array.isArray(chunk)) {
      throw new Error("GitHub repos API returned an unexpected payload.");
    }

    repos.push(...chunk);
    if (chunk.length < REPOS_PER_PAGE) return repos;
  }

  throw new Error(`GitHub repo pagination exceeded ${MAX_REPO_PAGES} pages.`);
}

function puppeteerLaunchArgs() {
  const args = ["--disable-dev-shm-usage", "--disable-gpu"];
  if (process.env.CI === "true") {
    args.unshift("--no-sandbox", "--disable-setuid-sandbox");
  }
  return args;
}

function validateScreenshot(screenshot, bodyHeight) {
  if (!Number.isFinite(bodyHeight) || bodyHeight <= 0) {
    throw new Error(`Invalid rendered body height: ${bodyHeight}`);
  }

  if (!screenshot || screenshot.byteLength < MIN_SCREENSHOT_BYTES) {
    throw new Error("Generated screenshot is unexpectedly small.");
  }
}

async function main() {
  const allRepos = await fetchOwnerRepos();

  const repos = selectRepos(activeOwnRepos(allRepos));
  if (!repos.length) throw new Error("No public repos found.");

  const sparklines = await Promise.all(
    repos.map((repo) => githubParticipation(USERNAME, repo.name)),
  );

  if (SMOKE) {
    console.log(`Smoke OK - ${repos.length} repos, ${allRepos.length} total fetched`);
    return;
  }

  const [{ dataUrl }, backgroundDataUrl] = await Promise.all([
    loadFontAsDataUrl(),
    loadAssetAsDataUrl("subway_blank_original.png", "image/png"),
  ]);
  const html = buildHtml(repos, sparklines, allRepos, dataUrl, backgroundDataUrl);

  const puppeteer = await import("puppeteer");
  const browser = await puppeteer.default.launch({
    args: puppeteerLaunchArgs(),
  });

  let screenshot;
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: OUTPUT_WIDTH, height: 800, deviceScaleFactor: DEVICE_SCALE });
    await page.setContent(html, { waitUntil: "domcontentloaded" });
    await page.evaluate(() => document.fonts.ready);
    const bodyHeight = Math.ceil(await page.evaluate(() => document.body.scrollHeight));
    await page.setViewport({ width: OUTPUT_WIDTH, height: bodyHeight, deviceScaleFactor: DEVICE_SCALE });
    screenshot = await page.screenshot({
      type: "png",
      clip: { x: 0, y: 0, width: OUTPUT_WIDTH, height: bodyHeight },
    });
    validateScreenshot(screenshot, bodyHeight);
  } finally {
    await browser.close();
  }

  await writeFile(join(ASSET_DIR, "signals.png"), screenshot);
  console.log(`signals.png written - ${repos.length} repos, latest: ${relativeTime(repos[0].pushed_at)}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
