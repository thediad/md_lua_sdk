# Shared compiler development

The `luacretro-sync-test` branch uses `file:../../luacretro` rather than the
published compiler. Keep `dev/luacretro` on `gtlua-compiler-sync` alongside
`dev/genesis/md_lua_sdk`:

```sh
git -C ../../luacretro switch gtlua-compiler-sync
npm install --ignore-scripts
npm ls luacretro
npm test
```

On PowerShell, use `npm.cmd`. The installed compiler is linked to the sibling
checkout, so edits there take effect without a transplant or loader override.
Keep the SDK's builtins, target descriptor, and C runtime in this repository.

The shared map special passes a ninth C argument (the layer mask), which
`md_map` currently ignores. PICO `mget` retains direct array reads; the Genesis
hardware `md_mget(layer, col, row)` has a different ABI and must not receive a
PICO map pointer.

This is a development dependency. Before publishing, pin a tested release or
an immutable Git commit accessible to consumers and regenerate the lockfile.

On Windows, the pinned external m68k toolchain currently imports absolute
filesystem paths as ESM specifiers. Its ROM build tests need a path-to-file-URL
workaround until that package is fixed; the compiler tests do not need one.
