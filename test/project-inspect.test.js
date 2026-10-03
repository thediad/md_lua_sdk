import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
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
  await assert.rejects(inspectProject(["audio", "--project", manifest]), /usage:/);
});

test("palette wrapping never splits a Genesis color value", () => {
  const output = paletteLines(Array.from({ length: 16 }, (_, index) => index * 0x111), 20);
  for (const line of output.split("\n")) {
    assert.ok(line.length <= 20);
    assert.match(line, /^0x[0-9A-F]{4}( 0x[0-9A-F]{4})*$/);
  }
  assert.equal(output.match(/0x[0-9A-F]{4}/g).length, 16);
});
