import path from "node:path";
import { randomUUID } from "node:crypto";
import { mkdir, open, rename, unlink } from "node:fs/promises";

export async function writeRom(outPath, rom) {
  const output = path.resolve(outPath);
  const parent = path.dirname(output);
  await mkdir(parent, { recursive: true });
  // Same directory keeps the final rename on the output filesystem.
  const temporary = path.join(parent, `.mdlua-rom-${randomUUID()}.tmp`);
  const file = await open(temporary, "wx");
  try {
    try { await file.writeFile(rom); }
    finally { await file.close(); }
    await rename(temporary, output);
  } finally {
    // Remove only this invocation's temporary file; never the prior ROM.
    await unlink(temporary).catch(error => {
      if (error.code !== "ENOENT") throw error;
    });
  }
}
