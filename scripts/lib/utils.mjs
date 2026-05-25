/**
 * Returns a human-readable relative time string.
 * Accepts an optional `now` timestamp so callers (and tests) can control the clock.
 * Returns a dash sentinel for invalid dates and "just now" for future or sub-minute dates.
 */
export function relativeTime(dateStr, now = Date.now()) {
  const date = new Date(dateStr);
  if (!isFinite(date.getTime())) return "—";
  const diffMs = now - date.getTime();
  if (diffMs <= 0) return "just now";
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 1) return "just now";
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
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function shortText(value, maxLength) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  const limit = Math.floor(Number(maxLength));
  if (!Number.isFinite(limit) || limit <= 0) return "";
  if (text.length <= limit) return text;
  if (limit <= 3) return ".".repeat(limit);
  return `${text.slice(0, limit - 3).trimEnd()}...`;
}

export function selectRepos(allRepos, limit = 5) {
  if (!Array.isArray(allRepos) || allRepos.length === 0) return [];
  const maxRepos = Math.max(0, Math.floor(Number(limit) || 0));
  return allRepos
    .filter((repo) => {
      if (!repo || typeof repo !== "object") return false;
      if (repo.fork || repo.archived) return false;
      return Number.isFinite(new Date(repo.pushed_at).getTime());
    })
    .sort((a, b) => new Date(b.pushed_at).getTime() - new Date(a.pushed_at).getTime())
    .slice(0, maxRepos)
    .map((repo) => ({
      name: repo.name,
      description: repo.description ?? null,
      language: repo.language ?? null,
      pushed_at: repo.pushed_at,
      stargazers_count: Number.isFinite(Number(repo.stargazers_count))
        ? Math.max(0, Number(repo.stargazers_count))
        : 0,
    }));
}
