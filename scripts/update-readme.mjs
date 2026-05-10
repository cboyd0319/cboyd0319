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

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function shortText(value, maxLength) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3).trimEnd()}...`;
}

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
  const y = 134 + index * 66;
  const accent = accents[index % accents.length];
  const signal = String(index + 1).padStart(2, "0");
  const description = shortText(
    repo.description || fallbackDescriptions.get(repo.name) || "Public build signal",
    52,
  );
  const language = shortText(repo.language || "Public", 14).toUpperCase();
  const timestamp = repo.pushed_at ? relativeTime(repo.pushed_at) : "";
  const stars = repo.stargazers_count > 0 ? `★ ${repo.stargazers_count}` : "";
  const barX = 920;
  const bars = Array.from({ length: 8 }, (_, barIndex) => {
    const x = barX + barIndex * 18;
    const height = 8 + ((barIndex + index) % 5) * 5;
    return `<rect x="${x}" y="${y + 34 - height}" width="10" height="${height}" rx="1.5" fill="${accent}" opacity="${0.45 + barIndex * 0.06}"/>`;
  }).join("");

  return `
  <g font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" filter="url(#f-glow)">
    <path d="M76 ${y - 34}H1124L1142 ${y - 16}V${y + 38}H76Z" fill="#07101a" fill-opacity="0.66" stroke="${accent}" stroke-opacity="0.45"/>
    <path d="M76 ${y - 34}V${y + 38}" stroke="${accent}" stroke-width="5"/>
    <rect x="104" y="${y - 18}" width="44" height="36" rx="5" fill="#050916" stroke="${accent}" stroke-opacity="0.8"/>
    <text x="126" y="${y + 6}" text-anchor="middle" fill="${accent}" font-size="16" font-weight="900">${signal}</text>
    <circle cx="176" cy="${y}" r="7" fill="${accent}">
      <animate attributeName="opacity" values="1;0.45;1" dur="${2.2 + index * 0.35}s" repeatCount="indefinite"/>
    </circle>
    <text x="204" y="${y - 4}" fill="#f4fbff" font-size="22" font-weight="900">${escapeXml(repo.name)}</text>
    <text x="204" y="${y + 22}" fill="#aebbe4" font-size="15" font-weight="700">${escapeXml(description)}</text>
    <text x="760" y="${y - 4}" fill="${accent}" font-size="13" font-weight="900" letter-spacing="2">${escapeXml(language)}</text>
    <text x="760" y="${y + 18}" fill="#aebbe4" font-size="13" font-weight="700">${escapeXml(timestamp)}</text>
    <text x="760" y="${y + 36}" fill="#536083" font-size="12" font-weight="700">${escapeXml(stars)}</text>
    ${bars}
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
    description: repo.description,
    language: repo.language,
    pushed_at: repo.pushed_at,
    stargazers_count: repo.stargazers_count,
  }));

if (!lines.length) {
  throw new Error("No public profile repositories matched the curated list.");
}

const mostRecentPush = lines[0].pushed_at;
const latestActivity = relativeTime(mostRecentPush);
const syncedAt = new Date().toUTCString().replace(/:\d\d GMT$/, " UTC");

const rows = lines.map(renderRow).join("\n");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 430" role="img" aria-labelledby="title desc">
  <title id="title">CBOYD0319 Tokyo neon recent signals</title>
  <desc id="desc">A Tokyo neon station-board feed showing curated public repositories for CBOYD0319 with colored signal rows and status bars.</desc>
  <defs>
    <linearGradient id="f-bg" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0" stop-color="#050713"/>
      <stop offset="0.58" stop-color="#0b0d22"/>
      <stop offset="1" stop-color="#041216"/>
    </linearGradient>
    <radialGradient id="f-bloom" cx="84%" cy="24%" r="38%">
      <stop offset="0" stop-color="#ff2f92" stop-opacity="0.3"/>
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
  <path d="M44 42H1156V388H44Z" fill="#050916" fill-opacity="0.54" stroke="#7df9ff" stroke-opacity="0.22"/>
  <path d="M44 92H372" stroke="url(#f-hot)" stroke-width="2.2"/>
  <path d="M842 388H1156" stroke="url(#f-hot)" stroke-width="2.2"/>
  <text x="76" y="80" fill="#ff4fb3" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-size="24" font-weight="900" letter-spacing="4" filter="url(#f-glow)">RECENT SIGNALS</text>
  <circle cx="810" cy="72" r="6" fill="#31ffb6" filter="url(#f-glow)"/>
  <text x="832" y="69" fill="#7df9ff" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-size="13" font-weight="900" letter-spacing="2">LATEST ACTIVITY: ${escapeXml(latestActivity.toUpperCase())}</text>
  <text x="832" y="85" fill="#536083" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-size="11" font-weight="700">SYNCED ${escapeXml(syncedAt)}</text>
${rows}
  <text x="600" y="408" text-anchor="middle" fill="#00e5ff" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-size="14" font-weight="900" letter-spacing="8">TURNING IDEAS INTO SYSTEMS</text>
</svg>
`;

const fs = await import("node:fs/promises");
const outputPath = new URL("../assets/live-feed.svg", import.meta.url);
await fs.writeFile(outputPath, svg);

console.log(`live-feed.svg written — ${lines.length} repos, latest push ${latestActivity}`);
