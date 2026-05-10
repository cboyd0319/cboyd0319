import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { tmpdir } from "node:os";

const exec = promisify(execFile);

const FRAME_COUNT = 20;
const FPS = 10;
const ANIMATION_DURATION_MS = 4000;

const DIR = dirname(fileURLToPath(import.meta.url));
const BANNER_PATH = join(DIR, "../assets/banner.png");
const GIF_PATH = join(DIR, "../assets/banner.gif");

function buildHtml(bannerBase64) {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
* { margin:0; padding:0; box-sizing:border-box; }
html, body { width:1200px; height:385px; overflow:hidden; background:#000; }
#banner { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; }
#scanlines {
  position:absolute; inset:0; pointer-events:none;
  background-image: repeating-linear-gradient(
    to bottom,
    transparent 0px, transparent 2px,
    rgba(0,0,0,0.18) 2px, rgba(0,0,0,0.18) 4px
  );
  animation: scanScroll 2.5s linear infinite;
  animation-play-state: paused;
}
#sweep {
  position:absolute; top:0; bottom:0; width:4px;
  background: linear-gradient(to bottom, transparent 0%, rgba(0,229,255,0.7) 50%, transparent 100%);
  filter: blur(3px);
  animation: sweepMove ${ANIMATION_DURATION_MS}ms ease-in-out infinite;
  animation-play-state: paused;
  left: -10px;
}
#vignette {
  position:absolute; inset:0; pointer-events:none;
  background: radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.45) 100%);
}
@keyframes scanScroll {
  from { background-position: 0 0; }
  to   { background-position: 0 4px; }
}
@keyframes sweepMove {
  0%   { left:-10px; opacity:0; }
  8%   { opacity:0.9; }
  92%  { opacity:0.9; }
  100% { left:1210px; opacity:0; }
}
</style>
</head>
<body>
  <img id="banner" src="data:image/png;base64,${bannerBase64}" alt="">
  <div id="scanlines"></div>
  <div id="sweep"></div>
  <div id="vignette"></div>
</body>
</html>`;
}

async function captureFrames(page, tmpDir) {
  const paths = [];
  for (let i = 0; i < FRAME_COUNT; i++) {
    const t = (i / FRAME_COUNT) * ANIMATION_DURATION_MS;
    await page.evaluate((t) => {
      document.getElementById("scanlines").style.animationDelay = `-${t}ms`;
      document.getElementById("sweep").style.animationDelay = `-${t}ms`;
    }, t);
    const framePath = join(tmpDir, `frame-${String(i).padStart(4, "0")}.png`);
    await page.screenshot({ path: framePath, type: "png",
      clip: { x: 0, y: 0, width: 1200, height: 385 } });
    paths.push(framePath);
    process.stdout.write(`\r  capturing frame ${i + 1}/${FRAME_COUNT}`);
  }
  console.log();
  return paths;
}

async function assembleGif(tmpDir) {
  const frameGlob = join(tmpDir, "frame-%04d.png");
  const palettePath = join(tmpDir, "palette.png");

  await exec("ffmpeg", [
    "-y", "-framerate", String(FPS), "-i", frameGlob,
    "-vf", "palettegen=max_colors=256:stats_mode=full",
    palettePath,
  ]);

  await exec("ffmpeg", [
    "-y", "-framerate", String(FPS), "-i", frameGlob,
    "-i", palettePath,
    "-lavfi", "paletteuse=dither=bayer:bayer_scale=3",
    GIF_PATH,
  ]);
}

async function main() {
  // Verify ffmpeg is available
  try {
    await exec("ffmpeg", ["-version"]);
  } catch {
    console.error("ffmpeg not found — install it first: brew install ffmpeg");
    process.exit(1);
  }

  const bannerBuf = await readFile(BANNER_PATH);
  const bannerBase64 = bannerBuf.toString("base64");
  console.log(`banner.png loaded (${(bannerBuf.length / 1024).toFixed(0)} KB)`);

  const html = buildHtml(bannerBase64);
  const tmpDir = join(tmpdir(), `banner-frames-${Date.now()}`);
  await mkdir(tmpDir, { recursive: true });

  const puppeteer = await import("puppeteer");
  const browser = await puppeteer.default.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 385, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: "domcontentloaded" });
    await page.evaluate(() => document.fonts.ready);
    // Let the first paint settle
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(r)));

    await captureFrames(page, tmpDir);
  } finally {
    await browser.close();
  }

  console.log("assembling GIF via ffmpeg...");
  await assembleGif(tmpDir);
  await rm(tmpDir, { recursive: true, force: true });

  const gifBuf = await readFile(GIF_PATH);
  console.log(`banner.gif written — ${(gifBuf.length / 1024).toFixed(0)} KB, ${FRAME_COUNT} frames @ ${FPS}fps`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
