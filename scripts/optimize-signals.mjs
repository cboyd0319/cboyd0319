import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdir, rename, stat, unlink } from "node:fs/promises";

import { ensureImageMagick, identifyImage, runMagick } from "./lib/imagemagick.mjs";

const MIN_OPTIMIZED_BYTES = 10_000;
const WEB = process.argv.includes("--web");

const dir = dirname(fileURLToPath(import.meta.url));
const outputPath = join(dir, "../assets/signals.png");
const generatedDir = join(dir, "../assets/generated");
const tempPath = join(generatedDir, WEB ? "signals-optimized-web.png" : "signals-optimized.png");

let before;
try {
  before = await stat(outputPath);
} catch (err) {
  if (err?.code === "ENOENT") {
    console.warn("signals.png does not exist yet; run the generator before optimizing.");
    process.exit(0);
  }
  throw err;
}

await ensureImageMagick();
await mkdir(generatedDir, { recursive: true });
const args = [
  outputPath,
  "-alpha",
  "off",
  "-strip",
  "-define",
  "png:compression-level=9",
  "-define",
  "png:compression-filter=5",
  "-define",
  "png:compression-strategy=1",
];
if (WEB) {
  args.push("-colors", "256", `PNG8:${tempPath}`);
} else {
  args.push(`PNG24:${tempPath}`);
}
await runMagick(args);

const [optimized, metadata] = await Promise.all([
  stat(tempPath),
  identifyImage(tempPath),
]);
if (!metadata.width || !metadata.height || optimized.size < MIN_OPTIMIZED_BYTES) {
  throw new Error("Optimized signals.png failed validation.");
}

if (optimized.size > before.size) {
  await unlink(tempPath);
  console.log(`signals.png kept original - ${before.size} bytes already smaller`);
} else {
  await rename(tempPath, outputPath);
  console.log(`signals.png optimized - ${before.size} -> ${optimized.size} bytes`);
}
