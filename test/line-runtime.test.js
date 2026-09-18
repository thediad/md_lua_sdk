import {test} from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import {LibretroHost} from "romdev-core-host";
import {core} from "romdev-core-gpgx";
import {buildMd} from "../compiler/build-md.mjs";

test("bitmap lines and rectangle outlines preserve clipped pixels and bound long axis lines",async()=>{
  const work=await mkdtemp(path.join(tmpdir(),"mdlua-lines-"));
  const source=path.join(work,"main.lua"),rom=path.join(work,"lines.bin");
  const lines=[[1,4,254,4],[254,7,1,7],[7,0,7,159],[12,159,12,0],[23,20,23,20],
    [-32768,35,32767,35],[100,32767,100,-32768],[-32768,-1,32767,-1],
    [0,50,255,110],[255,120,0,60],[150,0,180,159],[190,159,160,0],
    [-20,80,40,120],[200,130,280,170]];
  const edges=[[230,150,210,150],[230,140,210,140],[230,150,230,140],[210,150,210,140]];
  await writeFile(source,`function _draw()
    cls(0)
    clip(3,2,246,154)
    ${lines.map(v=>`line(${v.join(",")},11)`).join("\n")}
    rect(230,150,210,140,11)
    clip(0,0,0,0)
    line(-32768,80,32767,80,8)
    clip()
    rectfill(240,0,247,1,11)
  end`);
  await buildMd(source,rom);
  const host=new LibretroHost({saveDir:work});
  try {
    await host.loadCore(core.jsPath,core.wasmPath);
    await host.loadMedia({platform:"genesis",path:rom});
    host.stepFrames(120);
    const {width,rgba}=host.screenshotRgba();
    const pixel=(x,y)=>Array.from(rgba.slice(((y+32)*width+x+32)*4,((y+32)*width+x+32)*4+3));
    const green=pixel(242,0),blank=pixel(0,0);
    assert.notDeepEqual(green,blank,"drawing must complete within 120 video frames");
    const expected=new Uint8Array(256*160);
    for(let [x,y,x1,y1] of [...lines,...edges]) {
      const dx=Math.abs(x1-x),dy=Math.abs(y1-y),sx=x<x1?1:-1,sy=y<y1?1:-1;
      let err=dx-dy;
      for(;;) {
        if(x>=3&&x<249&&y>=2&&y<156)expected[y*256+x]=1;
        if(x===x1&&y===y1)break;
        const e2=2*err;
        if(e2>-dy){err-=dy;x+=sx;}
        if(e2<dx){err+=dx;y+=sy;}
      }
    }
    for(let y=0;y<160;y++)for(let x=0;x<256;x++){
      if(y<2&&x>=240&&x<248)continue;
      assert.deepEqual(pixel(x,y),expected[y*256+x]?green:blank,`line pixel ${x},${y}`);
    }
  } finally {host.unloadMedia();}
});
