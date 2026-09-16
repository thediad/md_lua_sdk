import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { PNG } from "pngjs";
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
    let visibleText = false;
    for (const y of [24, 64, 104, 144, 184]) {
      for (let row = 0; row < 8; row++) {
        const start = ((y + row) * width + 8) * 4;
        const expected = ((y + 16 + row) * width + 8) * 4;
        assert.deepEqual(rgba.slice(start, start + 96 * 4), rgba.slice(expected, expected + 96 * 4), `text pair at y=${y}`);
        for (let x = 0; x < 96; x++) if (rgba[start + x * 4] || rgba[start + x * 4 + 1] || rgba[start + x * 4 + 2]) visibleText = true;
      }
    }
    assert.ok(visibleText, "numeric text must be visible, not two matching blank regions");
  } finally {
    host.unloadMedia();
  }
});

test("imported sprite flags are ready in _init and remain mutable for map filtering", async () => {
  const work = await mkdtemp(path.join(tmpdir(), "mdlua-import-flags-"));
  const rom = path.join(work,"flags.bin");
  const example = new URL("../examples/imported_flags/",import.meta.url);
  await buildMd(fileURLToPath(new URL("main.lua",example)),rom,{
    gffPath:fileURLToPath(new URL("sprites.gff",example)),
  });
  const host = new LibretroHost({saveDir:work});
  try {
    await host.loadCore(core.jsPath,core.wasmPath);
    await host.loadMedia({platform:"genesis",path:rom});
    host.stepFrames(120);
    const {width,rgba}=host.screenshotRgba();
    const pixel=(x,y)=>Array.from(rgba.slice((y*width+x)*4,(y*width+x)*4+3));
    const blank=pixel(300,200);
    let passText=false;
    for(let y=24;y<32;y++) for(let x=48;x<144;x++) {
      if(pixel(x,y).some((v,i)=>v!==blank[i])) passText=true;
    }
    assert.ok(passText,"imported byte/bit and mutation checks must reach PASS");
    for(let i=0;i<3;i++) {
      const x=112+i*8;
      assert.notDeepEqual(pixel(x,48),blank);
      assert.deepEqual(pixel(x,72),i!==1?pixel(x,48):blank);
      assert.deepEqual(pixel(x,96),i!==0?pixel(x,48):blank);
    }
  } finally { host.unloadMedia(); }
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

test("bitmap text composes colored glyphs with clipping, clearing and draw order", async () => {
  const work = await mkdtemp(path.join(tmpdir(), "mdlua-bitmap-text-"));
  const rom = path.join(work, "text.bin");
  await buildMd(fileURLToPath(new URL("../examples/bitmap_text/main.lua", import.meta.url)), rom);
  const font = PNG.sync.read(await readFile(new URL("../node_modules/romdev-toolchain-m68k-gcc/share/genesis/lib/sgdk/res/image/font_default.png", import.meta.url)));
  const host = new LibretroHost({ saveDir: work });
  try {
    await host.loadCore(core.jsPath, core.wasmPath);
    await host.loadMedia({ platform: "genesis", path: rom });
    host.stepFrames(120);
    const { width, rgba } = host.screenshotRgba();
    const pixel = (x,y) => Array.from(rgba.slice(((y+32)*width+x+32)*4,((y+32)*width+x+32)*4+3));
    const red = pixel(240,0), green = pixel(248,0), black = pixel(200,150);
    assert.notDeepEqual(red, green);
    assert.notDeepEqual(red, black);
    const glyphPixel = (x,y) => {
      const glyph = 65-32;
      const offset = (((glyph>>4)*8+y)*font.width+(glyph&15)*8+x)*4;
      return font.data[offset+3] && font.data.slice(offset,offset+3).some(v=>v);
    };
    for (const [dx,dy,bg,clipLeft,clipRight] of [[13,17,green,0,256],[-3,50,black,0,256],[17,75,black,20,24]]) {
      for (let y=0;y<8;y++) for (let x=0;x<8;x++) {
        if (dx+x<0) continue;
        const visible=dx+x>=clipLeft && dx+x<clipRight && glyphPixel(x,y);
        assert.deepEqual(pixel(dx+x,dy+y),visible?red:bg,`glyph at ${dx},${dy}, pixel ${x},${y}`);
      }
    }
    for (let y=50;y<58;y++) {
      for (let x=40;x<48;x++) assert.deepEqual(pixel(x,y),green,"later drawing covers text");
      for (let x=80;x<104;x++) assert.deepEqual(pixel(x,y),black,"cls removes old text from both buffers");
    }
    let lit=0;
    for (let y=0;y<8;y++) for (let x=0;x<32;x++) {
      assert.deepEqual(pixel(16+x,104+y),pixel(16+x,120+y),"numeric and literal text agree");
      if (pixel(16+x,104+y).some((v,i)=>v!==black[i])) lit++;
    }
    assert.ok(lit>0,"numeric comparison must contain visible text");
  } finally { host.unloadMedia(); }
});
