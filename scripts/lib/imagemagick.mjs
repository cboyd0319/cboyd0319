import { spawn, spawnSync } from "node:child_process";
import { open, unlink } from "node:fs/promises";
import { FONTCONFIG_FILE, verifyDisplayFont } from "./font.mjs";

export const REQUIRED_MAGICK_VERSION = "7.1.2-25";

const HOMEBREW_MAGICK = "/opt/homebrew/opt/imagemagick-full/bin/magick";
let cachedMagickPath = null;
let cachedMagickInfo;

function commandCandidates() {
  if (process.env.MAGICK_BIN?.trim()) return [process.env.MAGICK_BIN.trim()];
  return [
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
  cachedMagickInfo ??= Promise.all([runCommand(magick, ["-version"]), verifyDisplayFont()]);
  const [{ stdout }] = await cachedMagickInfo;
  const version = parseMagickVersion(stdout);
  if (version !== requiredVersion) {
    throw new Error(`ImageMagick ${requiredVersion} required, got ${version || "unknown"} from ${magick}.`);
  }
  if (!/\brsvg\b/.test(stdout)) throw new Error(`ImageMagick must include the rsvg delegate: ${magick}.`);
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
  const { magick } = await ensureImageMagick();
  return runCommand(magick, args, {
    ...options,
    env: { ...(options.env ?? process.env), FONTCONFIG_FILE },
  });
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

export async function withImageLock(outputPath, work) {
  const lockPath = `${outputPath}.lock`;
  const lock = await open(lockPath, "wx").catch((err) => {
    if (err.code === "EEXIST") throw new Error(`Image writer lock exists: ${lockPath}. Remove it only after confirming no generator or optimizer is running.`);
    throw err;
  });
  try {
    await lock.writeFile(`${process.pid}\n`);
    return await work();
  } finally {
    await lock.close();
    await unlink(lockPath);
  }
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
