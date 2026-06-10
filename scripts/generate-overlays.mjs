import { fileURLToPath } from "node:url";
import { dirname, isAbsolute, join } from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";

import {
  OUTPUT_WIDTH as DEFAULT_OUTPUT_WIDTH,
  USERNAME,
} from "./lib/config.mjs";
import { github, githubParticipation } from "./lib/github.mjs";
import { loadFontAsDataUrl } from "./lib/font.mjs";
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
const REPO_LIMIT = 4;
const SMOKE = process.argv.includes("--smoke");
const STATIC = ["1", "true", "yes"].includes(String(process.env.STATIC ?? "").toLowerCase());
const RASTERIZER = process.env.RASTERIZER?.trim() || "sharp";
const MIN_IMAGE_BYTES = 10_000;
const PANEL_RASTER_SCALE = 4;
const PANEL_SOFTEN_SIGMA = 0.025;
const PANEL_SHADOW_OPACITY = 0.06;
const PANEL_SHADOW_BLUR = 0.8;
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

function staticParticipation(repoName, staticData) {
  return staticData.repos.find((repo) => repo.name === repoName)?.sparkline ?? Array(10).fill(0);
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

async function collectData(staticData) {
  const allRepos = STATIC ? staticRepos(staticData) : await fetchOwnerRepos();
  const repos = selectRepos(ownActiveRepos(allRepos), REPO_LIMIT);
  const sparklines = STATIC
    ? repos.map((repo) => staticParticipation(repo.name, staticData))
    : await Promise.all(repos.map((repo) => githubParticipation(USERNAME, repo.name)));
  return { allRepos, repos, sparklines };
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

async function validateImage(buffer, expectedWidth) {
  if (!buffer || buffer.byteLength < MIN_IMAGE_BYTES) {
    throw new Error("Generated signals.png is unexpectedly small.");
  }

  const metadata = await sharp(buffer).metadata();
  if (metadata.width !== expectedWidth || !metadata.height || metadata.height <= 0) {
    throw new Error(`Generated signals.png has unexpected dimensions: ${metadata.width}x${metadata.height}`);
  }
}

function panelGlassSvg(width, height) {
  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
<defs>
  <linearGradient id="panel-glass" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="#D8CFB8" stop-opacity="0.10"/>
    <stop offset="20%" stop-color="#D8CFB8" stop-opacity="0.02"/>
    <stop offset="70%" stop-color="#78312E" stop-opacity="0.010"/>
    <stop offset="100%" stop-color="#000000" stop-opacity="0.24"/>
  </linearGradient>
  <pattern id="panel-scan" width="1" height="4" patternUnits="userSpaceOnUse">
    <rect x="0" y="0" width="1" height="1" fill="#D8CFB8" opacity="0.16"/>
  </pattern>
  <filter id="panel-noise">
    <feTurbulence type="fractalNoise" baseFrequency="0.92" numOctaves="2" seed="19" result="noise"/>
    <feColorMatrix in="noise" type="saturate" values="0"/>
    <feComponentTransfer>
      <feFuncA type="table" tableValues="0 0.055"/>
    </feComponentTransfer>
  </filter>
</defs>
<rect width="${width}" height="${height}" rx="6" fill="#D8CFB8" opacity="0.004"/>
<rect width="${width}" height="${height}" rx="6" fill="url(#panel-glass)"/>
<rect width="${width}" height="${height}" fill="url(#panel-scan)" opacity="0.004"/>
<rect width="${width}" height="${height}" filter="url(#panel-noise)" opacity="0.006"/>
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
  <filter id="grime">
    <feTurbulence type="fractalNoise" baseFrequency="0.58" numOctaves="2" seed="37" result="noise"/>
    <feColorMatrix in="noise" type="saturate" values="0"/>
    <feComponentTransfer>
      <feFuncA type="table" tableValues="0 0.07"/>
    </feComponentTransfer>
  </filter>
</defs>
<rect width="${width}" height="${height}" fill="#06100f" opacity="0.24"/>
<rect width="${width}" height="${height}" fill="url(#top-shadow)" opacity="0.34"/>
<rect width="${width}" height="${height}" filter="url(#grime)" opacity="0.22"/>
</svg>`;
}

async function rasterizePanelBase(svg, { width, height }) {
  if (RASTERIZER === "resvg") {
    const { Resvg } = await import("@resvg/resvg-js");
    const resvg = new Resvg(svg, {
      fitTo: {
        mode: "width",
        value: width * PANEL_RASTER_SCALE,
      },
      font: {
        loadSystemFonts: true,
      },
    });
    return sharp(resvg.render().asPng())
      .resize(width, height, { fit: "fill", kernel: "lanczos3" })
      .ensureAlpha()
      .png()
      .toBuffer();
  }

  return sharp(Buffer.from(svg), { density: 72 * PANEL_RASTER_SCALE })
    .resize(width, height, { fit: "fill", kernel: "lanczos3" })
    .ensureAlpha()
    .png()
    .toBuffer();
}

async function renderPanelLayers(svg, { width, height, emissiveSvg = svg, shadowOpacity = PANEL_SHADOW_OPACITY, shadowBlur = PANEL_SHADOW_BLUR, panelSoftenSigma = PANEL_SOFTEN_SIGMA }) {
  const base = await rasterizePanelBase(svg, { width, height });
  const emissiveBase = await rasterizePanelBase(emissiveSvg, { width, height });

  const panel = await softenReadablePanel(base, panelSoftenSigma);

  const glow = await sharp(emissiveBase)
    .blur(0.75)
    .modulate({ brightness: 1.0, saturation: 0.9 })
    .png()
    .toBuffer();

  const glass = await sharp(Buffer.from(panelGlassSvg(width, height)))
    .png()
    .toBuffer();
  const absorption = await sharp(Buffer.from(panelAbsorptionSvg(width, height)))
    .png()
    .toBuffer();

  const shadow = await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: shadowOpacity },
    },
  })
    .blur(shadowBlur)
    .png()
    .toBuffer();

  return { panel, glow, glass, absorption, shadow, emissive: emissiveBase };
}

async function renderOverlayCanvas(layers, { width, height, emissiveOpacity, panelOpacity, glassOpacity, throughGlassOpacity = 0 }) {
  return sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      ...(emissiveOpacity > 0 ? [{
        input: layers.glow,
        blend: "screen",
        opacity: emissiveOpacity,
      }] : []),
      {
        input: layers.panel,
        blend: "over",
        opacity: panelOpacity,
      },
      ...(throughGlassOpacity > 0 ? [{
        input: layers.absorption,
        blend: "over",
        opacity: throughGlassOpacity,
      }] : []),
      ...(glassOpacity > 0 ? [{
        input: layers.glass,
        blend: "screen",
        opacity: glassOpacity,
      }] : []),
    ])
    .png()
    .toBuffer();
}

function solveLinearSystem(matrix, values) {
  const n = values.length;
  const a = matrix.map((row, i) => [...row, values[i]]);

  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(a[row][col]) > Math.abs(a[pivot][col])) pivot = row;
    }
    if (Math.abs(a[pivot][col]) < 1e-12) throw new Error("Perspective transform is singular.");
    [a[col], a[pivot]] = [a[pivot], a[col]];

    const divisor = a[col][col];
    for (let j = col; j <= n; j++) a[col][j] /= divisor;

    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = a[row][col];
      for (let j = col; j <= n; j++) a[row][j] -= factor * a[col][j];
    }
  }

  return a.map((row) => row[n]);
}

function homography(from, to) {
  const matrix = [];
  const values = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = from[i];
    const u = to[i].x;
    const v = to[i].y;
    matrix.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    values.push(u);
    matrix.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    values.push(v);
  }
  const [a, b, c, d, e, f, g, h] = solveLinearSystem(matrix, values);
  return { a, b, c, d, e, f, g, h };
}

function projectPoint(transform, x, y) {
  const denom = transform.g * x + transform.h * y + 1;
  return {
    x: (transform.a * x + transform.b * y + transform.c) / denom,
    y: (transform.d * x + transform.e * y + transform.f) / denom,
  };
}

function sampleBilinear(raw, width, height, x, y) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(width - 1, x0 + 1);
  const y1 = Math.min(height - 1, y0 + 1);
  const dx = x - x0;
  const dy = y - y0;
  const weights = [
    [(1 - dx) * (1 - dy), x0, y0],
    [dx * (1 - dy), x1, y0],
    [(1 - dx) * dy, x0, y1],
    [dx * dy, x1, y1],
  ];
  const out = [0, 0, 0, 0];
  for (const [weight, sx, sy] of weights) {
    const i = (sy * width + sx) * 4;
    out[0] += raw[i] * weight;
    out[1] += raw[i + 1] * weight;
    out[2] += raw[i + 2] * weight;
    out[3] += raw[i + 3] * weight;
  }
  return out.map((value) => Math.max(0, Math.min(255, Math.round(value))));
}

async function perspectiveWarpPng(input, { width, height, quad }) {
  const src = await sharp(input).ensureAlpha().raw().toBuffer();
  const bbox = boxFromQuad(quad);
  const destinationToSource = homography(quad, [
    { x: 0, y: 0 },
    { x: width - 1, y: 0 },
    { x: width - 1, y: height - 1 },
    { x: 0, y: height - 1 },
  ]);
  const output = Buffer.alloc(bbox.width * bbox.height * 4);

  for (let y = 0; y < bbox.height; y++) {
    for (let x = 0; x < bbox.width; x++) {
      const globalX = bbox.left + x + 0.5;
      const globalY = bbox.top + y + 0.5;
      const source = projectPoint(destinationToSource, globalX, globalY);
      if (source.x < 0 || source.y < 0 || source.x > width - 1 || source.y > height - 1) continue;
      const [r, g, b, alpha] = sampleBilinear(src, width, height, source.x, source.y);
      const i = (y * bbox.width + x) * 4;
      output[i] = r;
      output[i + 1] = g;
      output[i + 2] = b;
      output[i + 3] = alpha;
    }
  }

  return {
    input: await sharp(output, {
      raw: {
        width: bbox.width,
        height: bbox.height,
        channels: 4,
      },
    }).png().toBuffer(),
    left: bbox.left,
    top: bbox.top,
    box: bbox,
  };
}

async function softenReadablePanel(base, sigma = PANEL_SOFTEN_SIGMA) {
  if (sigma <= 0) return base;
  if (sigma < 0.3) {
    const blurred = await sharp(base).blur(0.3).png().toBuffer();
    return sharp(base)
      .composite([{ input: blurred, blend: "over", opacity: sigma / 0.3 }])
      .png()
      .toBuffer();
  }

  return sharp(base)
    .blur(sigma)
    .png()
    .toBuffer();
}

async function colorWash(width, height, background) {
  return sharp({
    create: {
      width,
      height,
      channels: 4,
      background,
    },
  })
    .png()
    .toBuffer();
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

async function applyFinalGrade(buffer, { width, height }) {
  if (FINAL_WARM_WASH_ALPHA <= 0 && FINAL_FILM_GRAIN_OPACITY <= 0) {
    return buffer;
  }

  const warmWash = await colorWash(width, height, {
    r: 255,
    g: 170,
    b: 95,
    alpha: FINAL_WARM_WASH_ALPHA,
  });
  const grain = Buffer.from(finalFilmGrainSvg(width, height));

  return sharp(buffer)
    .modulate({ brightness: 1.018, saturation: 0.985 })
    .composite([
      { input: warmWash, blend: "soft-light" },
      { input: grain, blend: "overlay", opacity: FINAL_FILM_GRAIN_OPACITY },
    ])
    .png()
    .toBuffer();
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

async function writeDebugCrops(output, { board, toolchain, width, height }) {
  const mainSign = expandedCrop(board, { width, height, pad: 18 });
  const toolSign = expandedCrop(toolchain, { width, height, pad: 12 });
  const mainCrop = await sharp(output).extract(mainSign).png().toBuffer();
  const toolCrop = await sharp(output).extract(toolSign).png().toBuffer();
  await Promise.all([
    writeFile(join(GENERATED_DIR, "debug-full.png"), output),
    writeFile(join(GENERATED_DIR, "debug-main-sign.png"), mainCrop),
    writeFile(join(GENERATED_DIR, "debug-toolchain.png"), toolCrop),
    writeFile(join(GENERATED_DIR, "debug-main-sign-2x.png"), await sharp(mainCrop).resize({ width: mainSign.width * 2 }).png().toBuffer()),
    writeFile(join(GENERATED_DIR, "debug-toolchain-2x.png"), await sharp(toolCrop).resize({ width: toolSign.width * 2 }).png().toBuffer()),
    writeFile(join(GENERATED_DIR, "debug-full-small.png"), await sharp(output).resize({ width: 640 }).png().toBuffer()),
    writeFile(join(GENERATED_DIR, "debug-full-gray.png"), await sharp(output).grayscale().png().toBuffer()),
    writeFile(join(GENERATED_DIR, "debug-full-blur2.png"), await sharp(output).blur(2).png().toBuffer()),
  ]);
}

async function main() {
  const scene = await readJson(join(CONFIG_DIR, "scene.json"));
  const staticData = await readJson(join(CONFIG_DIR, "static-data.json"));
  const layout = applyLayoutEnv(await readJson(join(CONFIG_DIR, "layouts/subway-default.json")));
  const backgroundPath = isAbsolute(BACKGROUND) ? BACKGROUND : join(ASSET_DIR, BACKGROUND);
  const metadata = await sharp(backgroundPath).metadata();
  const sourceWidth = metadata.width || layout.sourceWidth;
  const sourceHeight = metadata.height || layout.sourceHeight;
  const scale = OUTPUT_WIDTH / sourceWidth;
  const outputHeight = Math.round(sourceHeight * scale);
  const quadScale = {
    scaleX: OUTPUT_WIDTH / sourceWidth,
    scaleY: outputHeight / sourceHeight,
  };

  const { allRepos, repos, sparklines } = await collectData(staticData);
  if (SMOKE) {
    console.log(`Smoke OK - ${repos.length} repos, ${allRepos.length} total ${STATIC ? "static" : "fetched"}, ${sourceWidth}x${sourceHeight} background`);
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
    sparklines,
    summary: STATIC ? staticData.summary : null,
    fontCss,
    width: boardDesign.width,
    height: boardDesign.height,
    outputWidth: boardDesign.width,
    outputHeight: boardDesign.height,
  });
  const repositoryEmissiveSvg = renderRepositorySignSvg({
    repos,
    allRepos,
    sparklines,
    summary: STATIC ? staticData.summary : null,
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
  const repositoryLayers = await renderPanelLayers(repositorySvg, {
    width: boardDesign.width,
    height: boardDesign.height,
    emissiveSvg: repositoryEmissiveSvg,
    shadowOpacity: 0,
    panelSoftenSigma: 0.18,
  });
  const toolchainLayers = await renderPanelLayers(toolchainSvg, {
    width: toolchainDesign.width,
    height: toolchainDesign.height,
    emissiveSvg: toolchainEmissiveSvg,
    shadowOpacity: 0,
    panelSoftenSigma: 0.18,
  });
  const repositoryOverlay = await renderOverlayCanvas(repositoryLayers, {
    width: boardDesign.width,
    height: boardDesign.height,
    emissiveOpacity: 0.01,
    panelOpacity: 0.86,
    glassOpacity: 0.005,
    throughGlassOpacity: 0.045,
  });
  const toolchainOverlay = await renderOverlayCanvas(toolchainLayers, {
    width: toolchainDesign.width,
    height: toolchainDesign.height,
    emissiveOpacity: 0.006,
    panelOpacity: 0.78,
    glassOpacity: 0.005,
    throughGlassOpacity: 0.06,
  });
  const repositoryWarped = await perspectiveWarpPng(repositoryOverlay, {
    width: boardDesign.width,
    height: boardDesign.height,
    quad: boardQuad,
  });
  const toolchainWarped = await perspectiveWarpPng(toolchainOverlay, {
    width: toolchainDesign.width,
    height: toolchainDesign.height,
    quad: toolchainQuad,
  });

  const composited = await sharp(backgroundPath)
    .resize({ width: OUTPUT_WIDTH })
    .composite([
      {
        input: repositoryWarped.input,
        left: repositoryWarped.left,
        top: repositoryWarped.top,
        blend: "over",
      },
      {
        input: toolchainWarped.input,
        left: toolchainWarped.left,
        top: toolchainWarped.top,
        blend: "over",
      },
    ])
    .png()
    .toBuffer();
  const output = await applyFinalGrade(composited, {
    width: OUTPUT_WIDTH,
    height: outputHeight,
  });

  await validateImage(output, OUTPUT_WIDTH);
  await validateSignals({
    scene,
    staticData,
    layout,
    repositorySvg,
    toolchainSvg,
    output,
    width: OUTPUT_WIDTH,
    height: outputHeight,
  });
  await mkdir(OUT_DIR, { recursive: true });
  await mkdir(GENERATED_DIR, { recursive: true });
  await writeDebugCrops(output, {
    board,
    toolchain,
    width: OUTPUT_WIDTH,
    height: outputHeight,
  });
  await Promise.all([
    writeFile(join(OUT_DIR, "signals.png"), output),
    writeFile(join(GENERATED_DIR, "repository-sign.svg"), repositorySvg),
    writeFile(join(GENERATED_DIR, "repository-sign-emissive.svg"), repositoryEmissiveSvg),
    writeFile(join(GENERATED_DIR, "toolchain-spectrum.svg"), toolchainSvg),
    writeFile(join(GENERATED_DIR, "toolchain-spectrum-emissive.svg"), toolchainEmissiveSvg),
    writeFile(join(GENERATED_DIR, "repository-sign.png"), repositoryLayers.panel),
    writeFile(join(GENERATED_DIR, "repository-sign-emissive.png"), repositoryLayers.emissive),
    writeFile(join(GENERATED_DIR, "repository-sign-glow.png"), repositoryLayers.glow),
    writeFile(join(GENERATED_DIR, "repository-sign-glass.png"), repositoryLayers.glass),
    writeFile(join(GENERATED_DIR, "repository-sign-absorption.png"), repositoryLayers.absorption),
    writeFile(join(GENERATED_DIR, "repository-overlay.png"), repositoryOverlay),
    writeFile(join(GENERATED_DIR, "repository-overlay-warped.png"), repositoryWarped.input),
    writeFile(join(GENERATED_DIR, "toolchain-spectrum.png"), toolchainLayers.panel),
    writeFile(join(GENERATED_DIR, "toolchain-spectrum-emissive.png"), toolchainLayers.emissive),
    writeFile(join(GENERATED_DIR, "toolchain-spectrum-glow.png"), toolchainLayers.glow),
    writeFile(join(GENERATED_DIR, "toolchain-spectrum-glass.png"), toolchainLayers.glass),
    writeFile(join(GENERATED_DIR, "toolchain-spectrum-absorption.png"), toolchainLayers.absorption),
    writeFile(join(GENERATED_DIR, "toolchain-overlay.png"), toolchainOverlay),
    writeFile(join(GENERATED_DIR, "toolchain-overlay-warped.png"), toolchainWarped.input),
  ]);
  console.log(`assets/signals.png written with ${repos.length} repo rows`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
