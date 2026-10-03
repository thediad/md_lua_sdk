import path from "node:path";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { resolveBuild } from "./project.mjs";
import { pngToSheet } from "./png-tiles.mjs";
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

export async function previewProject(args, cwd = process.cwd()) {
  if (args[0] !== "sheet") throw new Error("usage: mdlua preview sheet [--project FILE]");
  const { out, assets } = await resolveBuild(args.slice(1), cwd);
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
