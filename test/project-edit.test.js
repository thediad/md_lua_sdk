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
  await editProject(["set", "sheet", path.join(assets, "sprites.png"), ...projectArg], cwd);
  await assert.rejects(editProject(["set", "sheet", path.join(assets, "sprites.png"), ...projectArg], cwd), /already registered/);
  await editProject(["add", "music", path.join(assets, "theme.vgm"), ...projectArg], cwd);
  await assert.rejects(editProject(["add", "music", path.join(assets, "theme.vgm"), ...projectArg], cwd), /already registered/);
  let config = JSON.parse(await readFile(path.join(project, "mdlua.json"), "utf8"));
  assert.equal(config.sheet, "my assets/sprites.png");
  assert.deepEqual(config.music, ["my assets/theme.vgm"]);
  assert.match(formatProject(await editProject(["show", ...projectArg], cwd)), /1\. my assets\/theme\.vgm/);
  await editProject(["remove", "music", "1", ...projectArg], cwd);
  await editProject(["unset", "sheet", ...projectArg], cwd);
  config = JSON.parse(await readFile(path.join(project, "mdlua.json"), "utf8"));
  assert.deepEqual(config, { entry: "main.lua", out: "build/game.bin" });
});

test("project asset editing rejects missing files, wrong extensions, and invalid removals", async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), "mdlua-project-edit-errors-"));
  await writeFile(path.join(cwd, "mdlua.json"), "{}\n");
  await writeFile(path.join(cwd, "wrong.wav"), "wav");
  await assert.rejects(editProject(["set", "sheet", "missing.png"], cwd), /asset not found/);
  await assert.rejects(editProject(["set", "sheet", "wrong.wav"], cwd), /expects \.png/);
  await assert.rejects(editProject(["remove", "music", "1"], cwd), /not registered/);
  await assert.rejects(editProject(["unset", "map"], cwd), /not registered/);
  assert.deepEqual(JSON.parse(await readFile(path.join(cwd, "mdlua.json"), "utf8")), {});
});
