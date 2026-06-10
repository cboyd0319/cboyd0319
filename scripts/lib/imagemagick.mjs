import { spawn, spawnSync } from "node:child_process";
import { access } from "node:fs/promises";
import { constants } from "node:fs";

export const REQUIRED_MAGICK_VERSION = "7.1.2-25";

const HOMEBREW_MAGICK = "/opt/homebrew/opt/imagemagick-full/bin/magick";
let cachedMagickPath = null;

function commandCandidates() {
  return [
    process.env.MAGICK_BIN,
    HOMEBREW_MAGICK,
    "magick",
    "magick.exe",
  ].filter(Boolean);
}

function canRun(command) {
  const result = spawnSync(command, ["-version"], {
    encoding: "utf8",
    stdio: "pipe",
  });
  return result.status === 0;
}

export function parseMagickVersion(output) {
  const match = String(output || "").match(/ImageMagick\s+([0-9]+\.[0-9]+\.[0-9]+-[0-9]+)/);
  return match?.[1] ?? null;
}

export function resolveMagickPath() {
  if (cachedMagickPath) return cachedMagickPath;
  for (const candidate of commandCandidates()) {
    if (canRun(candidate)) {
      cachedMagickPath = candidate;
      return cachedMagickPath;
    }
  }
  throw new Error(`ImageMagick ${REQUIRED_MAGICK_VERSION} not found. Set MAGICK_BIN or install /opt/homebrew/opt/imagemagick-full/bin/magick.`);
}

export async function ensureImageMagick({ requiredVersion = REQUIRED_MAGICK_VERSION } = {}) {
  const magick = resolveMagickPath();
  const { stdout } = await runCommand(magick, ["-version"]);
  const version = parseMagickVersion(stdout);
  if (version !== requiredVersion) {
    throw new Error(`ImageMagick ${requiredVersion} required, got ${version || "unknown"} from ${magick}.`);
  }
  return { magick, version, output: stdout };
}

export function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (status, signal) => {
      if (status === 0) {
        resolve({ stdout, stderr });
        return;
      }
      reject(new Error(`${command} ${args.join(" ")} failed with ${signal || status}\n${stderr || stdout}`));
    });
  });
}

export async function runMagick(args, options = {}) {
  return runCommand(resolveMagickPath(), args, options);
}

export async function identifyImage(path) {
  const { stdout } = await runMagick([
    "identify",
    "-format",
    "%w\t%h\t%[channels]\t%[colorspace]\t%b\n",
    path,
  ]);
  const [width, height, channels, colorspace, bytes] = stdout.trim().split("\t");
  return {
    width: Number(width),
    height: Number(height),
    channels,
    colorspace,
    bytes,
  };
}

export async function assertReadableFile(path) {
  await access(path, constants.R_OK);
}

export function pngOutput(path) {
  return `PNG32:${path}`;
}

export function alphaMultiplyArgs(path, opacity) {
  return [
    "(",
    path,
    "-alpha",
    "on",
    "-channel",
    "A",
    "-evaluate",
    "multiply",
    String(opacity),
    "+channel",
    ")",
  ];
}

export function perspectiveControlPoints(width, height, quad) {
  const source = [
    [0, 0],
    [width, 0],
    [width, height],
    [0, height],
  ];
  return source
    .map(([x, y], index) => `${x},${y} ${quad[index].x},${quad[index].y}`)
    .join(" ");
}
