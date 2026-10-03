import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { pngToSheet } from "../compiler/png-tiles.mjs";
import { audioPreviewSource, mapPreviewSource, sheetPreviewPlan, sheetPreviewSource } from "../compiler/preview-project.mjs";
import { compile } from "../compiler/index.js";
import { BUILTINS } from "../compiler/builtins.js";
import { spriteVariants, variantEmitter } from "../compiler/sprite-variants.mjs";

test("sheet preview uses hardware-scaled variants and compiles as an interactive inspector", async () => {
  const sheet = pngToSheet(await readFile(new URL("../examples/starfall/shmup_sheet.png", import.meta.url)));
  const plan = sheetPreviewPlan(sheet);
  const source = sheetPreviewSource(sheet, plan.size);
  assert.equal(plan.size, 32);
  assert.equal(plan.manifest.variants.length, 16);
  assert.deepEqual(plan.manifest.variants[9], { source: [8, 8, 8, 8], size: [32, 32] });
  assert.equal(plan.manifest.budgetBytes, 8192);
  assert.match(source, /local total=16/);
  assert.match(source, /local columns=8/);
  assert.match(source, /btn\(0\)/);
  assert.match(source, /local repeat_wait=0/);
  assert.match(source, /repeat_wait=5/);
  assert.match(source, /if dirty!=0 then/);
  assert.doesNotMatch(source, /btnp\(/);
  assert.match(source, /ssprv\(selected,144,80\)/);
  assert.doesNotMatch(source, /rectfill|hexdata/);
  const generated = spriteVariants(sheet, plan.manifest);
  const result = compile(source, "mdstudio-sheet-preview.lua", { target: "md", builtins: {
    ...BUILTINS, ssprv: { ...BUILTINS.ssprv, emit: variantEmitter(generated.variants) },
  } });
  assert.equal(result.ok, true, result.diagnostics.map(item => item.message).join("\n"));
});

test("map preview uses the hardware tile plane with bounded D-pad panning", async () => {
  const source = mapPreviewSource({ cols: 64, rows: 40 });
  assert.match(source, /local max_x=192/);
  assert.match(source, /local max_y=96/);
  assert.match(source, /map_show\(0\)/);
  assert.match(source, /hud\(3\)/);
  assert.match(source, /camera\(view_x,view_y\)/);
  assert.doesNotMatch(source, /rectfill|hexdata/);
  const result = compile(source, "mdstudio-map-preview.lua", { target: "md" });
  assert.equal(result.ok, true, result.diagnostics.map(item => item.message).join("\n"));
});

test("audio preview selects and auditions registered music and SFX", () => {
  const source = audioPreviewSource(2, 3);
  assert.match(source, /local music_total=2/);
  assert.match(source, /local sfx_total=3/);
  assert.match(source, /if kind==0 then music\(selected\) else sfx\(selected\) end/);
  assert.match(source, /if btnp\(5\) then music\(-1\) end/);
  const result = compile(source, "mdstudio-audio-preview.lua", { target: "md" });
  assert.equal(result.ok, true, result.diagnostics.map(item => item.message).join("\n"));
});
