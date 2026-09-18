import {readFile} from "node:fs/promises";
import {execFile} from "node:child_process";
import {promisify} from "node:util";
import path from "node:path";
import {fileURLToPath} from "node:url";

export function releaseIssues(manifest, files) {
  const issues=[];
  const compiler=manifest.dependencies?.luacretro ?? "";
  const exactVersion=/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
  const gitRevision=/^(?:git\+https:\/\/|https:\/\/|github:)[^\s#]+#[a-f0-9]{40}$/i;
  if (!exactVersion.test(compiler) && !gitRevision.test(compiler))
    issues.push("luacretro must use an exact published version or full HTTPS Git revision; the sibling development dependency is not distributable.");
  const names=new Set(files.map(file=>file.path));
  for(const required of ["package.json","bin/mdlua-launch.mjs","bin/windows-paths.mjs",
    "bin/mdlua.js","bin/help.mjs","compiler/index.js","compiler/build-md.mjs",
    "md-sdk/md_api.c","md-sdk/md_api.h","md-sdk/md_math.c","md-sdk/md_math.h",
    "docs/DEVELOPMENT_GUIDE.md","docs/NUMERIC_BEHAVIOR.md"]) {
    if(!names.has(required))issues.push(`Package is missing ${required}.`);
  }
  for(const name of names) {
    if(/^examples\/.*\/build\//.test(name))issues.push(`Generated example output must not ship: ${name}.`);
  }
  return issues;
}

async function main() {
  const root=fileURLToPath(new URL("../",import.meta.url));
  const manifest=JSON.parse(await readFile(path.join(root,"package.json"),"utf8"));
  const npm=process.env.npm_execpath;
  if(!npm)throw new Error("Run this check with npm run release:check.");
  const {stdout}=await promisify(execFile)(process.execPath,
    [npm,"pack","--dry-run","--json","--ignore-scripts"],{cwd:root,maxBuffer:8*1024*1024});
  const [packed]=JSON.parse(stdout);
  const issues=releaseIssues(manifest,packed.files);
  console.log(`Package audit: ${packed.files.length} files, ${packed.size} packed bytes.`);
  if(issues.length) {
    for(const issue of issues)console.error(`BLOCKED: ${issue}`);
    process.exitCode=1;
  } else console.log("Static package checks passed. Remote availability, clean installation and release approval still require verification.");
}

if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  main().catch(error=>{console.error(error.message);process.exitCode=1;});
}
