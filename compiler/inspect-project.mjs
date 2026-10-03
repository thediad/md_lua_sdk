import path from "node:path";
import { readFile } from "node:fs/promises";
import { resolveBuild } from "./project.mjs";
import { pngToSheet, pngToTilemap } from "./png-tiles.mjs";

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
  if (!new Set(["sheet", "map"]).has(kind)) throw new Error("usage: mdlua inspect <sheet|map> [--project FILE]");
  const rest = args.slice(1);
  if (rest.some(value => value !== "--project" && value.startsWith("-"))) throw new Error("usage: mdlua inspect <sheet|map> [--project FILE]");
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
