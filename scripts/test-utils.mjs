// Pure unit tests — no network calls, no Puppeteer, no file I/O.
// Imports only side-effect-free lib modules.
import { relativeTime, escapeHtml, shortText, selectRepos } from "./lib/utils.mjs";

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

// Baseline: five repos, no forks or archives
const allRepos = [
  makeRepo("repo-a", 1),
  makeRepo("repo-b", 3),
  makeRepo("repo-c", 10),
  makeRepo("repo-d", 7),
  makeRepo("repo-e", 2),
];

const selected = selectRepos(allRepos, 5);

assert("returns all non-fork non-archived repos up to limit", selected.length, 5);
assert("sorts by pushed_at desc — most recent first", selected[0].name, "repo-a");
assert("second most recent", selected[1].name, "repo-e");
assert("third most recent", selected[2].name, "repo-b");

// Fork exclusion
const withFork = [makeRepo("fork-repo", 0, { fork: true }), makeRepo("normal", 1)];
assert("fork is excluded", selectRepos(withFork).length, 1);
assert("non-fork repo is included", selectRepos(withFork)[0].name, "normal");

// Archived exclusion
const withArchived = [makeRepo("archived", 0, { archived: true }), makeRepo("active", 1)];
assert("archived is excluded", selectRepos(withArchived).length, 1);
assert("active repo is included", selectRepos(withArchived)[0].name, "active");

// Both fork and archived in same list
const mixed = [
  makeRepo("fork-one", 0, { fork: true }),
  makeRepo("archived-one", 1, { archived: true }),
  makeRepo("good", 2),
];
assert("only non-fork non-archived included", selectRepos(mixed).length, 1);
assert("good repo is the one included", selectRepos(mixed)[0].name, "good");

// Limit
const limited = selectRepos(allRepos, 3);
assert("respects limit of 3", limited.length, 3);
assert("limit selects most recent first", limited[0].name, "repo-a");

// Default limit of 5
const eightRepos = Array.from({ length: 8 }, (_, i) => makeRepo(`r${i}`, i));
assert("default limit is 5", selectRepos(eightRepos).length, 5);

// Edge cases
assertDeepEqual("empty API response → []", selectRepos([]), []);
assertDeepEqual("all forked → []", selectRepos([makeRepo("a", 0, { fork: true })]), []);
assertDeepEqual("all archived → []", selectRepos([makeRepo("b", 0, { archived: true })]), []);

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
