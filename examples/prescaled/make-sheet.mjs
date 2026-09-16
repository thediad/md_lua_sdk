import { writeFileSync } from "node:fs";
import { encodePng } from "../../compiler/png-encode.mjs";
const rgba = new Uint8Array(16 * 16 * 4);
const colors = [[255,0,0], [0,255,0], [0,0,255], [255,255,0]];
for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
  const offset = (y * 16 + x) * 4;
  rgba.set(colors[(y >= 8 ? 2 : 0) + (x >= 8 ? 1 : 0)], offset);
  rgba[offset + 3] = x < 4 && y < 4 ? 0 : 255;
}
writeFileSync(new URL("sheet.png", import.meta.url), encodePng(rgba, 16, 16));
