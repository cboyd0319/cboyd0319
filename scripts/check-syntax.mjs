import { spawnSync } from "node:child_process";

const files = [
  "scripts/check-syntax.mjs",
  "scripts/generate-overlays.mjs",
  "scripts/render-magick-panels.mjs",
  "scripts/optimize-signals.mjs",
  "scripts/validate-signals.mjs",
  "scripts/test-utils.mjs",
  "scripts/lib/config.mjs",
  "scripts/lib/utils.mjs",
  "scripts/lib/github.mjs",
  "scripts/lib/font.mjs",
  "scripts/lib/final-grade.mjs",
  "scripts/lib/imagemagick.mjs",
  "scripts/lib/svg.mjs",
];

const checks = [
  ...files.map((file) => [process.execPath, "--check", file]),
  ...["scripts/install-imagemagick-ci.sh", "scripts/publish-signals.sh"].map((file) => ["bash", "-n", file]),
  ...[".githooks/pre-commit", ".githooks/pre-push"].map((file) => ["sh", "-n", file]),
];
for (const [command, ...args] of checks) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    stdio: "pipe",
  });
  if (result.status !== 0) {
    if (result.error) console.error(result.error.message);
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    process.exit(result.status ?? 1);
  }
}

console.log(`Syntax OK - ${checks.length} files checked`);
