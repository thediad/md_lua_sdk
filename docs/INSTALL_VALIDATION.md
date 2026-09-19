# Isolated installation checkpoint

Verified on Windows, 2026-09-19, using Node 24+ and npm 11.9.0.
SDK source: 790c99c. Canonical compiler source: d8c37f8.

## What was installed

`npm pack --ignore-scripts` produced local SDK and compiler archives from the
reviewed checkouts. They were installed under
`C:\dev\release-validation\numeric-checkpoint`, using this private test manifest:

```json
{
  "name": "mdlua-release-validation",
  "version": "0.0.0",
  "private": true,
  "dependencies": { "mdlua": "file:./mdlua-0.3.1.tgz" },
  "overrides": { "luacretro": "file:./luacretro-0.1.1.tgz" }
}
```

The override replaces the SDK's development sibling dependency only for this
test installation. It is not a release manifest or a published version claim.
Installation used `npm install --ignore-scripts --no-audit --no-fund` with a cache
under `C:\dev`. Twenty packages installed. The compiler is a real directory,
not a link to the sibling checkout; its checker hash matches the packed source.

## Checks completed

- Installed `mdlua.cmd init clean-game` created the starter and VS Code tasks.
- Installed CLI built the new project into a 524288-byte ROM.
- Generated VS Code process task pointed to the installed SDK and built the ROM.
- Invalid Lua through installed `mdlua c` exited with code 1 and an absolute
  source/line diagnostic.
- Example build outputs are excluded from the package; source assets are included.

No GUI runner or physical hardware check was performed for this installation.
The optional SDL runner is not required to build a ROM.

## Still required before release

A read-only remote lookup found `gtlua-compiler-sync` at 74ca7d0, older than the
required compiler. Publish the reviewed compiler revision through an explicit
release decision, choose a verified immutable dependency, then repeat installation
without the local override. The final remote-dependency smoke test remains open.
