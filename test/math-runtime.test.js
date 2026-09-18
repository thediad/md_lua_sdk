import {test} from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import {LibretroHost} from "romdev-core-host";
import {core} from "romdev-core-gpgx";
import {buildMd} from "../compiler/build-md.mjs";

test("runtime abs and sign match constant folding at fixed-point boundaries",async()=>{
  const work=await mkdtemp(path.join(tmpdir(),"mdlua-abs-"));
  const source=path.join(work,"main.lua"),rom=path.join(work,"abs.bin");
  const values=[-32768,-32767.5,-3,-0.5,0,0.5,32767];
  await writeFile(source,`local passed=1
${values.map((v,i)=>`local expected${i}=abs(${v})`).join("\n")}
${values.map((v,i)=>`local sign${i}=sgn(${v})`).join("\n")}
local input=array(7)
function _init()
  ${values.map((v,i)=>`input[${i+1}]=${v}`).join("\n")}
  ${values.map((v,i)=>`if abs(input[${i+1}])!=abs(${v}) then passed=0 end`).join("\n")}
  ${values.map((v,i)=>`if abs(input[${i+1}])!=expected${i} then passed=0 end`).join("\n")}
  ${values.map((v,i)=>`if sgn(input[${i+1}])!=sign${i} then passed=0 end`).join("\n")}
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
    assert.deepEqual(pixel(18),pixel(2),"runtime and constant abs/sign agree");
  } finally {host.unloadMedia();}
});

test("numeric boundaries preserve rounding, signs, square roots and angle quadrants",async()=>{
  const work=await mkdtemp(path.join(tmpdir(),"mdlua-math-"));
  const source=path.join(work,"main.lua"),rom=path.join(work,"math.bin");
  const checks=[
    'flr(a[1])==-2','ceil(a[1])==-1','sgn(a[1])==-1','sgn(a[2])==0',
    'min(a[1],a[3])==-1.5','max(a[1],a[3])==2.5','mid(a[3],a[1],a[2])==0',
    'sqrt(a[4])==2','sqrt(a[1])==0','sqrt(a[2])==0','sqrt(a[5])==0.5',
    'abs(a[1]/a[3]+0.6)<0.0001','a[1]%a[3]==1','a[3]%a[1]==-0.5',
    'atan2(a[6],a[2])==0.5','atan2(a[2],a[6])==0.25',
    'atan2(a[6],a[6])==0.375','abs(atan2(a[6],a[7])-0.625)<0.0001',
    'sin(a[5])==-1','cos(a[5])==0',
    'a[3]%a[2]==0','a[3]/a[2]==abs(-32768)',
    'a[6]%a[8]==0','a[7]%a[8]==0',
    'a[6]/a[2]==-32768','atan2(a[2],a[2])==0.75',
    'sgn(a[8])==-1','sqrt(a[7])>181','sqrt(a[7])<182',
    'a[8]\\a[3]==folded_floor',
  ];
  await writeFile(source,`local a=array(8)
local folded_floor=-0.0000152587890625\\2.5
local outcomes=array8(${checks.length})
local passed=1
local calls=0
function next_value()
  calls+=1
  return calls
end
function _init()
  a[1]=-1.5 a[2]=0 a[3]=2.5 a[4]=4 a[5]=0.25 a[6]=-32768 a[7]=32767
  a[8]=-0.0000152587890625
  ${checks.map((c,i)=>`if ${c} then outcomes[${i+1}]=1 else passed=0 end`).join('\n')}
  local x=-7
  local y=3
  if x\\y!=-3 or x%y!=2 then passed=0 end
  if (0-a[8])\\a[1]!=-1 or a[8]\\a[1]!=0 then passed=0 end
  if min(next_value(),10)!=1 or calls!=1 then passed=0 end
  if max(next_value(),1)!=2 or calls!=2 then passed=0 end
  if min(next_value())!=0 or calls!=3 then passed=0 end
  if max(next_value())!=4 or calls!=4 then passed=0 end
end
function _draw()
  cls(0)
  rectfill(0,0,7,7,11)
  if passed==1 then rectfill(16,0,23,7,11) else rectfill(16,0,23,7,8) end
  for i=1,${checks.length} do if outcomes[i]==1 then rectfill(i*8,16,i*8+3,19,11) end end
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
    for(let i=0;i<checks.length;i++) {
      const offset=((48*width)+(i+1)*8+32)*4;
      assert.deepEqual(Array.from(rgba.slice(offset,offset+3)),pixel(2),checks[i]);
    }
    assert.deepEqual(pixel(18),pixel(2),"numeric boundary checks passed");
  } finally {host.unloadMedia();}
});
