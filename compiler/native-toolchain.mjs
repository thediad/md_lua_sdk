import { access, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { pathToFileURL } from "node:url";

const exec = promisify(execFile);

export function mappedPath(root, virtual) {
  if (virtual !== "/work" && !virtual.startsWith("/work/")) throw new Error(`Unexpected tool path: ${virtual}`);
  const suffix = virtual.slice(5);
  if (suffix.split("/").some(part => part === "..") || suffix.includes("\\")) throw new Error(`Unsafe tool path: ${virtual}`);
  return path.join(root, suffix);
}

export async function nativeEnvironment({ packageRoot, toolchainRoot, workRoot }) {
  const load = relative => import(pathToFileURL(path.join(packageRoot, relative)).href);
  const { dirShare } = await load("build/common/share-fs.js");
  const { hashSources } = await load("build/common/sdk-cache.js");
  const share = dirShare(path.join(packageRoot, "share/genesis/lib"));
  const sources = {};
  for (const prefix of ["sgdk/src", "sgdk/res"]) {
    for (const relative of await share.list(prefix)) {
      if (/\.(c|s|s80|h|inc|i80|res)$/i.test(relative)) sources[relative] = await share.text(relative);
    }
  }
  await share.bytes("sgdk/libmd.seed.a");
  const expected = (await share.text("sgdk/libmd.seed.hash")).trim();
  if (await hashSources(sources) !== expected) throw new Error("SGDK seed source hash mismatch; native build stopped without rebuilding SGDK");

  const root = path.resolve(toolchainRoot);
  const tools = {
    cc1: path.join(root, "libexec/gcc/m68k-elf/14.2.0/cc1"),
    as: path.join(root, "bin/m68k-elf-as"),
    ld: path.join(root, "bin/m68k-elf-ld"),
    objcopy: path.join(root, "bin/m68k-elf-objcopy"),
  };
  for (const executable of Object.values(tools)) await access(executable, constants.X_OK);
  await mkdir(workRoot, { recursive: true });
  const buildDir = await mkdtemp(path.join(path.resolve(workRoot), "native-build-"));
  process.stderr.write(`Native build evidence: ${buildDir}\n`);
  let sequence = 0;

  return {
    share,
    hash: hashSources,
    loadGlue() { throw new Error("Z80/SGDK source rebuild is disabled in the native experiment"); },
    async runTool(job) {
      const executable = tools[job.tool];
      if (!executable) throw new Error(`Unsupported native tool: ${job.tool}`);
      const directory = path.join(buildDir, `${String(++sequence).padStart(2, "0")}-${job.tool}`);
      await mkdir(directory);
      for (const file of job.inputFiles) {
        const filename = mappedPath(directory, file.vfsPath);
        await mkdir(path.dirname(filename), { recursive: true });
        await writeFile(filename, file.data, file.encoding);
      }
      const argv = job.argv.map(argument => argument.startsWith("/work") ? mappedPath(directory, argument)
        : argument.startsWith("-Map=/work") ? `-Map=${mappedPath(directory, argument.slice(5))}` : argument);
      await writeFile(path.join(directory, "command.json"), JSON.stringify({ executable, argv }, null, 2));
      let exitCode = 0;
      let log = "";
      const started = Date.now();
      try {
        const result = await exec(executable, argv, { cwd: directory, timeout: 180000, maxBuffer: 4 * 1024 * 1024 });
        log = result.stdout + result.stderr;
      } catch (error) {
        exitCode = Number.isInteger(error.code) ? error.code : 1;
        log = (error.stdout ?? "") + (error.stderr ?? "") + `\n${error.message}`;
      }
      await writeFile(path.join(directory, "result.json"), JSON.stringify({ exitCode, milliseconds: Date.now() - started, log }, null, 2));
      const outputs = {};
      if (exitCode === 0) {
        for (const file of job.outputFiles) outputs[file.vfsPath] = (await readFile(mappedPath(directory, file.vfsPath))).toString(file.encoding);
      }
      return { exitCode, log, outputs };
    },
  };
}
