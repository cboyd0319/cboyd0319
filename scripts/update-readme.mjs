const username = "cboyd0319";
const markerStart = "<!-- public-work:start -->";
const markerEnd = "<!-- public-work:end -->";

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
  .map((repo) => {
    const language = repo.language || "Mixed";
    const stars = repo.stargazers_count === 1 ? "1 star" : `${repo.stargazers_count} stars`;
    const description = clean(copy.get(repo.name) || repo.description || "Public project.");

    return `- [${repo.name}](${repo.html_url}): ${language}, ${stars}, pushed ${formatDate(
      repo.pushed_at,
    )}. ${description}`;
  });

if (!lines.length) {
  throw new Error("No public profile repositories matched the curated list.");
}

const fs = await import("node:fs/promises");
const readmePath = new URL("../README.md", import.meta.url);
const readme = await fs.readFile(readmePath, "utf8");
const start = readme.indexOf(markerStart);
const end = readme.indexOf(markerEnd);

if (start === -1 || end === -1 || end < start) {
  throw new Error("README activity markers are missing or out of order.");
}

const next = `${readme.slice(0, start + markerStart.length)}
${lines.join("\n")}
${readme.slice(end)}`;

await fs.writeFile(readmePath, next);
