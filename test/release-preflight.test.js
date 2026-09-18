import {test} from "node:test";
import assert from "node:assert/strict";
import {releaseIssues} from "../tools/release-preflight.mjs";

const files=["package.json","bin/mdlua-launch.mjs","bin/windows-paths.mjs",
  "bin/mdlua.js","bin/help.mjs","compiler/index.js","compiler/build-md.mjs",
  "md-sdk/md_api.c","md-sdk/md_api.h","md-sdk/md_math.c","md-sdk/md_math.h",
  "docs/DEVELOPMENT_GUIDE.md","docs/NUMERIC_BEHAVIOR.md"].map(path=>({path}));
const manifest=spec=>({dependencies:{luacretro:spec}});

test("release preflight rejects development or floating compiler dependencies",()=>{
  for(const spec of [undefined,"file:../../luacretro","workspace:*","^0.1.1","latest",
    "git+https://github.com/thediad/luacretro.git#gtlua-compiler-sync"])
    assert.match(releaseIssues(manifest(spec),files).join("\n"),/exact published version/);
});
test("release preflight accepts immutable spec shapes without claiming remote availability",()=>{
  for(const spec of ["0.1.1","0.2.0-rc.1","git+https://github.com/thediad/luacretro.git#"+"a".repeat(40)])
    assert.deepEqual(releaseIssues(manifest(spec),files),[]);
});
test("release preflight detects missing runtime files and generated ROM output",()=>{
  const changed=files.filter(file=>file.path!=="md-sdk/md_math.c");
  changed.push({path:"examples/hello/build/hello.bin"});
  const issues=releaseIssues(manifest("0.1.1"),changed);
  assert.equal(issues.length,2);
  assert.match(issues.join("\n"),/missing md-sdk\/md_math.c/);
  assert.match(issues.join("\n"),/Generated example output/);
});
