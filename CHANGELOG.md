# Development changelog

This records the local `luacretro-sync-test` development work. Entries under
Unreleased are not a claim that these changes have been published upstream or
released on npm. See [the guide](docs/DEVELOPMENT_GUIDE.md) for usage and coverage.

## Unreleased

- Optimized `circfill` to skip invisible rows and fill bounded packed spans.
  Preserved midpoint-circle pixels and clipping; added emulator coverage for
  small/edge-crossing circles and completion of a radius-32767 draw.

- Fixed large bitmap clip rectangles overflowing their 16-bit stored bounds.
  Clip results are bounded to the bitmap before storage; off-screen and empty
  intersections remain empty. Added an emulator regression for boundary cases.

- `spr`/`spr8` now reject invalid sheet IDs without using hardware sprite slots.
  Multi-cell sprites skip cells beyond the sheet. Added pixel-level emulator
  coverage for bounds, transparency, flips and camera offsets.

- Fixed music play-once after standalone PCM: activate XGM2 before applying the
  loop count instead of trusting a stale loaded-driver flag.
- Fixed SFX channel numbering: Lua channels 2/3 map to the corresponding SGDK
  enums; unsupported values fall back to channel 3. XGM2 has three PCM channels.
- Added NTSC/PAL audio-output regressions and a synthetic-tone listening example.

- Fixed PNG background tile packing: individual 8x8 tiles are no longer mirrored
  horizontally. Rebuild ROMs to apply the correction; sprite-sheet packing is unchanged.
- `tset` now rejects tile IDs outside the imported tileset before touching map RAM
  or VRAM. Added emulator coverage for asymmetric art, transparent tile zero,
  invalid IDs/coordinates, boundary cells and `map_show` source restoration.

- Added multiline text in hardware and bitmap modes using long-bracket strings.
  Lines advance eight pixels; LF/CRLF/CR are supported. Cursor advancement now
  counts all lines and wraps within the active display height. Hardware text
  clips to the visible screen instead of sending off-screen coordinates to SGDK.
  Quoted escape handling in the shared compiler is unchanged.
- The map/flags diagnostic now draws its persistent hardware labels once,
  avoiding text loss caused by clearing the plane during each display scan.

- Added `mdlua init <new-directory>`: a playable no-assets starter, project
  configuration, README and build-output ignore file. Existing destinations
  are refused. Updated the guide and corrected stale cheat-sheet timing/text advice.

- `mdlua run` now shares the build command's project configuration and overrides,
  including asset paths and output location. Passing a `.bin` directly launches
  it without rebuilding or reading project configuration.

### Build workflow and documentation

- Added optional `mdlua.json` project configuration: entry, output, sprite sheet,
  background map, flags, sprite variants, SFX and music paths.
- Build flags override configuration; paths resolve relative to their source.
- Added `npm.cmd run build` and a CLI launcher that handles Windows imports,
  including toolchain workers. Manual external preload setup is unnecessary.
- Added a starter-local `build.cmd` in the workstation tutorial project.
- Added the development guide and working-feature/validation inventory.
- Validation: project parsing and end-to-end CLI build tests, including a path
  with spaces and an environment without the old `NODE_OPTIONS` workaround.

### Genesis runtime

- `8efa671`: invalid player IDs return false; controller regression covers both
  ports, three/six-button pads, NTSC/PAL, holds, repeat presses and simultaneous input.
- `595bf50`: colored bitmap clears fill actual pixel RAM and survive lazy bitmap
  initialization; clipping remains independent of a full-buffer clear.
- `c29d977`: Lua SRAM transfers clamp to declared array capacities and evaluate
  dynamic count expressions once.
- `e057803`: SRAM slots are bounded to 0-127, negative lengths are rejected;
  emulator regression exports and reloads saved data without changing valid layouts.
- `62e19da`: real-time clocks use video interrupts with NTSC/PAL conversion;
  corrected the fixed-point return descriptor for `realsecs`.
- `a18f3ac`: added complete animated bitmap-frame comparisons in NTSC and PAL.
- `d09090f`: moved bitmap blanking transitions into the border and reduced transfer
  batches. Full-image emulator checks pass; user confirmed no flicker in BlastEm.
- `ade22db`: rectangle fills clip before iterating and write packed pixel spans.
- `e3b3489`: imported 256-byte `.gff` sprite flags; fixed unsafe VDP access while
  plane-clear DMA was still running.
- `bc71da5`: bitmap text composes into the framebuffer with color, clipping and
  correct draw order, using a 768-byte ROM font mask.
- `83f6622`: added budgeted pre-scaled sprite assets, `ssprv`, declared `sspr`
  resolution, memory-cost reporting, and pixel/flip/transparency regressions.
- Earlier sync work added bounded mutable byte maps, sprite flags and filtering,
  fractional number printing, clipping intersections and corrected pixel readback.

### Shared compiler integration

- Both SDKs use the sibling canonical luacretro development checkout.
- Canonical compiler added descriptor-driven clip/cartdata/map/flag handling and
  SDK-owned emission/constant-evaluation hooks. Canonical banking b6-b13,
  blob-reader inlining protection, `.object` indexing and far-call renaming are retained.
- Genesis does not expose PICO persistence merely because the shared compiler
  supports its lowering. Genesis development retains save/load only.

### Validation policy

- The filled-circle validation passed 98 SDK tests with no skips, including
  exact pixel comparisons and a large-radius completion check in the emulator.
  Audio-output checks also pass; human listening and physical hardware remain pending.
- Run `npm.cmd test` for current results; do not treat historical counts as live status.
- Physical hardware verification is pending and does not block emulator-focused work.
- Audio, advanced direct SGDK APIs, and performance under real game workloads
  require targeted validation rather than relying on API presence alone.
