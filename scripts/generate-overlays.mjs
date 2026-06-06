import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import sharp from "sharp";

import {
  USERNAME,
  LANGUAGE_COLORS,
  TOKYO_NEON_PALETTE,
  OUTPUT_WIDTH as DEFAULT_OUTPUT_WIDTH,
  DEVICE_SCALE as DEFAULT_DEVICE_SCALE,
} from "./lib/config.mjs";
import { relativeTime, escapeHtml, shortText, selectRepos } from "./lib/utils.mjs";
import { github, githubParticipation } from "./lib/github.mjs";
import { loadFontAsDataUrl } from "./lib/font.mjs";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ASSET_DIR = join(SCRIPT_DIR, "../assets");
const OUT_DIR = ASSET_DIR;
const BACKGROUND = "subway_blank_original.png";
const REPOS_PER_PAGE = 100;
const MAX_REPO_PAGES = 10;
const REPO_LIMIT = 4;
const SMOKE = process.argv.includes("--smoke");
const STATIC = ["1", "true", "yes"].includes(String(process.env.STATIC ?? "").toLowerCase());
const MIN_SCREENSHOT_BYTES = 10_000;

// Overlay boxes are in SOURCE IMAGE PIXELS, not output pixels.
// The script reads the background dimensions and scales these boxes automatically
// when OUTPUT_WIDTH changes. These defaults are tuned for the 1672x941 subway image.
function envNumber(name, fallback) {
  if (!process.env[name]?.trim()) return fallback;
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
}

function minutesAgo(minutes) {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

function daysAgo(days) {
  return new Date(Date.now() - days * 24 * 60 * 60_000).toISOString();
}

const OUTPUT_WIDTH = envNumber("OUTPUT_WIDTH", DEFAULT_OUTPUT_WIDTH);
const DEVICE_SCALE = envNumber("DEVICE_SCALE", DEFAULT_DEVICE_SCALE);

const BOARD = {
  left: envNumber("BOARD_LEFT", 304),
  top: envNumber("BOARD_TOP", 34),
  width: envNumber("BOARD_WIDTH", 604),
  height: envNumber("BOARD_HEIGHT", 324),
};

const TOOLCHAIN = {
  left: envNumber("TOOLCHAIN_LEFT", 1322),
  top: envNumber("TOOLCHAIN_TOP", 646),
  width: envNumber("TOOLCHAIN_WIDTH", 178),
  height: envNumber("TOOLCHAIN_HEIGHT", 136),
};

const ACCENTS = {
  TypeScript: "#70bedd",
  Python: "#238dbf",
  Shell: "#8977b3",
  PowerShell: "#7b2d69",
  Other: "#cdcae1",
};

function ownActiveRepos(allRepos) {
  return allRepos.filter((repo) => repo && !repo.fork && !repo.archived && repo.name !== USERNAME);
}

function staticRepos() {
  return [
    {
      name: "JobSentinel",
      language: "TypeScript",
      language_pct: 25,
      pushed_at: minutesAgo(32),
      stargazers_count: 28,
      fork: false,
      archived: false,
    },
    {
      name: "PyGuard",
      language: "Python",
      language_pct: 35,
      pushed_at: daysAgo(14),
      stargazers_count: 19,
      fork: false,
      archived: false,
    },
    {
      name: "WormsWMD-macOS-Fix",
      language: "Shell",
      language_pct: 25,
      pushed_at: daysAgo(45),
      stargazers_count: 11,
      fork: false,
      archived: false,
    },
    {
      name: "PoshGuard",
      language: "PowerShell",
      language_pct: 15,
      pushed_at: daysAgo(180),
      stargazers_count: 7,
      fork: false,
      archived: false,
    },
  ];
}

function staticParticipation(repoName) {
  const lines = new Map([
    ["JobSentinel", [0, 1, 0, 2, 0, 0, 0, 2, 3, 5]],
    ["PyGuard", [0, 0, 1, 0, 0, 0, 0, 1, 4, 2]],
    ["WormsWMD-macOS-Fix", [0, 0, 0, 1, 0, 0, 0, 1, 2, 3]],
    ["PoshGuard", [0, 0, 0, 0, 1, 0, 0, 1, 1, 2]],
  ]);
  return lines.get(repoName) ?? Array(10).fill(0);
}

async function fetchOwnerRepos() {
  const repos = [];
  for (let page = 1; page <= MAX_REPO_PAGES; page++) {
    const chunk = await github(`/users/${USERNAME}/repos?type=owner&sort=pushed&direction=desc&per_page=${REPOS_PER_PAGE}&page=${page}`);
    if (!Array.isArray(chunk)) throw new Error("GitHub repos API returned an unexpected payload.");
    repos.push(...chunk);
    if (chunk.length < REPOS_PER_PAGE) return repos;
  }
  return repos;
}

function sparklineSvg(values, color) {
  const padded = Array.from({ length: 10 }, (_, i) => Math.max(0, Number(values?.[i] ?? 0) || 0));
  const max = Math.max(...padded, 1);
  return `<svg viewBox="0 0 100 28" width="100" height="28" aria-hidden="true">${padded.map((value, i) => {
    const h = Math.round(4 + (value / max) * 20);
    return `<rect x="${i * 10 + 2}" y="${25 - h}" width="5" height="${h}" rx="1.5" fill="${color}" opacity="${(0.35 + i * 0.06).toFixed(2)}"/>`;
  }).join("")}</svg>`;
}

function repoRow(repo, index, sparkline) {
  const language = repo.language || "Code";
  const color = ACCENTS[language] || LANGUAGE_COLORS.get(language) || TOKYO_NEON_PALETTE.lavender;
  return `<div class="repo-row" style="--row:${color}">
    <span class="repo-icon">${escapeHtml(language === "TypeScript" ? "TS" : language === "Python" ? "Py" : language === "Shell" ? ">_" : language === "PowerShell" ? ">" : String(index + 1))}</span>
    <span class="repo-name">${escapeHtml(shortText(repo.name, 22))}</span>
    <span class="repo-lang">${escapeHtml(shortText(language, 11))}</span>
    <span class="repo-time">Updated ${escapeHtml(relativeTime(repo.pushed_at))}</span>
    <span class="repo-spark">${sparklineSvg(sparkline, color)}</span>
  </div>`;
}

function languageSummary(allRepos) {
  const activeRepos = ownActiveRepos(allRepos);
  const weighted = activeRepos.filter((repo) => repo.language && Number.isFinite(Number(repo.language_pct)));

  if (weighted.length) {
    const totals = new Map();
    for (const repo of weighted) {
      totals.set(repo.language, (totals.get(repo.language) || 0) + Math.max(0, Number(repo.language_pct)));
    }
    const total = [...totals.values()].reduce((sum, pct) => sum + pct, 0) || 1;
    return [...totals.entries()].map(([name, pct]) => ({
      name,
      pct: Math.round((pct / total) * 100),
      color: ACCENTS[name] || LANGUAGE_COLORS.get(name) || TOKYO_NEON_PALETTE.lavender,
    }));
  }

  const counts = new Map();
  for (const repo of activeRepos) {
    if (!repo.language) continue;
    counts.set(repo.language, (counts.get(repo.language) || 0) + 1);
  }
  const entries = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
  const total = entries.reduce((sum, [, count]) => sum + count, 0) || 1;
  return entries.map(([name, count]) => ({
    name,
    pct: Math.round((count / total) * 100),
    color: ACCENTS[name] || LANGUAGE_COLORS.get(name) || TOKYO_NEON_PALETTE.lavender,
  }));
}

function donutGradient(langs) {
  if (!langs.length) return TOKYO_NEON_PALETTE.haze;
  let start = 0;
  const stops = [];
  for (const lang of langs) {
    const end = start + lang.pct;
    stops.push(`${lang.color} ${start}% ${end}%`);
    start = end;
  }
  return `conic-gradient(${stops.join(", ")})`;
}

function weeklyStreak(sparklines) {
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

function validateScreenshot(screenshot, renderedHeight) {
  if (!Number.isFinite(renderedHeight) || renderedHeight <= 0) {
    throw new Error(`Invalid rendered height: ${renderedHeight}`);
  }

  if (!screenshot || screenshot.byteLength < MIN_SCREENSHOT_BYTES) {
    throw new Error("Generated screenshot is unexpectedly small.");
  }
}

async function assetDataUrl(filename, mediaType) {
  const data = await readFile(join(ASSET_DIR, filename));
  return `data:${mediaType};base64,${data.toString("base64")}`;
}

function html({ repos, allRepos, sparklines, fontDataUrl, backgroundDataUrl, sourceWidth, sourceHeight }) {
  const latest = repos[0] ? relativeTime(repos[0].pushed_at).toUpperCase() : "—";
  const activeRepos = ownActiveRepos(allRepos);
  const totalStars = activeRepos.reduce((sum, repo) => sum + Math.max(0, Number(repo.stargazers_count) || 0), 0);
  const streak = weeklyStreak(sparklines);
  const rows = repos.map((repo, i) => repoRow(repo, i, sparklines[i])).join("");
  const langs = languageSummary(allRepos);
  const langSegments = langs.map((l) => `<span style="flex:${l.pct};background:${l.color}"></span>`).join("");
  const langRows = langs.map((l) => `<div><i style="background:${l.color}"></i><b>${escapeHtml(l.name)}</b><em>${l.pct}%</em></div>`).join("");
  const donut = donutGradient(langs);
  const fontFace = fontDataUrl ? `@font-face{font-family:'Space Mono';src:url('${fontDataUrl}') format('woff2');font-weight:400 700;font-display:block;}` : "";

  return `<!doctype html><html><head><meta charset="utf-8"><style>
${fontFace}
:root{--s:${OUTPUT_WIDTH / sourceWidth};--font:${fontDataUrl ? "'Space Mono'" : "'Courier New'"},monospace;}
*{box-sizing:border-box} body{margin:0;background:#0b1624;font-family:var(--font);width:${OUTPUT_WIDTH}px;}
.scene{position:relative;width:${OUTPUT_WIDTH}px;height:${Math.round(sourceHeight * (OUTPUT_WIDTH / sourceWidth))}px;overflow:hidden;color:#f0dec5;background:#0b1624;}
.bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;}
.scene::after{content:"";position:absolute;inset:0;pointer-events:none;background:repeating-linear-gradient(0deg,rgba(255,255,255,.018) 0 1px,transparent 1px 5px),radial-gradient(ellipse at center,transparent 58%,rgba(5,10,16,.18));mix-blend-mode:soft-light;}
.board{position:absolute;left:calc(${BOARD.left}px*var(--s));top:calc(${BOARD.top}px*var(--s));width:calc(${BOARD.width}px*var(--s));height:calc(${BOARD.height}px*var(--s));padding:calc(10px*var(--s)) calc(14px*var(--s));background:transparent;border:none;overflow:hidden;display:flex;flex-direction:column;}
.board>*{position:relative;z-index:1}
.board-head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:1px solid rgba(181,213,220,.24);padding-bottom:calc(6px*var(--s));}
.title{font-size:calc(21px*var(--s));font-weight:700;letter-spacing:calc(1px*var(--s));line-height:1;color:#f0dec5;white-space:nowrap;text-shadow:0 0 calc(7px*var(--s)) rgba(240,222,197,.28),0 0 calc(18px*var(--s)) rgba(112,190,221,.12);}
.kana{font-size:calc(12px*var(--s));letter-spacing:calc(1.5px*var(--s));color:#d7c2dc;padding-top:calc(5px*var(--s));white-space:nowrap;text-shadow:0 0 calc(8px*var(--s)) rgba(215,194,220,.22);}
.metrics{display:grid;grid-template-columns:1fr 1fr 1fr;border-bottom:1px solid rgba(181,213,220,.16);}
.metrics span{padding:calc(5px*var(--s)) calc(8px*var(--s));font-size:calc(12px*var(--s));letter-spacing:calc(.45px*var(--s));text-align:center;border-right:1px solid rgba(181,213,220,.16);white-space:nowrap;text-shadow:0 0 calc(7px*var(--s)) rgba(240,222,197,.18)}.metrics span:last-child{border-right:0}
.repo-row{display:grid;grid-template-columns:calc(23px*var(--s)) minmax(0,1fr) calc(70px*var(--s)) calc(110px*var(--s)) calc(80px*var(--s));align-items:center;gap:calc(7px*var(--s));min-height:calc(31px*var(--s));flex:1;border-bottom:1px solid rgba(181,213,220,.15);}
.repo-icon{display:flex;align-items:center;justify-content:center;width:calc(19px*var(--s));height:calc(19px*var(--s));border-radius:calc(3px*var(--s));background:var(--row);color:#07101a;font-size:calc(8px*var(--s));font-weight:700;box-shadow:0 0 calc(10px*var(--s)) color-mix(in srgb,var(--row),transparent 55%)}
.repo-name{font-size:calc(13px*var(--s));white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-shadow:0 0 calc(6px*var(--s)) rgba(240,222,197,.18)}.repo-lang,.repo-time{font-size:calc(10px*var(--s));white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.repo-lang{color:var(--row);text-shadow:0 0 calc(7px*var(--s)) color-mix(in srgb,var(--row),transparent 62%)}.repo-time{color:#d7c2dc}.repo-spark svg{width:calc(80px*var(--s));height:calc(20px*var(--s));display:block}
.summary{display:grid;grid-template-columns:1fr 1fr 1fr;padding-top:calc(7px*var(--s));font-size:calc(12px*var(--s));font-weight:700;letter-spacing:calc(.5px*var(--s));white-space:nowrap}.summary span:nth-child(1){color:#ec6cc8;text-shadow:0 0 calc(8px*var(--s)) rgba(236,108,200,.28)}.summary span:nth-child(2),.summary span:nth-child(3){color:#1fc7e6;text-align:center;text-shadow:0 0 calc(8px*var(--s)) rgba(31,199,230,.28)}.summary span:nth-child(3){text-align:right}
.toolchain{position:absolute;left:calc(${TOOLCHAIN.left}px*var(--s));top:calc(${TOOLCHAIN.top}px*var(--s));width:calc(${TOOLCHAIN.width}px*var(--s));height:calc(${TOOLCHAIN.height}px*var(--s));padding:calc(8px*var(--s)) calc(9px*var(--s));background:transparent;border:none;overflow:hidden;}
.tool-title{font-size:calc(8px*var(--s));letter-spacing:calc(.55px*var(--s));font-weight:700;color:#1fc7e6;margin-bottom:calc(6px*var(--s));white-space:nowrap;text-shadow:0 0 calc(7px*var(--s)) rgba(31,199,230,.34)}.langbar{display:flex;height:calc(8px*var(--s));gap:calc(2px*var(--s));border-radius:999px;overflow:hidden;background:#102536;margin-bottom:calc(7px*var(--s));}.tool-body{display:grid;grid-template-columns:calc(46px*var(--s)) 1fr;gap:calc(7px*var(--s));align-items:center}.donut{position:relative;width:calc(46px*var(--s));height:calc(46px*var(--s));border-radius:50%;background:${donut};box-shadow:0 0 calc(10px*var(--s)) rgba(31,199,230,.16)}.donut::after{content:"";position:absolute;inset:calc(13px*var(--s));border-radius:50%;background:transparent;}.langlist{display:grid;grid-template-columns:1fr;gap:calc(4px*var(--s));}.langlist div{display:grid;grid-template-columns:calc(7px*var(--s)) minmax(0,1fr) auto;gap:calc(4px*var(--s));align-items:center}.langlist i{width:calc(7px*var(--s));height:calc(7px*var(--s));border-radius:50%}.langlist b,.langlist em{font-size:calc(6.6px*var(--s));font-style:normal;font-weight:400;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.langlist em{color:#d7c2dc}
</style></head><body><section class="scene"><img class="bg" src="${backgroundDataUrl}" alt=""><section class="board"><div class="board-head"><div class="title">REPOSITORY SIGNALS</div><div class="kana">リポジトリ・シグナル</div></div><div class="metrics"><span>LATEST&nbsp; ${escapeHtml(latest)}</span><span>${activeRepos.length}&nbsp; ACTIVE REPOS</span><span>${totalStars}&nbsp; STARS TOTAL</span></div>${rows}<div class="summary"><span>${totalStars} STAR SIGNAL</span><span>${activeRepos.length} ACTIVE REPOS</span><span>${streak}W STREAK</span></div></section><section class="toolchain"><div class="tool-title">TOOLCHAIN SPECTRUM</div><div class="langbar">${langSegments}</div><div class="tool-body"><div class="donut"></div><div class="langlist">${langRows}</div></div></section></section></body></html>`;
}

function puppeteerLaunchArgs() {
  return process.env.CI === "true"
    ? ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"]
    : ["--disable-dev-shm-usage", "--disable-gpu"];
}

async function main() {
  const allRepos = STATIC ? staticRepos() : await fetchOwnerRepos();
  const repos = selectRepos(ownActiveRepos(allRepos), REPO_LIMIT);
  const sparklines = STATIC
    ? repos.map((repo) => staticParticipation(repo.name))
    : await Promise.all(repos.map((repo) => githubParticipation(USERNAME, repo.name)));
  const backgroundPath = join(ASSET_DIR, BACKGROUND);
  const metadata = await sharp(backgroundPath).metadata();
  const sourceWidth = metadata.width || 1672;
  const sourceHeight = metadata.height || 941;
  if (SMOKE) {
    console.log(`Smoke OK - ${repos.length} repos, ${allRepos.length} total ${STATIC ? "static" : "fetched"}, ${sourceWidth}x${sourceHeight} background`);
    return;
  }
  const [{ dataUrl: fontDataUrl }, backgroundDataUrl] = await Promise.all([
    loadFontAsDataUrl(),
    assetDataUrl(BACKGROUND, "image/png"),
  ]);

  const puppeteer = await import("puppeteer");
  const browser = await puppeteer.default.launch({ args: puppeteerLaunchArgs() });
  try {
    const page = await browser.newPage();
    const height = Math.round(sourceHeight * (OUTPUT_WIDTH / sourceWidth));
    await page.setViewport({ width: OUTPUT_WIDTH, height, deviceScaleFactor: DEVICE_SCALE });
    await page.setContent(html({ repos, allRepos, sparklines, fontDataUrl, backgroundDataUrl, sourceWidth, sourceHeight }), { waitUntil: "domcontentloaded" });
    await page.evaluate(() => document.fonts.ready);
    const screenshot = await page.screenshot({ type: "png", clip: { x: 0, y: 0, width: OUTPUT_WIDTH, height } });
    validateScreenshot(screenshot, height);
    await mkdir(OUT_DIR, { recursive: true });
    await writeFile(join(OUT_DIR, "signals.png"), screenshot);
    console.log(`assets/signals.png written with ${repos.length} repo rows`);
  } finally {
    await browser.close();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
