import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";

import {
  OUTPUT_WIDTH as DEFAULT_OUTPUT_WIDTH,
  USERNAME,
} from "./lib/config.mjs";
import { github, githubParticipation } from "./lib/github.mjs";
import { loadFontAsDataUrl } from "./lib/font.mjs";
import { ownActiveRepos, renderRepositorySignSvg, renderToolchainSpectrumSvg } from "./lib/svg.mjs";
import { selectRepos } from "./lib/utils.mjs";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ASSET_DIR = join(SCRIPT_DIR, "../assets");
const OUT_DIR = ASSET_DIR;
const GENERATED_DIR = join(ASSET_DIR, "generated");
const BACKGROUND = "subway_blank_original.png";
const REPOS_PER_PAGE = 100;
const MAX_REPO_PAGES = 10;
const REPO_LIMIT = 4;
const SMOKE = process.argv.includes("--smoke");
const STATIC = ["1", "true", "yes"].includes(String(process.env.STATIC ?? "").toLowerCase());
const MIN_IMAGE_BYTES = 10_000;

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

// Overlay boxes are in source-image pixels for assets/subway_blank_original.png.
const BOARD = {
  left: envNumber("BOARD_LEFT", 300),
  top: envNumber("BOARD_TOP", 30),
  width: envNumber("BOARD_WIDTH", 612),
  height: envNumber("BOARD_HEIGHT", 336),
};

const TOOLCHAIN = {
  left: envNumber("TOOLCHAIN_LEFT", 1324),
  top: envNumber("TOOLCHAIN_TOP", 628),
  width: envNumber("TOOLCHAIN_WIDTH", 176),
  height: envNumber("TOOLCHAIN_HEIGHT", 156),
};

function staticRepos() {
  return [
    {
      name: "JobSentinel",
      language: "TypeScript",
      language_pct: 25,
      pushed_at: minutesAgo(32),
      stargazers_count: 28,
      fork: false,
      archived: false,
    },
    {
      name: "PyGuard",
      language: "Python",
      language_pct: 35,
      pushed_at: daysAgo(14),
      stargazers_count: 19,
      fork: false,
      archived: false,
    },
    {
      name: "WormsWMD-macOS-Fix",
      language: "Shell",
      language_pct: 25,
      pushed_at: daysAgo(45),
      stargazers_count: 11,
      fork: false,
      archived: false,
    },
    {
      name: "PoshGuard",
      language: "PowerShell",
      language_pct: 15,
      pushed_at: daysAgo(180),
      stargazers_count: 7,
      fork: false,
      archived: false,
    },
  ];
}

function staticParticipation(repoName) {
  const lines = new Map([
    ["JobSentinel", [0, 1, 0, 2, 0, 0, 0, 2, 3, 5]],
    ["PyGuard", [0, 0, 1, 0, 0, 0, 0, 1, 4, 2]],
    ["WormsWMD-macOS-Fix", [0, 0, 0, 1, 0, 0, 0, 1, 2, 3]],
    ["PoshGuard", [0, 0, 0, 0, 1, 0, 0, 1, 1, 2]],
  ]);
  return lines.get(repoName) ?? Array(10).fill(0);
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

async function collectData() {
  const allRepos = STATIC ? staticRepos() : await fetchOwnerRepos();
  const repos = selectRepos(ownActiveRepos(allRepos), REPO_LIMIT);
  const sparklines = STATIC
    ? repos.map((repo) => staticParticipation(repo.name))
    : await Promise.all(repos.map((repo) => githubParticipation(USERNAME, repo.name)));
  return { allRepos, repos, sparklines };
}

function scaledBox(box, scale) {
  return {
    left: Math.round(box.left * scale),
    top: Math.round(box.top * scale),
    width: Math.round(box.width * scale),
    height: Math.round(box.height * scale),
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

async function main() {
  const backgroundPath = join(ASSET_DIR, BACKGROUND);
  const metadata = await sharp(backgroundPath).metadata();
  const sourceWidth = metadata.width || 1672;
  const sourceHeight = metadata.height || 941;
  const scale = OUTPUT_WIDTH / sourceWidth;

  const { allRepos, repos, sparklines } = await collectData();
  if (SMOKE) {
    console.log(`Smoke OK - ${repos.length} repos, ${allRepos.length} total ${STATIC ? "static" : "fetched"}, ${sourceWidth}x${sourceHeight} background`);
    return;
  }

  const { dataUrl: fontDataUrl } = await loadFontAsDataUrl();
  const board = scaledBox(BOARD, scale);
  const toolchain = scaledBox(TOOLCHAIN, scale);
  const repositorySvg = renderRepositorySignSvg({
    repos,
    allRepos,
    sparklines,
    fontDataUrl,
    width: BOARD.width,
    height: BOARD.height,
    outputWidth: board.width,
    outputHeight: board.height,
  });
  const toolchainSvg = renderToolchainSpectrumSvg({
    allRepos,
    fontDataUrl,
    width: TOOLCHAIN.width,
    height: TOOLCHAIN.height,
    outputWidth: toolchain.width,
    outputHeight: toolchain.height,
  });

  const output = await sharp(backgroundPath)
    .resize({ width: OUTPUT_WIDTH })
    .composite([
      { input: Buffer.from(repositorySvg), left: board.left, top: board.top },
      { input: Buffer.from(toolchainSvg), left: toolchain.left, top: toolchain.top },
    ])
    .png()
    .toBuffer();

  await validateImage(output, OUTPUT_WIDTH);
  await mkdir(OUT_DIR, { recursive: true });
  await mkdir(GENERATED_DIR, { recursive: true });
  await Promise.all([
    writeFile(join(OUT_DIR, "signals.png"), output),
    writeFile(join(GENERATED_DIR, "repository-sign.svg"), repositorySvg),
    writeFile(join(GENERATED_DIR, "toolchain-spectrum.svg"), toolchainSvg),
  ]);
  console.log(`assets/signals.png written with ${repos.length} repo rows`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
