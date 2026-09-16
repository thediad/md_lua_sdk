import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pngToSheet } from "../compiler/png-tiles.mjs";
import { scaledSheetAssets } from "../compiler/asset-headers.mjs";
import { spriteVariants, ssprEmitter, variantEmitter } from "../compiler/sprite-variants.mjs";
import { compile } from "../compiler/index.js";
import { BUILTINS } from "../compiler/builtins.js";
import { buildMd } from "../compiler/build-md.mjs";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const png = readFileSync(new URL("../examples/prescaled/sheet.png", import.meta.url));
const sheet = pngToSheet(png);
const manifest = JSON.parse(readFileSync(new URL("../examples/prescaled/variants.json", import.meta.url)));
const generated = spriteVariants(sheet, manifest);

test("variants preserve indexed pixels, transparency and column-major tile order", () => {
  for (const v of generated.variants) {
    const [w,h] = v.size;
    for (let y=0; y<h; y++) for (let x=0; x<w; x++) {
      const sx=Math.floor(x*16/w), sy=Math.floor(y*16/h);
      const source = (sheet.words[((sy>>3)*2+(sx>>3))*8+(sy&7)] >>> ((7-(sx&7))*4)) & 15;
      const tile = v.tileOffset+(x>>3)*(h/8)+(y>>3);
      const actual = (generated.words[tile*8+(y&7)] >>> ((7-(x&7))*4)) & 15;
      assert.equal(actual,source);
    }
  }
  assert.equal(generated.bytes, 32+288+512+192);
  assert.ok(generated.variants.every(v => v.hardwareSprites===1));
  assert.deepEqual(spriteVariants(sheet,manifest),generated);
  assert.match(scaledSheetAssets(png,manifest).header,/sprite_variant_meta/);
});

test("invalid source rectangles, sizes, duplicates and budgets are rejected", () => {
  for (const v of [null, {}, {source:[0,0,17,16],size:[16,16]}, {source:[0,0,16,16],size:[40,32]}, {source:[0,0,16,16],size:[12,8]}]) {
    assert.throws(()=>spriteVariants(sheet,{variants:[v]}));
  }
  assert.throws(()=>spriteVariants(sheet,{...manifest,budgetBytes:16}),/budgetBytes/);
  assert.throws(()=>spriteVariants(sheet,{variants:[manifest.variants[0],manifest.variants[0]]}),/duplicate/);
});

test("sspr resolves declared sizes and rejects undeclared or dynamic sizes", () => {
  const opts={builtins:{...BUILTINS,sspr:{...BUILTINS.sspr,emit:ssprEmitter(generated.variants)},ssprv:{...BUILTINS.ssprv,emit:variantEmitter(generated.variants)}}};
  const good=compile('function _draw() sspr(0,0,16,16,20,30,24,24) ssprv(2,10,20,true) end','t.lua',opts);
  assert.ok(good.ok,JSON.stringify(good.diagnostics));
  assert.match(good.c,/md_sspr_variant\(1, 20, 30, 0, 0\)/);
  assert.throws(()=>compile('function _draw() sspr(0,0,16,16,0,0,32,24) end','t.lua',opts),/undeclared/);
  assert.throws(()=>compile('local size=24 function _draw() sspr(0,0,16,16,0,0,size,size) end','t.lua',opts),/must be literal/);
  assert.throws(()=>compile('function _draw() ssprv(9,0,0) end','t.lua',opts),/not declared/);
  assert.throws(()=>compile('function _draw() ssprv(-1,0,0) end','t.lua',opts),/not declared/);
  const bounded={...opts,builtins:{...opts.builtins,sspr:{...BUILTINS.sspr,emit:ssprEmitter(generated.variants,[16,16])}}};
  assert.throws(()=>compile('function _draw() sspr(16,0,8,8,0,0) end','t.lua',bounded),/outside the sheet/);
  assert.throws(()=>compile('function _draw() ssprv(0,0,0) end'),/requires/);
});

test("build rejects missing sheets and bitmap VRAM conflicts before invoking the toolchain", async () => {
  const dir=await mkdtemp(path.join(tmpdir(),"mdlua-scale-errors-"));
  const entry=path.join(dir,"main.lua"), out=path.join(dir,"game.bin");
  await writeFile(entry,'function _draw() pset(0,0,1) end');
  const spriteVariantsPath=fileURLToPath(new URL("../examples/prescaled/variants.json",import.meta.url));
  const sheetPath=fileURLToPath(new URL("../examples/prescaled/sheet.png",import.meta.url));
  await assert.rejects(buildMd(entry,out,{spriteVariantsPath}),/requires --sheet/);
  await assert.rejects(buildMd(entry,out,{spriteVariantsPath,sheetPath}),/cannot share VRAM/);
});
