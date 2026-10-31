import { fileURLToPath } from "node:url";
import { dirname, isAbsolute, join } from "node:path";
import { copyFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";

import {
  OUTPUT_WIDTH as DEFAULT_OUTPUT_WIDTH,
  USERNAME,
  applyLayoutEnv,
  envNumber,
  staticRepos,
} from "./lib/config.mjs";
import { github } from "./lib/github.mjs";
import { loadFontAsDataUrl } from "./lib/font.mjs";
import { applyFinalGrade } from "./lib/final-grade.mjs";
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

export { applyLayoutEnv } from "./lib/config.mjs";

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
const PANEL_SOFTEN_SIGMA = 0.10;
const PANEL_TEXTURE_ATTENUATE = 0.018;
const PANEL_TEXTURE_SEED = 31;
const PANEL_GLOW_TINT_COLOR = "#C98524";
const PANEL_GLOW_TINT_STRENGTH = 12;
const MACRO_GLOW_BLUR_SIGMA = 9;
const MACRO_GLOW_OPACITY = 0.035;
const GLARE_OPACITY = 0.035;
const CHROMATIC_ABERRATION_RED_SHIFT = "+1+0";
const CHROMATIC_ABERRATION_BLUE_SHIFT = "-1+0";
const TOOLCHAIN_CHROMATIC_ABERRATION_RED_SHIFT = "+2+1";
const TOOLCHAIN_CHROMATIC_ABERRATION_BLUE_SHIFT = "-1-1";

function rgbaMultiplyArgs(path, opacity) {
  return [
    "(",
    path,
    "-alpha",
    "on",
    "-channel",
    "RGBA",
    "-evaluate",
    "multiply",
    String(opacity),
    "+channel",
    ")",
  ];
}

const OUTPUT_WIDTH = envNumber("OUTPUT_WIDTH", DEFAULT_OUTPUT_WIDTH);

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

export async function fetchOwnerRepos() {
  const repos = new Map();
  for (let page = 1; page <= MAX_REPO_PAGES; page++) {
    const chunk = await github(`/users/${USERNAME}/repos?type=owner&sort=full_name&direction=asc&per_page=${REPOS_PER_PAGE}&page=${page}`);
    if (!Array.isArray(chunk)) throw new Error("GitHub repos API returned an unexpected payload.");
    for (const repo of chunk) {
      if (!repo || typeof repo !== "object" || typeof repo.private !== "boolean"
        || typeof repo.owner?.login !== "string") {
        throw new Error("GitHub repos API returned invalid repository metadata.");
      }
      if (repo.private || (repo.visibility && repo.visibility !== "public")
        || repo.owner.login.toLowerCase() !== USERNAME.toLowerCase()) continue;
      if (typeof repo.name !== "string" || !/^[\w.-]+$/.test(repo.name) || [".", ".."].includes(repo.name)
        || typeof repo.fork !== "boolean" || typeof repo.archived !== "boolean"
        || (repo.language !== null && typeof repo.language !== "string")
        || (repo.pushed_at !== null && (typeof repo.pushed_at !== "string" || !Number.isFinite(Date.parse(repo.pushed_at))))
        || !Number.isSafeInteger(repo.stargazers_count) || repo.stargazers_count < 0) {
        throw new Error("GitHub repos API returned invalid repository metadata.");
      }
      const { name, fork, archived, language, pushed_at, stargazers_count } = repo;
      repos.set(name.toLowerCase(), { name, fork, archived, language, pushed_at, stargazers_count });
    }
    if (chunk.length < REPOS_PER_PAGE) return [...repos.values()];
  }
  throw new Error("GitHub repository pagination limit reached; refusing incomplete data.");
}

async function fetchRepoLanguages(repoName) {
  const data = await github(`/repos/${USERNAME}/${encodeURIComponent(repoName)}/languages`);
  if (!data || Array.isArray(data) || typeof data !== "object"
    || Object.entries(data).some(([name, bytes]) => !name.trim() || !Number.isSafeInteger(bytes) || bytes < 0)) {
    throw new Error("GitHub languages API returned an unexpected payload.");
  }
  return data;
}

export async function withLanguageBreakdowns(repos) {
  const activeRepos = ownActiveRepos(repos);
  const languagesByName = new Map();
  for (const repo of activeRepos) {
    languagesByName.set(repo.name, await fetchRepoLanguages(repo.name));
  }
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

function requiredQuad(box, label) {
  if (!Array.isArray(box.quad) || box.quad.length !== 4) {
    throw new Error(`${label} layout must define a four-point quad.`);
  }
  return box.quad;
}

function scaledQuad(box, { scaleX, scaleY }, label) {
  return requiredQuad(box, label).map((point) => ({
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

async function renderMacroGlow(inputPath, outputPath, { glowTintColor, glowTintStrength }) {
  await runMagick([
    inputPath,
    "-blur",
    `0x${MACRO_GLOW_BLUR_SIGMA}`,
    "-modulate",
    "100,90,100",
    "-fill",
    glowTintColor,
    "-colorize",
    String(glowTintStrength),
    pngOutput(outputPath),
  ]);
}

async function renderPanelLayers(prefix, svgPath, emissiveSvgPath, {
  width,
  height,
  panelSoftenSigma = PANEL_SOFTEN_SIGMA,
  glowTintColor = PANEL_GLOW_TINT_COLOR,
  glowTintStrength = PANEL_GLOW_TINT_STRENGTH,
}) {
  const basePath = join(GENERATED_DIR, `${prefix}-base.png`);
  const softenedPath = join(GENERATED_DIR, `${prefix}-softened.png`);
  const panelPath = join(GENERATED_DIR, `${prefix}.png`);
  const emissivePath = join(GENERATED_DIR, `${prefix}-emissive.png`);
  const emissiveTexturedPath = join(GENERATED_DIR, `${prefix}-emissive-textured.png`);
  const glowPath = join(GENERATED_DIR, `${prefix}-glow.png`);
  const macroGlowPath = join(GENERATED_DIR, `${prefix}-macro-glow.png`);

  await Promise.all([
    rasterizeSvg(svgPath, basePath, { width, height }),
    rasterizeSvg(emissiveSvgPath, emissivePath, { width, height }),
  ]);
  await softenReadablePanel(basePath, softenedPath, panelSoftenSigma);
  await Promise.all([
    copyFile(softenedPath, panelPath),
    copyFile(emissivePath, emissiveTexturedPath),
  ]);
  await Promise.all([
    runMagick([
      emissiveTexturedPath,
      "-blur",
      "0x0.75",
      "-modulate",
      "100,90,100",
      "-fill",
      glowTintColor,
      "-colorize",
      String(glowTintStrength),
      pngOutput(glowPath),
    ]),
    renderMacroGlow(emissiveTexturedPath, macroGlowPath, { glowTintColor, glowTintStrength }),
  ]);

  return {
    panel: panelPath,
    glow: glowPath,
    macroGlow: macroGlowPath,
    emissive: emissiveTexturedPath,
  };
}

async function renderOverlayCanvas(layers, outputPath, { width, height, emissiveOpacity, panelOpacity, macroGlowOpacity = MACRO_GLOW_OPACITY }) {
  const args = ["-size", `${width}x${height}`, "xc:none"];
  if (macroGlowOpacity > 0) {
    args.push(...alphaMultiplyArgs(layers.macroGlow, macroGlowOpacity), "-compose", "Screen", "-composite");
  }
  if (emissiveOpacity > 0) {
    args.push(...alphaMultiplyArgs(layers.glow, emissiveOpacity), "-compose", "Screen", "-composite");
  }
  args.push(...alphaMultiplyArgs(layers.panel, panelOpacity), "-compose", "Over", "-composite");
  args.push(pngOutput(outputPath));
  await runMagick(args);
}

async function applyChromaticAberration(inputPath, outputPath, {
  redShift = CHROMATIC_ABERRATION_RED_SHIFT,
  blueShift = CHROMATIC_ABERRATION_BLUE_SHIFT,
} = {}) {
  await runMagick([
    inputPath,
    "-channel",
    "R",
    "-roll",
    redShift,
    "-blur",
    "0x0.3",
    "+channel",
    "-channel",
    "B",
    "-roll",
    blueShift,
    "-blur",
    "0x0.3",
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

function glareSvg(width, height, variant) {
  const topPath = `M ${-width * 0.08} ${height * 0.12} L ${width * 1.08} ${height * 0.03} L ${width * 1.04} ${height * 0.13} L ${-width * 0.04} ${height * 0.22} Z`;
  const sidePath = `M ${width * 0.04} ${height * 0.07} L ${width * 1.18} ${height * 0.16} L ${width * 1.08} ${height * 0.25} L ${-width * 0.08} ${height * 0.16} Z`;
  const path = variant === "side" ? sidePath : topPath;
  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
<defs>
  <linearGradient id="glass-glare" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#ffdba0" stop-opacity="0"/>
    <stop offset="0.5" stop-color="#ffdba0" stop-opacity="1"/>
    <stop offset="1" stop-color="#ffdba0" stop-opacity="0"/>
  </linearGradient>
  <filter id="glass-soften" x="-20%" y="-80%" width="140%" height="260%">
    <feGaussianBlur stdDeviation="25"/>
  </filter>
</defs>
<path d="${path}" fill="url(#glass-glare)" filter="url(#glass-soften)"/>
</svg>`;
}

async function renderGlareCanvas(prefix, outputPath, { width, height, variant }) {
  const svgPath = join(GENERATED_DIR, `${prefix}.svg`);
  await writeFile(svgPath, glareSvg(width, height, variant));
  await rasterizeSvg(svgPath, outputPath, { width, height });
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
  const boardQuad = scaledQuad(layout.board, quadScale, "board");
  const toolchainQuad = scaledQuad(layout.toolchain, quadScale, "toolchain");
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
    panelSoftenSigma: 0.12,
  });

  const repositoryOverlayPath = join(GENERATED_DIR, "repository-overlay.png");
  const toolchainOverlayPath = join(GENERATED_DIR, "toolchain-overlay.png");
  const repositoryGlarePath = join(GENERATED_DIR, "repository-glare.png");
  const toolchainGlarePath = join(GENERATED_DIR, "toolchain-glare.png");
  await Promise.all([
    renderOverlayCanvas(repositoryLayers, repositoryOverlayPath, {
      width: boardDesign.width,
      height: boardDesign.height,
      emissiveOpacity: 0.008,
      panelOpacity: 0.72,
    }),
    renderOverlayCanvas(toolchainLayers, toolchainOverlayPath, {
      width: toolchainDesign.width,
      height: toolchainDesign.height,
      emissiveOpacity: 0.014,
      panelOpacity: 0.76,
    }),
    renderGlareCanvas("repository-glare", repositoryGlarePath, {
      width: boardDesign.width,
      height: boardDesign.height,
      variant: "top",
    }),
    renderGlareCanvas("toolchain-glare", toolchainGlarePath, {
      width: toolchainDesign.width,
      height: toolchainDesign.height,
      variant: "side",
    }),
  ]);

  const repositoryWarpedPath = join(GENERATED_DIR, "repository-overlay-warped.png");
  const toolchainWarpedPath = join(GENERATED_DIR, "toolchain-overlay-warped.png");
  const repositoryGlareWarpedPath = join(GENERATED_DIR, "repository-glare-warped.png");
  const toolchainGlareWarpedPath = join(GENERATED_DIR, "toolchain-glare-warped.png");
  const repositoryAberratedPath = join(GENERATED_DIR, "repository-overlay-aberrated.png");
  const toolchainAberratedPath = join(GENERATED_DIR, "toolchain-overlay-aberrated.png");
  await Promise.all([
    applyChromaticAberration(repositoryOverlayPath, repositoryAberratedPath),
    applyChromaticAberration(toolchainOverlayPath, toolchainAberratedPath, {
      redShift: TOOLCHAIN_CHROMATIC_ABERRATION_RED_SHIFT,
      blueShift: TOOLCHAIN_CHROMATIC_ABERRATION_BLUE_SHIFT,
    }),
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
    perspectiveWarpPng(repositoryGlarePath, repositoryGlareWarpedPath, {
      width: boardDesign.width,
      height: boardDesign.height,
      quad: boardQuad,
      box: board,
    }),
    perspectiveWarpPng(toolchainGlarePath, toolchainGlareWarpedPath, {
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
    ...rgbaMultiplyArgs(repositoryGlareWarpedPath, GLARE_OPACITY),
    "-geometry",
    `+${board.left}+${board.top}`,
    "-compose",
    "Screen",
    "-composite",
    ...rgbaMultiplyArgs(toolchainGlareWarpedPath, GLARE_OPACITY),
    "-geometry",
    `+${toolchain.left}+${toolchain.top}`,
    "-compose",
    "Screen",
    "-composite",
    pngOutput(compositedPath),
  ]);
  await applyFinalGrade(compositedPath, outputPath, {
    width: OUTPUT_WIDTH,
    height: outputHeight,
    workDir: GENERATED_DIR,
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
