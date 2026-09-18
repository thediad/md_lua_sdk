import {test} from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,writeFile,readdir} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {execFile} from "node:child_process";
import {promisify} from "node:util";

const launcher=fileURLToPath(new URL("../bin/mdlua-launch.mjs",import.meta.url));
const run=(args,cwd)=>promisify(execFile)(process.execPath,[launcher,...args],{cwd});

test("CLI help succeeds without loading a project or creating files",async()=>{
  const cwd=await mkdtemp(path.join(tmpdir(),"mdlua-help-"));
  await writeFile(path.join(cwd,"mdlua.json"),"invalid config");
  for(const args of [[],["--help"],["-h"],["help"],["help","build"],["build","--help"],["run","-h"],["init","--help"],["c","--help"]]) {
    const {stdout,stderr}=await run(args,cwd);
    assert.match(stdout,/Usage: mdlua/);
    assert.equal(stderr,"");
  }
  assert.deepEqual(await readdir(cwd),["mdlua.json"]);
  await assert.rejects(run(["help","missing"],cwd),e=>e.code===1 && /unknown help topic/.test(e.stderr));
  await assert.rejects(run(["missing"],cwd),e=>e.code===1 && /unknown command/.test(e.stderr));
});

test("generated-C command separates output and readable diagnostics",async()=>{
  const cwd=await mkdtemp(path.join(tmpdir(),"mdlua-c-"));
  const source=path.join(cwd,"main.lua");
  await writeFile(source,"function _draw() end");
  const result=await run(["c",source],cwd);
  assert.match(result.stdout,/#include "md_api.h"/);
  assert.equal(result.stderr,"");
  for(const args of [["c"],["c",source,"extra.lua"],["c","--unknown"],["c","missing.lua"]]) {
    await assert.rejects(run(args,cwd),e=>{
      assert.equal(e.code,1);
      assert.equal(e.stdout,"");
      assert.doesNotMatch(e.stderr,/\n\s+at /);
      return true;
    });
  }
  await writeFile(source,"local =");
  await assert.rejects(run(["c",source],cwd),e=>e.code===1 && e.stdout==="" && e.stderr.startsWith(`${source}:1:`));
});
