import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { writeFile } from "node:fs/promises";

const DIR = dirname(fileURLToPath(import.meta.url));
const OUT = join(DIR, "../assets/banner.png");

const W = 1200;
const H = 420;
const HORIZON = 274;
const VP_X = 600;
const SUN = { cx: 600, cy: 210, r: 86 };

function makeRng(seed = 0xC0B0319) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function makeStars(count = 120) {
  const rng = makeRng(8675309);
  return Array.from({ length: count }, () => ({
    x: Math.floor(rng() * W),
    y: Math.floor(rng() * 180),
    r: rng() < 0.12 ? 1.5 : rng() < 0.45 ? 1 : 0.45,
    o: (0.28 + rng() * 0.58).toFixed(2),
    c: rng() < 0.14 ? "#7df9ff" : rng() < 0.08 ? "#ff9bd7" : "#ffffff",
  }));
}

function makeRain(count = 150) {
  const rng = makeRng(0xBAD5EED);
  return Array.from({ length: count }, () => ({
    x: Math.floor(rng() * W),
    y: Math.floor(rng() * H),
    len: Math.floor(9 + rng() * 24),
    o: (0.08 + rng() * 0.18).toFixed(2),
  }));
}

function makeWindows(x, top, width, height, color, seed) {
  const rng = makeRng(seed);
  const windows = [];
  for (let yy = top + 12; yy < top + height - 10; yy += 18) {
    for (let xx = x + 9; xx < x + width - 10; xx += 18) {
      if (rng() < 0.34) {
        windows.push(
          `<rect x="${xx}" y="${yy}" width="6" height="2.2" rx="1" fill="${color}" opacity="${(0.24 + rng() * 0.46).toFixed(2)}"/>`,
        );
      }
    }
  }
  return windows.join("");
}

function makeRoadLines() {
  const lines = [];
  for (let k = -12; k <= 12; k++) {
    const xb = VP_X + k * 68;
    if (xb < -260 || xb > W + 260) continue;
    const far = Math.abs(k) / 12;
    lines.push(
      `<line x1="${xb}" y1="${H}" x2="${VP_X}" y2="${HORIZON}" stroke="#00e5ff" stroke-width="${(1.1 + far * 0.8).toFixed(1)}" opacity="${(0.28 + far * 0.4).toFixed(2)}"/>`,
    );
  }
  for (let k = 1; k <= 12; k++) {
    const y = HORIZON + Math.round(k * k * 2.8);
    if (y >= H) break;
    const progress = (y - HORIZON) / (H - HORIZON);
    lines.push(
      `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="url(#roadFade)" stroke-width="${Math.max(0.5, 2.2 - progress * 1.3).toFixed(1)}" opacity="${(0.85 - progress * 0.5).toFixed(2)}"/>`,
    );
  }
  return lines.join("");
}

function makeSunScanlines() {
  const lines = [];
  let y = SUN.cy - SUN.r * 0.2;
  let gap = 5.5;
  while (y <= SUN.cy + SUN.r + 4) {
    const progress = (y - (SUN.cy - SUN.r * 0.2)) / (SUN.r * 1.25);
    lines.push(
      `<line x1="0" y1="${Math.round(y)}" x2="${W}" y2="${Math.round(y)}" stroke="#15000f" stroke-width="${(2.6 + progress * 7).toFixed(1)}"/>`,
    );
    y += gap;
    gap += 0.42;
  }
  return lines.join("");
}

function buildSvg() {
  const stars = makeStars()
    .map((s) => `<circle cx="${s.x}" cy="${s.y}" r="${s.r}" fill="${s.c}" opacity="${s.o}"/>`)
    .join("");
  const rain = makeRain()
    .map((r) => `<line x1="${r.x}" y1="${r.y}" x2="${r.x - 10}" y2="${r.y + r.len}" stroke="#a8f7ff" stroke-width="1" opacity="${r.o}"/>`)
    .join("");

  const leftWindows = makeWindows(0, 92, 230, 188, "#00e5ff", 101);
  const rightWindows = makeWindows(970, 84, 230, 196, "#ff4fb3", 202);
  const centerWindows = makeWindows(438, 156, 112, 118, "#ffe66d", 303);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs>
  <linearGradient id="sky" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="#030512"/>
    <stop offset="35%" stop-color="#061932"/>
    <stop offset="67%" stop-color="#260035"/>
    <stop offset="100%" stop-color="#080712"/>
  </linearGradient>
  <radialGradient id="sunG" cx="50%" cy="45%" r="55%">
    <stop offset="0%" stop-color="#fffbe7"/>
    <stop offset="12%" stop-color="#ffe66d"/>
    <stop offset="31%" stop-color="#ff8a00"/>
    <stop offset="56%" stop-color="#ff2f92"/>
    <stop offset="86%" stop-color="#721358"/>
    <stop offset="100%" stop-color="#25072d"/>
  </radialGradient>
  <clipPath id="sunClip"><circle cx="${SUN.cx}" cy="${SUN.cy}" r="${SUN.r}"/></clipPath>
  <linearGradient id="road" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="#100018"/>
    <stop offset="42%" stop-color="#06030f"/>
    <stop offset="100%" stop-color="#020208"/>
  </linearGradient>
  <linearGradient id="roadFade" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0%" stop-color="#ff2f92" stop-opacity="0"/>
    <stop offset="14%" stop-color="#ff2f92" stop-opacity="0.65"/>
    <stop offset="50%" stop-color="#7df9ff" stop-opacity="0.85"/>
    <stop offset="86%" stop-color="#ff2f92" stop-opacity="0.65"/>
    <stop offset="100%" stop-color="#ff2f92" stop-opacity="0"/>
  </linearGradient>
  <linearGradient id="title" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0%" stop-color="#7df9ff"/>
    <stop offset="38%" stop-color="#f4fbff"/>
    <stop offset="62%" stop-color="#ffe66d"/>
    <stop offset="100%" stop-color="#ff4fb3"/>
  </linearGradient>
  <linearGradient id="under" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0%" stop-color="#00e5ff" stop-opacity="0"/>
    <stop offset="20%" stop-color="#00e5ff" stop-opacity="0.9"/>
    <stop offset="50%" stop-color="#ff4fb3" stop-opacity="1"/>
    <stop offset="80%" stop-color="#ffe66d" stop-opacity="0.9"/>
    <stop offset="100%" stop-color="#ffe66d" stop-opacity="0"/>
  </linearGradient>
  <filter id="titleGlow" x="-30%" y="-70%" width="160%" height="240%">
    <feGaussianBlur in="SourceGraphic" stdDeviation="3.5" result="blur"/>
    <feColorMatrix in="blur" type="matrix" values="0 0 0 0 0.05 0 0 0 0 0.85 0 0 0 0 1 0 0 0 0.95 0" result="cyan"/>
    <feMerge>
      <feMergeNode in="cyan"/>
      <feMergeNode in="SourceGraphic"/>
    </feMerge>
  </filter>
  <filter id="pinkGlow" x="-50%" y="-50%" width="200%" height="200%">
    <feGaussianBlur stdDeviation="6" result="blur"/>
    <feColorMatrix in="blur" type="matrix" values="1 0 0 0 1 0 0 0 0 0.12 0 0 0 0 0.55 0 0 0 0.82 0"/>
    <feBlend in="SourceGraphic" mode="screen"/>
  </filter>
  <radialGradient id="vignette" cx="50%" cy="50%" r="72%">
    <stop offset="0%" stop-color="#000000" stop-opacity="0"/>
    <stop offset="66%" stop-color="#000000" stop-opacity="0.08"/>
    <stop offset="100%" stop-color="#000000" stop-opacity="0.68"/>
  </radialGradient>
</defs>

<rect width="${W}" height="${H}" fill="url(#sky)"/>
<rect width="${W}" height="${H}" fill="url(#vignette)"/>
${stars}
<ellipse cx="600" cy="285" rx="510" ry="96" fill="#ff2f92" opacity="0.16"/>
<circle cx="${SUN.cx}" cy="${SUN.cy}" r="${SUN.r + 66}" fill="#ff2f92" opacity="0.08"/>
<circle cx="${SUN.cx}" cy="${SUN.cy}" r="${SUN.r + 32}" fill="#ff8a00" opacity="0.08"/>
<circle cx="${SUN.cx}" cy="${SUN.cy}" r="${SUN.r}" fill="url(#sunG)"/>
<g clip-path="url(#sunClip)">${makeSunScanlines()}</g>

<g opacity="0.98">
  <path d="M0 118 L230 72 L230 ${HORIZON} L0 ${HORIZON} Z" fill="#040612"/>
  <path d="M1200 108 L970 70 L970 ${HORIZON} L1200 ${HORIZON} Z" fill="#040612"/>
  <path d="M438 146 L550 126 L550 ${HORIZON} L438 ${HORIZON} Z" fill="#050714"/>
  <path d="M650 126 L768 146 L768 ${HORIZON} L650 ${HORIZON} Z" fill="#050714"/>
  ${leftWindows}
  ${rightWindows}
  ${centerWindows}
  ${makeWindows(650, 148, 118, 126, "#a855ff", 404)}
</g>

<g filter="url(#pinkGlow)">
  <rect x="38" y="132" width="34" height="116" rx="5" fill="#12051a" stroke="#ff4fb3" stroke-width="1.2"/>
  <rect x="50" y="146" width="10" height="88" rx="5" fill="#ff2f92"/>
  <text x="55" y="210" text-anchor="middle" font-family="Arial, sans-serif" font-size="10" font-weight="700" letter-spacing="2" fill="#ffe66d" transform="rotate(-90 55 210)">APPSEC</text>
  <rect x="1128" y="122" width="36" height="126" rx="5" fill="#07141d" stroke="#00e5ff" stroke-width="1.2"/>
  <rect x="1142" y="138" width="9" height="92" rx="5" fill="#00e5ff"/>
  <text x="1147" y="196" text-anchor="middle" font-family="Arial, sans-serif" font-size="10" font-weight="700" letter-spacing="2" fill="#f4fbff" transform="rotate(90 1147 196)">AUTOMATION</text>
</g>

<g fill="#02030b">
  <rect x="236" y="214" width="44" height="60"/>
  <rect x="282" y="198" width="34" height="76"/>
  <rect x="324" y="221" width="62" height="53"/>
  <rect x="805" y="216" width="70" height="58"/>
  <rect x="883" y="193" width="42" height="81"/>
  <rect x="930" y="226" width="44" height="48"/>
</g>
<line x1="0" y1="${HORIZON}" x2="${W}" y2="${HORIZON}" stroke="url(#under)" stroke-width="2.5" opacity="0.95"/>
<rect x="0" y="${HORIZON + 1}" width="${W}" height="${H - HORIZON - 1}" fill="url(#road)"/>
${makeRoadLines()}
<g opacity="0.22">
  <path d="M0 310 C210 292 392 286 600 286 C808 286 990 292 1200 310" fill="none" stroke="#7df9ff" stroke-width="14" stroke-linecap="round"/>
  <path d="M0 348 C225 326 404 315 600 315 C796 315 975 326 1200 348" fill="none" stroke="#ff2f92" stroke-width="10" stroke-linecap="round"/>
</g>

<g opacity="0.32">
  <rect x="0" y="0" width="${W}" height="${H}" fill="none" stroke="#7df9ff" stroke-width="1"/>
  <path d="M28 34 H170 M1030 34 H1172 M28 386 H170 M1030 386 H1172" stroke="#7df9ff" stroke-width="1"/>
  <circle cx="198" cy="34" r="3" fill="#31ffb6"/>
  <circle cx="1002" cy="386" r="3" fill="#ff4fb3"/>
</g>

<g filter="url(#titleGlow)">
  <text x="600" y="150" text-anchor="middle" font-family="Arial Black, Impact, Arial, sans-serif" font-size="92" font-weight="900" letter-spacing="7" fill="url(#title)" stroke="#03040d" stroke-width="5" paint-order="stroke fill">CBOYD0319</text>
  <rect x="248" y="170" width="704" height="3" rx="1.5" fill="url(#under)"/>
  <text x="600" y="202" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" font-weight="700" letter-spacing="5" fill="#d9fbff">SECURITY AUTOMATION // APPSEC // CLOUD SYSTEMS</text>
</g>

<g font-family="Arial, sans-serif" font-weight="700" letter-spacing="2" opacity="0.78">
  <text x="96" y="312" fill="#7df9ff" font-size="11">PUBLIC TOOLS</text>
  <text x="988" y="312" fill="#ff9bd7" font-size="11">BUILD SIGNAL</text>
  <text x="600" y="382" text-anchor="middle" fill="#31ffb6" font-size="12">TURNING IDEAS INTO SYSTEMS</text>
</g>

${rain}
<rect width="${W}" height="${H}" fill="url(#vignette)"/>
</svg>`;
}

async function main() {
  const svgContent = buildSvg();
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
* { margin:0; padding:0; }
html, body { width:${W}px; height:${H}px; overflow:hidden; background:#000; }
</style>
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
    console.log(`banner.png written - ${W}x${H} logical (2x physical)`);
  } finally {
    await browser.close();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
