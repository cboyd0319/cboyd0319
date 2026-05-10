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

// ── Sparkline renderer ────────────────────────────────────────────────────────

function renderSparkline(sparkline, accent) {
  const padded = Array.from({ length: 10 }, (_, i) => sparkline[i] ?? 0);
  const max = Math.max(...padded, 1);
  return padded
    .map(
      (val, i) =>
        `<div style="width:7px;background:${accent};opacity:${0.35 + i * 0.065};border-radius:2px 2px 0 0;height:${Math.round(10 + (val / max) * 90)}%;align-self:flex-end;"></div>`,
    )
    .join("");
}

// ── Row renderer ──────────────────────────────────────────────────────────────

function renderRow(repo, index, sparkline) {
  const accent = ACCENTS[index % ACCENTS.length];
  const description = shortText(
    repo.description || REPO_SUMMARIES.get(repo.name) || "Public build signal",
    72,
  );
  const language = (repo.language || "").toUpperCase();
  const timestamp = relativeTime(repo.pushed_at);
  const stars = repo.stargazers_count > 0 ? `★ ${repo.stargazers_count}` : "";
  const bars = renderSparkline(sparkline, accent);

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

// ── Language breakdown section ─────────────────────────────────────────────────

function buildLanguageSection(allRepos) {
  const counts = new Map();
  for (const r of allRepos) {
    if (r.fork || r.archived || !r.language) continue;
    counts.set(r.language, (counts.get(r.language) ?? 0) + 1);
  }

  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  const total = sorted.reduce((s, [, n]) => s + n, 0);
  if (total === 0) return "";

  const barSegments = sorted
    .map(([lang, count]) => {
      const pct = ((count / total) * 100).toFixed(1);
      const color = LANGUAGE_COLORS.get(lang) ?? "#8888aa";
      return `<div style="flex:${pct};background:${color};min-width:4px;height:100%;" title="${escapeHtml(lang)} ${pct}%"></div>`;
    })
    .join("");

  const legend = sorted
    .map(([lang, count]) => {
      const pct = ((count / total) * 100).toFixed(1);
      const color = LANGUAGE_COLORS.get(lang) ?? "#8888aa";
      return `<div style="display:flex;align-items:center;gap:6px;">
        <div style="width:10px;height:10px;border-radius:50%;background:${color};flex-shrink:0;"></div>
        <span style="font-size:12px;color:#7a8db3;letter-spacing:0.5px;">${escapeHtml(lang)}</span>
        <span style="font-size:11px;color:#3a4a6a;letter-spacing:0.3px;">${pct}%</span>
      </div>`;
    })
    .join("");

  return `
<div style="background:linear-gradient(135deg,#060915 0%,#0b0d22 55%,#041216 100%);border:1px solid rgba(125,249,255,0.15);border-top:none;padding:20px 36px 24px;">
  <div style="font-size:13px;letter-spacing:5px;color:#7df9ff;margin-bottom:14px;opacity:0.8;">LANGUAGE BREAKDOWN</div>
  <div style="display:flex;height:8px;border-radius:4px;overflow:hidden;margin-bottom:14px;gap:2px;">
    ${barSegments}
  </div>
  <div style="display:flex;flex-wrap:wrap;gap:16px 24px;">
    ${legend}
  </div>
</div>`;
}

// ── System map SVG ────────────────────────────────────────────────────────────

function buildSystemMap() {
  const HUB_X = 564, HUB_Y = 190, HUB_R = 44;
  const NODE_R = 36;
  const nodes = [
    { label: "TOOLS",      x:  90, y: 105, color: "#ff2f92" },
    { label: "AUTOMATION", x: 305, y:  72, color: "#a855ff" },
    { label: "SECURITY",   x: 564, y:  60, color: "#ffe66d" },
    { label: "SERVICES",   x: 823, y:  72, color: "#00e5ff" },
    { label: "AGENTS",     x:1038, y: 105, color: "#31ffb6" },
  ];

  const spokes = nodes
    .map(
      (n) =>
        `<line x1="${HUB_X}" y1="${HUB_Y}" x2="${n.x}" y2="${n.y}" stroke="${n.color}" stroke-width="1.5" stroke-dasharray="4,3" opacity="0.6"/>`,
    )
    .join("\n      ");

  const nodeElements = nodes
    .map((n) => {
      const labelY = n.y + 4;
      return `<circle cx="${n.x}" cy="${n.y}" r="${NODE_R}" fill="#050713" stroke="${n.color}" stroke-width="2"/>
      <circle cx="${n.x}" cy="${n.y}" r="${NODE_R}" fill="none" stroke="${n.color}" stroke-width="8" opacity="0.12"/>
      <text x="${n.x}" y="${labelY}" text-anchor="middle" dominant-baseline="middle" font-size="9" fill="${n.color}" letter-spacing="1" font-family="'Space Mono','Courier New',monospace">${n.label}</text>`;
    })
    .join("\n      ");

  return `
<div style="background:linear-gradient(135deg,#060915 0%,#0b0d22 55%,#041216 100%);border:1px solid rgba(125,249,255,0.15);border-top:none;padding:20px 36px 28px;">
  <div style="font-size:13px;letter-spacing:5px;color:#7df9ff;margin-bottom:4px;opacity:0.8;">SYSTEM MAP</div>
  <svg width="1128" height="245" viewBox="0 0 1128 245" style="display:block;overflow:visible;">
    <defs>
      <radialGradient id="hubGlow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#00e5ff" stop-opacity="0.25"/>
        <stop offset="100%" stop-color="#00e5ff" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <!-- Spokes -->
    ${spokes}
    <!-- Hub glow -->
    <ellipse cx="${HUB_X}" cy="${HUB_Y}" rx="80" ry="80" fill="url(#hubGlow)"/>
    <!-- Hub -->
    <circle cx="${HUB_X}" cy="${HUB_Y}" r="${HUB_R}" fill="#050713" stroke="#00e5ff" stroke-width="2"/>
    <circle cx="${HUB_X}" cy="${HUB_Y}" r="${HUB_R}" fill="none" stroke="#00e5ff" stroke-width="8" opacity="0.12"/>
    <text x="${HUB_X}" y="${HUB_Y - 7}" text-anchor="middle" font-size="10" fill="#00e5ff" letter-spacing="2" font-family="'Space Mono','Courier New',monospace">CBOYD</text>
    <text x="${HUB_X}" y="${HUB_Y + 9}" text-anchor="middle" font-size="10" fill="#00e5ff" letter-spacing="2" font-family="'Space Mono','Courier New',monospace">0319</text>
    <!-- Nodes -->
    ${nodeElements}
  </svg>
</div>`;
}

// ── HTML builder ──────────────────────────────────────────────────────────────

function buildHtml(repos, sparklines, allRepos, fontDataUrl) {
  const latestActivity = relativeTime(repos[0].pushed_at).toUpperCase();
  const rows = repos.map((repo, i) => renderRow(repo, i, sparklines[i])).join("");
  const fontFace = fontDataUrl
    ? `@font-face { font-family:'Space Mono'; src:url('${fontDataUrl}') format('woff2'); font-weight:400 700; font-display:block; }`
    : "";
  const fontStack = fontDataUrl
    ? "'Space Mono','Courier New',monospace"
    : "'Courier New',Courier,monospace";

  const languageSection = buildLanguageSection(allRepos);
  const systemMapSection = buildSystemMap();

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
${languageSection}
${systemMapSection}
<div style="background:#030510;text-align:center;padding:14px;font-size:13px;letter-spacing:9px;color:#00e5ff;text-shadow:0 0 12px rgba(0,229,255,0.5);border-top:1px solid rgba(0,229,255,0.12);">TURNING IDEAS INTO SYSTEMS</div>
</body>
</html>`;
}

// ── Main (gated: only runs when this file is the entry point) ─────────────────

async function main() {
  const allRepos = await github(
    `/users/${USERNAME}/repos?type=owner&sort=pushed&direction=desc&per_page=100`,
  );

  // The profile repo itself (name === USERNAME) is excluded: the daily bot commit
  // would otherwise make it perpetually the freshest entry in the signals panel.
  const repos = selectRepos(allRepos.filter((r) => r.name !== USERNAME));
  if (!repos.length) throw new Error("No public repos found.");

  const sparklines = await Promise.all(
    repos.map((r) => githubParticipation(USERNAME, r.name)),
  );

  if (SMOKE) {
    console.log(`Smoke OK — ${repos.length} repos, ${allRepos.length} total fetched`);
    return;
  }

  const { dataUrl } = await loadFontAsDataUrl();
  const html = buildHtml(repos, sparklines, allRepos, dataUrl);

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
