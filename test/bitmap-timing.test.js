import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { shareDir } from "romdev-toolchain-m68k-gcc";
import { bitmapTimingSource } from "../compiler/bitmap-timing.mjs";

test("bitmap timing adaptation rejects drift in the pinned SGDK source", async () => {
  const source = await readFile(path.join(shareDir,"lib","sgdk","src","bmp.c"),"utf8");
  assert.doesNotThrow(()=>bitmapTimingSource(source));
  assert.throws(()=>bitmapTimingSource(source.replace("#define NTSC_TILES_BW           7","#define NTSC_TILES_BW           8")),/source changed/);
});
