import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { ensureImageMagick, pngOutput, runMagick } from "./lib/imagemagick.mjs";

const ROOT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");
const GENERATED_DIR = join(ROOT_DIR, "assets/generated");
const RASTER_DENSITY = 144;

async function renderMagick(svgPath, outputPath, width, height) {
  await runMagick([
    "-background",
    "none",
    "-density",
    String(RASTER_DENSITY),
    svgPath,
    "-resize",
    `${width}x${height}!`,
    "-alpha",
    "on",
    pngOutput(outputPath),
  ]);
}

async function main() {
  await ensureImageMagick();
  const jobs = [
    ["repository-sign.svg", 500, 160],
    ["toolchain-spectrum.svg", 144, 420],
  ];

  for (const [file, width, height] of jobs) {
    const base = file.replace(/\.svg$/, "");
    await renderMagick(
      join(GENERATED_DIR, file),
      join(GENERATED_DIR, `${base}-magick-raster.png`),
      width,
      height,
    );
  }
  console.log("ImageMagick raster crops written to assets/generated");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
