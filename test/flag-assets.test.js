import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { flagsAssetHeader } from "../compiler/asset-headers.mjs";
import { buildMd } from "../compiler/build-md.mjs";

test("flag assets preserve all 256 bytes and reject partial or oversized input", () => {
  const flags = Uint8Array.from({length:256}, (_,i)=>i);
  const header = flagsAssetHeader(flags);
  assert.deepEqual(header.match(/\{([^}]+)\}/)[1].split(",").map(Number),Array.from(flags));
  for (const size of [0,255,257,512]) assert.throws(()=>flagsAssetHeader(new Uint8Array(size)),/exactly 256/);
});

test("build rejects invalid flag assets before invoking the toolchain", async () => {
  const work = await mkdtemp(path.join(tmpdir(),"mdlua-flags-"));
  const source = path.join(work,"main.lua"), gffPath = path.join(work,"bad.gff");
  await writeFile(source,"function _draw() end");
  await writeFile(gffPath,new Uint8Array(255));
  await assert.rejects(buildMd(source,path.join(work,"bad.bin"),{gffPath}),/exactly 256 sprite-flag bytes; got 255/);
});
