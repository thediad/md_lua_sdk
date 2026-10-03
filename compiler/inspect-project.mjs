import path from "node:path";
import { readFile } from "node:fs/promises";
import { resolveBuild } from "./project.mjs";
import { pngToSheet, pngToTilemap } from "./png-tiles.mjs";
import { isGzip, songToXgm2, wavToXgm2Pcm } from "./audio-assets.mjs";
import { spriteVariants } from "./sprite-variants.mjs";

export function paletteLines(values, width = 38) {
  const tokens = values.map(value => `0x${value.toString(16).toUpperCase().padStart(4, "0")}`);
  const lines = [];
  let line = "";
  for (const token of tokens) {
    if (line && line.length + 1 + token.length > width) {
      lines.push(line);
      line = "";
    }
    line += `${line ? " " : ""}${token}`;
  }
  if (line) lines.push(line);
  return lines.join("\n");
}

export async function inspectProject(args, cwd = process.cwd()) {
  const kind = args[0];
  if (!new Set(["sheet", "map", "audio", "variants"]).has(kind)) throw new Error("usage: mdlua inspect <sheet|map|audio|variants> [--project FILE]");
  const rest = args.slice(1);
  if (rest.some(value => value !== "--project" && value.startsWith("-"))) throw new Error("usage: mdlua inspect <sheet|map|audio|variants> [--project FILE]");
  const { assets } = await resolveBuild(rest, cwd);
  if (kind === "sheet") {
    if (!assets.sheetPath) throw new Error("project has no registered sheet");
    const sheet = pngToSheet(await readFile(assets.sheetPath));
    const tiles = sheet.words.length / 8;
    return [
      `Sprite sheet: ${assets.sheetPath}`,
      `Size: ${sheet.tilesAcross * 8}x${sheet.tilesDown * 8} pixels`,
      `Grid: ${sheet.tilesAcross} columns x ${sheet.tilesDown} rows`,
      `Tile IDs: 0-${tiles - 1}, row-major`,
      `Graphics: ${tiles} tiles, ${tiles * 32} VRAM bytes`,
      "Palette: PAL1 (index 0 is transparent)",
      paletteLines(sheet.pal),
    ].join("\n");
  }
  if (kind === "audio") {
    const music = assets.musicPaths ?? [];
    const sfx = assets.sfxPaths ?? [];
    if (!music.length && !sfx.length) throw new Error("project has no registered audio");
    const lines = [`Audio assets: ${music.length} music, ${sfx.length} sfx`];
    for (let index = 0; index < music.length; index++) {
      let bytes = new Uint8Array(await readFile(music[index]));
      const sourceBytes = bytes.length;
      if (isGzip(bytes)) {
        const { gunzipSync } = await import("node:zlib");
        bytes = new Uint8Array(gunzipSync(bytes));
      }
      const compiled = songToXgm2(bytes);
      lines.push(`Music ${index}: ${path.basename(music[index])}`);
      lines.push(`  ${sourceBytes} source bytes -> ${compiled.length} XGM2 bytes`);
    }
    for (let index = 0; index < sfx.length; index++) {
      const bytes = new Uint8Array(await readFile(sfx[index]));
      const compiled = wavToXgm2Pcm(bytes);
      lines.push(`SFX ${index}: ${path.basename(sfx[index])}`);
      lines.push(`  ${bytes.length} source bytes -> ${compiled.length} PCM bytes`);
      lines.push(`  about ${(compiled.length / 13300).toFixed(2)} seconds at 13.3 kHz`);
    }
    return lines.join("\n");
  }
  if (kind === "variants") {
    if (!assets.sheetPath || !assets.spriteVariantsPath) throw new Error("project needs a registered sheet and spriteVariants file");
    const sheet = pngToSheet(await readFile(assets.sheetPath));
    const manifest = JSON.parse(await readFile(assets.spriteVariantsPath, "utf8"));
    const result = spriteVariants(sheet, manifest);
    const lines = [`Sprite variants: ${result.variants.length}`, `Graphics: ${result.bytes}/${result.budgetBytes} budget bytes`];
    for (const variant of result.variants) {
      lines.push(`${variant.id}: [${variant.source.join(",")}] -> ${variant.size.join("x")}`);
      lines.push(`  ${variant.bytes} ROM/VRAM bytes, ${variant.hardwareSprites} hardware sprite`);
    }
    return lines.join("\n");
  }
  if (!assets.mapPath) throw new Error("project has no registered map");
  const map = pngToTilemap(await readFile(assets.mapPath));
  const tiles = map.tileWords.length / 8;
  return [
    `Tile map: ${assets.mapPath}`,
    `Size: ${map.cols * 8}x${map.rows * 8} pixels`,
    `Grid: ${map.cols} columns x ${map.rows} rows`,
    `Graphics: ${tiles} unique tiles, ${tiles * 32} VRAM bytes`,
    `Map cells: ${map.map.length}`,
    "Palette: PAL2",
    paletteLines(map.pal),
  ].join("\n");
}
