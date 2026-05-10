import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { writeFile } from "node:fs/promises";

const DIR = dirname(fileURLToPath(import.meta.url));
const OUT = join(DIR, "../assets/banner.png");
const W = 1200, H = 385;
const HORIZON = 248;
const VP_X = 600;
const SUN_CX = 600, SUN_CY = 198, SUN_R = 78;

function makeStars(count = 96) {
  let s = 8675309;
  const rng = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  return Array.from({ length: count }, () => ({
    x: Math.floor(rng() * W),
    y: Math.floor(rng() * (HORIZON - 30)),
    r: rng() < 0.15 ? 1.5 : rng() < 0.45 ? 1 : 0.5,
    o: (0.35 + rng() * 0.6).toFixed(2),
    c: rng() < 0.12 ? "#b0f8ff" : rng() < 0.08 ? "#ffbbcc" : "#ffffff",
  }));
}

function makeVLines() {
  const lines = [];
  for (let k = -10; k <= 10; k++) {
    const xb = VP_X + k * 70;
    if (xb < -180 || xb > W + 180) continue;
    const distRatio = Math.abs(k) / 10;
    lines.push({ xb, opacity: (0.35 + distRatio * 0.45).toFixed(2) });
  }
  return lines;
}

function makeHLines() {
  const ys = [];
  for (let k = 1; k <= 14; k++) {
    const y = HORIZON + Math.round(k * k * 2.2);
    if (y >= H) break;
    ys.push(y);
  }
  return ys;
}

function makeScanLines() {
  const lines = [];
  let y = SUN_CY - SUN_R * 0.22;
  let gap = 5.2;
  while (y <= SUN_CY + SUN_R + 2) {
    const progress = (y - (SUN_CY - SUN_R * 0.22)) / (SUN_R * 1.22);
    const thick = (2.5 + progress * 6.5).toFixed(1);
    lines.push({ y: Math.round(y), thick });
    y += gap;
    gap += 0.38;
  }
  return lines;
}

// Silhouette buildings: {x, top, w} — bottom = HORIZON
const BUILDINGS = [
  // Left cluster
  { x: 0,    top: 222, w: 44 }, { x: 37,   top: 206, w: 24 }, { x: 55,   top: 220, w: 40 },
  { x: 88,   top: 193, w: 17 }, { x: 98,   top: 208, w: 30 }, { x: 122,  top: 216, w: 21 },
  { x: 136,  top: 202, w: 38 }, { x: 166,  top: 212, w: 24 }, { x: 183,  top: 221, w: 18 },
  { x: 194,  top: 206, w: 32 }, { x: 219,  top: 217, w: 18 }, { x: 230,  top: 224, w: 14 },
  { x: 237,  top: 212, w: 28 }, { x: 258,  top: 218, w: 22 }, { x: 272,  top: 223, w: 18 },
  { x: 283,  top: 209, w: 26 }, { x: 302,  top: 216, w: 20 }, { x: 315,  top: 222, w: 16 },
  { x: 324,  top: 211, w: 30 }, { x: 346,  top: 219, w: 18 }, { x: 357,  top: 225, w: 14 },
  { x: 364,  top: 213, w: 24 }, { x: 381,  top: 220, w: 16 }, { x: 390,  top: 215, w: 20 },
  { x: 403,  top: 221, w: 16 }, { x: 412,  top: 216, w: 22 }, { x: 427,  top: 222, w: 14 },
  { x: 434,  top: 218, w: 20 }, { x: 447,  top: 213, w: 18 }, { x: 458,  top: 220, w: 16 },
  // Right cluster (mirror)
  { x: 726,  top: 220, w: 16 }, { x: 735,  top: 213, w: 18 }, { x: 746,  top: 218, w: 20 },
  { x: 759,  top: 222, w: 14 }, { x: 768,  top: 216, w: 22 }, { x: 783,  top: 221, w: 16 },
  { x: 792,  top: 215, w: 20 }, { x: 807,  top: 220, w: 16 }, { x: 819,  top: 213, w: 24 },
  { x: 836,  top: 225, w: 14 }, { x: 845,  top: 219, w: 18 }, { x: 861,  top: 211, w: 30 },
  { x: 884,  top: 222, w: 16 }, { x: 895,  top: 216, w: 20 }, { x: 911,  top: 209, w: 26 },
  { x: 930,  top: 223, w: 18 }, { x: 944,  top: 218, w: 22 }, { x: 963,  top: 212, w: 28 },
  { x: 956,  top: 224, w: 14 }, { x: 980,  top: 221, w: 18 }, { x: 994,  top: 206, w: 32 },
  { x: 1019, top: 212, w: 24 }, { x: 1042, top: 202, w: 38 }, { x: 1078, top: 216, w: 21 },
  { x: 1095, top: 208, w: 30 }, { x: 1095, top: 193, w: 17 }, { x: 1105, top: 220, w: 40 },
  { x: 1139, top: 206, w: 24 }, { x: 1156, top: 222, w: 44 },
];

function buildSvg() {
  const stars = makeStars();
  const vLines = makeVLines();
  const hLines = makeHLines();
  const scanLines = makeScanLines();

  const starsEl = stars
    .map((s) => `<circle cx="${s.x}" cy="${s.y}" r="${s.r}" fill="${s.c}" opacity="${s.o}"/>`)
    .join("");

  const vLinesEl = vLines
    .map((l) =>
      `<line x1="${l.xb}" y1="${H}" x2="${VP_X}" y2="${HORIZON}" stroke="#00e5ff" stroke-width="1" opacity="${l.opacity}"/>`,
    )
    .join("");

  const hLinesEl = hLines
    .map((y) => {
      const progress = (y - HORIZON) / (H - HORIZON);
      const op = (0.92 - progress * 0.65).toFixed(2);
      const sw = Math.max(0.4, 1.8 - progress * 1.3).toFixed(1);
      return `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="url(#hFade)" stroke-width="${sw}" opacity="${op}"/>`;
    })
    .join("");

  const scanEl = scanLines
    .map((l) => `<line x1="0" y1="${l.y}" x2="${W}" y2="${l.y}" stroke="#1a000f" stroke-width="${l.thick}"/>`)
    .join("");

  const buildEl = BUILDINGS.map(
    (b) => `<rect x="${b.x}" y="${b.top}" width="${b.w}" height="${HORIZON - b.top + 2}"/>`,
  ).join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs>
  <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%"   stop-color="#010110"/>
    <stop offset="28%"  stop-color="#070924"/>
    <stop offset="58%"  stop-color="#13092e"/>
    <stop offset="78%"  stop-color="#260042"/>
    <stop offset="100%" stop-color="#1e0032"/>
  </linearGradient>
  <radialGradient id="sunG" cx="50%" cy="50%" r="50%">
    <stop offset="0%"   stop-color="#fffce0"/>
    <stop offset="11%"  stop-color="#ffe564"/>
    <stop offset="27%"  stop-color="#ff8800"/>
    <stop offset="51%"  stop-color="#ff2f92"/>
    <stop offset="79%"  stop-color="#7a0055"/>
    <stop offset="100%" stop-color="#380040"/>
  </radialGradient>
  <clipPath id="sunC"><circle cx="${SUN_CX}" cy="${SUN_CY}" r="${SUN_R}"/></clipPath>
  <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%"   stop-color="#0f0026"/>
    <stop offset="38%"  stop-color="#060014"/>
    <stop offset="100%" stop-color="#02000a"/>
  </linearGradient>
  <linearGradient id="hFade" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0%"   stop-color="#ff2f92" stop-opacity="0"/>
    <stop offset="10%"  stop-color="#ff2f92" stop-opacity="0.85"/>
    <stop offset="50%"  stop-color="#ff2f92" stop-opacity="1"/>
    <stop offset="90%"  stop-color="#ff2f92" stop-opacity="0.85"/>
    <stop offset="100%" stop-color="#ff2f92" stop-opacity="0"/>
  </linearGradient>
  <radialGradient id="hGlow" cx="50%" cy="50%" r="50%">
    <stop offset="0%"   stop-color="#ff2f92" stop-opacity="0.7"/>
    <stop offset="55%"  stop-color="#b00060" stop-opacity="0.22"/>
    <stop offset="100%" stop-color="#500030" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="lCyan" cx="0%" cy="55%" r="55%">
    <stop offset="0%"   stop-color="#00e5ff" stop-opacity="0.13"/>
    <stop offset="100%" stop-color="#00e5ff" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="rMag" cx="100%" cy="55%" r="55%">
    <stop offset="0%"   stop-color="#ff2f92" stop-opacity="0.17"/>
    <stop offset="100%" stop-color="#ff2f92" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="vig" cx="50%" cy="50%" r="70%">
    <stop offset="0%"   stop-color="black" stop-opacity="0"/>
    <stop offset="66%"  stop-color="black" stop-opacity="0"/>
    <stop offset="100%" stop-color="black" stop-opacity="0.65"/>
  </radialGradient>
</defs>

<rect width="${W}" height="${H}" fill="url(#sky)"/>
${starsEl}
<rect width="${W}" height="${HORIZON}" fill="url(#lCyan)"/>
<rect width="${W}" height="${HORIZON}" fill="url(#rMag)"/>
<ellipse cx="${SUN_CX}" cy="${HORIZON + 18}" rx="490" ry="135" fill="url(#hGlow)"/>
<circle cx="${SUN_CX}" cy="${SUN_CY}" r="${SUN_R + 55}" fill="#ff2f92" opacity="0.085"/>
<circle cx="${SUN_CX}" cy="${SUN_CY}" r="${SUN_R + 28}" fill="#ff6600" opacity="0.075"/>
<circle cx="${SUN_CX}" cy="${SUN_CY}" r="${SUN_R}" fill="url(#sunG)"/>
<g clip-path="url(#sunC)">${scanEl}</g>
<g fill="#040012">${buildEl}</g>
<line x1="0" y1="${HORIZON}" x2="${W}" y2="${HORIZON}" stroke="url(#hFade)" stroke-width="2.2" opacity="0.95"/>
<rect x="0" y="${HORIZON + 1}" width="${W}" height="${H - HORIZON - 1}" fill="url(#floor)"/>
${vLinesEl}
${hLinesEl}
<rect width="${W}" height="${H}" fill="url(#vig)"/>
</svg>`;
}

async function main() {
  const svgContent = buildSvg();
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>*{margin:0;padding:0;}html,body{width:${W}px;height:${H}px;overflow:hidden;background:#000;}</style>
</head><body>${svgContent}</body></html>`;

  const puppeteer = await import("puppeteer");
  const browser = await puppeteer.default.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: W, height: H, deviceScaleFactor: 2 });
    await page.setContent(html, { waitUntil: "domcontentloaded" });
    const screenshot = await page.screenshot({
      type: "png",
      clip: { x: 0, y: 0, width: W, height: H },
    });
    await writeFile(OUT, screenshot);
    console.log(`banner.png written — ${W}x${H} logical (2x physical)`);
  } finally {
    await browser.close();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
