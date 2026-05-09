const username = "cboyd0319";

const curatedRepos = new Set([
  "WormsWMD-macOS-Fix",
  "JobSentinel",
  "PyGuard",
  "PoshGuard",
]);

const accents = ["#ffe66d", "#00e5ff", "#ff2f92", "#ff4fb3"];

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
  const y = 158 + index * 52;
  const lineY = y + 20;
  const accent = accents[index % accents.length];

  return `
  <g font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace">
    <circle cx="96" cy="${y}" r="7" fill="${accent}" filter="url(#f-glow)"/>
    <text x="136" y="${y + 7}" fill="#f4fbff" font-size="22" font-weight="900">${escapeXml(repo.name)}</text>
    <path d="M96 ${lineY}H680" stroke="${accent}" stroke-opacity="0.3"/>
  </g>`;
}

const repos = await github(
  `/users/${username}/repos?type=owner&sort=pushed&direction=desc&per_page=100`,
);

const lines = repos
  .filter((repo) => !repo.fork && !repo.archived && curatedRepos.has(repo.name))
  .sort((a, b) => new Date(b.pushed_at) - new Date(a.pushed_at))
  .slice(0, 4)
  .map((repo) => ({
    name: repo.name,
  }));

if (!lines.length) {
  throw new Error("No public profile repositories matched the curated list.");
}

const rows = lines.map(renderRow).join("\n");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 430" role="img" aria-labelledby="title desc">
  <title id="title">Tokyo neon public repository feed</title>
  <desc id="desc">A minimal Tokyo neon station-board feed showing recent public repositories for Chad Boyd.</desc>
  <defs>
    <linearGradient id="f-bg" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0" stop-color="#050713"/>
      <stop offset="0.58" stop-color="#0b0d22"/>
      <stop offset="1" stop-color="#041216"/>
    </linearGradient>
    <radialGradient id="f-bloom" cx="84%" cy="24%" r="38%">
      <stop offset="0" stop-color="#ff2f92" stop-opacity="0.28"/>
      <stop offset="1" stop-color="#050713" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="f-hot" x1="0" x2="1" y1="0" y2="0">
      <stop offset="0" stop-color="#00e5ff"/>
      <stop offset="0.52" stop-color="#ff2f92"/>
      <stop offset="1" stop-color="#ffe66d"/>
    </linearGradient>
    <filter id="f-glow" x="-35%" y="-35%" width="170%" height="170%">
      <feGaussianBlur stdDeviation="2.8" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>

  <rect width="1200" height="430" fill="url(#f-bg)"/>
  <rect width="1200" height="430" fill="url(#f-bloom)"/>
  <g opacity="0.16" stroke="#9df8ff" stroke-width="1.1" stroke-linecap="round">
    <path d="M158 18 144 96M438 44 422 128M948 20 934 112M1090 72 1078 148"/>
  </g>
  <path d="M58 48H1142V374H58Z" fill="#050916" fill-opacity="0.54" stroke="#7df9ff" stroke-opacity="0.22"/>
  <path d="M58 96H342" stroke="url(#f-hot)" stroke-width="2.2"/>
  <path d="M874 374H1142" stroke="url(#f-hot)" stroke-width="2.2"/>
  <text x="82" y="82" fill="#ffe66d" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-size="17" font-weight="900" letter-spacing="3">RECENT SIGNALS</text>
  <text x="876" y="82" fill="#7df9ff" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-size="14" font-weight="900" letter-spacing="2">PUBLIC WORK</text>
${rows}
</svg>
`;

const fs = await import("node:fs/promises");
const outputPath = new URL("../assets/live-feed.svg", import.meta.url);
await fs.writeFile(outputPath, svg);
