import {test} from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,writeFile,readFile,mkdir} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {execFile} from "node:child_process";
import {promisify} from "node:util";
import {resolveBuild} from "../compiler/project.mjs";

test("project paths are relative to config; explicit CLI paths override from cwd",async()=>{
  const cwd=await mkdtemp(path.join(tmpdir(),"mdlua-project-"));
  const project=path.join(cwd,"my game");await mkdir(project);
  const config=path.join(project,"mdlua.json");
  await writeFile(config,JSON.stringify({entry:"src/main.lua",out:"build/game.bin",sheet:"assets/sprites.png",music:["assets/a.vgm"]}));
  const result=await resolveBuild(["--project",config,"--sheet","override.png"],cwd);
  assert.equal(result.entry,path.join(project,"src/main.lua"));
  assert.equal(result.out,path.join(project,"build/game.bin"));
  assert.equal(result.assets.sheetPath,path.join(cwd,"override.png"));
  assert.deepEqual(result.assets.musicPaths,[path.join(project,"assets/a.vgm")]);
});

test("build defaults and malformed project options are handled explicitly",async()=>{
  const cwd=await mkdtemp(path.join(tmpdir(),"mdlua-options-"));
  assert.equal((await resolveBuild([],cwd)).entry,path.join(cwd,"main.lua"));
  assert.equal((await resolveBuild(["entry.lua"],cwd)).out,path.join(cwd,"game.bin"));
  for(const args of [["--sheet"],["--unknown","x"],["one.lua","two.lua"],["--project","missing.json"],["--music","song.vgm,"]]) await assert.rejects(resolveBuild(args,cwd));
  for(const value of [{entyr:"main.lua"},{music:"song.vgm"},{sheet:42},null]) {
    await writeFile(path.join(cwd,"mdlua.json"),JSON.stringify(value));
    await assert.rejects(resolveBuild([],cwd));
  }
});

test("CLI builds a project without an external Windows preload or asset arguments",async()=>{
  const cwd=await mkdtemp(path.join(tmpdir(),"mdlua-cli project-"));
  await writeFile(path.join(cwd,"main.lua"),'function _init() print("PROJECT BUILD",8,8,7) end\nfunction _draw() end');
  await writeFile(path.join(cwd,"mdlua.json"),JSON.stringify({entry:"main.lua",out:"build/test.bin"}));
  const env={...process.env};delete env.NODE_OPTIONS;
  const launcher=fileURLToPath(new URL("../bin/mdlua-launch.mjs",import.meta.url));
  const {stdout}=await promisify(execFile)(process.execPath,[launcher,"build"],{cwd,env});
  assert.match(stdout,/test\.bin/);
  assert.match(stdout,/4\/1424 used, 1420 free/);
  assert.match(stdout,/Fallback sheet: 4; map: 0; pre-scaled: 0/);
  const rom=await readFile(path.join(cwd,"build/test.bin"));
  assert.ok(rom.length>=0x200);
  assert.match(rom.toString("ascii",0x100,0x110),/SEGA/);
});


test("run builds configured assets and launches the returned output path",async()=>{
  const {prepareRun}=await import("../compiler/run-project.mjs");
  const cwd=await mkdtemp(path.join(tmpdir(),"mdlua-run project-"));
  await writeFile(path.join(cwd,"mdlua.json"),JSON.stringify({entry:"main.lua",out:"build/game.bin",sheet:"art.png"}));
  let calls=0;
  const build=async(entry,out,assets)=>{
    calls++;
    assert.equal(entry,path.join(cwd,"main.lua"));
    assert.equal(out,path.join(cwd,"custom.bin"));
    assert.equal(assets.sheetPath,path.join(cwd,"override.png"));
    return {outPath:out};
  };
  assert.equal(await prepareRun(["--sheet","override.png","-o","custom.bin"],cwd,build),path.join(cwd,"custom.bin"));
  assert.equal(calls,1);
  await writeFile(path.join(cwd,"main.lua"),"function _draw() end");
  await writeFile(path.join(cwd,"mdlua.json"),JSON.stringify({entry:"main.lua",out:"build/game.bin"}));
  const rom=await prepareRun([],cwd);
  assert.equal(rom,path.join(cwd,"build/game.bin"));
});

test("direct ROM run bypasses project config; malformed run options never build",async()=>{
  const {prepareRun}=await import("../compiler/run-project.mjs");
  const cwd=await mkdtemp(path.join(tmpdir(),"mdlua-run-options-"));
  await writeFile(path.join(cwd,"mdlua.json"),"invalid json");
  const neverBuild=async()=>assert.fail("must not build");
  assert.equal(await prepareRun(["existing.BIN"],cwd,neverBuild),path.join(cwd,"existing.BIN"));
  await writeFile(path.join(cwd,"mdlua.json"),"{}");
  for(const args of [["--sheet"],["a.lua","b.lua"],["existing.bin","-o","other.bin"],["--unknown"]]) {
    await assert.rejects(prepareRun(args,cwd,neverBuild));
  }
});


test("project JSON accepts a UTF-8 BOM and reports clickable configuration errors",async()=>{
  const cwd=await mkdtemp(path.join(tmpdir(),"mdlua-json-diagnostics-"));
  const file=path.join(cwd,"mdlua.json");
  await writeFile(file,'\uFEFF{"entry":"main.lua","out":"build/game.bin"}');
  assert.equal((await resolveBuild([],cwd)).out,path.join(cwd,"build/game.bin"));
  const check=async(text,expected)=>{
    await writeFile(file,text);
    await assert.rejects(resolveBuild([],cwd),error=>{
      assert.ok(error.message.startsWith(`${file}:`));
      assert.match(error.message,/:\d+:\d+: error: /);
      assert.match(error.message,expected);
      return true;
    });
  };
  await check('{\n "entry": "main.lua",\n "out": }',/invalid project JSON/);
  // V8 omits source positions for some errors; those point to the file start.
  await assert.rejects(resolveBuild([],cwd),error=>error.message.startsWith(`${file}:1:1: error:`));
  await check('{\n "entry": "main.lua",\n "out" "game.bin"\n}',/invalid project JSON/);
  await assert.rejects(resolveBuild([],cwd),error=>error.message.startsWith(`${file}:3:8: error:`));
  await check('{"entyr":"main.lua"}',/unknown project setting: entyr/);
  await check('{"music":"song.vgm"}',/invalid project setting: music/);
  await check('null',/must contain an object/);
});
