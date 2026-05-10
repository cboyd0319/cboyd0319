import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { writeFile } from "node:fs/promises";

import {
  USERNAME,
  CURATED_REPOS,
  FALLBACK_DESCRIPTIONS,
  ACCENTS,
  OUTPUT_WIDTH,
  DEVICE_SCALE,
} from "./lib/config.mjs";
import { relativeTime, escapeHtml, shortText, selectRepos } from "./lib/utils.mjs";
import { github } from "./lib/github.mjs";
import { loadFontAsDataUrl } from "./lib/font.mjs";

// ── Row renderer ──────────────────────────────────────────────────────────────

function renderRow(repo, index) {
  const accent = ACCENTS[index % ACCENTS.length];
  const description = shortText(
    repo.description || FALLBACK_DESCRIPTIONS.get(repo.name) || "Public build signal",
    72,
  );
  const language = (repo.language || "").toUpperCase();
  const timestamp = relativeTime(repo.pushed_at);
  const stars = repo.stargazers_count > 0 ? `★ ${repo.stargazers_count}` : "";

  const bars = Array.from({ length: 10 }, (_, i) => {
    const pct = 25 + ((i * 7 + index * 13) % 76);
    return `<div style="width:7px;background:${accent};opacity:${0.35 + i * 0.065};border-radius:2px 2px 0 0;height:${pct}%;align-self:flex-end;"></div>`;
  }).join("");

  return `
  <div style="display:flex;align-items:center;gap:20px;padding:20px 0;border-bottom:1px solid rgba(32,55,95,0.55);position:relative;">
    <div style="position:absolute;left:0;top:0;bottom:0;width:4px;border-radius:2px;background:${accent};box-shadow:0 0 10px ${accent};opacity:0.9;"></div>
    <div style="width:11px;height:11px;border-radius:50%;flex-shrink:0;background:${accent};box-shadow:0 0 10px ${accent},0 0 20px ${accent}66;margin-left:16px;"></div>
    <div style="flex:1;min-width:0;">
      <div style="font-size:18px;font-weight:700;color:#c8d8ff;letter-spacing:0.5px;margin-bottom:5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
        <span style="color:#536083">${escapeHtml(USERNAME)}/</span><span style="color:#f4fbff;text-shadow:0 0 12px rgba(244,251,255,0.3)">${escapeHtml(repo.name)}</span>
      </div>
      <div style="font-size:13px;color:#7a8db3;letter-spacing:0.3px;">${escapeHtml(description)}</div>
    </div>
    <div style="font-size:12px;letter-spacing:2px;color:#7df9ff;opacity:0.8;flex-shrink:0;width:90px;text-align:right;">${escapeHtml(language)}</div>
    <div style="font-size:12px;letter-spacing:1px;color:#536083;flex-shrink:0;width:48px;text-align:right;">${escapeHtml(stars)}</div>
    <div style="font-size:14px;font-weight:700;color:${accent};text-shadow:0 0 10px ${accent}99;flex-shrink:0;width:64px;text-align:right;">${escapeHtml(timestamp)}</div>
    <div style="display:flex;gap:3px;align-items:flex-end;height:36px;flex-shrink:0;width:100px;">${bars}</div>
  </div>`;
}

// ── HTML builder ──────────────────────────────────────────────────────────────

function buildHtml(repos, fontDataUrl) {
  const latestActivity = relativeTime(repos[0].pushed_at).toUpperCase();
  const rows = repos.map(renderRow).join("");
  const fontFace = fontDataUrl
    ? `@font-face { font-family:'Share Tech Mono'; src:url('${fontDataUrl}') format('woff2'); font-display:block; }`
    : "";
  const fontStack = fontDataUrl
    ? "'Share Tech Mono','Courier New',monospace"
    : "'Courier New',Courier,monospace";

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
${fontFace}
* { margin:0; padding:0; box-sizing:border-box; }
html, body { width:${OUTPUT_WIDTH}px; background:#050713; font-family:${fontStack}; color:#f4fbff; -webkit-font-smoothing:antialiased; }
</style>
</head>
<body>
<div style="background:linear-gradient(135deg,#060915 0%,#0b0d22 55%,#041216 100%);border:1px solid rgba(125,249,255,0.15);padding:28px 36px 0;position:relative;overflow:hidden;">
  <div style="position:absolute;inset:0;pointer-events:none;background-image:radial-gradient(rgba(0,229,255,0.12) 1px,transparent 1px);background-size:28px 28px;"></div>
  <div style="position:absolute;top:-100px;right:-100px;width:400px;height:400px;pointer-events:none;background:radial-gradient(circle,rgba(255,47,146,0.18) 0%,transparent 65%);"></div>
  <div style="position:absolute;bottom:-60px;left:-60px;width:300px;height:300px;pointer-events:none;background:radial-gradient(circle,rgba(0,229,255,0.12) 0%,transparent 65%);"></div>

  <div style="display:flex;align-items:center;gap:14px;margin-bottom:18px;position:relative;">
    <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
      <circle cx="13" cy="13" r="2.8" fill="#ff4fb3"/>
      <path d="M8 13c0-2.8 2.2-5 5-5s5 2.2 5 5" stroke="#ff4fb3" stroke-width="2" stroke-linecap="round"/>
      <path d="M3.5 13c0-5.2 4.3-9.5 9.5-9.5s9.5 4.3 9.5 9.5" stroke="#ff4fb3" stroke-width="2" stroke-linecap="round" opacity="0.5"/>
    </svg>
    <div style="font-size:22px;font-weight:700;letter-spacing:5px;color:#ff4fb3;text-shadow:0 0 20px rgba(255,47,146,0.75),0 0 40px rgba(255,47,146,0.35);margin-right:auto;">RECENT SIGNALS</div>
    <div style="display:flex;align-items:center;gap:8px;">
      <div style="width:8px;height:8px;border-radius:50%;background:#31ffb6;box-shadow:0 0 8px #31ffb6,0 0 16px #31ffb666;"></div>
      <span style="font-size:13px;color:#7df9ff;letter-spacing:2px;">LATEST: ${latestActivity}</span>
    </div>
  </div>

  <div style="height:2px;background:linear-gradient(90deg,#00e5ff 0%,#ff2f92 50%,#ffe66d 100%);opacity:0.65;margin-bottom:4px;"></div>
  <div style="position:relative;">${rows}</div>
  <div style="text-align:center;padding:18px 0 22px;font-size:13px;letter-spacing:3px;color:#ff4fb3;text-shadow:0 0 12px rgba(255,47,146,0.55);">MORE ACTIVITY ON GITHUB &rsaquo;</div>
</div>
<div style="background:#030510;text-align:center;padding:14px;font-size:13px;letter-spacing:9px;color:#00e5ff;text-shadow:0 0 12px rgba(0,229,255,0.5);border-top:1px solid rgba(0,229,255,0.12);">TURNING IDEAS INTO SYSTEMS</div>
</body>
</html>`;
}

// ── Main (gated: only runs when this file is the entry point) ─────────────────

async function main() {
  const allRepos = await github(
    `/users/${USERNAME}/repos?type=owner&sort=pushed&direction=desc&per_page=100`,
  );

  const repos = selectRepos(allRepos, CURATED_REPOS);
  if (!repos.length) throw new Error("No public repos matched the curated list.");

  const { dataUrl } = await loadFontAsDataUrl();
  const html = buildHtml(repos, dataUrl);

  const puppeteer = await import("puppeteer");
  const browser = await puppeteer.default.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
  });

  let screenshot;
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: OUTPUT_WIDTH, height: 800, deviceScaleFactor: DEVICE_SCALE });
    await page.setContent(html, { waitUntil: "domcontentloaded" });
    await page.evaluate(() => document.fonts.ready);
    const bodyHeight = await page.evaluate(() => document.body.scrollHeight);
    await page.setViewport({ width: OUTPUT_WIDTH, height: bodyHeight, deviceScaleFactor: DEVICE_SCALE });
    screenshot = await page.screenshot({
      type: "png",
      clip: { x: 0, y: 0, width: OUTPUT_WIDTH, height: bodyHeight },
    });
  } finally {
    await browser.close();
  }

  const dir = dirname(fileURLToPath(import.meta.url));
  await writeFile(join(dir, "../assets/signals.png"), screenshot);
  console.log(`signals.png written — ${repos.length} repos, latest: ${relativeTime(repos[0].pushed_at)}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
