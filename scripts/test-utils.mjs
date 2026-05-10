import {
  relativeTime,
  escapeHtml,
  shortText,
  selectRepos,
  CURATED_REPOS,
} from "./generate-signals.mjs";

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

// ── relativeTime ──────────────────────────────────────────────────────────────

console.log("\nrelativeTime");

const now = new Date();
const minsAgo = (n) => new Date(now - n * 60_000).toISOString();
const hoursAgo = (n) => new Date(now - n * 3_600_000).toISOString();
const daysAgo = (n) => new Date(now - n * 86_400_000).toISOString();

assert("30 minutes ago", relativeTime(minsAgo(30)), "30m ago");
assert("59 minutes ago", relativeTime(minsAgo(59)), "59m ago");
assert("1 hour ago", relativeTime(hoursAgo(1)), "1h ago");
assert("23 hours ago", relativeTime(hoursAgo(23)), "23h ago");
assert("exactly 1 day", relativeTime(daysAgo(1)), "1d ago");
assert("3 days ago", relativeTime(daysAgo(3)), "3d ago");
assert("6 days ago", relativeTime(daysAgo(6)), "6d ago");
assert("1 week ago", relativeTime(daysAgo(7)), "1w ago");
assert("4 weeks ago", relativeTime(daysAgo(28)), "4w ago");
assert("5 weeks becomes 1mo", relativeTime(daysAgo(35)), "1mo ago");
assert("2 months ago", relativeTime(daysAgo(62)), "2mo ago");

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

const makeRepo = (name, pushed_at, extra = {}) => ({
  name,
  fork: false,
  archived: false,
  description: null,
  language: null,
  pushed_at,
  stargazers_count: 0,
  ...extra,
});

const sampleRepos = [
  makeRepo("PyGuard", daysAgo(1)),
  makeRepo("JobSentinel", daysAgo(3)),
  makeRepo("PoshGuard", daysAgo(10)),
  makeRepo("WormsWMD-macOS-Fix", daysAgo(7)),
  makeRepo("some-other-repo", daysAgo(0)),          // not in curated set
  makeRepo("PyGuard-fork", daysAgo(0), { fork: true }), // fork — excluded
  makeRepo("archived-thing", daysAgo(0), { archived: true, name: "PyGuard" }), // archived — excluded
];

const selected = selectRepos(sampleRepos, CURATED_REPOS, 5);
assert("excludes non-curated repos", selected.every((r) => CURATED_REPOS.has(r.name)), true);
assert("excludes forks", selected.every((r) => !r.fork), true);
assert("excludes archived", selected.every((r) => !r.archived), true);
assert("sorted by pushed_at desc", selected[0].name, "PyGuard");
assert("returns at most limit", selected.length <= 5, true);

const empty = selectRepos([], CURATED_REPOS);
assertDeepEqual("empty API response returns []", empty, []);

const noMatches = selectRepos([makeRepo("unrelated", daysAgo(0))], CURATED_REPOS);
assertDeepEqual("no curated matches returns []", noMatches, []);

const withLimit = selectRepos(sampleRepos, CURATED_REPOS, 2);
assert("respects limit param", withLimit.length, 2);

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
