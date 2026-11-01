import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

export const FONTCONFIG_FILE = fileURLToPath(new URL("../../config/fonts.conf", import.meta.url));

export async function verifyDisplayFont() {
  const font = await readFile(new URL("../../fonts/NotoSansJP-VF.ttf", import.meta.url));
  if (createHash("sha256").update(font).digest("hex") !== "f4b373b226668ee33a6e54b02823dcd2d1209f17159f777421ae8c2275160369") {
    throw new Error("Bundled Noto Sans JP font checksum mismatch.");
  }
}
