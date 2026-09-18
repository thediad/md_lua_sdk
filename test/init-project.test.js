import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, readdir, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { LibretroHost } from "romdev-core-host";
import { core } from "romdev-core-gpgx";
import { initProject } from "../compiler/init-project.mjs";

test("init refuses existing destinations and malformed arguments without modifying files", async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), "mdlua-init-"));
  await writeFile(path.join(cwd, "keep"), "user data");
  for (const args of [[], [""], ["--force"], ["one", "two"], ["."], ["keep"]]) {
    await assert.rejects(initProject(args, cwd));
  }
  assert.equal(await readFile(path.join(cwd, "keep"), "utf8"), "user data");
  assert.deepEqual(await readdir(cwd), ["keep"]);
});

test("CLI starter builds and supports movement and reset in the emulator", async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), "mdlua-starter-"));
  const launcher = fileURLToPath(new URL("../bin/mdlua-launch.mjs", import.meta.url));
  await promisify(execFile)(process.execPath, [launcher, "init", "my game"], { cwd });
  const directory = path.join(cwd, "my game");
  assert.deepEqual((await readdir(directory)).sort(), [".gitignore", ".vscode", "README.md", "main.lua", "mdlua.json"]);
  const config=JSON.parse(await readFile(path.join(directory,".vscode/tasks.json"),"utf8"));
  const build=config.tasks.find(task=>task.label==="Genesis Lua: build");
  assert.equal(build.type,"process");
  assert.deepEqual(build.group,{kind:"build",isDefault:true});
  const run=config.tasks.find(task=>task.label==="Genesis Lua: run");
  assert.equal(run.args[1],"run");
  const expand=value=>value.replaceAll("${workspaceFolder}",directory);
  const env={...process.env};delete env.NODE_OPTIONS;
  await promisify(execFile)(build.command,build.args.map(expand),{cwd:expand(build.options.cwd),env});
  const rom=path.join(directory,"build/game.bin");
  const host = new LibretroHost({ saveDir: cwd });
  try {
    await host.loadCore(core.jsPath, core.wasmPath);
    await host.loadMedia({ platform: "genesis", path: rom });
    host.stepFrames(60);
    const pixel = (x,y) => {
      const { width, rgba } = host.screenshotRgba();
      return Array.from(rgba.slice((y*width+x)*4, (y*width+x)*4+3));
    };
    const background = pixel(300, 180);
    const sprite = pixel(158, 110);
    assert.notDeepEqual(sprite, background, "starter sprite must be visible");
    host.setInput({ ports: [{ right: true }, {}] });
    host.stepFrames(90);
    assert.deepEqual(pixel(158,110), background, "sprite moves away from start");
    assert.deepEqual(pixel(314,110), sprite, "movement clamps at right edge");
    host.setInput({ ports: [{ b: true }, {}] });
    host.stepFrames(6);
    assert.deepEqual(pixel(158,110), sprite, "B resets position");
    assert.deepEqual(pixel(314,110), background, "old sprite is removed");
  } finally { host.unloadMedia(); }
});


test("generated task matcher locates compiler errors in a nested source path",async()=>{
  const cwd=await mkdtemp(path.join(tmpdir(),"mdlua-ide-errors-"));
  const directory=await initProject(["my game"],cwd);
  await mkdir(path.join(directory,"src"));
  const source=path.join(directory,"src","broken.lua");
  await writeFile(source,"function _draw()\n local x =\nend\n");
  await writeFile(path.join(directory,"mdlua.json"),JSON.stringify({entry:"src/broken.lua",out:"build/game.bin"}));
  const config=JSON.parse(await readFile(path.join(directory,".vscode/tasks.json"),"utf8"));
  const task=config.tasks[0],matcher=task.problemMatcher[0];
  assert.equal(matcher.fileLocation,"absolute");
  const expand=value=>value.replaceAll("${workspaceFolder}",directory);
  const error=await promisify(execFile)(task.command,task.args.map(expand),{cwd:directory}).then(()=>assert.fail("invalid Lua must fail"),e=>e);
  const matches=error.stderr.split(/\r?\n/).map(line=>new RegExp(matcher.pattern.regexp).exec(line)).filter(Boolean);
  assert.ok(matches.length>0,error.stderr);
  for(const match of matches) {
    assert.equal(match[matcher.pattern.file],source);
    assert.ok(Number(match[matcher.pattern.line])>0);
    assert.ok(Number(match[matcher.pattern.column])>0);
    assert.equal(match[matcher.pattern.severity],"error");
    assert.ok(match[matcher.pattern.message].length>0);
  }
});
