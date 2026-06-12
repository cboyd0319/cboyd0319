import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";

import { applyFinalGrade } from "./lib/final-grade.mjs";
import { ensureImageMagick, identifyImage, pngOutput, runMagick } from "./lib/imagemagick.mjs";
import { renderRepositorySignSvg, renderToolchainSpectrumSvg } from "./lib/svg.mjs";
import { selectRepos } from "./lib/utils.mjs";

const ROOT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");
const OVERLAY_BOX_PAD = 18;
const MIN_INSIDE_DIFF_MEAN = 0.0001;
const MIN_INSIDE_DIFF_MAX = 0.05;
const MAX_OUTSIDE_DIFF_MEAN = 0.000001;
const MAX_OUTSIDE_DIFF_MAX = 0.001;

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

function requireQuad(label, box) {
  if (!Array.isArray(box.quad) || box.quad.length !== 4) fail(`${label} quad missing`);
  for (const [index, point] of box.quad.entries()) {
    if (!Number.isFinite(Number(point?.x)) || !Number.isFinite(Number(point?.y))) {
      fail(`${label} quad point ${index} is invalid: ${JSON.stringify(point)}`);
    }
  }
  const area = polygonArea(box.quad);
  if (area < 1) fail(`${label} quad area is too small: ${area}`);
}

function polygonArea(points) {
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const next = points[(i + 1) % points.length];
    area += Number(points[i].x) * Number(next.y) - Number(next.x) * Number(points[i].y);
  }
  return Math.abs(area / 2);
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

function scaledOverlayBoxes(layout, width, height) {
  const scaleX = width / layout.sourceWidth;
  const scaleY = height / layout.sourceHeight;
  return [layout.board, layout.toolchain].map((box) => {
    const points = (box.quad || [
      { x: box.left, y: box.top },
      { x: box.left + box.width, y: box.top },
      { x: box.left + box.width, y: box.top + box.height },
      { x: box.left, y: box.top + box.height },
    ]).map((point) => ({ x: point.x * scaleX, y: point.y * scaleY }));
    const left = Math.max(0, Math.floor(Math.min(...points.map((point) => point.x)) - OVERLAY_BOX_PAD));
    const top = Math.max(0, Math.floor(Math.min(...points.map((point) => point.y)) - OVERLAY_BOX_PAD));
    const right = Math.min(width - 1, Math.ceil(Math.max(...points.map((point) => point.x)) + OVERLAY_BOX_PAD));
    const bottom = Math.min(height - 1, Math.ceil(Math.max(...points.map((point) => point.y)) + OVERLAY_BOX_PAD));
    return { left, top, right, bottom };
  });
}

function maskDraw(boxes) {
  return boxes.map((box) => `rectangle ${box.left},${box.top} ${box.right},${box.bottom}`).join(" ");
}

function parseMetric(stdout) {
  const [mean, max] = stdout.trim().split(/\s+/).map(Number);
  return { mean, max };
}

async function maskedDiffMetric(diffPath, maskPath) {
  const { stdout } = await runMagick([
    diffPath,
    "-alpha",
    "off",
    maskPath,
    "-alpha",
    "off",
    "-compose",
    "multiply",
    "-composite",
    "-format",
    "%[fx:mean] %[fx:maxima]\n",
    "info:",
  ]);
  return parseMetric(stdout);
}

export function assertOverlayPixelMetrics(metrics) {
  if (metrics.outside.mean > MAX_OUTSIDE_DIFF_MEAN || metrics.outside.max > MAX_OUTSIDE_DIFF_MAX) {
    fail(`output changed outside overlay region: mean ${metrics.outside.mean}, max ${metrics.outside.max}`);
  }
  if (metrics.inside.mean < MIN_INSIDE_DIFF_MEAN || metrics.inside.max < MIN_INSIDE_DIFF_MAX) {
    fail(`output missing overlay-region changes: mean ${metrics.inside.mean}, max ${metrics.inside.max}`);
  }
}

async function overlayPixelMetrics({ output, background, layout, width, height }) {
  const tempDir = await mkdtemp(join(tmpdir(), "signals-validate-"));
  try {
    const resizedBackground = join(tempDir, "background.png");
    const gradedBackground = join(tempDir, "background-graded.png");
    const diffPath = join(tempDir, "diff.png");
    const outsideMask = join(tempDir, "outside-mask.png");
    const insideMask = join(tempDir, "inside-mask.png");
    const boxes = scaledOverlayBoxes(layout, width, height);
    const draw = maskDraw(boxes);

    await runMagick([background, "-resize", `${width}x${height}!`, pngOutput(resizedBackground)]);
    await applyFinalGrade(resizedBackground, gradedBackground, { width, height, workDir: tempDir });
    await runMagick([gradedBackground, output, "-compose", "difference", "-composite", pngOutput(diffPath)]);
    await Promise.all([
      runMagick(["-size", `${width}x${height}`, "xc:white", "-fill", "black", "-draw", draw, pngOutput(outsideMask)]),
      runMagick(["-size", `${width}x${height}`, "xc:black", "-fill", "white", "-draw", draw, pngOutput(insideMask)]),
    ]);

    const [outside, inside] = await Promise.all([
      maskedDiffMetric(diffPath, outsideMask),
      maskedDiffMetric(diffPath, insideMask),
    ]);
    return { outside, inside };
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
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
  background,
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
    requireQuad(name, box);
  }
  requireDesignSize("repository board", layout.board, { width: 500, height: 160 });
  requireDesignSize("toolchain panel", layout.toolchain, { width: 131, height: 420 });

  if (output) {
    const metadata = await identifyImage(output);
    if (metadata.width !== width || metadata.height !== height) {
      fail(`output dimensions ${metadata.width}x${metadata.height}, expected ${width}x${height}`);
    }
    if (background) {
      assertOverlayPixelMetrics(await overlayPixelMetrics({ output, background, layout, width, height }));
    }
  }

  return true;
}

export function expectedOutputSize(layout, env = process.env) {
  const outputWidthText = env.OUTPUT_WIDTH?.trim();
  const outputWidth = outputWidthText ? Number(outputWidthText) : layout.sourceWidth;
  const width = Number.isFinite(outputWidth) ? outputWidth : layout.sourceWidth;
  const scale = width / layout.sourceWidth;
  return {
    width,
    height: Math.round(layout.sourceHeight * scale),
  };
}

async function main() {
  await ensureImageMagick();
  const output = join(ROOT_DIR, "assets/signals.png");
  const background = join(ROOT_DIR, "assets/subway_blank_original.png");
  const [scene, staticData, layout] = await Promise.all([
    readFile(join(ROOT_DIR, "config/scene.json"), "utf8").then(JSON.parse),
    readFile(join(ROOT_DIR, "config/static-data.json"), "utf8").then(JSON.parse),
    readFile(join(ROOT_DIR, "config/layouts/subway-default.json"), "utf8").then(JSON.parse),
  ]);
  const { repositorySvg, toolchainSvg } = await readGeneratedSvgs(staticData, layout);
  const { width, height } = expectedOutputSize(layout);
  await validateSignals({
    scene,
    staticData,
    layout,
    repositorySvg,
    toolchainSvg,
    output,
    background,
    width,
    height,
  });
  console.log("Signals validation OK");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
