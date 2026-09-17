import {test} from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,writeFile,readFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import {PNG} from "pngjs";
import {buildMd} from "../compiler/build-md.mjs";

test("ordinary sheets and maps respect the shared tile VRAM budget",async()=>{
  const work=await mkdtemp(path.join(tmpdir(),"mdlua-vram-"));
  const source=path.join(work,"main.lua"),out=path.join(work,"game.bin");
  await writeFile(source,"function _draw() spr(0,16,16) end");
  const sheet=async(name,width,height)=>{
    const png=new PNG({width,height});
    for(let i=0;i<png.data.length;i+=4)png.data.set([255,0,0,255],i);
    const file=path.join(work,name);await writeFile(file,PNG.sync.write(png));return file;
  };
  // Pinned SGDK: 16 system tiles at the bottom, 96 font tiles at the top;
  // plane tables start at tile 1536.
  // 1424 user tiles reach, but do not cross, that boundary.
  const exact=await sheet("exact.png",128,712);
  await buildMd(source,out,{sheetPath:exact});
  const good=await readFile(out);
  assert.match(good.toString("ascii",0x100,0x110),/SEGA/);
  const overflow=await sheet("overflow.png",128,720);
  await assert.rejects(buildMd(source,out,{sheetPath:overflow}),/exceed the default tile VRAM region/);
  assert.deepEqual(await readFile(out),good,"failed build preserves the previous ROM");
  const small=await sheet("sheet.png",256,192); // 768 tiles
  const png=new PNG({width:256,height:192});
  for(let y=0;y<192;y++)for(let x=0;x<256;x++){
    const tile=(y>>3)*32+(x>>3)+1;
    const bit=(y%8)*8+x%8;
    const white=bit<10 && ((tile>>bit)&1);
    png.data.set(white?[255,255,255,255]:[0,0,0,255],(y*256+x)*4);
  }
  const mapPath=path.join(work,"map.png");await writeFile(mapPath,PNG.sync.write(png));
  await assert.rejects(buildMd(source,out,{sheetPath:small,mapPath}),/exceed the default tile VRAM region/);
  assert.deepEqual(await readFile(out),good,"combined asset rejection preserves the previous ROM");
});
