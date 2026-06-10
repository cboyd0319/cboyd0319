import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { stat, writeFile } from "node:fs/promises";

import sharp from "sharp";

const MIN_OPTIMIZED_BYTES = 10_000;
const WEB = process.argv.includes("--web");

const dir = dirname(fileURLToPath(import.meta.url));
const outputPath = join(dir, "../assets/signals.png");

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
const optimized = await sharp(outputPath, { limitInputPixels: 40_000_000 })
  .png({
    adaptiveFiltering: true,
    compressionLevel: 9,
    effort: 10,
    palette: WEB,
    ...(WEB ? { quality: 90 } : {}),
  })
  .toBuffer();

const metadata = await sharp(optimized).metadata();
if (!metadata.width || !metadata.height || optimized.byteLength < MIN_OPTIMIZED_BYTES) {
  throw new Error("Optimized signals.png failed validation.");
}

if (optimized.byteLength > before.size) {
  console.log(`signals.png kept original - ${before.size} bytes already smaller`);
} else {
  await writeFile(outputPath, optimized);
  console.log(`signals.png optimized - ${before.size} -> ${optimized.byteLength} bytes`);
}
