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
