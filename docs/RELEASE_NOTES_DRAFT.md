# Standalone release candidate notes

Status: draft, unpublished. Suggested candidate version: **0.4.0-rc.1**.
The package manifest is intentionally unchanged until dependency pinning and
final installation checks are complete. Confirm version availability before release.

## Purpose

Build Genesis-native games with convenient Lua APIs and a bundled SGDK toolchain.
This is a compiled Lua subset, not a PICO-8 cartridge compatibility layer.
Windows/VS Code is the validated development environment for this candidate.

## Development workflow

- Project configuration (`mdlua.json`) holds source, output and asset paths.
- `mdlua init` generates a playable starter and VS Code build/run tasks.
- Ctrl+Shift+B builds; Lua/project diagnostics link to source locations.
- CLI help, graphics tile budgets and safe ROM replacement improve build feedback.
- Hello and Starfall include project files and build instructions.

## Runtime improvements

- Bitmap clipping, fills, text and transfer timing have emulator regressions.
- Sprite bounds, list reuse and imported background tile orientation are corrected.
- Audio driver switching and effect channels are tested; BlastEm listening checks
  passed. The integrated diagnostic's saved BEST survives normal quit/reopen.
- Numeric fixes cover random bounds, absolute-value saturation, sign folding,
  min/max helpers, extreme angle inputs, floor division, modulo and ceiling.
- Folded global values outside the numeric range fail compilation.

## Compatibility notes

- Rebuild existing ROMs to apply runtime/compiler fixes.
- Seeded random sequences change because the generator now uses its intended
  16-bit state. Replays or generated levels tied to old sequences may change.
- `layer_show` and `layer_pri` now fail compilation; older builds ignored them.
- `abs` returns fixed point, with the minimum value saturating positively.
- Folded `sgn(0)` now equals runtime `sgn(0)`: zero.
- Invalid output paths that collide with project inputs are rejected.
- Save/load remains the persistence API; no cartdata/dget/dset mode is added.

## Validation and limits

Checkpoint: 119 Genesis tests and 50 canonical compiler tests passed with no
skips. Local archive installation passed starter creation, CLI/task builds and
diagnostic checks. These are historical checkpoints, not final release results.

Physical hardware is unverified. General runtime overflow and exact agreement
between folded and runtime fractional approximations are not promised. See
[numeric behavior](NUMERIC_BEHAVIOR.md) and [development guide](DEVELOPMENT_GUIDE.md).
Direct SGDK descriptors indicate compiler availability, not universal runtime coverage.

## Required before publishing

1. Make the reviewed canonical compiler revision available through the intended
   distribution channel, then pin the exact verified revision/version.
2. Repeat isolated installation without the local validation override.
3. Complete the documentation checklist and rerun final package/test checks.
4. Confirm the release version and approve publication/tagging explicitly.

Use [the release checklist](RELEASE_CHECKLIST.md) as the source of completion status.
