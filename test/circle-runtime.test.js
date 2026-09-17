import {test} from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import {LibretroHost} from "romdev-core-host";
import {core} from "romdev-core-gpgx";
import {buildMd} from "../compiler/build-md.mjs";

test("packed circle spans preserve midpoint pixels, clipping and large-radius completion",async()=>{
  const work=await mkdtemp(path.join(tmpdir(),"mdlua-circles-"));
  const source=path.join(work,"main.lua"),rom=path.join(work,"circles.bin");
  const circles=[[20,20,0],[40,20,1],[65,25,9],[110,40,23],[-3,90,15],[254,90,17],[80,158,12],[160,110,18],[210,120,-1]];
  await writeFile(source,`local passed=0
function _init()
  cls(0)
  circfill(128,80,32767,11)
  if pget(0,0)==11 and pget(255,159)==11 then passed=1 end
end
function _draw()
  cls(0)
  clip()
  ${circles.map(([x,y,r],i)=>`${i===7?"clip(154,102,12,14)":"clip()"}\ncircfill(${x},${y},${r},11)`).join("\n")}
  clip()
  rectfill(240,0,247,7,11)
  if passed==1 then rectfill(224,0,231,7,11) else rectfill(224,0,231,7,8) end
end
`);
  await buildMd(source,rom);
  const host=new LibretroHost({saveDir:work});
  try {
    await host.loadCore(core.jsPath,core.wasmPath);
    await host.loadMedia({platform:"genesis",path:rom});
    host.stepFrames(240);
    const {width,rgba}=host.screenshotRgba();
    const pixel=(x,y)=>Array.from(rgba.slice(((y+32)*width+x+32)*4,((y+32)*width+x+32)*4+3));
    const green=pixel(242,2),blank=pixel(0,0);
    assert.notDeepEqual(green,blank,"large radius must finish and reach drawing within 240 video frames");
    assert.deepEqual(pixel(226,2),green,"large circle covers both screen corners");
    const expected=new Uint8Array(256*160);
    circles.forEach(([cx,cy,r],index)=>{
      if(r<0)return;
      const plot=(x,y)=>{
        if(x<0||x>=256||y<0||y>=160)return;
        if(index===7 && (x<154||x>=166||y<102||y>=116))return;
        expected[y*256+x]=1;
      };
      let x=r,y=0,err=1-r;
      while(x>=y){
        // Original per-pixel algorithm is the independent reference.
        for(let i=cx-x;i<=cx+x;i++){plot(i,cy+y);plot(i,cy-y);}
        for(let i=cx-y;i<=cx+y;i++){plot(i,cy+x);plot(i,cy-x);}
        y++;
        if(err<0)err+=2*y+1;else{x--;err+=2*(y-x)+1;}
      }
    });
    for(let y=0;y<160;y++)for(let x=0;x<256;x++){
      if(y<8 && ((x>=224&&x<232)||(x>=240&&x<248)))continue;
      assert.deepEqual(pixel(x,y),expected[y*256+x]?green:blank,`circle pixel ${x},${y}`);
    }
  } finally {host.unloadMedia();}
});
