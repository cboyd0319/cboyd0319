import { fileURLToPath } from "node:url";
import { dirname, isAbsolute, join } from "node:path";
import { copyFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";

import {
  OUTPUT_WIDTH as DEFAULT_OUTPUT_WIDTH,
  USERNAME,
} from "./lib/config.mjs";
import { github } from "./lib/github.mjs";
import { loadFontAsDataUrl } from "./lib/font.mjs";
import {
  alphaMultiplyArgs,
  ensureImageMagick,
  identifyImage,
  perspectiveControlPoints,
  pngOutput,
  runMagick,
} from "./lib/imagemagick.mjs";
import { ownActiveRepos, renderRepositorySignSvg, renderToolchainSpectrumSvg } from "./lib/svg.mjs";
import { selectRepos } from "./lib/utils.mjs";
import { validateSignals } from "./validate-signals.mjs";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(SCRIPT_DIR, "..");
const ASSET_DIR = join(SCRIPT_DIR, "../assets");
const OUT_DIR = ASSET_DIR;
const GENERATED_DIR = join(ASSET_DIR, "generated");
const CONFIG_DIR = join(ROOT_DIR, "config");
const BACKGROUND = process.env.BACKGROUND?.trim() || "subway_blank_original.png";
const REPOS_PER_PAGE = 100;
const MAX_REPO_PAGES = 10;
const REPO_LIMIT = 2;
const SMOKE = process.argv.includes("--smoke");
const STATIC = ["1", "true", "yes"].includes(String(process.env.STATIC ?? "").toLowerCase());
const LIVE_SMOKE = process.argv.includes("--live") || ["1", "true", "yes"].includes(String(process.env.LIVE_SMOKE ?? "").toLowerCase());
const USE_STATIC_DATA = STATIC || (SMOKE && !LIVE_SMOKE);
const MIN_IMAGE_BYTES = 10_000;
const PANEL_RASTER_DENSITY = 144;
const PANEL_SOFTEN_SIGMA = 0.1;
const PANEL_TEXTURE_ATTENUATE = 0.016;
const PANEL_TEXTURE_SEED = 31;
const CHROMATIC_ABERRATION_RED_SHIFT = "+1+0";
const CHROMATIC_ABERRATION_BLUE_SHIFT = "-1+0";
const FINAL_WARM_WASH_ALPHA = 0;
const FINAL_FILM_GRAIN_OPACITY = 0;

function envNumber(name, fallback) {
  if (!process.env[name]?.trim()) return fallback;
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
}

function minutesAgo(minutes) {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

function daysAgo(days) {
  return new Date(Date.now() - days * 24 * 60 * 60_000).toISOString();
}

const OUTPUT_WIDTH = envNumber("OUTPUT_WIDTH", DEFAULT_OUTPUT_WIDTH);

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

function relativeDate(value) {
  const text = String(value ?? "").trim().toLowerCase();
  const match = text.match(/^(\d+)(m|h|d|w|mo)\s+ago$/);
  if (!match) return new Date().toISOString();
  const amount = Number(match[1]);
  const unit = match[2];
  if (unit === "m") return minutesAgo(amount);
  if (unit === "h") return new Date(Date.now() - amount * 60 * 60_000).toISOString();
  if (unit === "d") return daysAgo(amount);
  if (unit === "w") return daysAgo(amount * 7);
  if (unit === "mo") return daysAgo(amount * 30);
  return new Date().toISOString();
}

function staticRepos(staticData) {
  return staticData.repos.map((repo) => ({
    name: repo.name,
    language: repo.language,
    language_pct: repo.language_pct,
    updated_label: repo.updated,
    pushed_at: relativeDate(repo.updated),
    stargazers_count: repo.stars,
    fork: false,
    archived: false,
  }));
}

function rectQuad(box) {
  return [
    { x: box.left, y: box.top },
    { x: box.left + box.width, y: box.top },
    { x: box.left + box.width, y: box.top + box.height },
    { x: box.left, y: box.top + box.height },
  ];
}

function applyBoxEnv(box, prefix) {
  const adjusted = {
    ...box,
    left: envNumber(`${prefix}_LEFT`, box.left),
    top: envNumber(`${prefix}_TOP`, box.top),
    width: envNumber(`${prefix}_WIDTH`, box.width),
    height: envNumber(`${prefix}_HEIGHT`, box.height),
  };
  const geometryChanged = adjusted.left !== box.left
    || adjusted.top !== box.top
    || adjusted.width !== box.width
    || adjusted.height !== box.height;
  return {
    ...adjusted,
    quad: geometryChanged ? rectQuad(adjusted) : box.quad,
  };
}

export function applyLayoutEnv(layout) {
  return {
    ...layout,
    board: applyBoxEnv(layout.board, "BOARD"),
    toolchain: applyBoxEnv(layout.toolchain, "TOOLCHAIN"),
  };
}

async function fetchOwnerRepos() {
  const repos = [];
  for (let page = 1; page <= MAX_REPO_PAGES; page++) {
    const chunk = await github(`/users/${USERNAME}/repos?type=owner&sort=pushed&direction=desc&per_page=${REPOS_PER_PAGE}&page=${page}`);
    if (!Array.isArray(chunk)) throw new Error("GitHub repos API returned an unexpected payload.");
    repos.push(...chunk);
    if (chunk.length < REPOS_PER_PAGE) return repos;
  }
  return repos;
}

async function fetchRepoLanguages(repoName) {
  try {
    const data = await github(`/repos/${USERNAME}/${encodeURIComponent(repoName)}/languages`);
    if (!data || Array.isArray(data) || typeof data !== "object") return null;
    return data;
  } catch (err) {
    console.warn(`Language fetch failed for ${repoName}: ${err.message}`);
    return null;
  }
}

async function withLanguageBreakdowns(repos) {
  const activeRepos = ownActiveRepos(repos);
  const languagesByName = new Map(await Promise.all(activeRepos.map(async (repo) => [
    repo.name,
    await fetchRepoLanguages(repo.name),
  ])));
  return repos.map((repo) => {
    const languages = languagesByName.get(repo.name);
    return languages ? { ...repo, languages } : repo;
  });
}

async function collectData(staticData) {
  const allRepos = USE_STATIC_DATA ? staticRepos(staticData) : await withLanguageBreakdowns(await fetchOwnerRepos());
  const repos = selectRepos(ownActiveRepos(allRepos), REPO_LIMIT);
  return { allRepos, repos };
}

function designSize(box) {
  return {
    width: Math.round(box.designWidth || box.width),
    height: Math.round(box.designHeight || box.height),
  };
}

function fallbackQuad(box) {
  return rectQuad(box);
}

function scaledQuad(box, { scaleX, scaleY }) {
  return (box.quad || fallbackQuad(box)).map((point) => ({
    x: point.x * scaleX,
    y: point.y * scaleY,
  }));
}

function boxFromQuad(quad) {
  const minX = Math.floor(Math.min(...quad.map((point) => point.x)));
  const minY = Math.floor(Math.min(...quad.map((point) => point.y)));
  const maxX = Math.ceil(Math.max(...quad.map((point) => point.x)));
  const maxY = Math.ceil(Math.max(...quad.map((point) => point.y)));
  return {
    left: minX,
    top: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

async function validateImage(path, expectedWidth) {
  const [file, metadata] = await Promise.all([stat(path), identifyImage(path)]);
  if (file.size < MIN_IMAGE_BYTES) {
    throw new Error("Generated signals.png is unexpectedly small.");
  }
  if (metadata.width !== expectedWidth || !metadata.height || metadata.height <= 0) {
    throw new Error(`Generated signals.png has unexpected dimensions: ${metadata.width}x${metadata.height}`);
  }
}

function panelGlassSvg(width, height) {
  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
<defs>
  <linearGradient id="panel-glass" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="#E8B46A" stop-opacity="0.16"/>
    <stop offset="18%" stop-color="#D8CFB8" stop-opacity="0.032"/>
    <stop offset="64%" stop-color="#78312E" stop-opacity="0.012"/>
    <stop offset="100%" stop-color="#000000" stop-opacity="0.055"/>
  </linearGradient>
  <linearGradient id="panel-reflection" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0%" stop-color="#D8CFB8" stop-opacity="0"/>
    <stop offset="16%" stop-color="#E8B46A" stop-opacity="0.20"/>
    <stop offset="28%" stop-color="#D8CFB8" stop-opacity="0.045"/>
    <stop offset="100%" stop-color="#D8CFB8" stop-opacity="0"/>
  </linearGradient>
  <filter id="soft-reflection" x="-8%" y="-160%" width="116%" height="420%">
    <feGaussianBlur stdDeviation="0.9"/>
  </filter>
</defs>
<rect width="${width}" height="${height}" fill="url(#panel-glass)" opacity="0.86"/>
<rect x="${Math.round(width * 0.04)}" y="${Math.max(1, Math.round(height * 0.065))}" width="${Math.round(width * 0.76)}" height="${Math.max(1, Math.round(height * 0.018))}" fill="url(#panel-reflection)" opacity="0.34" filter="url(#soft-reflection)"/>
</svg>`;
}

function panelAbsorptionSvg(width, height) {
  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
<defs>
  <linearGradient id="top-shadow" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="#000000" stop-opacity="0.46"/>
    <stop offset="16%" stop-color="#000000" stop-opacity="0.22"/>
    <stop offset="62%" stop-color="#06100f" stop-opacity="0.12"/>
    <stop offset="100%" stop-color="#000000" stop-opacity="0.26"/>
  </linearGradient>
</defs>
<rect width="${width}" height="${height}" fill="#06100f" opacity="0.24"/>
<rect width="${width}" height="${height}" fill="url(#top-shadow)" opacity="0.34"/>
</svg>`;
}

async function rasterizeSvg(svgPath, outputPath, { width, height }) {
  await runMagick([
    "-background",
    "none",
    "-density",
    String(PANEL_RASTER_DENSITY),
    svgPath,
    "-resize",
    `${width}x${height}!`,
    "-alpha",
    "on",
    pngOutput(outputPath),
  ]);
}

export function panelTextureArgs(attenuate = PANEL_TEXTURE_ATTENUATE) {
  return attenuate > 0
    ? ["-seed", String(PANEL_TEXTURE_SEED), "-attenuate", String(attenuate), "+noise", "Gaussian"]
    : [];
}

async function softenReadablePanel(inputPath, outputPath, sigma = PANEL_SOFTEN_SIGMA) {
  if (sigma <= 0) {
    await copyFile(inputPath, outputPath);
    return;
  }
  const textureArgs = panelTextureArgs();
  if (sigma < 0.3) {
    await runMagick([
      inputPath,
      "(",
      inputPath,
      "-blur",
      "0x0.3",
      "-alpha",
      "on",
      "-channel",
      "A",
      "-evaluate",
      "multiply",
      String(sigma / 0.3),
      "+channel",
      ")",
      "-compose",
      "Over",
      "-composite",
      ...textureArgs,
      pngOutput(outputPath),
    ]);
    return;
  }
  await runMagick([
    inputPath,
    "-blur",
    `0x${sigma}`,
    ...textureArgs,
    pngOutput(outputPath),
  ]);
}

async function renderPanelLayers(prefix, svgPath, emissiveSvgPath, { width, height, panelSoftenSigma = PANEL_SOFTEN_SIGMA }) {
  const basePath = join(GENERATED_DIR, `${prefix}-base.png`);
  const panelPath = join(GENERATED_DIR, `${prefix}.png`);
  const emissivePath = join(GENERATED_DIR, `${prefix}-emissive.png`);
  const glowPath = join(GENERATED_DIR, `${prefix}-glow.png`);
  const glassSvgPath = join(GENERATED_DIR, `${prefix}-glass.svg`);
  const glassPath = join(GENERATED_DIR, `${prefix}-glass.png`);
  const absorptionSvgPath = join(GENERATED_DIR, `${prefix}-absorption.svg`);
  const absorptionPath = join(GENERATED_DIR, `${prefix}-absorption.png`);

  await Promise.all([
    rasterizeSvg(svgPath, basePath, { width, height }),
    rasterizeSvg(emissiveSvgPath, emissivePath, { width, height }),
    writeFile(glassSvgPath, panelGlassSvg(width, height)),
    writeFile(absorptionSvgPath, panelAbsorptionSvg(width, height)),
  ]);
  await Promise.all([
    softenReadablePanel(basePath, panelPath, panelSoftenSigma),
    rasterizeSvg(glassSvgPath, glassPath, { width, height }),
    rasterizeSvg(absorptionSvgPath, absorptionPath, { width, height }),
    runMagick([
      emissivePath,
      "-blur",
      "0x0.75",
      "-modulate",
      "100,90,100",
      pngOutput(glowPath),
    ]),
  ]);

  return {
    panel: panelPath,
    glow: glowPath,
    glass: glassPath,
    absorption: absorptionPath,
    emissive: emissivePath,
  };
}

async function renderOverlayCanvas(layers, outputPath, { width, height, emissiveOpacity, panelOpacity, glassOpacity, throughGlassOpacity = 0 }) {
  const args = ["-size", `${width}x${height}`, "xc:none"];
  if (emissiveOpacity > 0) {
    args.push(...alphaMultiplyArgs(layers.glow, emissiveOpacity), "-compose", "Screen", "-composite");
  }
  args.push(...alphaMultiplyArgs(layers.panel, panelOpacity), "-compose", "Over", "-composite");
  if (throughGlassOpacity > 0) {
    args.push(...alphaMultiplyArgs(layers.absorption, throughGlassOpacity), "-compose", "Over", "-composite");
  }
  if (glassOpacity > 0) {
    args.push(...alphaMultiplyArgs(layers.glass, glassOpacity), "-compose", "Screen", "-composite");
  }
  args.push(pngOutput(outputPath));
  await runMagick(args);
}

async function applyChromaticAberration(inputPath, outputPath) {
  await runMagick([
    inputPath,
    "-channel",
    "R",
    "-roll",
    CHROMATIC_ABERRATION_RED_SHIFT,
    "+channel",
    "-channel",
    "B",
    "-roll",
    CHROMATIC_ABERRATION_BLUE_SHIFT,
    "+channel",
    pngOutput(outputPath),
  ]);
}

async function perspectiveWarpPng(inputPath, outputPath, { width, height, quad, box }) {
  await runMagick([
    inputPath,
    "-alpha",
    "set",
    "-virtual-pixel",
    "transparent",
    "-background",
    "none",
    "-define",
    `distort:viewport=${box.width}x${box.height}+${box.left}+${box.top}`,
    "+distort",
    "Perspective",
    perspectiveControlPoints(width, height, quad),
    pngOutput(outputPath),
  ]);
}

async function colorWash(path, { width, height, background }) {
  await runMagick([
    "-size",
    `${width}x${height}`,
    `xc:${background}`,
    pngOutput(path),
  ]);
}

function finalFilmGrainSvg(width, height) {
  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
<filter id="final-grain">
  <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="31" result="noise"/>
  <feColorMatrix in="noise" type="saturate" values="0"/>
  <feComponentTransfer>
    <feFuncA type="table" tableValues="0 0.05"/>
  </feComponentTransfer>
</filter>
<rect width="${width}" height="${height}" filter="url(#final-grain)"/>
</svg>`;
}

async function applyFinalGrade(inputPath, outputPath, { width, height }) {
  if (FINAL_WARM_WASH_ALPHA <= 0 && FINAL_FILM_GRAIN_OPACITY <= 0) {
    await copyFile(inputPath, outputPath);
    return;
  }

  const warmWashPath = join(GENERATED_DIR, "final-warm-wash.png");
  const grainSvgPath = join(GENERATED_DIR, "final-film-grain.svg");
  const grainPath = join(GENERATED_DIR, "final-film-grain.png");
  await Promise.all([
    colorWash(warmWashPath, { width, height, background: `rgba(255,170,95,${FINAL_WARM_WASH_ALPHA})` }),
    writeFile(grainSvgPath, finalFilmGrainSvg(width, height)),
  ]);
  await rasterizeSvg(grainSvgPath, grainPath, { width, height });

  await runMagick([
    inputPath,
    "-modulate",
    "101.8,98.5,100",
    warmWashPath,
    "-compose",
    "SoftLight",
    "-composite",
    ...alphaMultiplyArgs(grainPath, FINAL_FILM_GRAIN_OPACITY),
    "-compose",
    "Overlay",
    "-composite",
    pngOutput(outputPath),
  ]);
}

function expandedCrop(box, { width, height, pad = 16 }) {
  const left = Math.max(0, box.left - pad);
  const top = Math.max(0, box.top - pad);
  const right = Math.min(width, box.left + box.width + pad);
  const bottom = Math.min(height, box.top + box.height + pad);
  return {
    left,
    top,
    width: right - left,
    height: bottom - top,
  };
}

async function cropImage(inputPath, outputPath, box) {
  await runMagick([
    inputPath,
    "-crop",
    `${box.width}x${box.height}+${box.left}+${box.top}`,
    "+repage",
    pngOutput(outputPath),
  ]);
}

async function writeDebugCrops(outputPath, { board, toolchain, width, height }) {
  const mainSign = expandedCrop(board, { width, height, pad: 18 });
  const toolSign = expandedCrop(toolchain, { width, height, pad: 12 });
  const mainCropPath = join(GENERATED_DIR, "debug-main-sign.png");
  const toolCropPath = join(GENERATED_DIR, "debug-toolchain.png");
  await Promise.all([
    copyFile(outputPath, join(GENERATED_DIR, "debug-full.png")),
    cropImage(outputPath, mainCropPath, mainSign),
    cropImage(outputPath, toolCropPath, toolSign),
    runMagick([outputPath, "-resize", "640x", pngOutput(join(GENERATED_DIR, "debug-full-small.png"))]),
    runMagick([outputPath, "-colorspace", "Gray", pngOutput(join(GENERATED_DIR, "debug-full-gray.png"))]),
    runMagick([outputPath, "-blur", "0x2", pngOutput(join(GENERATED_DIR, "debug-full-blur2.png"))]),
  ]);
  await Promise.all([
    runMagick([mainCropPath, "-resize", `${mainSign.width * 2}x`, pngOutput(join(GENERATED_DIR, "debug-main-sign-2x.png"))]),
    runMagick([toolCropPath, "-resize", `${toolSign.width * 2}x`, pngOutput(join(GENERATED_DIR, "debug-toolchain-2x.png"))]),
  ]);
}

async function main() {
  const [{ version }] = await Promise.all([
    ensureImageMagick(),
    mkdir(OUT_DIR, { recursive: true }),
    mkdir(GENERATED_DIR, { recursive: true }),
  ]);
  const scene = await readJson(join(CONFIG_DIR, "scene.json"));
  const staticData = await readJson(join(CONFIG_DIR, "static-data.json"));
  const layout = applyLayoutEnv(await readJson(join(CONFIG_DIR, "layouts/subway-default.json")));
  const backgroundPath = isAbsolute(BACKGROUND) ? BACKGROUND : join(ASSET_DIR, BACKGROUND);
  const metadata = await identifyImage(backgroundPath);
  const sourceWidth = metadata.width || layout.sourceWidth;
  const sourceHeight = metadata.height || layout.sourceHeight;
  const scale = OUTPUT_WIDTH / sourceWidth;
  const outputHeight = Math.round(sourceHeight * scale);
  const quadScale = {
    scaleX: OUTPUT_WIDTH / sourceWidth,
    scaleY: outputHeight / sourceHeight,
  };

  const { allRepos, repos } = await collectData(staticData);
  if (SMOKE) {
    console.log(`Smoke OK - ImageMagick ${version}, ${repos.length} repos, ${allRepos.length} total ${USE_STATIC_DATA ? "static" : "fetched"}, ${sourceWidth}x${sourceHeight} background`);
    return;
  }

  const { css: fontCss } = await loadFontAsDataUrl();
  const boardDesign = designSize(layout.board);
  const toolchainDesign = designSize(layout.toolchain);
  const boardQuad = scaledQuad(layout.board, quadScale);
  const toolchainQuad = scaledQuad(layout.toolchain, quadScale);
  const board = boxFromQuad(boardQuad);
  const toolchain = boxFromQuad(toolchainQuad);
  const repositorySvg = renderRepositorySignSvg({
    repos,
    allRepos,
    fontCss,
    width: boardDesign.width,
    height: boardDesign.height,
    outputWidth: boardDesign.width,
    outputHeight: boardDesign.height,
  });
  const repositoryEmissiveSvg = renderRepositorySignSvg({
    repos,
    allRepos,
    fontCss,
    width: boardDesign.width,
    height: boardDesign.height,
    outputWidth: boardDesign.width,
    outputHeight: boardDesign.height,
    emissiveOnly: true,
  });
  const toolchainSvg = renderToolchainSpectrumSvg({
    allRepos,
    fontCss,
    width: toolchainDesign.width,
    height: toolchainDesign.height,
    outputWidth: toolchainDesign.width,
    outputHeight: toolchainDesign.height,
  });
  const toolchainEmissiveSvg = renderToolchainSpectrumSvg({
    allRepos,
    fontCss,
    width: toolchainDesign.width,
    height: toolchainDesign.height,
    outputWidth: toolchainDesign.width,
    outputHeight: toolchainDesign.height,
    emissiveOnly: true,
  });

  const repositorySvgPath = join(GENERATED_DIR, "repository-sign.svg");
  const repositoryEmissiveSvgPath = join(GENERATED_DIR, "repository-sign-emissive.svg");
  const toolchainSvgPath = join(GENERATED_DIR, "toolchain-spectrum.svg");
  const toolchainEmissiveSvgPath = join(GENERATED_DIR, "toolchain-spectrum-emissive.svg");
  await Promise.all([
    writeFile(repositorySvgPath, repositorySvg),
    writeFile(repositoryEmissiveSvgPath, repositoryEmissiveSvg),
    writeFile(toolchainSvgPath, toolchainSvg),
    writeFile(toolchainEmissiveSvgPath, toolchainEmissiveSvg),
  ]);

  const repositoryLayers = await renderPanelLayers("repository-sign", repositorySvgPath, repositoryEmissiveSvgPath, {
    width: boardDesign.width,
    height: boardDesign.height,
  });
  const toolchainLayers = await renderPanelLayers("toolchain-spectrum", toolchainSvgPath, toolchainEmissiveSvgPath, {
    width: toolchainDesign.width,
    height: toolchainDesign.height,
  });

  const repositoryOverlayPath = join(GENERATED_DIR, "repository-overlay.png");
  const toolchainOverlayPath = join(GENERATED_DIR, "toolchain-overlay.png");
  await Promise.all([
    renderOverlayCanvas(repositoryLayers, repositoryOverlayPath, {
      width: boardDesign.width,
      height: boardDesign.height,
      emissiveOpacity: 0.005,
      panelOpacity: 0.92,
      glassOpacity: 0.10,
      throughGlassOpacity: 0,
    }),
    renderOverlayCanvas(toolchainLayers, toolchainOverlayPath, {
      width: toolchainDesign.width,
      height: toolchainDesign.height,
      emissiveOpacity: 0.008,
      panelOpacity: 0.98,
      glassOpacity: 0.10,
      throughGlassOpacity: 0,
    }),
  ]);

  const repositoryWarpedPath = join(GENERATED_DIR, "repository-overlay-warped.png");
  const toolchainWarpedPath = join(GENERATED_DIR, "toolchain-overlay-warped.png");
  const repositoryAberratedPath = join(GENERATED_DIR, "repository-overlay-aberrated.png");
  const toolchainAberratedPath = join(GENERATED_DIR, "toolchain-overlay-aberrated.png");
  await Promise.all([
    applyChromaticAberration(repositoryOverlayPath, repositoryAberratedPath),
    applyChromaticAberration(toolchainOverlayPath, toolchainAberratedPath),
  ]);
  await Promise.all([
    perspectiveWarpPng(repositoryAberratedPath, repositoryWarpedPath, {
      width: boardDesign.width,
      height: boardDesign.height,
      quad: boardQuad,
      box: board,
    }),
    perspectiveWarpPng(toolchainAberratedPath, toolchainWarpedPath, {
      width: toolchainDesign.width,
      height: toolchainDesign.height,
      quad: toolchainQuad,
      box: toolchain,
    }),
  ]);

  const resizedBackgroundPath = join(GENERATED_DIR, "background-resized.png");
  const compositedPath = join(GENERATED_DIR, "signals-composited.png");
  const outputPath = join(OUT_DIR, "signals.png");
  await runMagick([
    backgroundPath,
    "-resize",
    `${OUTPUT_WIDTH}x`,
    pngOutput(resizedBackgroundPath),
  ]);
  await runMagick([
    resizedBackgroundPath,
    repositoryWarpedPath,
    "-geometry",
    `+${board.left}+${board.top}`,
    "-compose",
    "Over",
    "-composite",
    toolchainWarpedPath,
    "-geometry",
    `+${toolchain.left}+${toolchain.top}`,
    "-compose",
    "Over",
    "-composite",
    pngOutput(compositedPath),
  ]);
  await applyFinalGrade(compositedPath, outputPath, {
    width: OUTPUT_WIDTH,
    height: outputHeight,
  });

  await validateImage(outputPath, OUTPUT_WIDTH);
  await validateSignals({
    scene,
    staticData,
    layout,
    repositorySvg,
    toolchainSvg,
    output: outputPath,
    background: backgroundPath,
    width: OUTPUT_WIDTH,
    height: outputHeight,
  });
  await writeDebugCrops(outputPath, {
    board,
    toolchain,
    width: OUTPUT_WIDTH,
    height: outputHeight,
  });
  console.log(`assets/signals.png written with ImageMagick ${version} and ${repos.length} repo rows`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
