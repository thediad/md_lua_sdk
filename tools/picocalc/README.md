# PicoCalc mdedit integration

These files extend the existing Nano-based `mdedit` workflow without changing
Nano itself. `F7` saves the current buffer, runs `mdlua check`, displays the
result for six seconds, refreshes the screen, and returns to the same editor
session automatically.

`F6` saves and selects the identifier under the cursor, pipes that selection to
`mdedit-help.sh`, displays `mdapi` output for eight seconds, restores the exact
selection, undoes the transient filter operation, and refreshes Nano. `F8`
retains the suspend-and-browse workflow for `mdlookup` and broader searches.
Exact F6 lookups read pre-rendered 38-column quick-reference cards from
`api-help-cache`, so they do not start Node or overflow the display with full
parameter notes. Generate that directory with `build-help-cache.mjs`; unknown
names retain the slower `mdapi` fallback and its search suggestions.

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
