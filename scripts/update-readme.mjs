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

const repos = await github(
  `/users/${username}/repos?type=owner&sort=pushed&direction=desc&per_page=100`,
);

const lines = repos
  .filter((repo) => !repo.fork && !repo.archived && copy.has(repo.name))
  .sort((a, b) => new Date(b.pushed_at) - new Date(a.pushed_at))
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

const rows = lines
  .map((repo, index) => {
    const y = 154 + index * 62;

    return `
  <g font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace">
    <text x="86" y="${y}" fill="oklch(96% 0.02 290)" font-size="22" font-weight="900">${escapeXml(repo.name)}</text>
    <text x="430" y="${y}" fill="oklch(86% 0.12 205)" font-size="18" font-weight="750">${escapeXml(repo.language)} / ${escapeXml(repo.stars)} / ${escapeXml(repo.date)}</text>
    <text x="86" y="${y + 29}" fill="oklch(79% 0.2 350)" font-size="17" font-weight="750">${escapeXml(repo.description)}</text>
  </g>`;
  })
  .join("\n");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 430" role="img" aria-labelledby="title desc">
  <title id="title">Live public feed</title>
  <desc id="desc">A cyberpunk SVG panel with latest public repository activity for Chad Boyd.</desc>
  <defs>
    <linearGradient id="feed-bg" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0" stop-color="oklch(9% 0.07 285)"/>
      <stop offset="0.55" stop-color="oklch(14% 0.1 318)"/>
      <stop offset="1" stop-color="oklch(8% 0.05 275)"/>
    </linearGradient>
    <pattern id="feed-grid" width="28" height="28" patternUnits="userSpaceOnUse">
      <path d="M28 0H0V28" fill="none" stroke="oklch(74% 0.21 205 / 0.1)" stroke-width="1"/>
    </pattern>
    <filter id="feed-glow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="3.5" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>

  <rect width="1200" height="430" fill="url(#feed-bg)"/>
  <rect width="1200" height="430" fill="url(#feed-grid)"/>
  <rect x="38" y="36" width="1124" height="358" fill="oklch(9% 0.04 280 / 0.7)" stroke="oklch(62% 0.29 350)" stroke-width="2"/>
  <path d="M70 96H1130" stroke="oklch(72% 0.24 205 / 0.42)" stroke-width="1"/>
  <path d="M70 394 104 360M1130 394 1096 360M70 36 104 70M1130 36 1096 70" stroke="oklch(72% 0.24 205)" stroke-width="2"/>

  <text x="72" y="78" fill="oklch(67% 0.28 25)" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-size="18" font-weight="900" letter-spacing="3">LIVE PUBLIC FEED</text>
  <text x="846" y="78" fill="oklch(79% 0.2 350)" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-size="15" font-weight="900" filter="url(#feed-glow)">AUTO-REFRESHED BY ACTIONS</text>
${rows}
</svg>
`;

const fs = await import("node:fs/promises");
const outputPath = new URL("../assets/live-feed.svg", import.meta.url);
await fs.writeFile(outputPath, svg);
