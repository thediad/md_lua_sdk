import path from "node:path";
import { buildMd } from "./build-md.mjs";
import { resolveBuild } from "./project.mjs";

// Keep build preparation separate from opening the optional emulator window.
export async function prepareRun(args, cwd = process.cwd(), build = buildMd) {
  if (args.length === 1 && !args[0].startsWith("-") && /\.bin$/i.test(args[0])) {
    return path.resolve(cwd, args[0]);
  }
  const { entry, out, assets } = await resolveBuild(args, cwd);
  if (!/\.lua$/i.test(entry)) throw new Error("run accepts a Lua entry file, or a .bin ROM without build options");
  const result = await build(entry, out, assets);
  return result.outPath;
}
