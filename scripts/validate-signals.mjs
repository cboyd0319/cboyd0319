import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFile } from "node:fs/promises";

import { ensureImageMagick, identifyImage } from "./lib/imagemagick.mjs";
import { renderRepositorySignSvg, renderToolchainSpectrumSvg } from "./lib/svg.mjs";
import { selectRepos } from "./lib/utils.mjs";

const ROOT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");

function fail(message) {
  throw new Error(`signals validation failed: ${message}`);
}

function requireIncludes(label, haystack, needles) {
  for (const needle of needles) {
    if (!haystack.includes(needle)) fail(`${label} missing ${needle}`);
  }
}

function requireExcludes(label, haystack, needles) {
  const upper = haystack.toUpperCase();
  for (const needle of needles) {
    if (upper.includes(String(needle).toUpperCase())) fail(`${label} contains prohibited ${needle}`);
  }
}

function requireAny(label, haystack, needles) {
  for (const needle of needles) {
    if (haystack.includes(needle)) return;
  }
  fail(`${label} missing one of ${needles.join(", ")}`);
}

function sum(items) {
  return items.reduce((total, value) => total + Number(value || 0), 0);
}

function samePoint(actual, expected) {
  return Number(actual?.x) === expected.x && Number(actual?.y) === expected.y;
}

function requireQuad(label, box, expected) {
  if (!Array.isArray(box.quad) || box.quad.length !== 4) fail(`${label} quad missing`);
  for (let i = 0; i < 4; i++) {
    if (!samePoint(box.quad[i], expected[i])) {
      fail(`${label} quad point ${i} is ${JSON.stringify(box.quad[i])}, expected ${JSON.stringify(expected[i])}`);
    }
  }
}

function requireDesignSize(label, box, expected) {
  if (Number(box.designWidth) !== expected.width || Number(box.designHeight) !== expected.height) {
    fail(`${label} design size ${box.designWidth}x${box.designHeight}, expected ${expected.width}x${expected.height}`);
  }
}

function staticRepos(staticData) {
  const baseTime = Date.UTC(2026, 0, 1, 0, 0, 0);
  return staticData.repos.map((repo, index) => ({
    name: repo.name,
    language: repo.language,
    language_pct: repo.language_pct,
    updated_label: repo.updated,
    pushed_at: new Date(baseTime - index * 1000).toISOString(),
    stargazers_count: repo.stars,
    fork: false,
    archived: false,
  }));
}

function renderStaticSvgs(staticData, layout) {
  const repos = staticRepos(staticData);
  const selectedRepos = selectRepos(repos, 2);
  return {
    repositorySvg: renderRepositorySignSvg({
      repos: selectedRepos,
      allRepos: repos,
      sparklines: selectedRepos.map((repo) => staticData.repos.find((item) => item.name === repo.name)?.sparkline ?? []),
      summary: staticData.summary,
      width: layout.board.designWidth,
      height: layout.board.designHeight,
    }),
    toolchainSvg: renderToolchainSpectrumSvg({
      allRepos: repos,
      width: layout.toolchain.designWidth,
      height: layout.toolchain.designHeight,
    }),
  };
}

async function readGeneratedSvgs(staticData, layout) {
  try {
    const [repositorySvg, toolchainSvg] = await Promise.all([
      readFile(join(ROOT_DIR, "assets/generated/repository-sign.svg"), "utf8"),
      readFile(join(ROOT_DIR, "assets/generated/toolchain-spectrum.svg"), "utf8"),
    ]);
    return { repositorySvg, toolchainSvg };
  } catch (err) {
    if (err?.code !== "ENOENT") throw err;
    return renderStaticSvgs(staticData, layout);
  }
}

export async function validateSignals({
  scene,
  staticData,
  layout,
  repositorySvg,
  toolchainSvg,
  output,
  width,
  height,
} = {}) {
  if (!scene) fail("scene config not loaded");
  if (!staticData?.repos?.length) fail("static repo data missing");
  if (!layout?.board || !layout?.toolchain) fail("layout boxes missing");

  requireIncludes("repository SVG", repositorySvg || "", [
    "M03",
    "REPOSITORY SIGNALS",
  ]);
  requireAny("repository SVG status", repositorySvg || "", ["ON", "CHECK", "IDLE"]);
  requireIncludes("repository SVG status LEDs", repositorySvg || "", ['data-status-led="']);
  requireIncludes("toolchain SVG", toolchainSvg || "", [
    "M03 SERVICE",
    "CODE LINES",
  ]);
  requireExcludes("generated SVG", `${repositorySvg || ""}\n${toolchainSvg || ""}`, [
    "#FFFFFF",
    "#ffffff",
    "SPECTRUM",
    "TOOLCHAIN",
    "新高円寺",
    "M03 LOCAL",
    "リポジトリ信号",
    "ACTIVE REPOS",
    "M03-TS",
    "M03-PY",
    "M03-SH",
    "M03-PS",
    "<path",
  ]);

  const languagePct = sum(staticData.repos.map((repo) => repo.language_pct));
  if (languagePct !== 100) fail(`toolchain percentages sum to ${languagePct}, expected 100`);

  const stars = sum(staticData.repos.map((repo) => repo.stars));
  if (stars !== Number(staticData.summary?.starsTotal)) {
    fail(`static stars total ${staticData.summary?.starsTotal} does not match repo sum ${stars}`);
  }
  if (staticData.repos.length !== Number(staticData.summary?.activeRepos)) {
    fail(`active repo summary ${staticData.summary?.activeRepos} does not match repo count ${staticData.repos.length}`);
  }
  if (!/^\d+W$/.test(String(staticData.summary?.streak || ""))) {
    fail(`streak malformed: ${staticData.summary?.streak}`);
  }

  const currentStation = String(scene.station?.name_en || "").toUpperCase();
  const nextStation = String(scene.direction?.next_en || "").toUpperCase();
  if (currentStation && nextStation && currentStation === nextStation) {
    fail(`current station and next station both ${currentStation}`);
  }
  if (scene.mode === "fictional_tokyo_inspired" && scene.operator?.show_real_tokyo_metro_branding) {
    fail("fictional mode cannot enable real Tokyo Metro branding");
  }
  if (!/^[A-Z]\d{2}$/.test(String(scene.station?.code || ""))) {
    fail(`station code must use line prefix plus two digits, got ${scene.station?.code}`);
  }
  if (/^\d+$/.test(String(scene.station?.code || ""))) {
    fail(`station code uses bare digits instead of line prefix: ${scene.station?.code}`);
  }
  if (scene.servicePanel?.items?.includes(scene.servicePanel?.title)) {
    fail(`service panel duplicates title ${scene.servicePanel.title} in items`);
  }
  const { bannedStrings = [], ...sceneWithoutBans } = scene;
  const serializedScene = JSON.stringify(sceneWithoutBans).toUpperCase();
  for (const banned of bannedStrings) {
    if (serializedScene.includes(String(banned).toUpperCase())) {
      fail(`scene config contains banned string ${banned}`);
    }
    if ((repositorySvg || "").toUpperCase().includes(String(banned).toUpperCase()) || (toolchainSvg || "").toUpperCase().includes(String(banned).toUpperCase())) {
      fail(`generated SVG contains banned string ${banned}`);
    }
  }

  for (const [name, box] of Object.entries({ board: layout.board, toolchain: layout.toolchain })) {
    if (box.left < 0 || box.top < 0 || box.width <= 0 || box.height <= 0) fail(`${name} layout has invalid dimensions`);
    if (box.left + box.width > layout.sourceWidth || box.top + box.height > layout.sourceHeight) {
      fail(`${name} layout exceeds source image bounds`);
    }
    for (const point of box.quad || []) {
      if (point.x < 0 || point.y < 0 || point.x > layout.sourceWidth || point.y > layout.sourceHeight) {
        fail(`${name} quad point exceeds source image bounds: ${JSON.stringify(point)}`);
      }
    }
  }
  requireDesignSize("repository board", layout.board, { width: 500, height: 160 });
  requireDesignSize("toolchain panel", layout.toolchain, { width: 131, height: 420 });
  requireQuad("repository board", layout.board, [
    { x: 445, y: 55 },
    { x: 945, y: 64 },
    { x: 945, y: 207 },
    { x: 445, y: 220 },
  ]);
  requireQuad("toolchain panel", layout.toolchain, [
    { x: 1416, y: 203 },
    { x: 1518, y: 184 },
    { x: 1500, y: 604 },
    { x: 1412, y: 583 },
  ]);

  if (output) {
    const metadata = await identifyImage(output);
    if (metadata.width !== width || metadata.height !== height) {
      fail(`output dimensions ${metadata.width}x${metadata.height}, expected ${width}x${height}`);
    }
  }

  return true;
}

async function main() {
  await ensureImageMagick();
  const output = join(ROOT_DIR, "assets/signals.png");
  const [scene, staticData, layout] = await Promise.all([
    readFile(join(ROOT_DIR, "config/scene.json"), "utf8").then(JSON.parse),
    readFile(join(ROOT_DIR, "config/static-data.json"), "utf8").then(JSON.parse),
    readFile(join(ROOT_DIR, "config/layouts/subway-default.json"), "utf8").then(JSON.parse),
  ]);
  const { repositorySvg, toolchainSvg } = await readGeneratedSvgs(staticData, layout);
  await validateSignals({
    scene,
    staticData,
    layout,
    repositorySvg,
    toolchainSvg,
    output,
    width: layout.sourceWidth,
    height: layout.sourceHeight,
  });
  console.log("Signals validation OK");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
