// Pure unit tests — no network calls, no Puppeteer, no file I/O.
// Imports only side-effect-free lib modules.
import { relativeTime, escapeHtml, shortText, selectRepos } from "./lib/utils.mjs";
import { CURATED_REPOS } from "./lib/config.mjs";

let passed = 0;
let failed = 0;

function assert(label, actual, expected) {
  if (actual === expected) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}`);
    console.error(`    expected: ${JSON.stringify(expected)}`);
    console.error(`    actual:   ${JSON.stringify(actual)}`);
    failed++;
  }
}

function assertDeepEqual(label, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}`);
    console.error(`    expected: ${e}`);
    console.error(`    actual:   ${a}`);
    failed++;
  }
}

// Fixed reference point so tests are deterministic and not wall-clock sensitive.
const BASE = new Date("2026-05-10T12:00:00Z").getTime();
const at = (ms) => new Date(BASE - ms).toISOString();
const mins = (n) => n * 60_000;
const hours = (n) => n * 3_600_000;
const days = (n) => n * 86_400_000;

// ── relativeTime ──────────────────────────────────────────────────────────────

console.log("\nrelativeTime");

assert("30 minutes ago", relativeTime(at(mins(30)), BASE), "30m ago");
assert("59 minutes ago", relativeTime(at(mins(59)), BASE), "59m ago");
assert("1 hour ago", relativeTime(at(hours(1)), BASE), "1h ago");
assert("23 hours ago", relativeTime(at(hours(23)), BASE), "23h ago");
assert("exactly 1 day", relativeTime(at(days(1)), BASE), "1d ago");
assert("3 days ago", relativeTime(at(days(3)), BASE), "3d ago");
assert("6 days ago", relativeTime(at(days(6)), BASE), "6d ago");
assert("1 week ago", relativeTime(at(days(7)), BASE), "1w ago");
assert("4 weeks ago", relativeTime(at(days(28)), BASE), "4w ago");
assert("5 weeks → 1mo", relativeTime(at(days(35)), BASE), "1mo ago");
assert("2 months ago", relativeTime(at(days(62)), BASE), "2mo ago");
assert("invalid date → —", relativeTime("not-a-date", BASE), "—");
assert("future date → just now", relativeTime(at(-mins(5)), BASE), "just now");

// ── escapeHtml ────────────────────────────────────────────────────────────────

console.log("\nescapeHtml");

assert("ampersand", escapeHtml("a & b"), "a &amp; b");
assert("less-than", escapeHtml("<script>"), "&lt;script&gt;");
assert("quotes", escapeHtml('"hello"'), "&quot;hello&quot;");
assert("null → empty string", escapeHtml(null), "");
assert("undefined → empty string", escapeHtml(undefined), "");
assert("number coercion", escapeHtml(42), "42");
assert("no entities → unchanged", escapeHtml("hello world"), "hello world");

// ── shortText ─────────────────────────────────────────────────────────────────

console.log("\nshortText");

assert("short string unchanged", shortText("hello", 10), "hello");
assert("exact length unchanged", shortText("hello", 5), "hello");
assert("truncates with ellipsis", shortText("hello world", 8), "hello...");
assert("trims trailing space before ellipsis", shortText("aa bb cc", 6), "aa...");
assert("collapses internal whitespace", shortText("a  b   c", 20), "a b c");
assert("null → empty string", shortText(null, 10), "");
assert("undefined → empty string", shortText(undefined, 10), "");

// ── selectRepos ───────────────────────────────────────────────────────────────

console.log("\nselectRepos");

const makeRepo = (name, daysOld, overrides = {}) => ({
  name,
  fork: false,
  archived: false,
  description: null,
  language: null,
  pushed_at: at(days(daysOld)),
  stargazers_count: 0,
  ...overrides,
});

// Baseline: four curated repos, one non-curated
const allRepos = [
  makeRepo("PyGuard", 1),
  makeRepo("JobSentinel", 3),
  makeRepo("PoshGuard", 10),
  makeRepo("WormsWMD-macOS-Fix", 7),
  makeRepo("unrelated-repo", 0),
];

const selected = selectRepos(allRepos, CURATED_REPOS, 5);

assert("returns only curated repos", selected.every((r) => CURATED_REPOS.has(r.name)), true);
assert("sorts by pushed_at desc — most recent first", selected[0].name, "PyGuard");
assert("unrelated repo excluded", selected.find((r) => r.name === "unrelated-repo"), undefined);

// Fork exclusion: fork IS in curated set but must be filtered out
const forkInCurated = makeRepo("PyGuard", 0, { fork: true });
const withForkOnly = selectRepos([forkInCurated], CURATED_REPOS);
assert("fork in curated set is excluded", withForkOnly.length, 0);

// Archived exclusion: archived IS in curated set but must be filtered out
const archivedInCurated = makeRepo("PoshGuard", 0, { archived: true });
const withArchivedOnly = selectRepos([archivedInCurated], CURATED_REPOS);
assert("archived in curated set is excluded", withArchivedOnly.length, 0);

// Non-curated repo that is not a fork still excluded
const nonCuratedActive = makeRepo("not-in-set", 0);
assert("non-curated active repo excluded", selectRepos([nonCuratedActive], CURATED_REPOS).length, 0);

// Limit
const limited = selectRepos(allRepos, CURATED_REPOS, 2);
assert("respects limit", limited.length, 2);

// Edge cases
assertDeepEqual("empty API response → []", selectRepos([], CURATED_REPOS), []);
assertDeepEqual("no curated matches → []", selectRepos([makeRepo("other", 0)], CURATED_REPOS), []);

// Output shape
const [first] = selected;
assert("output includes name", "name" in first, true);
assert("output includes description", "description" in first, true);
assert("output includes language", "language" in first, true);
assert("output includes pushed_at", "pushed_at" in first, true);
assert("output includes stargazers_count", "stargazers_count" in first, true);

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
