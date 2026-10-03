import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { editProject, formatProject } from "../compiler/edit-project.mjs";

test("project asset editing is explicit, relative, and non-overwriting", async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), "mdlua-project-edit-"));
  const project = path.join(cwd, "game");
  const assets = path.join(project, "my assets");
  await mkdir(assets, { recursive: true });
  await writeFile(path.join(project, "mdlua.json"), JSON.stringify({ entry: "main.lua", out: "build/game.bin" }));
  await writeFile(path.join(assets, "sprites.png"), "png");
  await writeFile(path.join(assets, "theme.vgm"), "vgm");
  const projectArg = ["--project", path.join(project, "mdlua.json")];
  const accept = async () => ({ graphics: { totalTiles: 4, capacityTiles: 1424, freeTiles: 1420 }, audio: { music: 1, sfx: 0 } });
  const edit = args => editProject(args, cwd, accept);
  await edit(["set", "sheet", path.join(assets, "sprites.png"), ...projectArg]);
  await assert.rejects(edit(["set", "sheet", path.join(assets, "sprites.png"), ...projectArg]), /already registered/);
  const added = await edit(["add", "music", path.join(assets, "theme.vgm"), ...projectArg]);
  assert.match(formatProject(added), /Validation: OK[\s\S]*Graphics tiles: 4\/1424/);
  await assert.rejects(edit(["add", "music", path.join(assets, "theme.vgm"), ...projectArg]), /already registered/);
  let config = JSON.parse(await readFile(path.join(project, "mdlua.json"), "utf8"));
  assert.equal(config.sheet, "my assets/sprites.png");
  assert.deepEqual(config.music, ["my assets/theme.vgm"]);
  assert.match(formatProject(await editProject(["show", ...projectArg], cwd)), /1\. my assets\/theme\.vgm/);
  await edit(["remove", "music", "1", ...projectArg]);
  await edit(["unset", "sheet", ...projectArg]);
  config = JSON.parse(await readFile(path.join(project, "mdlua.json"), "utf8"));
  assert.deepEqual(config, { entry: "main.lua", out: "build/game.bin" });
});

test("project asset editing rejects missing files, wrong extensions, and invalid removals", async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), "mdlua-project-edit-errors-"));
  await writeFile(path.join(cwd, "mdlua.json"), "{}\n");
  await writeFile(path.join(cwd, "wrong.wav"), "wav");
  const accept = async () => ({});
  await assert.rejects(editProject(["set", "sheet", "missing.png"], cwd, accept), /asset not found/);
  await assert.rejects(editProject(["set", "sheet", "wrong.wav"], cwd, accept), /expects \.png/);
  await assert.rejects(editProject(["remove", "music", "1"], cwd, accept), /not registered/);
  await assert.rejects(editProject(["unset", "map"], cwd, accept), /not registered/);
  assert.deepEqual(JSON.parse(await readFile(path.join(cwd, "mdlua.json"), "utf8")), {});
});

test("failed candidate validation preserves the original manifest exactly", async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), "mdlua-project-transaction-"));
  const original = '{\n  "entry": "main.lua",\n  "out": "build/game.bin"\n}\n';
  await writeFile(path.join(cwd, "mdlua.json"), original);
  await writeFile(path.join(cwd, "bad.png"), "not a png");
  let sawCandidate = false;
  const reject = async candidate => {
    sawCandidate = JSON.parse(await readFile(candidate, "utf8")).sheet === "bad.png";
    throw new Error("invalid PNG payload");
  };
  await assert.rejects(editProject(["set", "sheet", "bad.png"], cwd, reject), /invalid PNG payload/);
  assert.equal(sawCandidate, true);
  assert.equal(await readFile(path.join(cwd, "mdlua.json"), "utf8"), original);
});

test("the real project check validates a candidate and reports its graphics budget", async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), "mdlua-project-real-check-"));
  await writeFile(path.join(cwd, "main.lua"), "function _draw() spr(0,0,0) end\n");
  await writeFile(path.join(cwd, "mdlua.json"), JSON.stringify({ entry: "main.lua", out: "build/game.bin" }));
  await writeFile(path.join(cwd, "sprites.png"), await readFile(new URL("../examples/starfall/shmup_sheet.png", import.meta.url)));
  const result = await editProject(["set", "sheet", "sprites.png"], cwd);
  assert.equal(result.validation.ok, true);
  assert.ok(result.validation.graphics.sheetTiles > 4);
  assert.match(formatProject(result), /Validation: OK[\s\S]*Graphics tiles: \d+\/1424/);
  assert.equal(JSON.parse(await readFile(path.join(cwd, "mdlua.json"), "utf8")).sheet, "sprites.png");
});
