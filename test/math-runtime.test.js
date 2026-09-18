import {test} from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import {LibretroHost} from "romdev-core-host";
import {core} from "romdev-core-gpgx";
import {buildMd} from "../compiler/build-md.mjs";

test("runtime abs matches constant folding at fixed-point boundaries",async()=>{
  const work=await mkdtemp(path.join(tmpdir(),"mdlua-abs-"));
  const source=path.join(work,"main.lua"),rom=path.join(work,"abs.bin");
  const values=[-32768,-32767.5,-3,-0.5,0,0.5,32767];
  await writeFile(source,`local passed=1
${values.map((v,i)=>`local expected${i}=abs(${v})`).join("\n")}
local input=array(7)
function _init()
  ${values.map((v,i)=>`input[${i+1}]=${v}`).join("\n")}
  ${values.map((v,i)=>`if abs(input[${i+1}])!=abs(${v}) then passed=0 end`).join("\n")}
  ${values.map((v,i)=>`if abs(input[${i+1}])!=expected${i} then passed=0 end`).join("\n")}
  local minimum=-32768
  if abs(minimum)!=abs(-32768) then passed=0 end
end
function _draw()
  cls(0)
  rectfill(0,0,7,7,11)
  if passed==1 then rectfill(16,0,23,7,11) else rectfill(16,0,23,7,8) end
end`);
  await buildMd(source,rom);
  const host=new LibretroHost({saveDir:work});
  try {
    await host.loadCore(core.jsPath,core.wasmPath);
    await host.loadMedia({platform:"genesis",path:rom});
    host.stepFrames(120);
    const {width,rgba}=host.screenshotRgba();
    const pixel=x=>Array.from(rgba.slice((34*width+x+32)*4,(34*width+x+32)*4+3));
    assert.notDeepEqual(pixel(2),pixel(10),"ROM reached drawing");
    assert.deepEqual(pixel(18),pixel(2),"runtime and constant abs agree");
  } finally {host.unloadMedia();}
});
