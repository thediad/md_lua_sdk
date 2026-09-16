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
  const rom=await readFile(path.join(cwd,"build/test.bin"));
  assert.ok(rom.length>=0x200);
  assert.match(rom.toString("ascii",0x100,0x110),/SEGA/);
});
