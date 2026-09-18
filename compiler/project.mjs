import path from "node:path";
import { assertOutputDistinct } from "./output-path.mjs";
import { readFile } from "node:fs/promises";

const options = {
  "--sheet": "sheet", "--map": "map", "--gff": "gff",
  "--sprite-variants": "spriteVariants", "--sfx": "sfx", "--music": "music",
  "-o": "out", "--project": "project",
};
const keys = new Set(["entry", "out", "sheet", "map", "gff", "spriteVariants", "sfx", "music"]);

export async function resolveBuild(args, cwd = process.cwd()) {
  const overrides = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith("-")) {
      const key = options[arg];
      if (!key) throw new Error(`unknown build option: ${arg}`);
      const value = args[++i];
      if (!value || value.startsWith("-")) throw new Error(`${arg} requires a value`);
      overrides[key] = key === "sfx" || key === "music" ? value.split(",") : value;
      if (Array.isArray(overrides[key]) && overrides[key].some(p => !p.trim())) throw new Error(`${arg} contains an empty path`);
    } else {
      if (overrides.entry) throw new Error("build accepts one Lua entry file");
      overrides.entry = arg;
    }
  }
  const configPath = path.resolve(cwd, overrides.project ?? "mdlua.json");
  const configError = (message, line = 1, column = 1) =>
    new Error(`${configPath}:${line}:${column}: error: ${message.replace(/\r?\n/g, " ")}`);
  let config = {};
  try {
    const text = (await readFile(configPath, "utf8")).replace(/^\uFEFF/, "");
    try { config = JSON.parse(text); }
    catch (error) {
      const location = /line (\d+) column (\d+)/.exec(error.message);
      throw configError(`invalid project JSON: ${error.message}`, location ? Number(location[1]) : 1, location ? Number(location[2]) : 1);
    }
  } catch (error) {
    if (error.code !== "ENOENT" || overrides.project) {
      if (error.message.startsWith(`${configPath}:`)) throw error;
      throw configError(error.message);
    }
  }
  if (!config || typeof config !== "object" || Array.isArray(config)) throw configError("project configuration must contain an object");
  for (const [key, value] of Object.entries(config)) {
    if (!keys.has(key)) throw configError(`unknown project setting: ${key}`);
    const paths = key === "sfx" || key === "music" ? value : [value];
    if (!Array.isArray(paths) || paths.some(p => typeof p !== "string" || !p.trim())) throw configError(`invalid project setting: ${key}`);
  }
  const resolved = {};
  for (const key of keys) {
    const value = overrides[key] ?? config[key];
    if (value === undefined) continue;
    const base = overrides[key] !== undefined ? cwd : path.dirname(configPath);
    resolved[key] = Array.isArray(value) ? value.map(p => path.resolve(base, p)) : path.resolve(base, value);
  }
  resolved.entry ??= path.resolve(path.dirname(configPath), "main.lua");
  resolved.out ??= path.join(path.dirname(resolved.entry), "game.bin");
  await assertOutputDistinct(resolved.out, [configPath, resolved.entry, resolved.sheet,
    resolved.map, resolved.gff, resolved.spriteVariants, ...(resolved.sfx ?? []), ...(resolved.music ?? [])]);
  return {
    entry: resolved.entry, out: resolved.out,
    assets: { sheetPath: resolved.sheet, mapPath: resolved.map, gffPath: resolved.gff,
      spriteVariantsPath: resolved.spriteVariants, sfxPaths: resolved.sfx, musicPaths: resolved.music },
  };
}
