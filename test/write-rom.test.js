import {test} from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,readFile,writeFile,readdir,mkdir} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import {writeRom} from "../compiler/write-rom.mjs";

test("ROM replacement writes complete bytes and leaves no temporary files",async()=>{
  const work=await mkdtemp(path.join(tmpdir(),"mdlua-rom-write-"));
  const out=path.join(work,"build","game.bin");
  await writeRom(out,Buffer.alloc(1024,42));
  const replacement=Buffer.alloc(32768,99);
  await writeRom(out,replacement);
  assert.deepEqual(await readFile(out),replacement);
  assert.deepEqual(await readdir(path.dirname(out)),["game.bin"]);
});

test("failed ROM writes and replacement preserve existing data and clean temporary files",async()=>{
  const work=await mkdtemp(path.join(tmpdir(),"mdlua-rom-failure-"));
  const out=path.join(work,"game.bin");
  await writeFile(out,"previous ROM");
  // Reject after the temporary file has been opened, exercising write cleanup.
  await assert.rejects(writeRom(out,{invalid:"data"}),TypeError);
  async function* interrupted() {
    yield Buffer.from("partial replacement bytes");
    throw new Error("simulated write interruption");
  }
  await assert.rejects(writeRom(out,interrupted()),/simulated write interruption/);
  assert.equal(await readFile(out,"utf8"),"previous ROM");
  assert.deepEqual(await readdir(work),["game.bin"]);
  const directory=path.join(work,"occupied.bin");
  await mkdir(directory);
  await writeFile(path.join(directory,"keep"),"user file");
  await assert.rejects(writeRom(directory,Buffer.from("new ROM")));
  assert.equal(await readFile(path.join(directory,"keep"),"utf8"),"user file");
  assert.equal(await readFile(out,"utf8"),"previous ROM");
  assert.deepEqual((await readdir(work)).sort(),["game.bin","occupied.bin"]);
});
