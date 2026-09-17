import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
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

test("colored bitmap clears fill RAM and ignore clipping without changing it", async () => {
  const work=await mkdtemp(path.join(tmpdir(),"mdlua-clear-"));
  const rom=path.join(work,"clear.bin");
  await buildMd(fileURLToPath(new URL("../examples/bitmap_clear/main.lua",import.meta.url)),rom);
  const host=new LibretroHost({saveDir:work});
  try {
    await host.loadCore(core.jsPath,core.wasmPath);
    await host.loadMedia({platform:"genesis",path:rom});
    host.stepFrames(120);
    const {width,rgba}=host.screenshotRgba();
    const pixel=(x,y)=>Array.from(rgba.slice(((y+32)*width+x+32)*4,((y+32)*width+x+32)*4+3));
    const green=pixel(240,8),blue=pixel(240,24);
    assert.notDeepEqual(green,blue);
    assert.deepEqual(pixel(8,8),green,"all initialization/pget/clip checks passed");
    assert.deepEqual(pixel(0,0),blue);
    assert.deepEqual(pixel(255,159),blue);
    assert.deepEqual(pixel(31,32),blue);
    assert.notDeepEqual(pixel(32,32),blue);
    assert.deepEqual(pixel(40,32),blue);
  } finally {host.unloadMedia();}
});

test("bitmap fills bound huge rectangles and preserve packed edge pixels", async () => {
  const work = await mkdtemp(path.join(tmpdir(), "mdlua-fill-"));
  const rom = path.join(work,"fill.bin");
  await buildMd(fileURLToPath(new URL("../examples/bitmap_fill/main.lua",import.meta.url)),rom);
  const host = new LibretroHost({saveDir:work});
  try {
    await host.loadCore(core.jsPath,core.wasmPath);
    await host.loadMedia({platform:"genesis",path:rom});
    host.stepFrames(120);
    const {width,rgba}=host.screenshotRgba();
    const pixel=(x,y)=>Array.from(rgba.slice(((y+32)*width+x+32)*4,((y+32)*width+x+32)*4+3));
    const red=pixel(100,100), green=pixel(11,13), white=pixel(41,40), orange=pixel(44,40), blue=pixel(51,40);
    assert.equal(new Set([red,green,white,orange,blue].map(c=>c.join(","))).size,5,"all five colors must be rendered");
    assert.deepEqual(pixel(80,8),green,"boundary-row pget checks must pass");
    for(let y=0;y<160;y++) for(let x=0;x<256;x++) {
      let expected=red;
      if(x>=11 && x<=30 && y>=13 && y<=30) expected=green;
      if(x>=80 && x<=95 && y>=8 && y<=15) expected=green;
      if(y>=40 && y<=47) {
        if(x===41) expected=white;
        if(x===44) expected=orange;
        if(x>=51 && x<=54) expected=blue;
      }
      assert.deepEqual(pixel(x,y),expected,`fill pixel ${x},${y}`);
    }
    const reference = rgba.slice();
    // Cover several complete transfer cycles, including display edge timing.
    for (let frame=0; frame<12; frame++) {
      host.stepFrames(1);
      const next = host.screenshotRgba().rgba;
      for (let y=0; y<160; y++) {
        const offset=((y+32)*width+32)*4;
        assert.deepEqual(next.slice(offset,offset+256*4),reference.slice(offset,offset+256*4),`stable bitmap row ${y}, frame ${frame}`);
      }
    }
  } finally { host.unloadMedia(); }
});

test("animated bitmap flips remain complete in NTSC and PAL", async () => {
  const work = await mkdtemp(path.join(tmpdir(),"mdlua-bitmap-regions-"));
  const original=path.join(work,"animation.bin");
  await buildMd(fileURLToPath(new URL("../examples/bitmap_animation/main.lua",import.meta.url)),original);
  for (const [region,minFps,maxFps] of [["U",59,61],["E",49,51]]) {
    const bytes=await readFile(original);
    // Genesis region field; ROM checksum covers bytes starting at 0x200.
    bytes.fill(32,0x1f0,0x200);
    bytes[0x1f0]=region.charCodeAt(0);
    const rom=path.join(work,`${region}.bin`);
    await writeFile(rom,bytes);
    const host=new LibretroHost({saveDir:work});
    try {
      await host.loadCore(core.jsPath,core.wasmPath);
      await host.loadMedia({platform:"genesis",path:rom});
      host.stepFrames(120);
      const fps=host.getStatus().coreFps;
      assert.ok(fps>minFps && fps<maxFps,`${region} must select its real video timing, got ${fps}`);
      const colors=new Set();
      for(let frame=0;frame<32;frame++) {
        host.stepFrames(1);
        const {width,height,rgba}=host.screenshotRgba();
        const ox=(width-256)/2, oy=(height-160)/2;
        const pixel=(x,y)=>Array.from(rgba.slice(((y+oy)*width+x+ox)*4,((y+oy)*width+x+ox)*4+3));
        const red=pixel(8,8),green=pixel(24,8),background=pixel(100,100);
        assert.notDeepEqual(red,green,`${region}: reference colors differ`);
        assert.ok([red,green].some(c=>c.every((v,i)=>v===background[i])),`${region}: valid background`);
        colors.add(background.join(","));
        for(let y=0;y<160;y++) for(let x=0;x<256;x++) {
          const expected=y>=8 && y<16 && x>=8 && x<16 ? red : y>=8 && y<16 && x>=24 && x<32 ? green : background;
          assert.deepEqual(pixel(x,y),expected,`${region} frame ${frame}, pixel ${x},${y}`);
        }
      }
      assert.equal(colors.size,2,`${region}: animation must display both buffers' colors`);
    } finally { host.unloadMedia(); }
  }
});

test("real clocks track video interrupts during slow NTSC and PAL drawing", async () => {
  const work=await mkdtemp(path.join(tmpdir(),"mdlua-clocks-"));
  const original=path.join(work,"clock.bin");
  await buildMd(fileURLToPath(new URL("../examples/clock_check/main.lua",import.meta.url)),original);
  for(const [region,min,max] of [["U",59,61],["E",49,51]]) {
    const bytes=await readFile(original);
    bytes.fill(32,0x1f0,0x200); bytes[0x1f0]=region.charCodeAt(0);
    const rom=path.join(work,`${region}.bin`);
    await writeFile(rom,bytes);
    const host=new LibretroHost({saveDir:work});
    try {
      await host.loadCore(core.jsPath,core.wasmPath);
      await host.loadMedia({platform:"genesis",path:rom});
      host.stepFrames(240);
      const fps=host.getStatus().coreFps;
      assert.ok(fps>min && fps<max,`${region} video timing`);
      const {width,height,rgba}=host.screenshotRgba();
      const ox=(width-256)/2,oy=(height-160)/2;
      const pixel=(x,y)=>Array.from(rgba.slice(((y+oy)*width+x+ox)*4,((y+oy)*width+x+ox)*4+3));
      assert.notDeepEqual(pixel(8,8),pixel(24,8));
      assert.deepEqual(pixel(60,50),pixel(8,8),`${region}: slow-loop clock checks must report green`);
    } finally { host.unloadMedia(); }
  }
});

test("SRAM bounds and exported saves survive a fresh emulator load", async () => {
  const work=await mkdtemp(path.join(tmpdir(),"mdlua-sram-"));
  const rom=path.join(work,"save.bin"), saveFile=path.join(work,"save.srm");
  await buildMd(fileURLToPath(new URL("../examples/save_check/main.lua",import.meta.url)),rom);
  for(let session=0;session<2;session++) {
    const host=new LibretroHost({saveDir:work});
    try {
      await host.loadCore(core.jsPath,core.wasmPath);
      await host.loadMedia({platform:"genesis",path:rom});
      assert.ok(host.getStatus().settleFramesUsed<20,"inject SRAM before diagnostic runs");
      // GPGX reports the used SRAM size (zero for erased RAM) after the
      // host's settle frames. Its libretro data pointer still exposes the
      // 64-KiB backing store. Load the exported bytes before Lua tests run.
      // https://github.com/ekeeke/Genesis-Plus-GX/blob/master/libretro/libretro.c
      const ptr=host.mod._retro_get_memory_data(0); // RETRO_MEMORY_SAVE_RAM
      assert.ok(ptr>0,"ROM must advertise battery SRAM");
      const data=session ? await readFile(saveFile) : new Uint8Array(0x10000).fill(255);
      assert.ok(data.length<=0x10000);
      host.mod.HEAPU8.set(data,ptr);
      host.stepFrames(120);
      const {width,rgba}=host.screenshotRgba();
      let lit=false;
      for(let y=0;y<8;y++) {
        const actual=((24+y)*width+8)*4;
        const expected=(((session?56:40)+y)*width+8)*4;
        assert.deepEqual(rgba.slice(actual,actual+96*4),rgba.slice(expected,expected+96*4),`session ${session} status row ${y}`);
        for(let x=0;x<96;x++) if(rgba[actual+x*4]) lit=true;
      }
      assert.ok(lit,"status must contain visible text");
      if(!session) {
        const size=host.regionSize("save_ram");
        assert.ok(size>0,"save data must be exposed for export");
        await writeFile(saveFile,host.readMemory("save_ram",0,size));
      }
    } finally {host.unloadMedia();}
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


test("multiline text matches positioned lines, clipping and cursor advancement", async () => {
  const work = await mkdtemp(path.join(tmpdir(), "mdlua-multiline-"));
  for (const bitmap of [false, true]) {
    const source = path.join(work, bitmap ? "bitmap.lua" : "hardware.lua");
    const rom = source.replace(".lua", ".bin");
    await writeFile(source, `function ${bitmap ? "_draw" : "_init"}()
  cls(0)
  ${bitmap ? "pset(0,0,0)" : "hud(2)"}
  print([[A\r\nB]],16,8,7)
  print("A",80,8,7)
  print("B",80,16,7)
  print([[A\n\nB\n]],16,40,7)
  print("A",80,40,7)
  print("B",80,56,7)
  print([[A\nB]],16,-8,7)
  print("B",80,0,7)
  print([[${"A".repeat(50)}\nB]],16,80,7)
  print("B",80,88,7)
  print([[A\r\nB]],7)
  print("C",7)
  print("A",112,0,7)
  print("B",112,8,7)
  print("C",112,16,7)
  print("AB",-8,112,7)
  print("B",80,112,7)
  print([[ ${"\n".repeat(bitmap ? 16 : 24)}]],7)
  print("Z",7)
  print("Z",112,0,7)
end
${bitmap ? "" : "function _draw() end"}
`);
    await buildMd(source, rom);
    const host = new LibretroHost({ saveDir: work });
    try {
      await host.loadCore(core.jsPath, core.wasmPath);
      await host.loadMedia({ platform: "genesis", path: rom });
      host.stepFrames(120);
      const { width, rgba } = host.screenshotRgba();
      const offset = bitmap ? 32 : 0;
      const pixel = (x,y) => Array.from(rgba.slice(((y+offset)*width+x+offset)*4,((y+offset)*width+x+offset)*4+3));
      let lit = 0;
      for (const [actualX, actualY, refX, refY] of [
        [16,0,80,0], [16,8,80,8], [16,16,80,16],
        [16,40,80,40], [16,56,80,56], [16,88,80,88],
        [0,0,112,0], [0,8,112,8], [0,16,112,16], [0,112,80,112],
      ]) for (let y=0;y<8;y++) for(let x=0;x<8;x++) {
        const actual = pixel(actualX+x,actualY+y);
        assert.deepEqual(actual,pixel(refX+x,refY+y),`${bitmap ? "bitmap" : "hardware"} at ${actualX+x},${actualY+y}`);
        if (actual.some(v=>v)) lit++;
      }
      assert.ok(lit > 0, "comparison must contain visible glyphs");
      for(let y=48;y<56;y++) for(let x=16;x<24;x++)
        assert.deepEqual(pixel(x,y),pixel(200,140),"blank line remains empty");
    } finally { host.unloadMedia(); }
  }
});
