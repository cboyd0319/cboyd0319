/**
 * Returns a human-readable relative time string.
 * Accepts an optional `now` timestamp so callers (and tests) can control the clock.
 * Returns "—" for invalid or future dates.
 */
export function relativeTime(dateStr, now = Date.now()) {
  const date = new Date(dateStr);
  if (!isFinite(date.getTime())) return "—";
  const diffMs = now - date.getTime();
  if (diffMs < 0) return "just now";
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
