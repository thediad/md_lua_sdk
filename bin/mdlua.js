#!/usr/bin/env node
// mdlua — PICO-8-flavored Lua -> Sega Mega Drive / Genesis ROM.
//   mdlua build <main.lua> [-o game.bin]
//   mdlua c <main.lua>          print the generated C (debugging)
import path from "node:path";
import { readFile } from "node:fs/promises";
import { buildMd } from "../compiler/build-md.mjs";
import { compile, formatDiagnostics } from "../compiler/index.js";
import { prepareRun } from "../compiler/run-project.mjs";
import { resolveBuild } from "../compiler/project.mjs";

const [cmd, ...rest] = process.argv.slice(2);
const fail = (m) => { console.error(m); process.exit(1); };

if (cmd === "build") {
  try {
    const { entry, out, assets } = await resolveBuild(rest);
    const r = await buildMd(entry, out, assets);
    const { statSync } = await import("node:fs");
    console.log(`${r.outPath} (${statSync(r.outPath).size} bytes)`);
    if (r.spriteVariants.variants.length) {
      console.log(`Pre-scaled sprites: ${r.spriteVariants.bytes} graphics bytes in ROM and VRAM; base sheet ${r.spriteVariants.sheetBytes} bytes; one hardware sprite per draw.`);
      for (const v of r.spriteVariants.variants) console.log(`  ${v.id}: ${v.source.join(",")} -> ${v.size.join("x")}: ${v.bytes} bytes`);
    }
  } catch (e) { fail(String(e.message ?? e)); }
} else if (cmd === "run") {
  try {
    const rom = await prepareRun(rest);
    const { runRom } = await import("./mdlua-run.mjs");
    await runRom(rom);
  } catch (e) {
    if (e.code === "SDL_UNAVAILABLE") fail("@kmamal/sdl not available - install it or run the .bin in any Genesis emulator");
    fail(String(e.message ?? e));
  }
} else if (cmd === "c") {
  if (!rest[0]) fail("usage: mdlua c <main.lua>");
  const src = await readFile(rest[0], "utf8");
  const res = compile(src, path.basename(rest[0]), { target: "md" });
  if (!res.ok) fail(formatDiagnostics(res.diagnostics.filter((d) => d.severity === "error")));
  process.stdout.write(res.c + "\n");
} else {
  fail("usage: mdlua build [main.lua] [--project mdlua.json] [--sheet s.png] [--sprite-variants variants.json] [--gff sprites.gff] [--map m.png] [--sfx a.wav,b.wav] [--music a.vgm,b.vgm] [-o game.bin]\n       mdlua run [main.lua] [same build flags] | mdlua run game.bin\n       mdlua c <main.lua>");
}
