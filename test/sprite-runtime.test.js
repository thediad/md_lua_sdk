import {test} from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import {PNG} from "pngjs";
import {LibretroHost} from "romdev-core-host";
import {core} from "romdev-core-gpgx";
import {buildMd} from "../compiler/build-md.mjs";

test("sprites bound sheet IDs without using slots and preserve flips and camera",async()=>{
  const work=await mkdtemp(path.join(tmpdir(),"mdlua-sprites-"));
  const sheetPath=path.join(work,"sheet.png");
  const png=new PNG({width:16,height:16});
  const colors=[[255,0,0,255],[0,255,0,255],[0,0,255,255],[255,255,255,255]];
  for(let y=0;y<16;y++) for(let x=0;x<16;x++) {
    const color=(x%8===0 || y%8===0) ? [0,0,0,0] : colors[(x>>3)+(y>>3)*2];
    png.data.set(color,(y*16+x)*4);
  }
  await writeFile(sheetPath,PNG.sync.write(png));
  const source=path.join(work,"main.lua"),rom=path.join(work,"sprites.bin");
  await writeFile(source,`function _init() cls(0) end
function _draw()
  camera()
  for i=1,80 do
    spr(-1,240,40,2,2)
    spr(4,240,40)
    spr8(-1,240,40)
    spr8(32767,240,40)
  end
  spr(0,16,48,2,2)
  spr(0,48,48,2,2,true,false)
  spr(0,80,48,2,2,false,true)
  spr(0,112,48,2,2,true,true)
  camera(5,7)
  spr(0,149,55,2,2)
  camera()
  spr(3,16,96,2,2)
  spr(3,48,96,2,2,true,true)
  spr8(3,80,96)
end
`);
  await buildMd(source,rom,{sheetPath});
  const host=new LibretroHost({saveDir:work});
  try {
    await host.loadCore(core.jsPath,core.wasmPath);
    await host.loadMedia({platform:"genesis",path:rom});
    host.stepFrames(120);
    const {width,rgba}=host.screenshotRgba();
    const pixel=(x,y)=>Array.from(rgba.slice((y*width+x)*4,(y*width+x)*4+3));
    const blank=pixel(300,200);
    assert.notDeepEqual(pixel(18,50),blank,"invalid IDs must not exhaust the sprite list");
    for(const [dx,fx,fy] of [[48,true,false],[80,false,true],[112,true,true],[144,false,false]])
      for(let y=0;y<16;y++) for(let x=0;x<16;x++)
        assert.deepEqual(pixel(dx+x,48+y),pixel(16+(fx?15-x:x),48+(fy?15-y:y)),`flip/camera ${dx}:${x},${y}`);
    for(let y=0;y<16;y++) for(let x=0;x<16;x++) {
      assert.deepEqual(pixel(16+x,96+y),x<8 && y<8 ? pixel(24+x,56+y) : blank,"partial sheet rectangle");
      assert.deepEqual(pixel(48+x,96+y),x>=8 && y>=8 ? pixel(24+15-x,56+15-y) : blank,"flipped partial rectangle");
      assert.deepEqual(pixel(240+x,40+y),blank,"invalid bases draw nothing");
    }
    for(let y=0;y<8;y++) for(let x=0;x<8;x++)
      assert.deepEqual(pixel(80+x,96+y),pixel(24+x,56+y),"spr8 uses the same sheet tiles");
  } finally {host.unloadMedia();}
});


test("sprite lists handle 80 entries, overflow, empty frames and reuse",async()=>{
  const work=await mkdtemp(path.join(tmpdir(),"mdlua-sprite-list-"));
  const source=path.join(work,"main.lua"),rom=path.join(work,"list.bin");
  await writeFile(source,`local mode=0
function _init() cls(0) end
function _update60()
  if btnp(4) then mode=1 end
  if btnp(5) then mode=2 end
  if btnp(6) then mode=0 end
end
function _draw()
  if mode==0 then
    for i=0,79 do spr(0,8+(i%10)*24,8+(i\\10)*20) end
    spr(0,280,200)
  end
  if mode==2 then spr(0,280,200) end
end
`);
  await buildMd(source,rom);
  const host=new LibretroHost({saveDir:work});
  try {
    await host.loadCore(core.jsPath,core.wasmPath);
    await host.loadMedia({platform:"genesis",path:rom});
    host.stepFrames(60);
    const snapshot=()=>{
      const {width,rgba}=host.screenshotRgba();
      return (x,y)=>Array.from(rgba.slice((y*width+x)*4,(y*width+x)*4+3));
    };
    const initial=snapshot(),blank=initial(300,220),color=initial(10,10);
    assert.notDeepEqual(color,blank,"first sprite visible");
    const check=(mode)=>{
      const pixel=snapshot();
      for(let i=0;i<80;i++)assert.deepEqual(pixel(10+(i%10)*24,10+Math.floor(i/10)*20),mode===0?color:blank,`mode ${mode} entry ${i}`);
      assert.deepEqual(pixel(282,202),mode===2?color:blank,"overflow/reused sprite");
    };
    const press=(key)=>{
      host.setInput({ports:[{[key]:true},{}]});host.stepFrames(4);
      host.setInput({ports:[{},{}]});host.stepFrames(4);
    };
    check(0);
    for(let round=0;round<2;round++) {
      press("b");check(1);
      host.stepFrames(20);check(1);
      press("a");check(2);
      press("y");check(0);
      press("a");check(2);
      press("y");check(0);
    }
  } finally {host.unloadMedia();}
});
