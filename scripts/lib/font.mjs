const TIMEOUT_MS = 10_000;
const CSS_URL = "https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&display=swap";
const FONT_URL_RE = /url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/;

/**
 * Fetches Space Mono from Google Fonts and returns it as a base64 data URL
 * so Puppeteer can render the font without a second network call.
 *
 * Returns { dataUrl: string } on success or { dataUrl: null } on any failure,
 * in which case the caller should fall back to a system monospace stack.
 */
export async function loadFontAsDataUrl() {
  try {
    const cssRes = await fetch(CSS_URL, {
      headers: { "user-agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!cssRes.ok) throw new Error(`Font CSS ${cssRes.status}`);

    const css = await cssRes.text();
    const match = css.match(FONT_URL_RE);
    if (!match) throw new Error("Font URL not found in CSS - Google Fonts format may have changed");

    const fontRes = await fetch(match[1], { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!fontRes.ok) throw new Error(`Font file ${fontRes.status}`);

    const buf = await fontRes.arrayBuffer();
    return { dataUrl: `data:font/woff2;base64,${Buffer.from(buf).toString("base64")}` };
  } catch (err) {
    console.warn(`Font load failed (${err.message}); using system monospace fallback`);
    return { dataUrl: null };
  }
}
