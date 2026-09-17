import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { PNG } from "pngjs";
import { LibretroHost } from "romdev-core-host";
import { core } from "romdev-core-gpgx";
import { buildMd } from "../compiler/build-md.mjs";

test("imported map writes reject invalid tiles and coordinates and restore source cells", async () => {
  const work = await mkdtemp(path.join(tmpdir(), "mdlua-imported-map-"));
  const png = new PNG({ width: 16, height: 8 });
  for (let y=0;y<8;y++) for (let x=0;x<16;x++) {
    const i=(y*16+x)*4;
    png.data.set(x<4 ? [255,0,0,255] : x<8 ? [0,0,255,255] : [0,255,0,255], i);
  }
  const mapPath = path.join(work,"map.png");
  await writeFile(mapPath,PNG.sync.write(png));
  const source=path.join(work,"main.lua"), rom=path.join(work,"map.bin");
  await writeFile(source, `function _init()
  cls(0)
  map_show(0)
  local ok=1
  if tget(0,0,0)~=1 or tget(0,1,0)~=2 then ok=0 end
  tset(0,0,0,2)
  if tget(0,0,0)~=2 then ok=0 end
  map_show(0)
  if tget(0,0,0)~=1 then ok=0 end
  tset(0,2,0,2)
  tset(0,2,0,-1)
  tset(0,2,0,3)
  tset(0,2,0,32767)
  if tget(0,2,0)~=2 then ok=0 end
  tset(0,3,0,0)
  tset(0,63,31,1)
  if tget(0,63,31)~=1 then ok=0 end
  tset(0,-1,0,1)
  tset(0,64,0,1)
  tset(0,0,-1,1)
  tset(0,0,32,1)
  if tget(0,-1,0)~=0 or tget(0,64,0)~=0 or tget(0,0,-1)~=0 or tget(0,0,32)~=0 then ok=0 end
  if tget(0,0,0)~=1 or tget(0,0,1)~=0 or tget(0,63,31)~=1 then ok=0 end
  if ok==1 then print("PASS",8,24,7) else print("FAIL",8,24,7) end
  print("PASS",8,40,7)
end
function _draw() end
`);
  await buildMd(source,rom,{mapPath});
  const host=new LibretroHost({saveDir:work});
  try {
    await host.loadCore(core.jsPath,core.wasmPath);
    await host.loadMedia({platform:"genesis",path:rom});
    host.stepFrames(120);
    const {width,rgba}=host.screenshotRgba();
    const pixel=(x,y)=>Array.from(rgba.slice((y*width+x)*4,(y*width+x)*4+3));
    const red=pixel(1,4), blue=pixel(6,4), green=pixel(12,4);
    assert.ok(red[0]>red[2] && blue[2]>blue[0] && green[1]>green[0],"source palette, tile order and left-to-right pixels");
    for(let y=0;y<8;y++) for(let x=0;x<8;x++) {
      assert.deepEqual(pixel(16+x,y),green,"invalid IDs must preserve the last valid tile");
      assert.deepEqual(pixel(24+x,y),[0,0,0],"tile zero clears to transparent");
    }
    let lit=0;
    for(let y=0;y<8;y++) for(let x=0;x<32;x++) {
      const actual=pixel(8+x,24+y);
      assert.deepEqual(actual,pixel(8+x,40+y),"Lua readback/bounds checks must pass");
      if(actual.some(v=>v)) lit++;
    }
    assert.ok(lit>0,"status must be visible");
  } finally {host.unloadMedia();}
});

