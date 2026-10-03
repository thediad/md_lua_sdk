import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { mappedPath } from "../compiler/native-toolchain.mjs";

test("native tool paths stay inside their isolated build directory", () => {
  const root = path.resolve("native-test-root");
  assert.equal(mappedPath(root, "/work/main.c"), path.join(root, "main.c"));
  assert.equal(mappedPath(root, "/work/out/main.o"), path.join(root, "out", "main.o"));
  assert.throws(() => mappedPath(root, "/tmp/main.c"), /Unexpected tool path/);
  assert.throws(() => mappedPath(root, "/work/../escape"), /Unsafe tool path/);
  assert.throws(() => mappedPath(root, "/work/bad\\name"), /Unsafe tool path/);
});
