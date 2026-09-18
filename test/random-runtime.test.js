import {test} from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import {LibretroHost} from "romdev-core-host";
import {core} from "romdev-core-gpgx";
import {buildMd} from "../compiler/build-md.mjs";

test("seeded random numbers stay in range and integer draws match fixed draws",async()=>{
  const work=await mkdtemp(path.join(tmpdir(),"mdlua-random-"));
  const source=path.join(work,"main.lua"),rom=path.join(work,"random.bin");
  await writeFile(source,`local passed=1
local values=array(32)
function _init()
  srand(123)
  for i=1,32 do
    local v=rnd(10)
    if v<0 or v>=10 then passed=0 end
    values[i]=v
  end
  srand(123)
  for i=1,32 do
    if rnd(10)!=values[i] then passed=0 end
  end
  srand(123)
  for i=1,32 do
    if flr(rnd(10))!=flr(values[i]) then passed=0 end
  end
  srand(-1.5)
  for i=1,100 do
    local v=rnd(0.5)
    if v<0 or v>=0.5 then passed=0 end
    local n=flr(rnd(32767))
    if n<0 or n>=32767 then passed=0 end
  end
  srand(0)
  local first=rnd()
  srand(0)
  if rnd()!=first or first<=0 or first>=1 then passed=0 end
  if rnd(0)!=0 or rnd(-1)!=0 then passed=0 end
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
    assert.notDeepEqual(pixel(2),pixel(10),"ROM reached its draw callback");
    assert.deepEqual(pixel(18),pixel(2),"range, reseeding and integer/fixed equivalence checks passed");
  } finally {host.unloadMedia();}
});
