import { join } from "node:path";
import { writeFile } from "node:fs/promises";

import { alphaMultiplyArgs, pngOutput, rasterizeSvg, runMagick } from "./imagemagick.mjs";

export const FINAL_FILM_GRAIN_OPACITY = 0.15;

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

export async function applyFinalGrade(inputPath, outputPath, { width, height, workDir }) {
  const grainSvgPath = join(workDir, "final-film-grain.svg");
  const grainPath = join(workDir, "final-film-grain.png");
  await writeFile(grainSvgPath, finalFilmGrainSvg(width, height));
  await rasterizeSvg(grainSvgPath, grainPath, { width, height });
  await runMagick([
    inputPath,
    ...alphaMultiplyArgs(grainPath, FINAL_FILM_GRAIN_OPACITY),
    "-compose", "Overlay", "-composite", pngOutput(outputPath),
  ]);
}
