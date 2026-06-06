import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { writeFile } from "node:fs/promises";

import {
  USERNAME,
  REPO_SUMMARIES,
  LANGUAGE_COLORS,
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
const DEFAULT_LANGUAGE_COLOR = "#8b8baa";
const OTHER_LANGUAGE_LABEL = "Other";
const MIN_SCREENSHOT_BYTES = 10_000;

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
  const description = shortText(
    REPO_SUMMARIES.get(repo.name) || repo.description || "Public build signal",
    86,
  );
  const language = (repo.language || "Code").toUpperCase();
  const timestamp = relativeTime(repo.pushed_at);
  const starCount = Number(repo.stargazers_count);
  const stars = Number.isFinite(starCount) && starCount > 0 ? Math.floor(starCount) : 0;

  return `
  <div class="signal-row" style="--accent:${accent};">
    <div class="signal-index">
      <span>${String(index + 1).padStart(2, "0")}</span>
    </div>
    <div class="repo-copy">
      <div class="repo-name">
        <span class="repo-owner">${escapeHtml(USERNAME)}/</span>${escapeHtml(repo.name)}
      </div>
      <div class="repo-description">${escapeHtml(description)}</div>
    </div>
    <div class="repo-meta">
      <span class="language-chip">${escapeHtml(language)}</span>
      <span class="star-chip">&#9733; ${stars}</span>
      <span class="time-chip">${escapeHtml(timestamp)}</span>
    </div>
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

function buildHtml(repos, sparklines, allRepos, fontDataUrl) {
  const latestActivity = relativeTime(repos[0].pushed_at).toUpperCase();
  const rows = repos.map((repo, i) => renderRow(repo, i, sparklines[i])).join("");
  const fontFace = fontDataUrl
    ? `@font-face { font-family:'Space Mono'; src:url('${fontDataUrl}') format('woff2'); font-weight:400 700; font-display:block; }`
    : "";
  const fontStack = fontDataUrl
    ? "'Space Mono','Courier New',monospace"
    : "'Courier New',Courier,monospace";

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
* { margin:0; padding:0; box-sizing:border-box; }
html, body {
  width:${OUTPUT_WIDTH}px;
  background:#03050f;
  color:#f4fbff;
  font-family:${fontStack};
  -webkit-font-smoothing:antialiased;
}
.panel {
  position:relative;
  overflow:hidden;
  padding:34px 36px 0;
  border:1px solid rgba(125,249,255,0.2);
  background:
    radial-gradient(circle at 14% 2%, rgba(255,47,146,0.22), transparent 28%),
    radial-gradient(circle at 88% 12%, rgba(0,229,255,0.18), transparent 30%),
    linear-gradient(135deg, #060915 0%, #0b0d22 54%, #041216 100%);
}
.panel::before {
  content:"";
  position:absolute;
  inset:0;
  pointer-events:none;
  background-image:
    linear-gradient(rgba(125,249,255,0.045) 1px, transparent 1px),
    linear-gradient(90deg, rgba(125,249,255,0.04) 1px, transparent 1px),
    radial-gradient(rgba(0,229,255,0.15) 1px, transparent 1px);
  background-size:48px 48px, 48px 48px, 28px 28px;
  mask-image:linear-gradient(to bottom, black 0%, black 78%, transparent 100%);
}
.panel::after {
  content:"";
  position:absolute;
  inset:0;
  pointer-events:none;
  background:radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.36) 100%);
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
  color:#7df9ff;
  font-size:12px;
  font-weight:700;
  letter-spacing:4px;
  margin-bottom:8px;
  opacity:0.86;
}
.title {
  color:#ff4fb3;
  font-size:34px;
  font-weight:700;
  letter-spacing:8px;
  line-height:1;
  text-shadow:0 0 18px rgba(255,47,146,0.72), 0 0 42px rgba(255,47,146,0.25);
}
.subhead {
  max-width:680px;
  margin-top:11px;
  color:#8796bd;
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
  border:1px solid rgba(125,249,255,0.18);
  background:rgba(3,5,16,0.72);
  box-shadow:inset 0 0 18px rgba(0,229,255,0.04);
}
.metric strong {
  display:block;
  color:#f4fbff;
  font-size:18px;
  line-height:1.1;
  letter-spacing:1.5px;
}
.metric span {
  display:block;
  margin-top:5px;
  color:#7df9ff;
  font-size:10px;
  letter-spacing:2px;
}
.divider {
  height:2px;
  margin-bottom:10px;
  background:linear-gradient(90deg, #00e5ff 0%, #ff2f92 48%, #ffe66d 100%);
  opacity:0.7;
}
.signal-stack { position:relative; }
.signal-stack::before {
  content:"";
  position:absolute;
  left:26px;
  top:20px;
  bottom:22px;
  width:2px;
  background:linear-gradient(to bottom, #ff2f92, #00e5ff, #ffe66d, #a855ff);
  box-shadow:0 0 18px rgba(0,229,255,0.45);
  opacity:0.85;
}
.signal-row {
  display:grid;
  grid-template-columns:58px minmax(0, 1fr) 292px 132px;
  align-items:center;
  gap:20px;
  min-height:104px;
  padding:17px 0;
  border-bottom:1px solid rgba(45,75,120,0.55);
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
  color:#4e5e83;
  font-size:9px;
  letter-spacing:1px;
}
.repo-copy { min-width:0; }
.repo-name {
  color:#f4fbff;
  font-size:21px;
  font-weight:700;
  letter-spacing:0.3px;
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
  text-shadow:0 0 12px rgba(244,251,255,0.24);
}
.repo-owner { color:#5b6686; font-weight:400; }
.repo-description {
  margin-top:8px;
  color:#8796bd;
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
  border:1px solid rgba(125,249,255,0.16);
  background:rgba(3,5,16,0.58);
  font-size:11px;
  letter-spacing:1.8px;
  white-space:nowrap;
}
.language-chip { color:#7df9ff; max-width:132px; overflow:hidden; text-overflow:ellipsis; }
.star-chip { color:#7080a7; }
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
  color:#2b3d60;
  font-size:16px;
}
.summary-strip strong {
  color:#ffe66d;
  font-size:13px;
  letter-spacing:2.5px;
  font-weight:700;
}
.summary-strip strong:nth-of-type(2) { color:#7df9ff; }
.summary-strip strong:nth-of-type(3) { color:#31ffb6; }
.language-panel {
  padding:23px 36px 28px;
  border:1px solid rgba(125,249,255,0.2);
  border-top:none;
  background:
    linear-gradient(135deg, #050812 0%, #09101e 58%, #031316 100%);
}
.section-kicker {
  color:#7df9ff;
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
  background:#071022;
  box-shadow:0 0 18px rgba(0,229,255,0.1);
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
  color:#9aaace;
  font-size:12px;
  letter-spacing:0.7px;
  font-weight:400;
}
.language-item em {
  color:#465575;
  font-size:11px;
  letter-spacing:0.4px;
  font-style:normal;
}
.footer {
  padding:15px 18px 17px;
  color:#00e5ff;
  background:#030510;
  border-top:1px solid rgba(0,229,255,0.16);
  text-align:center;
  font-size:13px;
  letter-spacing:8px;
  text-shadow:0 0 12px rgba(0,229,255,0.48);
}
</style>
</head>
<body>
<section class="panel">
  <div class="content">
    <header class="header">
      <div>
        <div class="title">RECENT SIGNALS</div>
        <div class="subhead">Daily static render of live public repository activity.</div>
      </div>
      <div class="metrics">
        <div class="metric"><strong>${latestActivity}</strong><span>LATEST</span></div>
        <div class="metric"><strong>${repoCount}</strong><span>REPOS</span></div>
        <div class="metric"><strong>${totalStars}</strong><span>STARS</span></div>
      </div>
    </header>
    <div class="divider"></div>
    <div class="signal-stack">${rows}</div>
    <div class="summary-strip">
      <strong>${totalStars} STAR SIGNAL</strong>
      <span>/</span>
      <strong>${repoCount} ACTIVE REPOS</strong>
      <span>/</span>
      <strong>${streak}W STREAK</strong>
    </div>
  </div>
</section>
${languageSection}
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

  const { dataUrl } = await loadFontAsDataUrl();
  const html = buildHtml(repos, sparklines, allRepos, dataUrl);

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

  const dir = dirname(fileURLToPath(import.meta.url));
  await writeFile(join(dir, "../assets/signals.png"), screenshot);
  console.log(`signals.png written - ${repos.length} repos, latest: ${relativeTime(repos[0].pushed_at)}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
