import puppeteer from "puppeteer";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const username = "cboyd0319";

const curatedRepos = new Set([
  "WormsWMD-macOS-Fix",
  "JobSentinel",
  "PyGuard",
  "PoshGuard",
]);

const fallbackDescriptions = new Map([
  ["PyGuard", "Python security tooling and checks"],
  ["WormsWMD-macOS-Fix", "macOS compatibility repair workflow"],
  ["JobSentinel", "Job search signals and automation"],
  ["PoshGuard", "PowerShell security guardrails"],
]);

const accents = ["#ff2f92", "#00e5ff", "#ffe66d", "#a855ff"];

function relativeTime(dateStr) {
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

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function shortText(value, maxLength) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3).trimEnd()}...`;
}

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

function renderRow(repo, index) {
  const accent = accents[index % accents.length];
  const description = shortText(
    repo.description || fallbackDescriptions.get(repo.name) || "Public build signal",
    72,
  );
  const language = (repo.language || "").toUpperCase();
  const timestamp = repo.pushed_at ? relativeTime(repo.pushed_at) : "—";
  const stars = repo.stargazers_count > 0 ? `★ ${repo.stargazers_count}` : "";

  const bars = Array.from({ length: 10 }, (_, i) => {
    const pct = 25 + ((i * 7 + index * 13) % 76);
    return `<div style="width:7px;background:${accent};opacity:${0.35 + i * 0.065};border-radius:2px 2px 0 0;height:${pct}%;align-self:flex-end;"></div>`;
  }).join("");

  return `
  <div style="
    display:flex;align-items:center;gap:20px;
    padding:20px 0;
    border-bottom:1px solid rgba(32,55,95,0.55);
    position:relative;
  ">
    <!-- left accent bar -->
    <div style="
      position:absolute;left:0;top:0;bottom:0;
      width:4px;border-radius:2px;
      background:${accent};
      box-shadow:0 0 10px ${accent};
      opacity:0.9;
    "></div>

    <!-- signal dot -->
    <div style="
      width:11px;height:11px;border-radius:50%;flex-shrink:0;
      background:${accent};
      box-shadow:0 0 10px ${accent},0 0 20px ${accent}66;
      margin-left:16px;
    "></div>

    <!-- repo info -->
    <div style="flex:1;min-width:0;">
      <div style="
        font-size:18px;font-weight:700;
        color:#c8d8ff;letter-spacing:0.5px;
        margin-bottom:5px;
        white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
      ">
        <span style="color:#536083">${escapeHtml(username)}/</span><span style="color:#f4fbff;text-shadow:0 0 12px rgba(244,251,255,0.3)">${escapeHtml(repo.name)}</span>
      </div>
      <div style="font-size:13px;color:#7a8db3;letter-spacing:0.3px;">${escapeHtml(description)}</div>
    </div>

    <!-- language -->
    <div style="
      font-size:12px;letter-spacing:2px;
      color:#7df9ff;opacity:0.8;
      flex-shrink:0;width:90px;text-align:right;
    ">${escapeHtml(language)}</div>

    <!-- stars -->
    <div style="
      font-size:12px;letter-spacing:1px;
      color:#536083;
      flex-shrink:0;width:48px;text-align:right;
    ">${escapeHtml(stars)}</div>

    <!-- timestamp -->
    <div style="
      font-size:14px;font-weight:700;
      color:${accent};
      text-shadow:0 0 10px ${accent}99;
      flex-shrink:0;width:64px;text-align:right;
    ">${escapeHtml(timestamp)}</div>

    <!-- sparklines -->
    <div style="
      display:flex;gap:3px;align-items:flex-end;
      height:36px;flex-shrink:0;width:100px;
    ">${bars}</div>
  </div>`;
}

// ── Fetch data ──────────────────────────────────────────────────────────────

const allRepos = await github(
  `/users/${username}/repos?type=owner&sort=pushed&direction=desc&per_page=100`,
);

const repos = allRepos
  .filter((r) => !r.fork && !r.archived && curatedRepos.has(r.name))
  .sort((a, b) => new Date(b.pushed_at) - new Date(a.pushed_at))
  .slice(0, 5)
  .map((r) => ({
    name: r.name,
    description: r.description,
    language: r.language,
    pushed_at: r.pushed_at,
    stargazers_count: r.stargazers_count,
  }));

if (!repos.length) {
  throw new Error("No public repos matched the curated list.");
}

const latestActivity = relativeTime(repos[0].pushed_at).toUpperCase();
const syncedAt = new Date().toISOString().slice(0, 16).replace("T", " ") + " UTC";
const rows = repos.map(renderRow).join("");

// ── HTML template ────────────────────────────────────────────────────────────

const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Share+Tech+Mono&display=swap" rel="stylesheet">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html, body {
    width:1200px;
    background:#050713;
    font-family:'Share Tech Mono','Courier New',monospace;
    color:#f4fbff;
    -webkit-font-smoothing:antialiased;
  }
</style>
</head>
<body>

<!-- ── signals panel ───────────────────────────────────────────────────── -->
<div style="
  background:linear-gradient(135deg,#060915 0%,#0b0d22 55%,#041216 100%);
  border:1px solid rgba(125,249,255,0.15);
  padding:28px 36px 0;
  position:relative;
  overflow:hidden;
">

  <!-- dot grid -->
  <div style="
    position:absolute;inset:0;pointer-events:none;
    background-image:radial-gradient(rgba(0,229,255,0.12) 1px,transparent 1px);
    background-size:28px 28px;
  "></div>

  <!-- pink bloom -->
  <div style="
    position:absolute;top:-100px;right:-100px;
    width:400px;height:400px;pointer-events:none;
    background:radial-gradient(circle,rgba(255,47,146,0.18) 0%,transparent 65%);
  "></div>

  <!-- cyan bloom bottom-left -->
  <div style="
    position:absolute;bottom:-60px;left:-60px;
    width:300px;height:300px;pointer-events:none;
    background:radial-gradient(circle,rgba(0,229,255,0.12) 0%,transparent 65%);
  "></div>

  <!-- ── header row ──────────────────────────────────────────────────── -->
  <div style="display:flex;align-items:center;gap:14px;margin-bottom:18px;position:relative;">
    <!-- broadcast icon -->
    <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
      <circle cx="13" cy="13" r="2.8" fill="#ff4fb3"/>
      <path d="M8 13c0-2.8 2.2-5 5-5s5 2.2 5 5" stroke="#ff4fb3" stroke-width="2" stroke-linecap="round"/>
      <path d="M3.5 13c0-5.2 4.3-9.5 9.5-9.5s9.5 4.3 9.5 9.5" stroke="#ff4fb3" stroke-width="2" stroke-linecap="round" opacity="0.5"/>
    </svg>

    <div style="
      font-size:22px;font-weight:700;letter-spacing:5px;
      color:#ff4fb3;
      text-shadow:0 0 20px rgba(255,47,146,0.75),0 0 40px rgba(255,47,146,0.35);
      margin-right:auto;
    ">RECENT SIGNALS</div>

    <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;">
      <div style="display:flex;align-items:center;gap:8px;">
        <div style="
          width:8px;height:8px;border-radius:50%;
          background:#31ffb6;
          box-shadow:0 0 8px #31ffb6,0 0 16px #31ffb666;
        "></div>
        <span style="font-size:13px;color:#7df9ff;letter-spacing:2px;">LATEST: ${latestActivity}</span>
      </div>
      <div style="font-size:11px;color:#3a4a6b;letter-spacing:1px;">SYNCED ${escapeHtml(syncedAt)}</div>
    </div>
  </div>

  <!-- gradient rule -->
  <div style="
    height:2px;
    background:linear-gradient(90deg,#00e5ff 0%,#ff2f92 50%,#ffe66d 100%);
    opacity:0.65;margin-bottom:4px;
  "></div>

  <!-- ── rows ────────────────────────────────────────────────────────── -->
  <div style="position:relative;">
    ${rows}
  </div>

  <!-- footer -->
  <div style="
    text-align:center;padding:18px 0 22px;
    font-size:13px;letter-spacing:3px;
    color:#ff4fb3;
    text-shadow:0 0 12px rgba(255,47,146,0.55);
  ">MORE ACTIVITY ON GITHUB &rsaquo;</div>
</div>

<!-- ── bottom bar ──────────────────────────────────────────────────────── -->
<div style="
  background:#030510;
  text-align:center;padding:14px;
  font-size:13px;letter-spacing:9px;
  color:#00e5ff;
  text-shadow:0 0 12px rgba(0,229,255,0.5);
  border-top:1px solid rgba(0,229,255,0.12);
">TURNING IDEAS INTO SYSTEMS</div>

</body>
</html>`;

// ── Puppeteer screenshot ──────────────────────────────────────────────────────

const browser = await puppeteer.launch({
  args: [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-gpu",
  ],
});

const page = await browser.newPage();
await page.setViewport({ width: 1200, height: 800, deviceScaleFactor: 2 });
await page.setContent(html, { waitUntil: "networkidle0" });

const bodyHeight = await page.evaluate(() => document.body.scrollHeight);
await page.setViewport({ width: 1200, height: bodyHeight, deviceScaleFactor: 2 });

const screenshot = await page.screenshot({
  type: "png",
  clip: { x: 0, y: 0, width: 1200, height: bodyHeight },
});

await browser.close();

const dir = dirname(fileURLToPath(import.meta.url));
const outputPath = join(dir, "../assets/signals.png");
await writeFile(outputPath, screenshot);

console.log(`signals.png written — ${repos.length} repos, latest: ${latestActivity}`);
