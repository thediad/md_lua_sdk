import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { LibretroHost } from "romdev-core-host";
import { core } from "romdev-core-gpgx";
import { initProject } from "../compiler/init-project.mjs";
import { prepareRun } from "../compiler/run-project.mjs";

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
  assert.deepEqual((await readdir(directory)).sort(), [".gitignore", "README.md", "main.lua", "mdlua.json"]);
  const rom = await prepareRun([], directory);
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
