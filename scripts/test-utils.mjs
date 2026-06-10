// Focused tests - no live network calls.
import { readFile } from "node:fs/promises";

import { ACCENTS, LANGUAGE_COLORS, TOKYO_NEON_PALETTE } from "./lib/config.mjs";
import { github, githubParticipation } from "./lib/github.mjs";
import { languageSummary, renderRepositorySignSvg, renderToolchainSpectrumSvg } from "./lib/svg.mjs";
import { relativeTime, escapeHtml, shortText, selectRepos } from "./lib/utils.mjs";
import { validateSignals } from "./validate-signals.mjs";

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

async function assertResolvesDeepEqual(label, fn, expected) {
  try {
    assertDeepEqual(label, await fn(), expected);
  } catch (err) {
    console.error(`  ✗ ${label}`);
    console.error(`    expected: ${JSON.stringify(expected)}`);
    console.error(`    threw:    ${err.message}`);
    failed++;
  }
}

function jsonResponse(status, body) {
  return {
    status,
    ok: status >= 200 && status < 300,
    text: async () => JSON.stringify(body),
    json: async () => body,
  };
}

// Fixed reference point so tests are deterministic and not wall-clock sensitive.
const BASE = new Date("2026-05-10T12:00:00Z").getTime();
const at = (ms) => new Date(BASE - ms).toISOString();
const mins = (n) => n * 60_000;
const hours = (n) => n * 3_600_000;
const days = (n) => n * 86_400_000;

// relativeTime

console.log("\nrelativeTime");

assert("30 minutes ago", relativeTime(at(mins(30)), BASE), "30m ago");
assert("under 1 minute -> just now", relativeTime(at(30_000), BASE), "just now");
assert("59 minutes ago", relativeTime(at(mins(59)), BASE), "59m ago");
assert("1 hour ago", relativeTime(at(hours(1)), BASE), "1h ago");
assert("23 hours ago", relativeTime(at(hours(23)), BASE), "23h ago");
assert("exactly 1 day", relativeTime(at(days(1)), BASE), "1d ago");
assert("3 days ago", relativeTime(at(days(3)), BASE), "3d ago");
assert("6 days ago", relativeTime(at(days(6)), BASE), "6d ago");
assert("1 week ago", relativeTime(at(days(7)), BASE), "1w ago");
assert("4 weeks ago", relativeTime(at(days(28)), BASE), "4w ago");
assert("5 weeks -> 1mo", relativeTime(at(days(35)), BASE), "1mo ago");
assert("2 months ago", relativeTime(at(days(62)), BASE), "2mo ago");
assert("invalid date -> dash", relativeTime("not-a-date", BASE), "—");
assert("future date -> just now", relativeTime(at(-mins(5)), BASE), "just now");

// escapeHtml

console.log("\nescapeHtml");

assert("ampersand", escapeHtml("a & b"), "a &amp; b");
assert("less-than", escapeHtml("<script>"), "&lt;script&gt;");
assert("quotes", escapeHtml('"hello"'), "&quot;hello&quot;");
assert("apostrophe", escapeHtml("can't"), "can&#39;t");
assert("null -> empty string", escapeHtml(null), "");
assert("undefined -> empty string", escapeHtml(undefined), "");
assert("number coercion", escapeHtml(42), "42");
assert("no entities -> unchanged", escapeHtml("hello world"), "hello world");

// shortText

console.log("\nshortText");

assert("short string unchanged", shortText("hello", 10), "hello");
assert("exact length unchanged", shortText("hello", 5), "hello");
assert("truncates with ellipsis", shortText("hello world", 8), "hello...");
assert("trims trailing space before ellipsis", shortText("aa bb cc", 6), "aa...");
assert("collapses internal whitespace", shortText("a  b   c", 20), "a b c");
assert("max length 2 stays within budget", shortText("abcdef", 2), "..");
assert("zero max length returns empty", shortText("abcdef", 0), "");
assert("null -> empty string", shortText(null, 10), "");
assert("undefined -> empty string", shortText(undefined, 10), "");

// selectRepos

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
assert("sorts by pushed_at desc - most recent first", selected[0].name, "repo-a");
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
assertDeepEqual("empty API response -> []", selectRepos([]), []);
assertDeepEqual("invalid entries are skipped", selectRepos([null, "bad", makeRepo("valid", 1)]).map((repo) => repo.name), ["valid"]);
assertDeepEqual("invalid pushed_at is skipped", selectRepos([makeRepo("bad-date", 0, { pushed_at: "not-a-date" }), makeRepo("valid", 1)]).map((repo) => repo.name), ["valid"]);
assertDeepEqual("all forked -> []", selectRepos([makeRepo("a", 0, { fork: true })]), []);
assertDeepEqual("all archived -> []", selectRepos([makeRepo("b", 0, { archived: true })]), []);

// Output shape
const [first] = selected;
assert("output includes name", "name" in first, true);
assert("output includes description", "description" in first, true);
assert("output includes language", "language" in first, true);
assert("output includes pushed_at", "pushed_at" in first, true);
assert("output includes stargazers_count", "stargazers_count" in first, true);

// languageSummary

console.log("\nlanguageSummary");

const languageNames = languageSummary([
  null,
  makeRepo("cboyd0319", 0, { language: "JavaScript" }),
  makeRepo("PyGuard", 1, { language: "Python" }),
  makeRepo("forked", 2, { fork: true, language: "Go" }),
  makeRepo("archived", 3, { archived: true, language: "Rust" }),
]).map((item) => item.name);

assert("profile repo language is excluded", languageNames.includes("JavaScript"), false);
assert("active repo language is included", languageNames.includes("Python"), true);
assert("fork language is excluded", languageNames.includes("Go"), false);
assert("archived language is excluded", languageNames.includes("Rust"), false);

const manyLanguageSummary = languageSummary([
  makeRepo("python-a", 1, { language: "Python" }),
  makeRepo("python-b", 2, { language: "Python" }),
  makeRepo("python-c", 3, { language: "Python" }),
  ...["JavaScript", "TypeScript", "Rust", "Go", "Ruby", "Java", "Kotlin", "Swift", "HTML"].map(
    (language, i) => makeRepo(`lang-${i}`, i + 4, { language }),
  ),
]);

assert("language overflow is grouped as Other", manyLanguageSummary.some((item) => item.name === "Other"), true);
assert("language summary stays capped", manyLanguageSummary.length, 4);
assert("top language percentage uses full total", manyLanguageSummary[0].pct, 25);

const weightedLanguageSummary = languageSummary([
  makeRepo("ts", 1, { language: "TypeScript", language_pct: 25 }),
  makeRepo("py", 2, { language: "Python", language_pct: 35 }),
  makeRepo("sh", 3, { language: "Shell", language_pct: 25 }),
  makeRepo("ps", 4, { language: "PowerShell", language_pct: 15 }),
]).map(({ name, pct }) => ({ name, pct }));

assertDeepEqual(
  "weighted language percentages preserve static display order",
  weightedLanguageSummary,
  [
    { name: "TypeScript", pct: 25 },
    { name: "Python", pct: 35 },
    { name: "Shell", pct: 25 },
    { name: "PowerShell", pct: 15 },
  ],
);

const escapedRepoSvg = renderRepositorySignSvg({
  repos: [
    makeRepo("<bad & repo>", 1, {
      language: "TypeScript",
      stargazers_count: 1,
    }),
  ],
  allRepos: [
    makeRepo("<bad & repo>", 1, {
      language: "TypeScript",
      stargazers_count: 1,
    }),
  ],
  sparklines: [[0, 1, 0, 2, 0, 0, 0, 2, 3, 5]],
  fontDataUrl: null,
  width: 500,
  height: 160,
});

assert("repository SVG uses requested dimensions", escapedRepoSvg.startsWith('<svg width="500" height="160" viewBox="0 0 500 160"'), true);
assert("repository SVG clips overlay paint inside sign display", escapedRepoSvg.includes('clip-path="url(#display-clip)"'), true);
assert("repository SVG escapes repo text", escapedRepoSvg.includes("&lt;bad &amp; repo&gt;"), true);
assert("repository SVG omits raw unsafe repo text", escapedRepoSvg.includes("<bad & repo>"), false);
assert("repository SVG keeps station target label", escapedRepoSvg.includes("新高円寺"), true);

const toolchainSvg = renderToolchainSpectrumSvg({
  allRepos: [
    makeRepo("ts", 1, { language: "TypeScript", language_pct: 25 }),
    makeRepo("py", 2, { language: "Python", language_pct: 35 }),
    makeRepo("sh", 3, { language: "Shell", language_pct: 25 }),
    makeRepo("ps", 4, { language: "PowerShell", language_pct: 15 }),
  ],
  fontDataUrl: null,
  width: 144,
  height: 420,
});

assert("toolchain SVG uses requested primary dimensions", toolchainSvg.startsWith('<svg width="144" height="420" viewBox="0 0 144 420"'), true);
assert("toolchain SVG clips overlay paint inside sign display", toolchainSvg.includes('clip-path="url(#display-clip)"'), true);
assert("toolchain SVG uses abbreviated TypeScript label", toolchainSvg.includes(">TS<"), true);
assert("toolchain SVG keeps full TypeScript name in metadata", toolchainSvg.includes('data-lang="TypeScript"'), true);

// config validation

console.log("\nconfig validation");

const sceneConfig = JSON.parse(await readFile("config/scene.json", "utf8"));
const staticDataConfig = JSON.parse(await readFile("config/static-data.json", "utf8"));
const layoutConfig = JSON.parse(await readFile("config/layouts/subway-default.json", "utf8"));
const staticRepoSvg = renderRepositorySignSvg({
  repos: staticDataConfig.repos.map((repo) => makeRepo(repo.name, 1, {
    language: repo.language,
    language_pct: repo.language_pct,
    updated_label: repo.updated,
    stargazers_count: repo.stars,
  })),
  allRepos: staticDataConfig.repos.map((repo) => makeRepo(repo.name, 1, {
    language: repo.language,
    language_pct: repo.language_pct,
    updated_label: repo.updated,
    stargazers_count: repo.stars,
  })),
  sparklines: staticDataConfig.repos.map((repo) => repo.sparkline),
  summary: staticDataConfig.summary,
  fontDataUrl: null,
  width: layoutConfig.board.designWidth,
  height: layoutConfig.board.designHeight,
});
const staticToolchainSvg = renderToolchainSpectrumSvg({
  allRepos: staticDataConfig.repos.map((repo) => makeRepo(repo.name, 1, {
    language: repo.language,
    language_pct: repo.language_pct,
    stargazers_count: repo.stars,
  })),
  fontDataUrl: null,
  width: layoutConfig.toolchain.designWidth,
  height: layoutConfig.toolchain.designHeight,
});

assert("static language percentages total 100", staticDataConfig.repos.reduce((total, repo) => total + repo.language_pct, 0), 100);
assert("static star total is configured", staticDataConfig.summary.starsTotal, 65);
assert("scene uses literal Marunouchi canon for the current blank", sceneConfig.mode, "literal_tokyo_metro_marunouchi");
assert("scene station code is M03", sceneConfig.station.code, "M03");
assert("scene service title not duplicated as item", sceneConfig.servicePanel.items.includes(sceneConfig.servicePanel.title), false);
assert("layout board inside source width", layoutConfig.board.left + layoutConfig.board.width <= layoutConfig.sourceWidth, true);
assert("layout toolchain inside source height", layoutConfig.toolchain.top + layoutConfig.toolchain.height <= layoutConfig.sourceHeight, true);
assert("static repository SVG uses plain station route label", staticRepoSvg.includes('data-station-code="M03"'), true);
assert("static repository SVG uses station target label", staticRepoSvg.includes("新高円寺"), true);
assert("static repository SVG uses time-first row", staticRepoSvg.includes(">32m<"), true);
assert("static repository SVG keeps JobSentinel row", staticRepoSvg.includes("JobSentinel"), true);
assert("static repository SVG keeps station status", staticRepoSvg.includes(">ON<"), true);
assert("static repository SVG removes language-code table column", staticRepoSvg.includes(">TS<"), false);
assert("static repository SVG removes old route-code language badge", staticRepoSvg.includes("M03-TS"), false);
assert("static repository SVG removes dashboard footer active metric", staticRepoSvg.includes("ACTIVE"), false);
assert("static repository SVG removes dashboard footer total metric", staticRepoSvg.includes("TOTAL"), false);
assert("static toolchain SVG uses station service header", staticToolchainSvg.includes("M03 SERVICE"), true);
assert("static toolchain SVG keeps compact percentage row", staticToolchainSvg.includes(">25%<"), true);
assert("static toolchain SVG removes old local label", staticToolchainSvg.includes("M03 LOCAL"), false);

try {
  await validateSignals({
    scene: sceneConfig,
    staticData: staticDataConfig,
    layout: layoutConfig,
    repositorySvg: staticRepoSvg,
    toolchainSvg: staticToolchainSvg,
  });
  assert("semantic validator accepts static config/SVGs", true, true);
} catch (err) {
  assert("semantic validator accepts static config/SVGs", err.message, "no error");
}

// palette

console.log("\npalette");

const tokyoColors = new Set(Object.values(TOKYO_NEON_PALETTE));

assertDeepEqual(
  "signal accents use Tokyo neon palette",
  ACCENTS,
  [
    TOKYO_NEON_PALETTE.ice,
    TOKYO_NEON_PALETTE.cyan,
    TOKYO_NEON_PALETTE.magenta,
    TOKYO_NEON_PALETTE.lavender,
  ],
);
assert(
  "language colors stay inside Tokyo neon palette",
  [...LANGUAGE_COLORS.values()].every((color) => tokyoColors.has(color)),
  true,
);

// github helpers

console.log("\ngithub helpers");

const originalFetch = globalThis.fetch;

let githubFetchCalls = 0;
globalThis.fetch = async () => {
  githubFetchCalls++;
  if (githubFetchCalls === 1) throw new Error("network");
  return jsonResponse(200, [{ name: "ok" }]);
};

await assertResolvesDeepEqual(
  "github retries transient fetch errors",
  () => github("/test", { retryDelayMs: 0 }),
  [{ name: "ok" }],
);
assert("github retried once", githubFetchCalls, 2);

let participationFetchCalls = 0;
globalThis.fetch = async () => {
  participationFetchCalls++;
  if (participationFetchCalls === 1) return jsonResponse(503, { message: "try later" });
  return jsonResponse(200, { all: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] });
};

await assertResolvesDeepEqual(
  "githubParticipation retries retryable status",
  () => githubParticipation("owner", "repo", { retryDelayMs: 0 }),
  [2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
);
assert("githubParticipation retried once", participationFetchCalls, 2);

globalThis.fetch = async () => ({
  status: 200,
  ok: true,
  json: async () => {
    throw new Error("bad json");
  },
});

await assertResolvesDeepEqual(
  "githubParticipation degrades on malformed stats payload",
  () => githubParticipation("owner", "repo", { retryDelayMs: 0 }),
  Array(10).fill(0),
);

globalThis.fetch = originalFetch;

// Summary

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
