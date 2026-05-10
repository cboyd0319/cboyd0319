// ── Config ────────────────────────────────────────────────────────────────────

export const USERNAME = "cboyd0319";

export const CURATED_REPOS = new Set([
  "WormsWMD-macOS-Fix",
  "JobSentinel",
  "PyGuard",
  "PoshGuard",
]);

export const FALLBACK_DESCRIPTIONS = new Map([
  ["PyGuard", "Python security tooling and checks"],
  ["WormsWMD-macOS-Fix", "macOS compatibility repair workflow"],
  ["JobSentinel", "Job search signals and automation"],
  ["PoshGuard", "PowerShell security guardrails"],
]);

export const ACCENTS = ["#ff2f92", "#00e5ff", "#ffe66d", "#a855ff"];

// ── Utilities (exported for tests) ───────────────────────────────────────────

export function relativeTime(dateStr) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "1d ago";
  if (diffDays < 7) return `${diffDays}d ago`;
  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks < 5) return `${diffWeeks}w ago`;
  const diffMonths = Math.floor(diffDays / 30);
  return `${diffMonths}mo ago`;
}

export function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function shortText(value, maxLength) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3).trimEnd()}...`;
}

export function selectRepos(allRepos, curatedSet, limit = 5) {
  if (!Array.isArray(allRepos) || allRepos.length === 0) return [];
  return allRepos
    .filter((r) => !r.fork && !r.archived && curatedSet.has(r.name))
    .sort((a, b) => new Date(b.pushed_at) - new Date(a.pushed_at))
    .slice(0, limit)
    .map((r) => ({
      name: r.name,
      description: r.description ?? null,
      language: r.language ?? null,
      pushed_at: r.pushed_at,
      stargazers_count: r.stargazers_count ?? 0,
    }));
}

// ── GitHub API ────────────────────────────────────────────────────────────────

async function github(path) {
  const headers = {
    accept: "application/vnd.github+json",
    "x-github-api-version": "2022-11-28",
    "user-agent": "cboyd0319-profile-readme",
  };
  if (process.env.GITHUB_TOKEN) {
    headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  const response = await fetch(`https://api.github.com${path}`, { headers });
  if (!response.ok) {
    throw new Error(`GitHub API ${response.status}: ${await response.text()}`);
  }
  return response.json();
}

// ── Font loading (pre-fetch so Puppeteer renders offline) ─────────────────────

async function loadFontAsDataUrl() {
  const cssRes = await fetch(
    "https://fonts.googleapis.com/css2?family=Share+Tech+Mono&display=swap",
    { headers: { "user-agent": "Mozilla/5.0" } },
  );
  const css = await cssRes.text();
  const match = css.match(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/);
  if (!match) throw new Error("Could not extract font URL from Google Fonts CSS");
  const fontBuf = await fetch(match[1]).then((r) => r.arrayBuffer());
  return `data:font/woff2;base64,${Buffer.from(fontBuf).toString("base64")}`;
}

// ── HTML row renderer ─────────────────────────────────────────────────────────

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

// ── HTML template ─────────────────────────────────────────────────────────────

function buildHtml(repos, fontDataUrl) {
  const latestActivity = relativeTime(repos[0].pushed_at).toUpperCase();
  const rows = repos.map(renderRow).join("");

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
@font-face {
  font-family: 'Share Tech Mono';
  src: url('${fontDataUrl}') format('woff2');
  font-display: block;
}
* { margin:0; padding:0; box-sizing:border-box; }
html, body { width:1200px; background:#050713; font-family:'Share Tech Mono','Courier New',monospace; color:#f4fbff; -webkit-font-smoothing:antialiased; }
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

// ── Main ──────────────────────────────────────────────────────────────────────

const allRepos = await github(
  `/users/${USERNAME}/repos?type=owner&sort=pushed&direction=desc&per_page=100`,
);

const repos = selectRepos(allRepos, CURATED_REPOS);
if (!repos.length) throw new Error("No public repos matched the curated list.");

const fontDataUrl = await loadFontAsDataUrl();
const html = buildHtml(repos, fontDataUrl);

const puppeteer = await import("puppeteer");
const browser = await puppeteer.default.launch({
  args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
});

let screenshot;
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 800, deviceScaleFactor: 2 });
  await page.setContent(html, { waitUntil: "domcontentloaded" });
  const bodyHeight = await page.evaluate(() => document.body.scrollHeight);
  await page.setViewport({ width: 1200, height: bodyHeight, deviceScaleFactor: 2 });
  screenshot = await page.screenshot({
    type: "png",
    clip: { x: 0, y: 0, width: 1200, height: bodyHeight },
  });
} finally {
  await browser.close();
}

import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const dir = dirname(fileURLToPath(import.meta.url));
await writeFile(join(dir, "../assets/signals.png"), screenshot);

console.log(`signals.png written — ${repos.length} repos, latest: ${relativeTime(repos[0].pushed_at)}`);
