import path from "node:path";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { resolveBuild } from "./project.mjs";
import { pngToSheet, pngToTilemap } from "./png-tiles.mjs";
import { buildMd } from "./build-md.mjs";

export function sheetPreviewPlan(sheet) {
  const tiles = sheet.words.length / 8;
  const availableTiles = 1424 - tiles;
  let size = 0;
  for (const candidate of [32, 16, 8]) {
    const tilesPerVariant = (candidate / 8) ** 2;
    if (tiles * tilesPerVariant <= availableTiles) { size = candidate; break; }
  }
  if (!size) throw new Error("sheet uses all available tile VRAM; no visual preview variant fits");
  const variants = Array.from({ length: tiles }, (_, id) => ({
    source: [(id % sheet.tilesAcross) * 8, Math.floor(id / sheet.tilesAcross) * 8, 8, 8],
    size: [size, size],
  }));
  return { size, manifest: { budgetBytes: tiles * size * size / 2, variants } };
}

export function sheetPreviewSource(sheet, size = sheetPreviewPlan(sheet).size) {
  const tiles = sheet.words.length / 8;
  return `-- Generated MDStudio sheet inspector. Do not edit.
local selected=0
local total=${tiles}
local columns=${sheet.tilesAcross}
local dirty=1
local repeat_wait=0

function _init()
  cls(0)
end

function _update()
  if repeat_wait>0 then repeat_wait-=1 return end
  local next=selected
  if btn(0) then next-=1
  elseif btn(1) then next+=1
  elseif btn(2) then next-=columns
  elseif btn(3) then next+=columns end
  next=mid(0,next,total-1)
  if next!=selected then selected=next dirty=1 repeat_wait=5 end
end

function _draw()
  if dirty!=0 then
    dirty=0
    cls(0)
    print("sheet tile",8,8,7)
    print(selected,88,8,10)
    print("row",8,160,7)
    print(selected\\columns,40,160,10)
    print("col",72,160,7)
    print(selected%columns,104,160,10)
    print("d-pad selects",8,184,7)
  end
  ssprv(selected,${160 - Math.floor(size / 2)},80)
end
`;
}

export function mapPreviewSource(map) {
  const maxX = Math.max(0, map.cols * 8 - 320);
  const maxY = Math.max(0, map.rows * 8 - 224);
  return `-- Generated MDStudio map inspector. Do not edit.
local view_x=0
local view_y=0
local max_x=${maxX}
local max_y=${maxY}

function _init()
  map_show(0)
  hud(3)
  cls(0)
  print("map preview - d-pad pans",8,8,7)
end

function _update()
  if btn(0) then view_x-=2 end
  if btn(1) then view_x+=2 end
  if btn(2) then view_y-=2 end
  if btn(3) then view_y+=2 end
  view_x=mid(0,view_x,max_x)
  view_y=mid(0,view_y,max_y)
  camera(view_x,view_y)
end

function _draw()
end
`;
}

export function audioPreviewSource(musicCount, sfxCount) {
  return `-- Generated MDStudio audio inspector. Do not edit.
local kind=0
local selected=0
local music_total=${musicCount}
local sfx_total=${sfxCount}

function _init()
  cls(0)
end

function _update()
  if btnp(2) or btnp(3) then
    kind=1-kind
    selected=0
  end
  local total=music_total
  if kind==1 then total=sfx_total end
  if btnp(0) then selected-=1 end
  if btnp(1) then selected+=1 end
  selected=mid(0,selected,max(0,total-1))
  if btnp(4) and total>0 then
    if kind==0 then music(selected) else sfx(selected) end
  end
  if btnp(5) then music(-1) end
end

function _draw()
  cls(0)
  print("audio preview",8,8,7)
  if kind==0 then
    print("music",8,40,10)
    print(selected,72,40,10)
    print("of",104,40,7)
    print(music_total,128,40,7)
  else
    print("sfx",8,40,11)
    print(selected,72,40,11)
    print("of",104,40,7)
    print(sfx_total,128,40,7)
  end
  print("up/down: bank",8,96,7)
  print("left/right: select",8,112,7)
  print("a: play",8,144,7)
  print("b: stop music",8,160,7)
end
`;
}

export async function previewProject(args, cwd = process.cwd()) {
  const kind = args[0];
  if (kind !== "sheet" && kind !== "map" && kind !== "audio") throw new Error("usage: mdlua preview <sheet|map|audio> [--project FILE]");
  const { out, assets } = await resolveBuild(args.slice(1), cwd);
  if (kind === "audio") {
    const musicPaths = assets.musicPaths ?? [];
    const sfxPaths = assets.sfxPaths ?? [];
    if (!musicPaths.length && !sfxPaths.length) throw new Error("project has no registered music or SFX");
    const output = path.join(path.dirname(out), "mdstudio-audio-preview.bin");
    await mkdir(path.dirname(output), { recursive: true });
    const source = path.join(path.dirname(output), `.mdstudio-audio-preview-${randomUUID()}.lua`);
    await writeFile(source, audioPreviewSource(musicPaths.length, sfxPaths.length), { flag: "wx" });
    try {
      await buildMd(source, output, { musicPaths, sfxPaths });
      return output;
    } finally {
      await unlink(source).catch(error => { if (error.code !== "ENOENT") throw error; });
    }
  }
  if (kind === "map") {
    if (!assets.mapPath) throw new Error("project has no registered map");
    const map = pngToTilemap(await readFile(assets.mapPath));
    const output = path.join(path.dirname(out), "mdstudio-map-preview.bin");
    await mkdir(path.dirname(output), { recursive: true });
    const source = path.join(path.dirname(output), `.mdstudio-map-preview-${randomUUID()}.lua`);
    await writeFile(source, mapPreviewSource(map), { flag: "wx" });
    try {
      await buildMd(source, output, { mapPath: assets.mapPath });
      return output;
    } finally {
      await unlink(source).catch(error => { if (error.code !== "ENOENT") throw error; });
    }
  }
  if (!assets.sheetPath) throw new Error("project has no registered sheet");
  const sheet = pngToSheet(await readFile(assets.sheetPath));
  const plan = sheetPreviewPlan(sheet);
  const output = path.join(path.dirname(out), "mdstudio-sheet-preview.bin");
  await mkdir(path.dirname(output), { recursive: true });
  const id = randomUUID();
  const source = path.join(path.dirname(output), `.mdstudio-sheet-preview-${id}.lua`);
  const variants = path.join(path.dirname(output), `.mdstudio-sheet-preview-${id}.json`);
  await writeFile(source, sheetPreviewSource(sheet, plan.size), { flag: "wx" });
  await writeFile(variants, JSON.stringify(plan.manifest), { flag: "wx" });
  try {
    await buildMd(source, output, { sheetPath: assets.sheetPath, spriteVariantsPath: variants });
    return output;
  } finally {
    for (const temporary of [source, variants]) {
      await unlink(temporary).catch(error => { if (error.code !== "ENOENT") throw error; });
    }
  }
}
