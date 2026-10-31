import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";

import { applyLayoutEnv, DISPLAY_ROUTE_CODE, resolveBackground, staticRepos } from "./lib/config.mjs";
import { applyFinalGrade } from "./lib/final-grade.mjs";
import { ensureImageMagick, identifyImage, pngOutput, runMagick } from "./lib/imagemagick.mjs";
import { ownActiveRepos, renderRepositorySignSvg, renderToolchainSpectrumSvg } from "./lib/svg.mjs";
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
    if (!Number.isFinite(point?.x) || !Number.isFinite(point?.y)) {
      fail(`${label} quad point ${index} is invalid: ${JSON.stringify(point)}`);
    }
  }
  const area = polygonArea(box.quad);
  if (area < 1) fail(`${label} quad area is too small: ${area}`);
  const turns = box.quad.map((a, i, points) => {
    const b = points[(i + 1) % 4];
    const c = points[(i + 2) % 4];
    return (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
  });
  if (!turns.every((turn) => turn > 0)) fail(`${label} quad must be convex and ordered clockwise`);
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
  if (box.designWidth !== expected.width || box.designHeight !== expected.height) {
    fail(`${label} design size ${box.designWidth}x${box.designHeight}, expected ${expected.width}x${expected.height}`);
  }
}

export function renderStaticSvgs(staticData, layout) {
  const repos = staticRepos(staticData);
  const selectedRepos = selectRepos(ownActiveRepos(repos), 2);
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
  for (const region of [metrics.outside, metrics.inside]) {
    if (![region?.mean, region?.max].every((value) => Number.isFinite(value) && value >= 0 && value <= 1)) {
      fail("invalid overlay pixel metrics");
    }
  }
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
    await runMagick(["-size", `${width}x${height}`, "xc:white", "-fill", "black", "-draw", draw, pngOutput(outsideMask)]);
    const outside = await maskedDiffMetric(diffPath, outsideMask);
    for (const box of boxes) {
      await runMagick(["-size", `${width}x${height}`, "xc:black", "-fill", "white", "-draw", maskDraw([box]), pngOutput(insideMask)]);
      const inside = await maskedDiffMetric(diffPath, insideMask);
      assertOverlayPixelMetrics({ outside, inside });
    }
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
  if (!Array.isArray(staticData?.repos) || !staticData.repos.length) fail("static repo data missing");
  if (!layout?.board || !layout?.toolchain) fail("layout boxes missing");
  expectedOutputSize(layout, {});

  requireIncludes("repository SVG", repositorySvg || "", [
    DISPLAY_ROUTE_CODE,
    "リポジトリ状況",
    "REPOSITORY SIGNALS",
  ]);
  requireAny("repository SVG status", repositorySvg || "", ["ACTIVE", "DEPS CHECK", "IDLE"]);
  requireIncludes("repository SVG status LEDs", repositorySvg || "", ['data-status-led="']);
  requireIncludes("toolchain SVG", toolchainSvg || "", [
    "コード構成",
    `${DISPLAY_ROUTE_CODE} CODE MIX`,
  ]);
  // Historical label checks belong in static template tests, not public repo text.
  if (/<path\b|(?:fill|stroke)=["']#ffffff["']/i.test(`${repositorySvg}\n${toolchainSvg}`)) {
    fail("generated SVG contains prohibited path or pure-white paint");
  }

  for (const repo of staticData.repos) {
    if (typeof repo?.name !== "string" || !repo.name.trim()) fail("static repo name missing");
    if (!Number.isSafeInteger(repo.stars) || repo.stars < 0) fail(`invalid static stars for ${repo.name}`);
    if (!Number.isFinite(repo.language_pct) || repo.language_pct < 0 || repo.language_pct > 100) {
      fail(`invalid static language percentage for ${repo.name}`);
    }
    if (repo.language_pct > 0 && (typeof repo.language !== "string" || !repo.language.trim())) {
      fail(`static language missing for ${repo.name}`);
    }
  }
  const languagePct = sum(staticData.repos.map((repo) => repo.language_pct));
  if (Math.abs(languagePct - 100) > 1e-9) fail(`toolchain percentages sum to ${languagePct}, expected 100`);

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
  if (scene.station?.code !== DISPLAY_ROUTE_CODE) fail(`station code must match the approved ${DISPLAY_ROUTE_CODE} background`);
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
    if (![box.left, box.top, box.width, box.height].every(Number.isFinite)) fail(`${name} layout dimensions must be finite numbers`);
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
      await overlayPixelMetrics({ output, background, layout, width, height });
    }
  }

  return true;
}

export function expectedOutputSize(layout, env = process.env) {
  for (const key of ["sourceWidth", "sourceHeight"]) {
    if (!Number.isSafeInteger(layout[key]) || layout[key] <= 0) fail(`${key} must be a positive integer`);
  }
  const outputWidthText = env.OUTPUT_WIDTH?.trim();
  const width = outputWidthText ? Number(outputWidthText) : layout.sourceWidth;
  if (!Number.isSafeInteger(width) || width <= 0) fail("OUTPUT_WIDTH must be a positive integer");
  const scale = width / layout.sourceWidth;
  const height = Math.round(layout.sourceHeight * scale);
  if (!Number.isSafeInteger(height) || height <= 0) fail("output height must be a positive integer");
  return { width, height };
}

async function main() {
  await ensureImageMagick();
  const output = join(ROOT_DIR, "assets/signals.png");
  const background = resolveBackground(join(ROOT_DIR, "assets"));
  const [scene, staticData, layout] = await Promise.all([
    readFile(join(ROOT_DIR, "config/scene.json"), "utf8").then(JSON.parse),
    readFile(join(ROOT_DIR, "config/static-data.json"), "utf8").then(JSON.parse),
    readFile(join(ROOT_DIR, "config/layouts/subway-default.json"), "utf8").then(JSON.parse).then(applyLayoutEnv),
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

if (import.meta.main) {
  await main();
}
