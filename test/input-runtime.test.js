import {test} from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,writeFile,readFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import {LibretroHost} from "romdev-core-host";
import {core} from "romdev-core-gpgx";
import {buildMd} from "../compiler/build-md.mjs";

test("both ports report three/six-button input and press edges in NTSC/PAL",async()=>{
  const work=await mkdtemp(path.join(tmpdir(),"mdlua-input-"));
  const source=path.join(work,"main.lua"),rom=path.join(work,"input.bin");
  const signature=[19,71,203,52,166,89,230,14];
  await writeFile(source,`local state=array8(80)
function _init()
${signature.map((v,i)=>`state[${i+1}]=${v}`).join("\n")}
end
function _update60()
  for pl=0,1 do
    for i=0,11 do
      local n=pl*12+i
      state[17+n]=0
      if btn(i,pl) then state[17+n]=1 end
      if btnp(i,pl) then state[41+n]+=1 end
    end
  end
  for i=0,11 do
    if btn(i,-1) or btn(i,2) or btnp(i,-1) or btnp(i,2) then state[65]=1 end
  end
  if btn(-1) or btn(12) or btnp(-1) or btnp(12) then state[66]=1 end
end
function _draw() end
`);
  await buildMd(source,rom);
  const original=await readFile(rom);
  for(const region of ["U","E"]) for(const device of [257,513]) {
  const bytes=Buffer.from(original);
  bytes.fill(32,0x1f0,0x200);bytes[0x1f0]=region.charCodeAt(0);
  const regionalRom=path.join(work,`${region}-${device}.bin`);
  await writeFile(regionalRom,bytes);
  const host=new LibretroHost({saveDir:work});
  try {
    await host.loadCore(core.jsPath,core.wasmPath);
    await host.loadMedia({platform:"genesis",path:regionalRom});
    // GPGX RETRO_DEVICE_MDPAD_6B = RETRO_DEVICE_SUBCLASS(JOYPAD,1).
    // https://github.com/ekeeke/Genesis-Plus-GX/blob/master/libretro/libretro.c
    for(let port=0;port<2;port++) host.mod._retro_set_controller_port_device(port,device);
    host.stepFrames(30);
    const fps=host.getStatus().coreFps;
    assert.ok(region==="U" ? fps>59 && fps<61 : fps>49 && fps<51,`${region}: expected video timing`);
    const ram=host.readMemory("system_ram",0,65536);
    const offset=ram.findIndex((_,i)=>signature.every((v,j)=>ram[i+j]===v));
    assert.ok(offset>=0,"Lua input diagnostic must initialize");
    const keys=["left","right","up","down","b","a","y","start","l","x","r","select"];
    const edges=new Uint8Array(24);
    function check(port,id,held){
      const state=host.readMemory("system_ram",offset,80);
      for(let n=0;n<24;n++) {
        assert.equal(state[16+n],held && n===port*12+id?1:0,`held ${port}:${id}, entry ${n}`);
        assert.equal(state[40+n],edges[n],`press count ${port}:${id}, entry ${n}`);
      }
      assert.equal(state[64],0,"invalid players must not alias player one");
      assert.equal(state[65],0,"invalid button IDs must remain false");
    }
    for(let port=0;port<2;port++) for(let id=0;id<12;id++) {
      for(let press=0;press<2;press++) {
        const ports=[{},{}]; ports[port][keys[id]]=true;
        const supported=device===513 || id<8;
        host.setInput({ports});host.stepFrames(6);
        if(supported) edges[port*12+id]++;
        check(port,id,supported);
        host.stepFrames(10);check(port,id,supported);
        host.setInput({ports:[{},{}]});host.stepFrames(6);check(port,id,false);
      }
    }
    host.setInput({ports:[{left:true,b:true},{right:true,a:true}]});
    host.stepFrames(6);
    const simultaneous=new Set([0,4,13,17]);
    const state=host.readMemory("system_ram",offset,80);
    for(let n=0;n<24;n++) {
      if(simultaneous.has(n)) edges[n]++;
      assert.equal(state[16+n],simultaneous.has(n)?1:0,`simultaneous held ${region}/${device}:${n}`);
      assert.equal(state[40+n],edges[n],`simultaneous edge ${region}/${device}:${n}`);
    }
    host.setInput({ports:[{},{}]});host.stepFrames(6);check(0,0,false);
  } finally {host.unloadMedia();}
  }
});
