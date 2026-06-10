import { spawnSync } from "node:child_process";

const files = [
  "scripts/check-syntax.mjs",
  "scripts/prepare-blank.mjs",
  "scripts/generate-overlays.mjs",
  "scripts/render-magick-panels.mjs",
  "scripts/optimize-signals.mjs",
  "scripts/validate-signals.mjs",
  "scripts/test-utils.mjs",
  "scripts/lib/config.mjs",
  "scripts/lib/utils.mjs",
  "scripts/lib/github.mjs",
  "scripts/lib/font.mjs",
  "scripts/lib/imagemagick.mjs",
  "scripts/lib/svg.mjs",
];

for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", file], {
    encoding: "utf8",
    stdio: "pipe",
  });
  if (result.status !== 0) {
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    process.exit(result.status ?? 1);
  }
}

console.log(`Syntax OK - ${files.length} files checked`);
