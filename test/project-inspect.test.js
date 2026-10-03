import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { inspectProject, paletteLines } from "../compiler/inspect-project.mjs";

const manifest = fileURLToPath(new URL("../examples/starfall/mdlua.json", import.meta.url));

test("project graphics inspection reports build-compatible sheet and map metadata", async () => {
  const sheet = await inspectProject(["sheet", "--project", manifest]);
  assert.match(sheet, /Size: 64x16 pixels/);
  assert.match(sheet, /Grid: 8 columns x 2 rows/);
  assert.match(sheet, /Tile IDs: 0-15, row-major/);
  assert.match(sheet, /Graphics: 16 tiles, 512 VRAM bytes/);
  assert.match(sheet, /Palette: PAL1/);
  assert.match(sheet, /0x[0-9A-F]{4}/);
  const map = await inspectProject(["map", "--project", manifest]);
  assert.match(map, /Grid: \d+ columns x \d+ rows/);
  assert.match(map, /Graphics: \d+ unique tiles, \d+ VRAM bytes/);
  assert.match(map, /Palette: PAL2/);
});

test("graphics inspection rejects missing registrations and malformed commands", async () => {
  const hello = fileURLToPath(new URL("../examples/hello/mdlua.json", import.meta.url));
  await assert.rejects(inspectProject(["sheet", "--project", hello]), /no registered sheet/);
  await assert.rejects(inspectProject(["unknown", "--project", manifest]), /usage:/);
});

test("palette wrapping never splits a Genesis color value", () => {
  const output = paletteLines(Array.from({ length: 16 }, (_, index) => index * 0x111), 20);
  for (const line of output.split("\n")) {
    assert.ok(line.length <= 20);
    assert.match(line, /^0x[0-9A-F]{4}( 0x[0-9A-F]{4})*$/);
  }
  assert.equal(output.match(/0x[0-9A-F]{4}/g).length, 16);
});

test("audio inspection reports converted sizes and SFX duration", async () => {
  const audio = fileURLToPath(new URL("../examples/audio_check/mdlua.json", import.meta.url));
  const output = await inspectProject(["audio", "--project", audio]);
  assert.match(output, /Audio assets: 1 music, 1 sfx/);
  assert.match(output, /Music 0: tone\.vgm[\s\S]*XGM2 bytes/);
  assert.match(output, /SFX 0: tone\.wav[\s\S]*PCM bytes/);
  assert.match(output, /about \d+\.\d{2} seconds at 13\.3 kHz/);
});

test("variant inspection reports source rectangles, sizes, and budgets", async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), "mdlua-inspect-variants-"));
  await writeFile(path.join(cwd, "sheet.png"), await readFile(new URL("../examples/prescaled/sheet.png", import.meta.url)));
  await writeFile(path.join(cwd, "variants.json"), await readFile(new URL("../examples/prescaled/variants.json", import.meta.url)));
  await writeFile(path.join(cwd, "mdlua.json"), JSON.stringify({ sheet: "sheet.png", spriteVariants: "variants.json" }));
  const output = await inspectProject(["variants"], cwd);
  assert.match(output, /Sprite variants: 4/);
  assert.match(output, /Graphics: \d+\/2048 budget bytes/);
  assert.match(output, /1: \[0,0,16,16\] -> 24x24/);
  assert.match(output, /ROM\/VRAM bytes, 1 hardware sprite/);
});
