const username = "cboyd0319";

const copy = new Map([
  [
    "WormsWMD-macOS-Fix",
    "Tahoe repair kit for black screens and crash-prone sessions.",
  ],
  [
    "JobSentinel",
    "Private-by-default job radar: scrape, score, alert.",
  ],
  [
    "PyGuard",
    "Python static-analysis gate for security and code quality.",
  ],
  [
    "PoshGuard",
    "PowerShell analyzer and autofix rig with diffs and rollback.",
  ],
]);

const accents = ["#ffe66d", "#00e5ff", "#ff2f92", "#ff2f92"];

function formatDate(value) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

function clean(value) {
  return value
    .replaceAll("\u2014", ",")
    .replaceAll("\u2013", "-")
    .replaceAll("\u2022", ";")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;");
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
  const y = 142 + index * 64;
  const panelY = 120 + index * 64;
  const accent = accents[index % accents.length];

  return `
  <g font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace">
    <circle cx="86" cy="${y}" r="8" fill="${accent}" filter="url(#f-glow)"/>
    <path d="M112 ${panelY}H1092L1118 ${panelY + 26}V${panelY + 60}H112Z" fill="#0b1424" fill-opacity="0.9" stroke="${accent}" stroke-opacity="0.62"/>
    <text x="136" y="${y + 9}" fill="#f7fbff" font-size="21" font-weight="900">${escapeXml(repo.name)}</text>
    <text x="740" y="${y + 9}" fill="#7df9ff" font-size="17" font-weight="850">${escapeXml(repo.language)} / ${escapeXml(repo.stars)} / ${escapeXml(repo.date)}</text>
    <text x="136" y="${y + 33}" fill="#ff4fb3" font-size="16" font-weight="800">${escapeXml(repo.description)}</text>
  </g>`;
}

const repos = await github(
  `/users/${username}/repos?type=owner&sort=pushed&direction=desc&per_page=100`,
);

const lines = repos
  .filter((repo) => !repo.fork && !repo.archived && copy.has(repo.name))
  .sort((a, b) => new Date(b.pushed_at) - new Date(a.pushed_at))
  .slice(0, 4)
  .map((repo) => ({
    name: repo.name,
    language: repo.language || "Mixed",
    stars: repo.stargazers_count === 1 ? "1 star" : `${repo.stargazers_count} stars`,
    date: formatDate(repo.pushed_at),
    description: clean(copy.get(repo.name) || repo.description || "Public project."),
  }));

if (!lines.length) {
  throw new Error("No public profile repositories matched the curated list.");
}

const rows = lines.map(renderRow).join("\n");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 430" role="img" aria-labelledby="title desc">
  <title id="title">Live public repository broadcast</title>
  <desc id="desc">A VHS-inspired synthwave broadcast panel showing recent public repository activity for Chad Boyd.</desc>
  <defs>
    <linearGradient id="f-bg" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0" stop-color="#050713"/>
      <stop offset="0.52" stop-color="#15102d"/>
      <stop offset="1" stop-color="#061015"/>
    </linearGradient>
    <linearGradient id="f-hot" x1="0" x2="1" y1="0" y2="0">
      <stop offset="0" stop-color="#00e5ff"/>
      <stop offset="0.52" stop-color="#ff2f92"/>
      <stop offset="1" stop-color="#ffe66d"/>
    </linearGradient>
    <pattern id="f-grid" width="28" height="28" patternUnits="userSpaceOnUse">
      <path d="M28 0H0V28" fill="none" stroke="#7df9ff" stroke-opacity="0.075"/>
    </pattern>
    <pattern id="f-scan" width="8" height="8" patternUnits="userSpaceOnUse">
      <path d="M0 1H8" stroke="#ffffff" stroke-opacity="0.045"/>
    </pattern>
    <filter id="f-glow" x="-35%" y="-35%" width="170%" height="170%">
      <feGaussianBlur stdDeviation="3" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>

  <rect width="1200" height="430" fill="url(#f-bg)"/>
  <rect width="1200" height="430" fill="url(#f-grid)"/>
  <rect width="1200" height="430" fill="url(#f-scan)" opacity="0.7"/>
  <path d="M52 42H1148V388H52Z" fill="#060b16" fill-opacity="0.78" stroke="#00e5ff" stroke-opacity="0.5"/>
  <path d="M52 94H1148" stroke="url(#f-hot)" stroke-width="2.4"/>
  <text x="74" y="78" fill="#ffe66d" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-size="18" font-weight="900" letter-spacing="3">LIVE PUBLIC BROADCAST</text>
  <text x="842" y="78" fill="#7df9ff" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-size="15" font-weight="900" letter-spacing="2" filter="url(#f-glow)">AUTO REFRESHED BY ACTIONS</text>
${rows}
</svg>
`;

const fs = await import("node:fs/promises");
const outputPath = new URL("../assets/live-feed.svg", import.meta.url);
await fs.writeFile(outputPath, svg);
