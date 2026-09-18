import {test} from "node:test";
import assert from "node:assert/strict";
import {mkdtemp} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {LibretroHost} from "romdev-core-host";
import {core} from "romdev-core-gpgx";
import {resolveBuild} from "../compiler/project.mjs";
import {buildMd} from "../compiler/build-md.mjs";

test("release example collects, saves, scrolls and survives sustained input",async()=>{
  const work=await mkdtemp(path.join(tmpdir(),"mdlua-release-"));
  const project=fileURLToPath(new URL("../examples/release_check/mdlua.json",import.meta.url));
  const config=await resolveBuild(["--project",project,"-o",path.join(work,"game.bin")]);
  await buildMd(config.entry,config.out,config.assets);
  const host=new LibretroHost({saveDir:work});
  try {
    await host.loadCore(core.jsPath,core.wasmPath);
    await host.loadMedia({platform:"genesis",path:config.out});
    host.stepFrames(60);
    const before=host.screenshotRgba().rgba.slice();
    host.setInput({ports:[{right:true},{}]});host.stepFrames(12);
    host.setInput({ports:[{},{}]});host.stepFrames(6);
    host.setInput({ports:[{y:true},{}]});host.stepFrames(6);
    host.setInput({ports:[{},{}]});host.stepFrames(6);
    const size=host.regionSize("save_ram");
    assert.ok(size>0);
    const saved=host.readMemory("save_ram",0,size);
    assert.deepEqual([1,3,5,7,9].map(i=>saved[i]),[165,3,83,1,1],"collision increments best and A stores the versioned record in odd-byte SRAM");
    for(let round=0;round<4;round++) {
      for(const key of ["right","down","left","up"]) {
        host.setInput({ports:[{[key]:true},{}]});host.stepFrames(90);
      }
    }
    host.setInput({ports:[{},{}]});host.stepFrames(60);
    assert.notDeepEqual(host.screenshotRgba().rgba,before,"scene changes during play");
    assert.deepEqual(host.readMemory("save_ram",0,size),saved,"movement never overwrites the explicit save");
  } finally {host.unloadMedia();}
});
