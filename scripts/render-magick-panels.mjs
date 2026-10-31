import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { ensureImageMagick, rasterizeSvg } from "./lib/imagemagick.mjs";

const ROOT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");
const GENERATED_DIR = join(ROOT_DIR, "assets/generated");
async function main() {
  await ensureImageMagick();
  const jobs = [
    ["repository-sign.svg", 500, 160],
    ["toolchain-spectrum.svg", 131, 420],
  ];

  for (const [file, width, height] of jobs) {
    const base = file.replace(/\.svg$/, "");
    await rasterizeSvg(
      join(GENERATED_DIR, file),
      join(GENERATED_DIR, `${base}-magick-raster.png`),
      { width, height },
    );
  }
  console.log("ImageMagick raster crops written to assets/generated");
}

if (import.meta.main) {
  await main();
}
