import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFile, writeFile } from "node:fs/promises";

import sharp from "sharp";
import { Resvg } from "@resvg/resvg-js";

const ROOT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");
const GENERATED_DIR = join(ROOT_DIR, "assets/generated");
const RASTER_SCALE = 4;

async function renderSharp(svg, width, height) {
  return sharp(Buffer.from(svg), { density: 72 * RASTER_SCALE })
    .resize(width, height, { fit: "fill", kernel: "lanczos3" })
    .png()
    .toBuffer();
}

async function renderResvg(svg, width, height) {
  const resvg = new Resvg(svg, {
    fitTo: {
      mode: "width",
      value: width * RASTER_SCALE,
    },
    font: {
      loadSystemFonts: true,
    },
  });
  return sharp(resvg.render().asPng())
    .resize(width, height, { fit: "fill", kernel: "lanczos3" })
    .png()
    .toBuffer();
}

async function main() {
  const jobs = [
    ["repository-sign.svg", 500, 160],
    ["toolchain-spectrum.svg", 144, 420],
  ];

  for (const [file, width, height] of jobs) {
    const svg = await readFile(join(GENERATED_DIR, file), "utf8");
    const base = file.replace(/\.svg$/, "");
    await Promise.all([
      writeFile(join(GENERATED_DIR, `${base}-sharp-raster.png`), await renderSharp(svg, width, height)),
      writeFile(join(GENERATED_DIR, `${base}-resvg-raster.png`), await renderResvg(svg, width, height)),
    ]);
  }
  console.log("Rasterizer comparison crops written to assets/generated");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
