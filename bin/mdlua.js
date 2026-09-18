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
import { helpText } from "./help.mjs";
import { initProject } from "../compiler/init-project.mjs";

const [cmd, ...rest] = process.argv.slice(2);
const fail = (m) => { console.error(m); process.exit(1); };

if (cmd === undefined || ["help", "--help", "-h"].includes(cmd)) {
  try {
    if (rest.length > 1) throw new Error("usage: mdlua help [command]");
    console.log(helpText(rest[0]));
  } catch (e) { fail(String(e.message ?? e)); }
} else if (rest.includes("--help") || rest.includes("-h")) {
  try { console.log(helpText(cmd)); }
  catch (e) { fail(String(e.message ?? e)); }
} else if (cmd === "init") {
  try {
    const directory = await initProject(rest);
    console.log(`Created ${directory}\nOpen its README.md for build and run instructions.`);
  } catch (e) { fail(String(e.message ?? e)); }
} else if (cmd === "build") {
  try {
    const { entry, out, assets } = await resolveBuild(rest);
    const r = await buildMd(entry, out, assets);
    const { statSync } = await import("node:fs");
    console.log(`${r.outPath} (${statSync(r.outPath).size} bytes)`);
    const g = r.graphics;
    console.log(`Graphics tiles (default hardware layout): ${g.totalTiles}/${g.capacityTiles} used, ${g.freeTiles} free (${g.bytes} bytes used).`);
    console.log(`  ${g.fallbackSheet ? "Fallback sheet" : "Sheet"}: ${g.sheetTiles}; map: ${g.mapTiles}; pre-scaled: ${g.variantTiles}.`);
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
  try {
    if (rest.length !== 1 || rest[0].startsWith("-")) throw new Error("usage: mdlua c <main.lua>");
    const source = path.resolve(rest[0]);
    const src = await readFile(source, "utf8");
    const res = compile(src, path.basename(source), { target: "md" });
    const diagnostics = res.diagnostics.map(d => ({ ...d, file: source }));
    const warnings = diagnostics.filter(d => d.severity === "warning");
    if (warnings.length) console.error(formatDiagnostics(warnings));
    if (!res.ok) throw new Error(formatDiagnostics(diagnostics.filter(d => d.severity === "error")));
    process.stdout.write(res.c + "\n");
  } catch (e) { fail(String(e.message ?? e)); }
} else {
  fail(`unknown command: ${cmd}\nUse mdlua --help for usage.`);
}
