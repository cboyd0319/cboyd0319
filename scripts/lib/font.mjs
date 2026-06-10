import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFile } from "node:fs/promises";

const TIMEOUT_MS = 10_000;
const FONT_DIR = join(dirname(fileURLToPath(import.meta.url)), "../../fonts");
const LOCAL_FONTS = [
  { family: "Noto Sans JP", weight: 500, file: "NotoSansJP-Medium.woff2" },
  { family: "Noto Sans JP", weight: 700, file: "NotoSansJP-Bold.woff2" },
];
const FONT_SHEETS = [
  `https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@500;700&text=${encodeURIComponent("リポジトリ・シグナル渋谷新宿出口安全第一都市地下鉄未来を接続")}`,
];
const FONT_URL_RE = /url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g;

/**
 * Fetches display fonts from Google Fonts and embeds font files into CSS
 * so generated SVG panels can render consistently through ImageMagick and GitHub Actions.
 *
 * Returns { css: string } on success or { css: "" } on any failure,
 * in which case the caller should fall back to the station-signage sans stack.
 */
export async function loadFontAsDataUrl() {
  const localCss = await loadLocalFonts();
  if (localCss) return { css: localCss };

  const chunks = [];
  for (const cssUrl of FONT_SHEETS) {
    chunks.push(await loadFontSheet(cssUrl));
  }

  return { css: chunks.filter(Boolean).join("\n") };
}

async function loadLocalFonts() {
  try {
    const chunks = [];
    for (const font of LOCAL_FONTS) {
      const data = await readFile(join(FONT_DIR, font.file));
      chunks.push(`@font-face{font-family:"${font.family}";src:url("data:font/woff2;base64,${data.toString("base64")}") format("woff2");font-weight:${font.weight};font-style:normal;font-display:block;}`);
    }
    return chunks.join("\n");
  } catch (err) {
    if (err?.code !== "ENOENT") console.warn(`Local font load failed (${err.message}); trying network fonts`);
    return "";
  }
}

async function loadFontSheet(cssUrl) {
  try {
    const cssRes = await fetch(cssUrl, {
      headers: { "user-agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!cssRes.ok) throw new Error(`Font CSS ${cssRes.status}`);

    let css = await cssRes.text();
    const urls = [...new Set([...css.matchAll(FONT_URL_RE)].map((match) => match[1]))];
    if (!urls.length) throw new Error("Font URL not found in CSS - Google Fonts format may have changed");

    for (const url of urls) {
      const fontRes = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (!fontRes.ok) throw new Error(`Font file ${fontRes.status}`);

      const mediaType = fontRes.headers.get("content-type")?.split(";")[0] || "font/ttf";
      const buf = await fontRes.arrayBuffer();
      const dataUrl = `url("data:${mediaType};base64,${Buffer.from(buf).toString("base64")}")`;
      css = css.replaceAll(`url(${url})`, dataUrl);
    }

    return css;
  } catch (err) {
    console.warn(`Font load failed (${err.message}); using system fallback`);
    return "";
  }
}
