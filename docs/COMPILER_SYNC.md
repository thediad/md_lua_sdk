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

SDK descriptor hooks pass the PICO map pointer and its actual byte length to
`md_p8_map`, `md_p8_mget`, and `md_p8_mset`. This keeps bounds and mutable map
storage in the Genesis runtime. The hardware `md_mget(layer, col, row)` API
remains separate. See `PICO_RUNTIME.md` for limits and diagnostic ROMs.

This is a development dependency. Before publishing, pin a tested release or
an immutable Git commit accessible to consumers and regenerate the lockfile.

On Windows, the pinned external m68k toolchain currently imports absolute
filesystem paths as ESM specifiers. Its ROM build tests need a path-to-file-URL
workaround until that package is fixed; the compiler tests do not need one.
