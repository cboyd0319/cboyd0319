// Focused tests - no live network calls.
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { staticRepos } from "./lib/config.mjs";
import { applyFinalGrade } from "./lib/final-grade.mjs";
import { applyChromaticAberration, applyLayoutEnv, fetchOwnerRepos, panelTextureArgs, publishSignals, withLanguageBreakdowns } from "./generate-overlays.mjs";
import { verifyDisplayFont } from "./lib/font.mjs";
import { github } from "./lib/github.mjs";
import { parseMagickVersion, perspectiveControlPoints, pngOutput, REQUIRED_MAGICK_VERSION, runMagick, rasterizeSvg, waitForWriters, withImageLock } from "./lib/imagemagick.mjs";
import { fitRepositoryRows, languageSummary, renderRepositorySignSvg, renderToolchainSpectrumSvg } from "./lib/svg.mjs";
import { relativeTime, escapeHtml, shortText, selectRepos } from "./lib/utils.mjs";
import { assertOverlayPixelMetrics, expectedOutputSize, renderStaticSvgs, validateSignals } from "./validate-signals.mjs";

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

async function assertRejects(label, fn, pattern) {
  try {
    await fn();
    assert(label, "accepted", "rejected");
  } catch (err) {
    assert(label, pattern.test(err.message), true);
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
assert("null date -> dash", relativeTime(null, BASE), "—");
assert("invalid reference clock -> dash", relativeTime(at(0), NaN), "—");
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
assertDeepEqual("private repositories are excluded", selectRepos([makeRepo("hidden", 0, { private: true })]), []);
assertDeepEqual("internal repositories are excluded", selectRepos([makeRepo("hidden", 0, { visibility: "internal" })]), []);
assertDeepEqual("null push dates are excluded", selectRepos([makeRepo("empty", 0, { pushed_at: null })]), []);
assertDeepEqual("invalid names are excluded", selectRepos([makeRepo(null, 0)]), []);
assert("explicit fixture status survives selection", selectRepos([makeRepo("fixture", 0, { status: "DEPS CHECK" })])[0].status, "DEPS CHECK");

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
  makeRepo("cboyd0319", 0, { languages: { JavaScript: 1 } }),
  makeRepo("PyGuard", 1, { languages: { Python: 1 } }),
  makeRepo("forked", 2, { fork: true, languages: { Go: 1 } }),
  makeRepo("archived", 3, { archived: true, languages: { Rust: 1 } }),
]).map((item) => item.name);

assert("profile repo language is excluded", languageNames.includes("JavaScript"), false);
assert("active repo language is included", languageNames.includes("Python"), true);
assert("fork language is excluded", languageNames.includes("Go"), false);
assert("archived language is excluded", languageNames.includes("Rust"), false);
assertDeepEqual("private language data is excluded", languageSummary([makeRepo("hidden", 0, { private: true, languages: { Python: 10 } })]), []);
assertDeepEqual("missing byte maps do not invent language shares", languageSummary([makeRepo("missing", 0, { language: "Python" })]), []);
assertDeepEqual("empty language maps do not invent byte counts", languageSummary([makeRepo("empty", 0, { language: "Python", languages: {} })]), []);
assertDeepEqual("language byte counts reject coercible values", languageSummary([makeRepo("bad", 0, { languages: { Python: "100", Shell: -10 } })]), []);
assertDeepEqual("equal language shares total exactly 100", languageSummary(["A", "B", "C"].map((language) => makeRepo(language, 0, { languages: { [language]: 1 } }))).map(({ pct }) => pct), [34, 33, 33]);

const manyLanguageSummary = languageSummary([
  makeRepo("python-a", 1, { languages: { Python: 1 } }),
  makeRepo("python-b", 2, { languages: { Python: 1 } }),
  makeRepo("python-c", 3, { languages: { Python: 1 } }),
  ...["JavaScript", "TypeScript", "Rust", "Go", "Ruby", "Java", "Kotlin", "Swift", "HTML"].map(
    (language, i) => makeRepo(`lang-${i}`, i + 4, { languages: { [language]: 1 } }),
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

assertDeepEqual("weighted overflow keeps the largest language visible", languageSummary(
  ["A", "B", "C", "D", "Rust"].map((language, index) => makeRepo(language, 1, {
    language, language_pct: index === 4 ? 96 : 1,
  })),
).map(({ name, pct }) => ({ name, pct })), [
  { name: "Rust", pct: 96 }, { name: "A", pct: 1 }, { name: "B", pct: 1 }, { name: "Other", pct: 2 },
]);

const byteLanguageSummary = languageSummary([
  makeRepo("frontend", 1, {
    language: "TypeScript",
    languages: { TypeScript: 100, JavaScript: 50 },
  }),
  makeRepo("backend", 2, {
    language: "Python",
    languages: { Python: 150, Shell: 50 },
  }),
]).map(({ name, pct }) => ({ name, pct }));

assertDeepEqual(
  "language byte totals beat primary-language repo counts",
  byteLanguageSummary,
  [
    { name: "Python", pct: 43 },
    { name: "TypeScript", pct: 29 },
    { name: "JavaScript", pct: 14 },
    { name: "Shell", pct: 14 },
  ],
);

const partialByteLanguageSummary = languageSummary([
  makeRepo("frontend", 1, {
    language: "Python",
    languages: { Python: 150, Shell: 50 },
  }),
  makeRepo("backend", 2, { language: "Go" }),
]).map(({ name, pct }) => ({ name, pct }));

assertDeepEqual(
  "partial language-map coverage still uses byte totals, without inventing shares for missing maps",
  partialByteLanguageSummary,
  [
    { name: "Python", pct: 75 },
    { name: "Shell", pct: 25 },
  ],
);

for (const unsupported of [{ security_status: "FAIL" }, { dependabot_alerts: 1 }, { security_alerts: 1 }, { vulnerability_alerts: 1 }, { archived: true }]) {
  const svg = renderRepositorySignSvg({ repos: [makeRepo("public", 0, unsupported)], width: 500, height: 160 });
  assert("uncollected metadata cannot imply a security status: " + Object.keys(unsupported)[0], svg.includes('data-status-led="ACTIVE"'), true);
}

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
  width: 500,
  height: 160,
});

assert("repository SVG uses requested dimensions", escapedRepoSvg.startsWith('<svg width="500" height="160" viewBox="0 0 500 160"'), true);
assert("repository SVG clips overlay paint inside sign display", escapedRepoSvg.includes('clip-path="url(#display-clip)"'), true);
assert("repository SVG sets display font family on text nodes", escapedRepoSvg.includes("font-family=\"'Noto Sans JP'"), true);
assert("repository SVG includes Japanese status header", escapedRepoSvg.includes(">リポジトリ状況<"), true);
assert("repository SVG escapes repo text", escapedRepoSvg.includes("&lt;bad &amp; repo&gt;"), true);
assert("repository SVG omits raw unsafe repo text", escapedRepoSvg.includes("<bad & repo>"), false);
assert("repository SVG omits station target label", escapedRepoSvg.includes("新高円寺"), false);

const publicRowsSvg = renderRepositorySignSvg({
  repos: [makeRepo("first", 1), makeRepo("second", 2)],
  width: 500, height: 160,
});
assert("public rows do not invent dependency alerts", publicRowsSvg.includes(">DEPS CHECK<"), false);

const longRepoSvg = renderRepositorySignSvg({
  repos: [
    makeRepo("WormsWMD-macOS-Fix", 1, {
      language: "Shell",
      stargazers_count: 47,
    }),
  ],
  allRepos: [
    makeRepo("WormsWMD-macOS-Fix", 1, {
      language: "Shell",
      stargazers_count: 47,
    }),
  ],
  width: 500,
  height: 160,
});

assert("repository SVG trims maintenance suffix before language column", longRepoSvg.includes(">WormsWMD-macOS<"), true);
assert("repository SVG keeps long full repo name out of visible text", longRepoSvg.includes(">WormsWMD-macOS-Fix<"), false);

const toolchainSvg = renderToolchainSpectrumSvg({
  allRepos: [
    makeRepo("ts", 1, { language: "TypeScript", language_pct: 25 }),
    makeRepo("py", 2, { language: "Python", language_pct: 35 }),
    makeRepo("sh", 3, { language: "Shell", language_pct: 25 }),
    makeRepo("ps", 4, { language: "PowerShell", language_pct: 15 }),
  ],
  width: 131,
  height: 420,
});

assert("toolchain SVG uses requested primary dimensions", toolchainSvg.startsWith('<svg width="131" height="420" viewBox="0 0 131 420"'), true);
assert("toolchain SVG clips overlay paint inside sign display", toolchainSvg.includes('clip-path="url(#display-clip)"'), true);
assert("toolchain SVG includes Japanese code mix header", toolchainSvg.includes(">コード構成<"), true);
assert("toolchain SVG uses code mix title", toolchainSvg.includes(">M03 CODE MIX<"), true);
assert("toolchain SVG uses full TypeScript label", toolchainSvg.includes(">TYPESCRIPT<"), true);
assert("toolchain SVG removes old code lines title", toolchainSvg.includes(">CODE LINES<"), false);
assert("toolchain SVG sorts largest share first", toolchainSvg.indexOf(">PYTHON<") < toolchainSvg.indexOf(">TYPESCRIPT<"), true);
assert("toolchain SVG removes old toolchain title", toolchainSvg.includes(">TOOLCHAIN<"), false);

const liveLanguageToolchainSvg = renderToolchainSpectrumSvg({
  allRepos: [
    makeRepo("a", 1, { language: "TypeScript", languages: { TypeScript: 100, Rust: 80 } }),
    makeRepo("b", 2, { language: "Python", languages: { Python: 120, Ruby: 40 } }),
    makeRepo("c", 3, { language: "Shell", languages: { Shell: 20, JavaScript: 20 } }),
  ],
  width: 131,
  height: 420,
});
assert("toolchain SVG uses full Rust label", liveLanguageToolchainSvg.includes(">RUST<"), true);
assert("toolchain SVG uses full Other label", liveLanguageToolchainSvg.includes(">OTHER<"), true);

const longLanguageSvg = renderToolchainSpectrumSvg({
  allRepos: [makeRepo("notebook", 1, { languages: { "Jupyter Notebook": 1 } })],
  width: 131, height: 420,
});
assert("long language label stays clear of percentages", longLanguageSvg.includes(">JUPYTER...<"), true);

// ImageMagick helper

console.log("\nimagemagick helper");

assert(
  "parses required ImageMagick version",
  parseMagickVersion(`Version: ImageMagick ${REQUIRED_MAGICK_VERSION} Q16-HDRI aarch64`),
  REQUIRED_MAGICK_VERSION,
);
assert(
  "perspective control points map source corners to target quad",
  perspectiveControlPoints(500, 160, [
    { x: 445, y: 55 },
    { x: 945, y: 64 },
    { x: 945, y: 207 },
    { x: 445, y: 220 },
  ]),
  "0,0 445,55 500,0 945,64 500,160 945,207 0,160 445,220",
);
assertDeepEqual(
  "panel texture noise is seeded for deterministic renders",
  panelTextureArgs(0.012),
  ["-seed", "31", "-attenuate", "0.012", "+noise", "Gaussian"],
);
assertDeepEqual("panel texture disabled emits no args", panelTextureArgs(0), []);

// font loader

console.log("\nfont loader");

await verifyDisplayFont();
assert("bundled display font matches its pinned checksum", true, true);
assert("SVG relies on the bundled Fontconfig font", escapedRepoSvg.includes("@font-face"), false);

// config validation

console.log("\nconfig validation");

const sceneConfig = JSON.parse(await readFile("config/scene.json", "utf8"));
const staticDataConfig = JSON.parse(await readFile("config/static-data.json", "utf8"));
const layoutConfig = JSON.parse(await readFile("config/layouts/subway-default.json", "utf8"));
const staticReposForTests = staticRepos(staticDataConfig);
assertDeepEqual("static timestamps are deterministic", staticRepos(staticDataConfig), staticReposForTests);
assertDeepEqual("static selection sorts age labels instead of fixture order", selectRepos(staticRepos({ repos: [...staticDataConfig.repos].reverse() }), 2).map(({ name }) => name), ["JobSentinel", "PyGuard"]);
await assertRejects("invalid static ages fail closed", () => staticRepos({ repos: [{ updated: "yesterday" }] }), /Invalid static/);
const selectedStaticRepos = selectRepos(staticReposForTests, 2);
const staticRepoSvg = renderRepositorySignSvg({
  repos: selectedStaticRepos,
  allRepos: staticReposForTests,
  width: layoutConfig.board.designWidth,
  height: layoutConfig.board.designHeight,
});
const staticToolchainSvg = renderToolchainSpectrumSvg({
  allRepos: staticReposForTests,
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
assertDeepEqual("validate default output size uses layout source", expectedOutputSize(layoutConfig, {}), { width: 1672, height: 941 });
assertDeepEqual("validate output size honors OUTPUT_WIDTH", expectedOutputSize(layoutConfig, { OUTPUT_WIDTH: "800" }), { width: 800, height: 450 });
for (const value of ["bad", "-1", "0", "0.5", "Infinity"]) {
  await assertRejects(`reject invalid OUTPUT_WIDTH ${value}`, () => expectedOutputSize(layoutConfig, { OUTPUT_WIDTH: value }), /OUTPUT_WIDTH/);
}
assert("static repository SVG uses plain station route label", staticRepoSvg.includes('data-station-code="M03"'), true);
assert("static repository SVG uses Japanese status header", staticRepoSvg.includes(">リポジトリ状況<"), true);
assert("static repository SVG omits old Japanese signal header", staticRepoSvg.includes(">リポジトリ信号<"), false);
assert("static repository SVG omits top-right station label", staticRepoSvg.includes("新高円寺"), false);
assert("static repository SVG uses time-first row", staticRepoSvg.includes(">32m<"), true);
assert("static repository SVG keeps JobSentinel row", staticRepoSvg.includes("JobSentinel"), true);
assert("static repository SVG adds internal text shadow", staticRepoSvg.includes('fill="#000000" opacity="0.6"'), true);
assert("static repository SVG adds status LED shadow", staticRepoSvg.includes('r="3" fill="#000000" opacity="0.55"'), true);
assert("static repository SVG adds structure line shadow", staticRepoSvg.includes('x1="37.5" y1="51.5"'), true);
assert("static repository SVG adds screen falloff", staticRepoSvg.includes('fill="url(#screen-falloff)"'), true);
assert("static repository SVG keeps second most recently updated row", staticRepoSvg.includes("PyGuard"), true);
assert("static repository SVG omits older Worms row", staticRepoSvg.includes("WormsWMD-macOS-Fix"), false);
assert("static repository SVG omits older PoshGuard row", staticRepoSvg.includes("PoshGuard"), false);
assert("static repository SVG rejects Norms typo", staticRepoSvg.includes("Norms macOS Fix"), false);
assert("static repository SVG keeps active station status", staticRepoSvg.includes(">ACTIVE<"), true);
assert("static repository SVG keeps dependency check station status", staticRepoSvg.includes(">DEPS CHECK<"), true);
assert("static repository SVG renders status LEDs", staticRepoSvg.includes('data-status-led="ACTIVE"') && staticRepoSvg.includes('data-status-led="DEPS CHECK"'), true);
assert("static repository SVG uses muted green active LED", staticRepoSvg.includes('fill="#7FB95A"'), true);
assert("static repository SVG keeps star counts", staticRepoSvg.includes(">★ 28<") && staticRepoSvg.includes(">★ 19<"), true);
assert("static repository SVG removes language-code table column", staticRepoSvg.includes(">TS<"), false);
assert("static repository SVG removes old route-code language badge", staticRepoSvg.includes("M03-TS"), false);
assert("static repository SVG removes dashboard footer active metric", staticRepoSvg.includes("ACTIVE REPOS"), false);
assert("static repository SVG removes dashboard footer total metric", staticRepoSvg.includes("TOTAL"), false);
assert("static repository SVG avoids full-panel wash rectangles", staticRepoSvg.includes('fill="url(#panel-life)"') || staticRepoSvg.includes('fill="url(#ui-scanline)"'), false);
assert("static toolchain SVG removes station service header", staticToolchainSvg.includes("M03 SERVICE"), false);
assert("static toolchain SVG uses Japanese code mix header", staticToolchainSvg.includes(">コード構成<"), true);
assert("static toolchain SVG adds structure line shadow", staticToolchainSvg.includes('x1="20.5" y1="59.5"'), true);
assert("static toolchain SVG adds screen falloff", staticToolchainSvg.includes('fill="url(#screen-falloff)"'), true);
assert("static toolchain SVG uses code mix title", staticToolchainSvg.includes(">M03 CODE MIX<"), true);
assert("static toolchain SVG removes old code lines title", staticToolchainSvg.includes(">CODE LINES<"), false);
assert("static toolchain SVG uses full language labels", staticToolchainSvg.includes(">PYTHON<") && staticToolchainSvg.includes(">TYPESCRIPT<"), true);
assert("static toolchain SVG sorts Python before TypeScript", staticToolchainSvg.indexOf(">PYTHON<") < staticToolchainSvg.indexOf(">TYPESCRIPT<"), true);
assert("static toolchain SVG keeps compact percentage row", staticToolchainSvg.includes(">25%<"), true);
assert("static toolchain SVG removes old local label", staticToolchainSvg.includes("M03 LOCAL"), false);
assert("static toolchain SVG removes old toolchain title", staticToolchainSvg.includes(">TOOLCHAIN<"), false);
assert("static toolchain SVG avoids full-panel wash rectangles", staticToolchainSvg.includes('fill="url(#panel-life)"') || staticToolchainSvg.includes('fill="url(#ui-scanline)"'), false);

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

const semanticInput = {
  scene: sceneConfig, staticData: staticDataConfig, layout: layoutConfig,
  repositorySvg: staticRepoSvg, toolchainSvg: staticToolchainSvg,
};
await assertRejects("station code must match the approved background", () => validateSignals({
  ...semanticInput, scene: { ...sceneConfig, station: { ...sceneConfig.station, code: "M04" } },
}), /approved M03 background/);
const profileFixture = { ...staticDataConfig, repos: [{ ...staticDataConfig.repos[0], name: "cboyd0319", updated: "0m ago" }, ...staticDataConfig.repos] };
assertDeepEqual("static validator selection excludes the profile repository", [...renderStaticSvgs(profileFixture, layoutConfig).repositorySvg.matchAll(/data-repo="([^"]+)"/g)].map((match) => match[1]), ["JobSentinel", "PyGuard"]);
for (const [label, mutate] of [
  ["nonfinite coordinates", (layout) => { layout.board.left = NaN; }],
  ["missing dimensions", (layout) => { delete layout.board.width; }],
  ["nonnumeric quad", (layout) => { layout.board.quad[0].x = null; }],
  ["invalid source size", (layout) => { layout.sourceWidth = NaN; }],
  ["nonnumeric design size", (layout) => { layout.board.designWidth = "500"; }],
  ["concave quad", (layout) => { layout.board.quad[2] = { x: 500, y: 100 }; }],
]) {
  const layout = structuredClone(layoutConfig);
  mutate(layout);
  await assertRejects(`validator rejects ${label}`, () => validateSignals({ ...semanticInput, layout }), /signals validation failed/);
}
for (const value of [NaN, Infinity, -0.1, undefined]) {
  await assertRejects(`validator rejects invalid pixel metric ${value}`, () => assertOverlayPixelMetrics({
    outside: { mean: value, max: 0 }, inside: { mean: 0.1, max: 0.2 },
  }), /invalid overlay pixel metrics/);
}
const invalidStaticData = structuredClone(staticDataConfig);
invalidStaticData.repos[0].language_pct = -10;
invalidStaticData.repos[1].language_pct += 35;
await assertRejects("validator rejects negative percentages even when total is 100", () => validateSignals({
  ...semanticInput, staticData: invalidStaticData,
}), /invalid static language percentage/);
for (const language of [null, "", " "]) {
  const staticData = structuredClone(staticDataConfig);
  staticData.repos[0].language = language;
  await assertRejects("positive static language weights require a language", () => validateSignals({
    ...semanticInput, staticData,
  }), /static language missing/);
}
const fractionalStaticData = structuredClone(staticDataConfig);
fractionalStaticData.repos.forEach((repo, index) => { repo.language_pct = [33.3, 33.3, 33.3, 0.1][index]; });
await assertResolvesDeepEqual("static percentages tolerate floating-point addition", () => validateSignals({
  ...semanticInput, staticData: fractionalStaticData,
}), true);
await assertResolvesDeepEqual("historical label substrings remain valid public repo names", () => validateSignals({
  ...semanticInput, repositorySvg: staticRepoSvg.replaceAll("JobSentinel", "toolchain-spectrum"),
}), true);

const originalBoardLeft = process.env.BOARD_LEFT;
const originalBoardTop = process.env.BOARD_TOP;
const originalBoardWidth = process.env.BOARD_WIDTH;
const originalBoardHeight = process.env.BOARD_HEIGHT;
process.env.BOARD_LEFT = "bad";
await assertRejects("invalid layout overrides fail closed", () => applyLayoutEnv(layoutConfig), /BOARD_LEFT must be a finite number/);
process.env.BOARD_LEFT = "10";
process.env.BOARD_TOP = "20";
process.env.BOARD_WIDTH = "30";
process.env.BOARD_HEIGHT = "40";
const envLayout = applyLayoutEnv(layoutConfig);
assertDeepEqual("board env overrides rebuild quad", envLayout.board.quad, [
  { x: 10, y: 20 },
  { x: 40, y: 20 },
  { x: 40, y: 60 },
  { x: 10, y: 60 },
]);
try {
  await validateSignals({
    scene: sceneConfig,
    staticData: staticDataConfig,
    layout: envLayout,
    repositorySvg: staticRepoSvg,
    toolchainSvg: staticToolchainSvg,
  });
  assert("semantic validator accepts layout env overrides", true, true);
} catch (err) {
  assert("semantic validator accepts layout env overrides", err.message, "no error");
}
if (originalBoardLeft === undefined) delete process.env.BOARD_LEFT;
else process.env.BOARD_LEFT = originalBoardLeft;
if (originalBoardTop === undefined) delete process.env.BOARD_TOP;
else process.env.BOARD_TOP = originalBoardTop;
if (originalBoardWidth === undefined) delete process.env.BOARD_WIDTH;
else process.env.BOARD_WIDTH = originalBoardWidth;
if (originalBoardHeight === undefined) delete process.env.BOARD_HEIGHT;
else process.env.BOARD_HEIGHT = originalBoardHeight;

console.log("\nimage validation");

const validationTmp = await mkdtemp(join(tmpdir(), "signals-validation-"));
try {
  await mkdir(join(validationTmp, "scripts/lib"), { recursive: true });
  await mkdir(join(validationTmp, "assets"));
  for (const file of ["optimize-signals.mjs", "lib/imagemagick.mjs", "lib/font.mjs"]) {
    await copyFile(join("scripts", file), join(validationTmp, "scripts", file));
  }
  const missingOptimization = spawnSync(process.execPath, [join(validationTmp, "scripts/optimize-signals.mjs")], { encoding: "utf8" });
  assert("optimizer fails when signals.png is missing", missingOptimization.status, 1);
  assert("optimizer explains missing input", missingOptimization.stderr.includes("run the generator before optimizing"), true);
  await Promise.all(["fonts", "config"].map((directory) => mkdir(join(validationTmp, directory))));
  await copyFile("fonts/NotoSansJP-VF.ttf", join(validationTmp, "fonts/NotoSansJP-VF.ttf"));
  await copyFile("config/fonts.conf", join(validationTmp, "config/fonts.conf"));
  const optimizedImage = join(validationTmp, "assets/signals.png");
  await copyFile("assets/subway_blank_original.png", optimizedImage);
  const optimization = spawnSync(process.execPath, [join(validationTmp, "scripts/optimize-signals.mjs")], { encoding: "utf8" });
  assert("optimizer accepts valid image", optimization.status, 0);
  const { stdout: pngTime } = await runMagick(["identify", "-quiet", "-format", "%[png:tIME]", optimizedImage]);
  assert("optimized PNG excludes nondeterministic time chunk", pngTime, "");
  const optimizedBytes = await readFile(optimizedImage);
  const webOptimization = spawnSync(process.execPath, [join(validationTmp, "scripts/optimize-signals.mjs"), "--web"], { encoding: "utf8" });
  assert("web optimization succeeds", webOptimization.status, 0);
  assert("web experiment preserves production image", (await readFile(optimizedImage)).equals(optimizedBytes), true);
  assert("web experiment writes separate PNG", (await readFile(join(validationTmp, "assets/generated/signals-web.png"))).length > 10_000, true);
  await withImageLock(optimizedImage, () => assertRejects("concurrent image writers fail before entering work", () => withImageLock(optimizedImage, () => {
    throw new Error("second writer entered");
  }), /Image writer lock exists/));
  await assertRejects("image writer propagates failure", () => withImageLock(optimizedImage, () => { throw new Error("render failed"); }), /render failed/);
  assert("image writer releases lock after success and failure", await withImageLock(optimizedImage, () => 42), 42);
  const candidate = join(validationTmp, "candidate.png");
  const published = join(validationTmp, "signals.png");
  await writeFile(candidate, "invalid candidate");
  await writeFile(published, "last valid output");
  try {
    await publishSignals(candidate, published, {});
    assert("publisher rejects invalid candidate", "accepted", "rejected");
  } catch (err) {
    assert("publisher validates before replacing output", err.message.includes("scene config not loaded"), true);
  }
  assert("failed validation preserves published image", await readFile(published, "utf8"), "last valid output");
  const blackImage = join(validationTmp, "black.png");
  await runMagick(["-size", "1672x941", "xc:black", pngOutput(blackImage)]);
  try {
    await publishSignals(blackImage, published, {
      scene: sceneConfig,
      staticData: staticDataConfig,
      layout: layoutConfig,
      repositorySvg: staticRepoSvg,
      toolchainSvg: staticToolchainSvg,
      background: "assets/subway_blank_original.png",
      width: 1672,
      height: 941,
    });
    assert("publisher rejects blank or unrelated PNG content", "accepted", "rejected");
  } catch (err) {
    assert("publisher rejects blank or unrelated PNG content", err.message.includes("outside overlay region"), true);
  }
  const graded = join(validationTmp, "graded.png");
  await applyFinalGrade("assets/subway_blank_original.png", graded, { width: 1672, height: 941, workDir: validationTmp });
  for (const [name, rectangle] of [["toolchain", "500,100 800,150"], ["repository", "1450,300 1500,500"]]) {
    const partial = join(validationTmp, `missing-${name}.png`);
    await runMagick([graded, "-fill", "white", "-draw", `rectangle ${rectangle}`, pngOutput(partial)]);
    await assertRejects(`validator rejects missing ${name} overlay`, () => validateSignals({
      ...semanticInput, output: partial, background: "assets/subway_blank_original.png", width: 1672, height: 941,
    }), /missing overlay-region changes/);
  }
  assert("failed raster validation preserves published image", await readFile(published, "utf8"), "last valid output");
} finally {
  await rm(validationTmp, { recursive: true, force: true });
}

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

try {
  const failedBodyResponse = (status) => new Response(new ReadableStream({
    start(controller) { controller.error(new Error("sensitive stream failure")); },
  }), { status });
  githubFetchCalls = 0;
  globalThis.fetch = async () => ++githubFetchCalls === 1
    ? failedBodyResponse(200) : Response.json({ recovered: true });
  await assertResolvesDeepEqual("github retries interrupted response bodies", () => github("/test", { retryDelayMs: 0 }), { recovered: true });
  assert("interrupted body is retried once", githubFetchCalls, 2);
  githubFetchCalls = 0;
  globalThis.fetch = async () => { githubFetchCalls++; return failedBodyResponse(200); };
  await assertRejects("body retry exhaustion keeps transport errors private", () => github("/test", { retryDelayMs: 0 }), /^GitHub API request failed after retries\.$/);
  assert("body retry exhaustion is bounded", githubFetchCalls, 4);
  githubFetchCalls = 0;
  globalThis.fetch = async () => { githubFetchCalls++; return new Response("invalid JSON"); };
  await assertRejects("malformed JSON fails closed", () => github("/test", { retryDelayMs: 0 }), /^GitHub API returned invalid JSON\.$/);
  assert("malformed JSON is not retried", githubFetchCalls, 1);
  githubFetchCalls = 0;
  globalThis.fetch = async () => ++githubFetchCalls === 1
    ? failedBodyResponse(503) : Response.json({ recovered: true });
  await assertResolvesDeepEqual("body cancellation failure preserves HTTP retry", () => github("/test", { retryDelayMs: 0 }), { recovered: true });
  assert("HTTP status retries despite cancellation failure", githubFetchCalls, 2);
  globalThis.fetch = async () => failedBodyResponse(403);
  await assertRejects("body cancellation failure cannot expose raw errors", () => github("/test", { retryDelayMs: 0 }), /^GitHub API 403$/);

  for (const status of [403, 429]) {
    githubFetchCalls = 0;
    globalThis.fetch = async () => { githubFetchCalls++; return jsonResponse(status, { message: "sensitive response body" }); };
    await assertRejects(`github stops on ${status} without exposing response bodies`, () => github("/test", { retryDelayMs: 0 }), new RegExp(`^GitHub API ${status}$`));
    assert(`github does not retry ${status}`, githubFetchCalls, 1);
  }
  githubFetchCalls = 0;
  globalThis.fetch = async () => { githubFetchCalls++; return jsonResponse(503, {}); };
  await assertRejects("github bounds transient HTTP retries", () => github("/test", { retryDelayMs: 0 }), /^GitHub API 503$/);
  assert("github exhausts exactly four attempts", githubFetchCalls, 4);

  const publicRepo = (name, overrides = {}) => makeRepo(name, 0, { private: false, owner: { login: "cboyd0319" }, ...overrides });
  let page = 0;
  globalThis.fetch = async () => jsonResponse(200, ++page === 1
    ? Array.from({ length: 100 }, (_, index) => publicRepo(`repo-${index}`))
    : [publicRepo("repo-0"), publicRepo("private", { private: true }), publicRepo("foreign", { owner: { login: "elsewhere" } })]);
  const fetchedRepos = await fetchOwnerRepos();
  assert("owner repository pagination fetches all pages", page, 2);
  assert("owner boundary filters private, foreign and duplicate entries", fetchedRepos.length, 100);
  assert("API output drops unneeded fields", "owner" in fetchedRepos[0], false);
  globalThis.fetch = async () => jsonResponse(200, [publicRepo("broken", { stargazers_count: "12" })]);
  await assertRejects("malformed repository data fails closed", fetchOwnerRepos, /invalid repository metadata/);
  globalThis.fetch = async () => jsonResponse(200, Array.from({ length: 100 }, (_, index) => publicRepo(`repo-${index}`)));
  await assertRejects("pagination cap cannot silently publish partial totals", fetchOwnerRepos, /pagination limit/);

  const originalToken = process.env.GITHUB_TOKEN;
  process.env.GITHUB_TOKEN = "test-public-boundary-sentinel";
  try {
    globalThis.fetch = async (_url, options) => {
      assert("owner listing can retain optional authentication", options.headers.authorization === "Bearer test-public-boundary-sentinel", true);
      assert("owner listing rejects redirects", options.redirect, "manual");
      return Response.json([publicRepo("one", { status: "FAIL", security_status: "FAIL", dependabot_alerts: 1 })]);
    };
    const listed = await fetchOwnerRepos();
    assert("live repository data drops status metadata", "status" in listed[0] || "security_status" in listed[0] || "dependabot_alerts" in listed[0], false);
    globalThis.fetch = async (_url, options) => {
      assert("language lookup never sends the configured token", new Headers(options.headers).has("authorization"), false);
      assert("language lookup rejects redirects", options.redirect, "manual");
      return new Headers(options.headers).has("authorization")
        ? Response.json({ Private: 100 }) : new Response(null, { status: 404 });
    };
    await assertRejects("a repository made private after listing aborts refresh", () => withLanguageBreakdowns(listed), /^GitHub API 404$/);
    globalThis.fetch = async () => new Response(null, { status: 301, headers: { location: "https://api.github.com/repos/elsewhere/one/languages" } });
    await assertRejects("transferred repository languages abort refresh", () => withLanguageBreakdowns(listed), /^GitHub API 301$/);
  } finally {
    if (originalToken === undefined) delete process.env.GITHUB_TOKEN;
    else process.env.GITHUB_TOKEN = originalToken;
  }

  let activeRequests = 0;
  let peakRequests = 0;
  globalThis.fetch = async () => {
    activeRequests++;
    peakRequests = Math.max(peakRequests, activeRequests);
    await Promise.resolve();
    activeRequests--;
    return jsonResponse(200, { Python: 100 });
  };
  const enriched = await withLanguageBreakdowns([makeRepo("one", 0), makeRepo("two", 0)]);
  assert("language requests run serially", peakRequests, 1);
  assert("all active repositories receive language maps", enriched.every((repo) => repo.languages.Python === 100), true);
  globalThis.fetch = async () => jsonResponse(403, {});
  await assertRejects("language failures abort incomplete refreshes", () => withLanguageBreakdowns([makeRepo("one", 0)]), /^GitHub API 403$/);
  globalThis.fetch = async () => jsonResponse(200, { Python: "100" });
  await assertRejects("malformed language bytes fail closed", () => withLanguageBreakdowns([makeRepo("one", 0)]), /unexpected payload/);
} finally {
  globalThis.fetch = originalFetch;
}


// Exercise publication against disposable Git remotes; no credentials or network.
if (spawnSync("jq", ["--version"], { encoding: "utf8" }).stdout?.trim() !== "jq-1.8.2") {
  throw new Error("Publisher regression tests require jq 1.8.2 on PATH.");
}
console.log("\nprofile publication");
const installerSource = await readFile("scripts/install-imagemagick-ci.sh", "utf8");
const aptPins = installerSource.match(/apt-get install[^\n]*\\\n((?:  .*(?:\\\n|\n))+)/)?.[1].replaceAll("\\", "").trim().split(/\s+/) ?? [];
assert("CI build prerequisites are explicitly versioned", aptPins.length === 10 && aptPins.every((pin) => /^[a-z0-9+.-]+=[^\s]+$/.test(pin)), true);
for (const file of ["ci.yml", "update-profile.yml"]) {
  const workflow = await readFile(join(".github/workflows", file), "utf8");
  assert(`${file} delegates package installation to one owner`, (workflow.match(/\.\/scripts\/install-imagemagick-ci\.sh/g) ?? []).length === 1 && !workflow.includes("apt-get install"), true);
}
const publisher = join(process.cwd(), "scripts/publish-signals.sh");
const publicationDir = await mkdtemp(join(tmpdir(), "signals-publish-"));
try {
  const bin = join(publicationDir, "bin");
  await mkdir(bin);
  await writeFile(join(bin, "sleep"), "#!/bin/sh\nexit 0\n", { mode: 0o755 });
  await writeFile(join(bin, "git"), `#!/usr/bin/env bash
set -eu
if [[ "$CASE" == rollback && " $* " == *" HEAD:refs/heads/main "* ]]; then
  PATH="$REAL_PATH" git --git-dir="$TEST_ROOT/remote" update-ref refs/heads/main "$ANCESTOR_SHA"
fi
PATH="$REAL_PATH" exec git "$@"
`, { mode: 0o755 });
  await writeFile(join(bin, "gh"), String.raw`#!/usr/bin/env bash
set -eu
case "$1 $2" in
  'api '*)
    sha="$(git rev-parse HEAD)"
    [[ "$CASE" != wrong_sha ]] || sha=0000000000000000000000000000000000000000
    event=push
    [[ "$CASE" != wrong_event ]] || event=pull_request
    if [[ "$CASE" == dispatch && ! -f "$TEST_ROOT/dispatched" ]]; then
      data='{"workflow_runs":[]}'
    else
      data="{\"workflow_runs\":[{\"id\":123,\"head_sha\":\"$sha\",\"head_branch\":\"$UPDATE_BRANCH\",\"event\":\"$event\"}]}"
    fi
    [[ "$2" == *'/actions/workflows/ci.yml/runs?'* ]] || exit 9
    printf '%s' "$data" | jq -r "$4"
    ;;
  'workflow run') touch "$TEST_ROOT/dispatched" ;;
  'run watch') [[ "$CASE" != failed ]] ;;
  'run view')
    if [[ "$CASE" == drift ]]; then git --git-dir="$TEST_ROOT/remote" update-ref refs/heads/main "$DRIFT_SHA"; fi
    job=validate
    [[ "$CASE" != wrong_job ]] || job=unrelated
    printf '{"headSha":"%s","headBranch":"%s","status":"completed","conclusion":"success","jobs":[{"name":"%s","conclusion":"success"}]}' "$(git rev-parse HEAD)" "$UPDATE_BRANCH" "$job" | jq -r "$7"
    ;;
  *) exit 9 ;;
esac
`, { mode: 0o755 });
  for (const scenario of ["success", "dispatch", "failed", "wrong_sha", "wrong_event", "wrong_job", "drift", "unchanged", "staged_image", "staged_other", "main_branch", "rollback"]) {
    const root = join(publicationDir, scenario);
    await mkdir(root);
    const env = { PATH: bin + ":" + process.env.PATH, HOME: root, GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "/dev/null", GIT_AUTHOR_NAME: "test", GIT_AUTHOR_EMAIL: "test@example.invalid", GIT_COMMITTER_NAME: "test", GIT_COMMITTER_EMAIL: "test@example.invalid", GITHUB_REPOSITORY: "test/profile", UPDATE_BRANCH: "automation/update-signals-panel", TEST_ROOT: root, CASE: scenario };
    env.REAL_PATH = process.env.PATH;
    const git = (...args) => {
      const result = spawnSync("git", args, { cwd: root, env, encoding: "utf8" });
      if (result.status !== 0) throw new Error(result.stderr);
      return result.stdout.trim();
    };
    git("init", "--bare", "remote");
    git("init", "-b", "main", "local");
    const local = join(root, "local");
    await mkdir(join(local, "assets"));
    await writeFile(join(local, "assets/signals.png"), "original");
    git("-C", local, "add", "assets/signals.png");
    git("-C", local, "commit", "-m", "Initial image");
    if (scenario === "rollback") {
      env.ANCESTOR_SHA = git("-C", local, "rev-parse", "HEAD");
      git("-C", local, "commit", "--allow-empty", "-m", "Baseline");
    }
    git("-C", local, "remote", "add", "origin", join(root, "remote"));
    git("-C", local, "push", "origin", "main");
    env.GITHUB_SHA = git("-C", local, "rev-parse", "HEAD");
    env.DRIFT_SHA = git("-C", local, "commit-tree", "HEAD^{tree}", "-p", "HEAD", "-m", "Concurrent update");
    git("-C", local, "push", "origin", env.DRIFT_SHA + ":refs/heads/drift");
    if (scenario !== "unchanged") await writeFile(join(local, "assets/signals.png"), "updated");
    if (scenario === "staged_image") git("-C", local, "add", "assets/signals.png");
    if (scenario === "staged_other") {
      await writeFile(join(local, "unrelated.txt"), "unrelated");
      git("-C", local, "add", "unrelated.txt");
    }
    if (scenario === "main_branch") {
      env.UPDATE_BRANCH = "main";
      env.CASE = "failed";
    }
    const result = spawnSync("bash", [publisher], { cwd: local, env, encoding: "utf8", timeout: 30_000 });
    const succeeds = ["success", "dispatch", "unchanged"].includes(scenario);
    assert("publisher " + scenario + " exit", result.status === 0, succeeds);
    const remoteHead = git("--git-dir", join(root, "remote"), "rev-parse", "main");
    const expected = scenario === "rollback" ? env.ANCESTOR_SHA : scenario === "drift" ? env.DRIFT_SHA : succeeds && scenario !== "unchanged" ? git("-C", local, "rev-parse", "HEAD") : env.GITHUB_SHA;
    assert("publisher " + scenario + " preserves expected main", remoteHead, expected);
  }
  for (const [name, version, delegates, expected] of [
    ["valid", "7.1.2-34", "freetype png rsvg", true],
    ["wrong version", "7.1.2-24", "freetype png rsvg", false],
    ["missing rsvg", "7.1.2-34", "freetype png", false],
  ]) {
    const root = join(publicationDir, name);
    const bin = join(root, "ImageMagick-7.1.2-34/bin");
    await mkdir(bin, { recursive: true });
    await writeFile(join(bin, "magick"), '#!/bin/sh\nprintf "%s\\n" "Version: ImageMagick ' + version + ' Q16-HDRI" "Delegates (built-in): ' + delegates + '"\n', { mode: 0o755 });
    const pathFile = join(root, "path");
    const result = spawnSync("bash", ["scripts/install-imagemagick-ci.sh"], { env: { PATH: process.env.PATH, RUNNER_TEMP: root, GITHUB_PATH: pathFile }, encoding: "utf8" });
    assert("installer " + name, result.status === 0, expected);
    assert("installer " + name + " publishes only verified binary", await readFile(pathFile, "utf8").catch(() => ""), expected ? bin + "\n" : "");
  }
} finally {
  await rm(publicationDir, { recursive: true, force: true });
}

console.log("\nrenderer regressions");
const rendererTmp = await mkdtemp(join(tmpdir(), "signals-renderer-"));
try {
  let siblingFinished = false;
  await assertRejects("nested writer failure propagates after siblings finish", () => withImageLock(join(rendererTmp, "locked.png"), () => waitForWriters([
    waitForWriters([
      Promise.reject(new Error("writer failed")),
      (async () => {
        await new Promise(setImmediate);
        await assertRejects("pending sibling excludes another image writer", () => withImageLock(join(rendererTmp, "locked.png"), () => 1), /Image writer lock exists/);
        siblingFinished = true;
      })(),
    ]),
  ])).catch((error) => {
    assert("failed nested writer batch waits for sibling completion", siblingFinished, true);
    throw error;
  }), /writer failed/);
  assert("failed batch releases lock after all writers settle", await withImageLock(join(rendererTmp, "locked.png"), () => 42), 42);

  const impulse = join(rendererTmp, "impulse.png");
  const split = join(rendererTmp, "split.png");
  await runMagick(["-size", "9x9", "xc:rgba(0,0,0,0.5)", "-fill", "white", "-draw", "point 4,4", "-fill", "black", "-draw", "point 0,0", pngOutput(impulse)]);
  await applyChromaticAberration(impulse, split);
  const { stdout: channels } = await runMagick([split, "-format", "%[fx:p{5,4}.r] %[fx:p{4,4}.g] %[fx:p{3,4}.b] %[fx:p{4,4}.r] %[fx:p{4,4}.b]", "info:"]);
  const [red, green, blue, centerRed, centerBlue] = channels.split(" ").map(Number);
  assert("chromatic aberration shifts only red and blue in opposite directions", red > 0.8 && green > 0.9 && blue > 0.8 && centerRed < 0.1 && centerBlue < 0.1, true);
  const { stdout: alphaDifference } = await runMagick(["(", impulse, "-alpha", "extract", ")", "(", split, "-alpha", "extract", ")", "-compose", "Difference", "-composite", "-format", "%[fx:maxima]", "info:"]);
  assert("chromatic aberration preserves original alpha", Number(alphaDifference), 0);

  await applyChromaticAberration(impulse, split, { redShift: "+2+1", blueShift: "-1-1" });
  const { stdout: diagonalChannels } = await runMagick([split, "-format", "%[fx:p{6,5}.r] %[fx:p{4,4}.g] %[fx:p{3,3}.b]", "info:"]);
  assert("toolchain chromatic split follows its diagonal offsets", diagonalChannels.split(" ").map(Number).every((value) => value > 0.8), true);
  await runMagick(["-size", "9x9", "xc:rgba(100,150,200,0.5)", pngOutput(impulse)]);
  await applyChromaticAberration(impulse, split);
  const { stdout: flatDifference } = await runMagick([impulse, split, "-compose", "Difference", "-composite", "-format", "%[fx:maxima]", "info:"]);
  assert("channel recombination preserves flat RGB color", Number(flatDifference), 0);

  const detailSvg = join(rendererTmp, "detail.svg");
  const raster = join(rendererTmp, "raster.png");
  const reference = join(rendererTmp, "reference.png");
  await writeFile(detailSvg, '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="20"><path d="M0 0L40 20M0 20L40 0" stroke="white" stroke-width="0.7"/></svg>');
  const { stdout: oversampledSize } = await runMagick(["-background", "none", "-density", "192", detailSvg, "-format", "%wx%h", "info:"]);
  assert("rsvg density192 produces two design pixels per axis", oversampledSize, "80x40");
  await rasterizeSvg(detailSvg, raster, { width: 40, height: 20 });
  await runMagick(["-background", "none", "-density", "192", detailSvg, "-resize", "40x20!", "-alpha", "on", pngOutput(reference)]);
  const { stdout: rasterDifference } = await runMagick([raster, reference, "-compose", "Difference", "-composite", "-format", "%[fx:maxima]", "info:"]);
  assert("shared SVG rasterizer uses actual 2x rsvg oversampling", Number(rasterDifference), 0);

  assert("text measurement treats ImageMagick percent syntax as literal SVG text", (await fitRepositoryRows([makeRepo("%[fx:1]", 1)]))[0].display_name, "%[fx:1]");
  const fittedRepos = await fitRepositoryRows([makeRepo("W".repeat(18), 1, { language: "Common Workflow Language" }), makeRepo("JobSentinel", 1, { language: "Python" })]);
  assert("short repository names retain their readable spelling", fittedRepos[1].display_name, "JobSentinel");
  assert("short language labels retain their readable spelling", fittedRepos[1].display_language, "Python");
  const wideSvg = renderRepositorySignSvg({ repos: fittedRepos.slice(0, 1), width: 500, height: 160 });
  const isolateColumn = (svg, pattern) => svg.replace(/<text\b[^>]*>[\s\S]*?<\/text>/g, (node) => pattern.test(node) ? node : "")
    .replace(/<(?:rect|circle|line)\b[^>]*\/>/g, (node) => node.includes('width="500" height="160"/>') ? node : "");
  const nameOnly = isolateColumn(wideSvg, /x="17[89](?:\.5)?"/);
  const nameSvgPath = join(rendererTmp, "name.svg");
  const namePng = join(rendererTmp, "name.png");
  await writeFile(nameSvgPath, nameOnly);
  await rasterizeSvg(nameSvgPath, namePng, { width: 500, height: 160 });
  const { stdout: overflow } = await runMagick([namePng, "-crop", "170x35+330+65", "-alpha", "extract", "-format", "%[fx:maxima]", "info:"]);
  assert("wide valid repository name cannot paint over metadata columns", Number(overflow), 0);
  assert("wide repository name uses readable ellipsis", /[.]{3}<\/text>/.test(wideSvg), true);
  const { stdout: visibleName } = await runMagick([namePng, "-crop", "142x25+178+71", "-alpha", "extract", "-trim", "-format", "%w", "info:"]);
  assert("width fitting keeps visible name and ellipsis inside its viewport", Number(visibleName) > 75 && Number(visibleName) < 142, true);
  const languageOnly = isolateColumn(wideSvg, /x="405"/);
  await writeFile(nameSvgPath, languageOnly);
  await rasterizeSvg(nameSvgPath, namePng, { width: 500, height: 160 });
  // Check the neighboring column; downsampling may feather into the 10px gutter.
  const { stdout: languageOverflow } = await runMagick([namePng, "-crop", "320x35+0+65", "-alpha", "extract", "-format", "%[fx:maxima]", "info:"]);
  assert("long GitHub language cannot paint over the repository column", Number(languageOverflow), 0);
  const { stdout: visibleLanguage } = await runMagick([namePng, "-crop", "75x32+330+69", "-alpha", "extract", "-trim", "-format", "%w", "info:"]);
  assert("long GitHub language remains visible with an ellipsis", Number(visibleLanguage) > 40 && Number(visibleLanguage) < 75 && fittedRepos[0].display_language.endsWith("..."), true);
  const unfittedSvg = renderRepositorySignSvg({ repos: [makeRepo("W".repeat(18), 1, { language: "Common Workflow Language" })], width: 500, height: 160 });
  for (const [column, pattern, crop] of [["name", /x="17[89](?:\.5)?"/, "170x35+330+65"], ["language", /x="405"/, "320x35+0+65"]]) {
    await writeFile(nameSvgPath, isolateColumn(unfittedSvg, pattern));
    await rasterizeSvg(nameSvgPath, namePng, { width: 500, height: 160 });
    const { stdout } = await runMagick([namePng, "-crop", crop, "-alpha", "extract", "-format", "%[fx:maxima]", "info:"]);
    assert(`unfitted ${column} text stays out of the neighboring column`, Number(stdout), 0);
  }
} finally {
  await rm(rendererTmp, { recursive: true, force: true });
}

// Summary

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
