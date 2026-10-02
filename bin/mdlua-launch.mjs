#!/usr/bin/env node
// Node 22 on the native PicoCalc host does not expose registerHooks. The
// absolute-drive import workaround is Windows-only, so do not load or parse it
// on other platforms.
if (process.platform === "win32") await import("./windows-paths.mjs");
await import("./mdlua.js");
