import path from "node:path";
import { randomUUID } from "node:crypto";
import { readFile, rename, stat, unlink, writeFile } from "node:fs/promises";

const singles = new Map([
  ["sheet", [".png"]], ["map", [".png"]], ["gff", [".gff"]],
  ["spriteVariants", [".json"]],
]);
const lists = new Map([["music", [".vgm", ".vgz", ".xgc"]], ["sfx", [".wav"]]]);

function parseArgs(args, cwd) {
  const remaining = [];
  let manifest = path.resolve(cwd, "mdlua.json");
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--project") {
      const value = args[++i];
      if (!value || value.startsWith("-")) throw new Error("--project requires a value");
      manifest = path.resolve(cwd, value);
    } else remaining.push(args[i]);
  }
  return { manifest, remaining };
}

async function loadManifest(file) {
  let text;
  try { text = (await readFile(file, "utf8")).replace(/^\uFEFF/, ""); }
  catch (error) {
    if (error.code === "ENOENT") throw new Error(`project manifest not found: ${file}`);
    throw error;
  }
  let config;
  try { config = JSON.parse(text); }
  catch (error) { throw new Error(`invalid project JSON: ${error.message}`); }
  if (!config || typeof config !== "object" || Array.isArray(config)) throw new Error("project configuration must contain an object");
  return config;
}

async function assetPath(manifest, key, value, extensions, cwd) {
  if (!value || value.startsWith("-")) throw new Error(`${key} requires an asset path`);
  const absolute = path.resolve(cwd, value);
  const info = await stat(absolute).catch(error => {
    if (error.code === "ENOENT") throw new Error(`asset not found: ${absolute}`);
    throw error;
  });
  if (!info.isFile()) throw new Error(`asset is not a regular file: ${absolute}`);
  if (!extensions.includes(path.extname(absolute).toLowerCase())) {
    throw new Error(`${key} expects ${extensions.join(" or ")}: ${absolute}`);
  }
  const relative = path.relative(path.dirname(manifest), absolute);
  return relative && !path.isAbsolute(relative) ? relative.replaceAll("\\", "/") : absolute.replaceAll("\\", "/");
}

async function saveManifest(file, config) {
  const temporary = path.join(path.dirname(file), `.mdlua-project-${randomUUID()}.tmp`);
  await writeFile(temporary, JSON.stringify(config, null, 2) + "\n", { flag: "wx" });
  try { await rename(temporary, file); }
  finally { await unlink(temporary).catch(error => { if (error.code !== "ENOENT") throw error; }); }
}

export async function editProject(args, cwd = process.cwd()) {
  const { manifest, remaining } = parseArgs(args, cwd);
  const action = remaining.shift() ?? "show";
  const config = await loadManifest(manifest);
  if (action === "show") {
    if (remaining.length) throw new Error("usage: mdlua project show [--project FILE]");
    return { manifest, config, changed: false };
  }
  const key = remaining.shift();
  if (action === "set") {
    if (!singles.has(key) || remaining.length !== 1) throw new Error("usage: mdlua project set <sheet|map|gff|spriteVariants> <file>");
    if (config[key] !== undefined) throw new Error(`${key} is already registered; remove it before replacing it`);
    config[key] = await assetPath(manifest, key, remaining[0], singles.get(key), cwd);
  } else if (action === "unset") {
    if (!singles.has(key) || remaining.length) throw new Error("usage: mdlua project unset <sheet|map|gff|spriteVariants>");
    if (config[key] === undefined) throw new Error(`${key} is not registered`);
    delete config[key];
  } else if (action === "add") {
    if (!lists.has(key) || remaining.length !== 1) throw new Error("usage: mdlua project add <music|sfx> <file>");
    const value = await assetPath(manifest, key, remaining[0], lists.get(key), cwd);
    const current = config[key] ?? [];
    if (!Array.isArray(current)) throw new Error(`${key} project setting must be an array`);
    if (current.includes(value)) throw new Error(`${key} asset is already registered: ${value}`);
    config[key] = [...current, value];
  } else if (action === "remove") {
    if (!lists.has(key) || remaining.length !== 1 || !/^[1-9]\d*$/.test(remaining[0])) throw new Error("usage: mdlua project remove <music|sfx> <number>");
    const current = config[key];
    const index = Number(remaining[0]) - 1;
    if (!Array.isArray(current) || index >= current.length) throw new Error(`${key} asset number is not registered: ${remaining[0]}`);
    current.splice(index, 1);
    if (!current.length) delete config[key];
  } else throw new Error(`unknown project action: ${action}`);
  await saveManifest(manifest, config);
  return { manifest, config, changed: true };
}

export function formatProject({ manifest, config }) {
  const lines = [`Project: ${manifest}`, `  entry: ${config.entry ?? "main.lua"}`, `  out: ${config.out ?? "game.bin"}`];
  for (const key of singles.keys()) lines.push(`  ${key}: ${config[key] ?? "(none)"}`);
  for (const key of lists.keys()) {
    const values = config[key] ?? [];
    lines.push(`  ${key}: ${values.length ? "" : "(none)"}`);
    values.forEach((value, index) => lines.push(`    ${index + 1}. ${value}`));
  }
  return lines.join("\n");
}
