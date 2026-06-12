import { join } from "node:path";
import { copyFile, writeFile } from "node:fs/promises";

import { alphaMultiplyArgs, pngOutput, runMagick } from "./imagemagick.mjs";

export const FINAL_WARM_WASH_ALPHA = 0;
export const FINAL_FILM_GRAIN_OPACITY = 0.15;

async function colorWash(path, { width, height, background }) {
  await runMagick([
    "-size",
    `${width}x${height}`,
    `xc:${background}`,
    pngOutput(path),
  ]);
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

async function rasterizeFinalGradeSvg(svgPath, outputPath, { width, height }) {
  await runMagick([
    "-background",
    "none",
    "-density",
    "144",
    svgPath,
    "-resize",
    `${width}x${height}!`,
    "-alpha",
    "on",
    pngOutput(outputPath),
  ]);
}

export async function applyFinalGrade(inputPath, outputPath, { width, height, workDir }) {
  if (FINAL_WARM_WASH_ALPHA <= 0 && FINAL_FILM_GRAIN_OPACITY <= 0) {
    await copyFile(inputPath, outputPath);
    return;
  }

  const warmWashPath = join(workDir, "final-warm-wash.png");
  const grainSvgPath = join(workDir, "final-film-grain.svg");
  const grainPath = join(workDir, "final-film-grain.png");
  const gradedBasePath = join(workDir, "final-graded-base.png");
  await writeFile(grainSvgPath, finalFilmGrainSvg(width, height));
  await rasterizeFinalGradeSvg(grainSvgPath, grainPath, { width, height });

  if (FINAL_WARM_WASH_ALPHA > 0) {
    await colorWash(warmWashPath, { width, height, background: `rgba(255,170,95,${FINAL_WARM_WASH_ALPHA})` });
    await runMagick([
      inputPath,
      "-modulate",
      "101.8,98.5,100",
      warmWashPath,
      "-compose",
      "SoftLight",
      "-composite",
      pngOutput(gradedBasePath),
    ]);
  } else {
    await copyFile(inputPath, gradedBasePath);
  }

  await runMagick([
    gradedBasePath,
    ...alphaMultiplyArgs(grainPath, FINAL_FILM_GRAIN_OPACITY),
    "-compose",
    "Overlay",
    "-composite",
    pngOutput(outputPath),
  ]);
}
