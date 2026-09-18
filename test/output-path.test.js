import {test} from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,writeFile,readFile,link} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import {buildMd} from "../compiler/build-md.mjs";
import {resolveBuild} from "../compiler/project.mjs";

test("build rejects source and asset output collisions before processing inputs",async()=>{
  const work=await mkdtemp(path.join(tmpdir(),"mdlua-output-"));
  const source=path.join(work,"main.lua");
  const contents="function _draw() end";
  await writeFile(source,contents);
  await assert.rejects(buildMd(source,source),/would overwrite an input/);
  assert.equal(await readFile(source,"utf8"),contents);
  for(const key of ["sheetPath","mapPath","gffPath","spriteVariantsPath","sfxPaths","musicPaths"]) {
    const file=path.join(work,key);
    await writeFile(file,"original asset bytes");
    const value=key.endsWith("Paths")?[file]:file;
    await assert.rejects(buildMd(source,file,{[key]:value}),/would overwrite an input/);
    assert.equal(await readFile(file,"utf8"),"original asset bytes");
  }
});

test("file aliases and project configuration cannot be used as ROM output",async()=>{
  const work=await mkdtemp(path.join(tmpdir(),"mdlua-output-alias-"));
  const source=path.join(work,"main.lua"),alias=path.join(work,"alias.bin");
  await writeFile(source,"function _draw() end");
  await link(source,alias);
  await assert.rejects(buildMd(source,alias),/would overwrite an input/);
  if(process.platform==="win32") await assert.rejects(buildMd(source,source.toUpperCase()),/would overwrite an input/);
  assert.equal(await readFile(source,"utf8"),"function _draw() end");
  const config=path.join(work,"mdlua.json");
  const json=JSON.stringify({entry:"main.lua",out:"mdlua.json"});
  await writeFile(config,json);
  await assert.rejects(resolveBuild([],work),/would overwrite an input/);
  await assert.rejects(resolveBuild(["-o","alias.bin"],work),/would overwrite an input/);
  assert.equal(await readFile(config,"utf8"),json);
  const valid=await resolveBuild(["-o","build/game.bin"],work);
  assert.equal(valid.out,path.join(work,"build/game.bin"));
});
