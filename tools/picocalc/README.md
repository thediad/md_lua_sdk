# PicoCalc mdedit integration

These files extend the existing Nano-based `mdedit` workflow without changing
Nano itself. `F7` saves the current buffer, runs `mdlua check`, displays the
result for six seconds, refreshes the screen, and returns to the same editor
session automatically.

Project source/output resolution is cached in `~/.mdedit-resolved`, keyed by
the manifest path and SHA-256 content hash. The first launch after changing
`mdlua.json` uses one Node process; unchanged projects reuse the cached paths.

The launcher must export these values before starting Nano:

```sh
export MDEDIT_SOURCE="$source"
export MDEDIT_MANIFEST="$manifest"
```

Install `mdedit-check.sh` beside the existing native workflow helpers and use
`mdedit.nanorc` as Nano's `--rcfile`. Back up deployed files before replacing
them; trial the binding separately before promotion.
