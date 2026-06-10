import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdir } from "node:fs/promises";

import sharp from "sharp";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(SCRIPT_DIR, "..");
const SOURCE = join(ROOT_DIR, "assets/subway_blank_original.png");
const GENERATED_DIR = join(ROOT_DIR, "assets/generated");

async function main() {
  const metadata = await sharp(SOURCE).metadata();
  if (metadata.width !== 1672 || metadata.height !== 941) {
    throw new Error(`Expected 1672x941 blank, got ${metadata.width}x${metadata.height}`);
  }

  await mkdir(GENERATED_DIR, { recursive: true });
  console.log("assets/subway_blank_original.png already prepared; no blank mutation applied");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
