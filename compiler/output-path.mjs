import path from "node:path";
import { stat } from "node:fs/promises";

async function existingFile(file) {
  try { return await stat(file, { bigint: true }); }
  catch (error) {
    if (error.code === "ENOENT" || error.code === "ENOTDIR") return null;
    throw error;
  }
}

// stat follows symlinks; device/inode identity also catches hard-link aliases.
export async function assertOutputDistinct(outPath, inputs) {
  const output = path.resolve(outPath);
  const normalized = file => process.platform === "win32" ? file.toLowerCase() : file;
  const files = inputs.filter(Boolean).map(file => path.resolve(file));
  const fail = file => { throw new Error(`ROM output would overwrite an input file: ${file}`); };
  for (const file of files) if (normalized(file) === normalized(output)) fail(file);
  const outputStat = await existingFile(output);
  if (!outputStat) return;
  for (const file of files) {
    const inputStat = await existingFile(file);
    if (inputStat && inputStat.ino !== 0n && inputStat.dev === outputStat.dev && inputStat.ino === outputStat.ino) fail(file);
  }
}
