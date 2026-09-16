import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LibretroHost } from "romdev-core-host";
import { core } from "romdev-core-gpgx";
import { buildMd } from "../compiler/build-md.mjs";

test("PICO map RAM, flags, and layer filtering run correctly in Genesis", async () => {
  const work = await mkdtemp(path.join(tmpdir(), "mdlua-pico-"));
  const rom = path.join(work, "map.bin");
  const source = fileURLToPath(new URL("../examples/pico_map_flags/main.lua", import.meta.url));
  await buildMd(source, rom);
  const host = new LibretroHost({ saveDir: work });
  try {
    await host.loadCore(core.jsPath, core.wasmPath);
    await host.loadMedia({ platform: "genesis", path: rom });
    host.stepFrames(120);
    const { width, rgba } = host.screenshotRgba();
    const pixel = (x, y) => Array.from(rgba.slice((y * width + x) * 4, (y * width + x) * 4 + 3));
    const blank = pixel(300, 200);
    for (let i = 0; i < 4; i++) {
      const x = 112 + i * 8;
      assert.notDeepEqual(pixel(x, 48), blank);
      assert.deepEqual(pixel(x, 72), i === 0 || i === 2 ? pixel(x, 48) : blank);
      assert.deepEqual(pixel(x, 96), i !== 0 ? pixel(x, 48) : blank);
      assert.deepEqual(pixel(x, 120), blank);
    }
    assert.deepEqual(pixel(120, 48), pixel(136, 48), "mset changes tile 4 to tile 2");
    // PASS prints beyond the short FAIL message; this area is blank on failure.
    let passText = false;
    for (let y = 24; y < 32; y++) for (let x = 48; x < 150; x++) {
      if (pixel(x, y).some((v, i) => v !== blank[i])) passText = true;
    }
    assert.ok(passText, "RAM/bounds/flag checks must reach the PASS branch");
  } finally {
    host.unloadMedia();
  }
});

test("fixed-point text matches rounded decimal strings in the emulator", async () => {
  const work = await mkdtemp(path.join(tmpdir(), "mdlua-numbers-"));
  const rom = path.join(work, "numbers.bin");
  await buildMd(fileURLToPath(new URL("../examples/number_print/main.lua", import.meta.url)), rom);
  const host = new LibretroHost({ saveDir: work });
  try {
    await host.loadCore(core.jsPath, core.wasmPath);
    await host.loadMedia({ platform: "genesis", path: rom });
    host.stepFrames(120);
    const { width, rgba } = host.screenshotRgba();
    for (const y of [24, 64, 104, 144, 184]) {
      for (let row = 0; row < 8; row++) {
        const start = ((y + row) * width + 8) * 4;
        const expected = ((y + 16 + row) * width + 8) * 4;
        assert.deepEqual(rgba.slice(start, start + 96 * 4), rgba.slice(expected, expected + 96 * 4), `text pair at y=${y}`);
      }
    }
  } finally {
    host.unloadMedia();
  }
});

test("bitmap clipping resets, intersects, and preserves an empty rectangle", async () => {
  const work = await mkdtemp(path.join(tmpdir(), "mdlua-clip-"));
  const rom = path.join(work, "clip.bin");
  await buildMd(fileURLToPath(new URL("../examples/bitmap_clip/main.lua", import.meta.url)), rom);
  const host = new LibretroHost({ saveDir: work });
  try {
    await host.loadCore(core.jsPath, core.wasmPath);
    await host.loadMedia({ platform: "genesis", path: rom });
    host.stepFrames(120);
    const { width, rgba } = host.screenshotRgba();
    // SGDK centers its 256x160 bitmap in the 320x224 display.
    const pixel = (x, y) => Array.from(rgba.slice(((y + 32) * width + x + 32) * 4, ((y + 32) * width + x + 32) * 4 + 3));
    assert.notDeepEqual(pixel(20,20), pixel(36,36));
    assert.deepEqual(pixel(52,52), pixel(100,100));
    assert.notDeepEqual(pixel(4,4), pixel(100,100));
    assert.deepEqual(pixel(20,82), pixel(36,36), "the status bar must be green (all pget checks pass)");
    assert.notDeepEqual(pixel(20,82), pixel(100,100));
  } finally {
    host.unloadMedia();
  }
});

test("pre-scaled variants render exact pixels, transparency and flips", async () => {
  const work = await mkdtemp(path.join(tmpdir(), "mdlua-scaled-"));
  const rom = path.join(work, "scaled.bin");
  const example = new URL("../examples/prescaled/", import.meta.url);
  const result = await buildMd(fileURLToPath(new URL("main.lua", example)), rom, {
    sheetPath: fileURLToPath(new URL("sheet.png", example)),
    spriteVariantsPath: fileURLToPath(new URL("variants.json", example)),
  });
  assert.equal(result.spriteVariants.bytes, 1024);
  assert.equal(result.spriteVariants.sheetBytes, 128);
  const host = new LibretroHost({ saveDir: work });
  try {
    await host.loadCore(core.jsPath, core.wasmPath);
    await host.loadMedia({ platform: "genesis", path: rom });
    host.stepFrames(120);
    const { width, rgba } = host.screenshotRgba();
    const pixel = (x,y) => Array.from(rgba.slice((y*width+x)*4,(y*width+x)*4+3));
    assert.notDeepEqual(pixel(180,52), pixel(188,52), "reference sheet colors must differ");
    for (const [dx,dy,w,h,fx,fy] of [[16,48,8,8,0,0],[48,48,24,24,0,0],[96,48,32,32,0,0],[16,104,32,32,1,0],[64,104,32,32,0,1],[112,104,32,32,1,1],[16,184,24,16,0,0]]) {
      for (let y=0; y<h; y++) for (let x=0; x<w; x++) {
        const sx=Math.floor((fx?w-1-x:x)*16/w), sy=Math.floor((fy?h-1-y:y)*16/h);
        assert.deepEqual(pixel(dx+x,dy+y),pixel(176+sx,48+sy),`sprite at ${dx},${dy}, pixel ${x},${y}`);
      }
    }
  } finally {
    host.unloadMedia();
  }
});
