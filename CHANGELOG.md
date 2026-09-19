# Development changelog

This records the local `luacretro-sync-test` development work. Entries under
Unreleased are not a claim that these changes have been published upstream or
released on npm. See [the guide](docs/DEVELOPMENT_GUIDE.md) for usage and coverage.

## Unreleased

- Full accumulated numeric validation passed 119 Genesis tests with no skips;
  the scoped numeric audit is complete with documented overflow/precision limits.
- Verified isolated installation from local SDK/compiler archives, starter
  creation, CLI/task builds and source diagnostics. A test-only compiler override
  was required; final remote dependency pinning and installation remain pending.

- Genesis rejects out-of-range folded scalar globals, non-byte array fills and
  numeric table initializers instead of silently wrapping their stored values.
  The shared checker option is opt-in; other SDK defaults remain unchanged.
  Validation: 51 focused Genesis tests and 50 canonical compiler tests passed.

- Fixed runtime `ceil` overflowing near the positive fixed-point limit. Genesis
  now uses an SDK-owned helper for fractional inputs and preserves integer inputs.
  Boundary ROM checks failed before the fix and pass afterward; all 50 focused
  math/compiler tests passed. The integer result 32768 is not representable in
  fixed-point storage; this conversion limit is documented.

- The canonical lexer now accepts the exact largest 16.16 literal,
  32767.99998474121 (`0x7fff.ffff`), instead of rejecting it against a rounded
  limit. Larger literals remain rejected. Genesis boundary ROM tests pass.

- Added missing integer min/max runtime helpers for function-call arguments.
  The regression reproduced a C compilation failure before the fix; explicit and
  omitted second arguments now pass emulator checks with single evaluation.
  All 50 focused math/compiler tests passed.

- Genesis constant-folded `sgn(0)` now returns zero, matching its runtime.
  The SDK-specific hook preserves other consoles' defaults. An expanded ROM
  regression failed before the fix; all 50 focused math/compiler checks passed
  afterward. Rebuild ROMs containing folded sign expressions for this correction.

- Added `npm run release:check` for checkout-based package auditing: exact
  compiler dependency specification, required runtime files and generated build
  exclusions. Three focused tests pass. The actual 113-file package audit reports
  the sibling compiler dependency as the only static blocker; remote availability
  and isolated installation remain unverified.

- Fixed fractional floor division rounding tiny negative quotients to zero before
  flooring. Genesis now uses a direct raw-value quotient helper; a ROM regression
  compares it with a folded constant and checks both divisor signs. The canonical
  option remains opt-in, leaving other SDK defaults unchanged.

- Added project configuration and build instructions for Hello and Starfall.
  README commands now include their assets through project files and use the
  Windows-compatible launcher. Clarified Starfall's default PSG effect fallback.

- Added a numeric behavior reference and reconciled README/cheat-sheet claims:
  `sgn(0)` is zero, general overflow compatibility is unsupported, and constant
  rounding/approximation limits are explicit. Clarified the development compiler
  dependency, emulator validation scope and advanced direct SGDK API status.

- Guarded fixed modulo by raw -1 to avoid signed quotient overflow. Expanded
  numeric emulator checks for minimum values, one-unit fractions, zero division
  and large square roots; 51 focused compiler/math/RNG tests passed.
- Excluded generated example build directories from npm package contents.
  Standalone dependency pinning and isolated installation remain pending.

- User confirmed the integrated release-check ROM works as intended in BlastEm
  and BEST survives closing and reopening. Integrated user validation is complete;
  physical hardware verification remains deferred.

- Added a finite first-release checklist and an integrated `release_check` game
  covering movement, collection, scrolling, tone music/effects and explicit saves.
  Automated play checks collection, saved bytes and continued movement; normal
  BlastEm quit/reopen persistence was subsequently confirmed by the user.
- `layer_show`/`layer_pri` now reject compilation instead of silently doing nothing.
- Numeric audit: supplied missing fixed min/max helpers, corrected fractional
  sign return typing, and fixed minimum-value angle magnitudes. Genesis opts into
  runtime division/modulo semantics while preserving native multiplication and
  inline integer division optimization. Other SDK defaults remain unchanged.

- Fixed runtime `abs(-32768)` to saturate like compiler-folded constants instead
  of overflowing. Corrected the Genesis `abs` return descriptor to fixed point,
  preventing extra scaling in mixed integer/fixed expressions. Added emulator
  comparisons across integer/fractional inputs and the minimum boundary.

- Fixed the random generator retaining 32-bit state despite requiring 16-bit
  xorshift steps. `rnd(n)` and its integer fast path now stay within their
  positive bounds; seed folding is explicitly masked too. Seeded sequences
  change from older builds. The new ROM regression failed before the fix and
  passed afterward; all 48 focused random-runtime/compiler checks passed.

- Outline circles now reject empty clips and bounding boxes outside the clipped
  bitmap before radius-dependent stepping. Added outline pixel comparisons and
  a repeated invisible-circle completion regression; visible circle shapes remain
  unchanged. All three focused circle/line emulator tests passed. Disabling the
  new guard caused the completion regression to fail as expected.

- Horizontal/vertical bitmap lines and rectangle outlines now use clipped packed
  fills, avoiding work proportional to off-screen endpoint distances. Diagonal
  pixel stepping is preserved, with a signed-shift undefined behavior removed.
  Added full-bitmap emulator comparisons for clipping, reversed endpoints,
  degenerate lines, extreme axis endpoints, rectangle outlines and diagonals.

- Added successful general and per-command CLI help, including build options.
  Help does not load project configuration or create files.
- `mdlua c` now validates its single source argument, reports file errors without
  Node stack traces, and sends warnings/errors with absolute Lua source locations
  to standard error while keeping generated C on standard output.

- Finished ROMs now replace the output via a same-directory temporary file.
  Failed writes/replacements preserve the prior ROM, and normal failure paths
  remove the temporary file. Tests include a write interrupted after some bytes.

- Recorded successful user verification of Problems-panel navigation and rebuilding
  after correcting a Lua error.
- Project JSON syntax/validation errors now use clickable absolute source
  locations. Exact JSON positions are used when supplied by Node; other errors
  point to the config file start. UTF-8 BOM-prefixed project files are accepted.

- Recorded user confirmation of the generated VS Code build task and starter
  movement/reset in BlastEm.
- Generated VS Code tasks now match Lua diagnostics into the Problems panel.
  Builds report absolute Lua source paths so nested project entries resolve
  correctly; an automated test verifies file/line/column extraction.

- `mdlua init` now creates VS Code process tasks: Ctrl+Shift+B builds, and the
  run task builds and launches the optional emulator. Tasks use the current
  Node/SDK installation, so no global command is required; moving either
  installation requires updating the saved task paths.
- The generated task command was executed from a project path containing spaces
  without NODE_OPTIONS; the resulting starter passed movement/reset emulator checks.

- Builds reject output paths that would overwrite source or asset inputs;
  project builds also protect their configuration file. Existing file aliases
  are checked by identity, and normal rebuilding to a ROM path still works.
  Source/asset collisions are checked before compilation and again before writing.

- Successful CLI builds now report graphics tiles used/free and the sheet/map/
  pre-scaled breakdown. `buildMd` also returns these counts as `graphics`.
  The report includes fallback sheet tiles and deduplicated map tile zero;
  it describes the default hardware layout, not bitmap or general RAM usage.

- Applied the combined tile VRAM guard to ordinary sheet/map builds as well as
  pre-scaled variants, reserving the pinned SGDK font region. The default asset
  capacity is 1,424 tiles. Rejected builds preserve the prior output ROM.
- Fixed toolchain error reporting to consume the parser's issue array, so the
  actual error is shown instead of the final lines of a noisy compilation log.

- Recorded successful user listening validation of `audio_check` in BlastEm:
  music stop/loop, both SFX channels, standalone PCM followed by play-once music,
  and effects over looping music. Physical hardware remains unverified.
- Added a sprite-list lifecycle regression for 80 entries, overflow, clearing
  all sprites and repeated reuse; existing runtime behavior passed unchanged.

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

- First-release audit checkpoint: 115 Genesis tests and 48 canonical compiler
  tests passed, no skips. Includes integrated play/save checks and numeric edge
  regressions. User subsequently confirmed BlastEm integrated play and automatic
  save persistence for the release-check ROM.

- The absolute-value fixes passed the full SDK suite: 112 tests with no failures
  or skips. The new emulator check reproduced incorrect results before the fixes.

- The bitmap line update passed the full SDK suite: 109 tests, no failures or
  skips, including the new pixel comparison and existing runtime regressions.

- CLI help and generated-C diagnostics passed 11 focused checks together with
  project configuration, generated-task builds and starter movement/reset emulator
  checks. The full runtime suite was not repeated for this CLI-only change.

- ROM replacement passed 14 focused checks, including partial-write failure,
  replacement failure, CLI builds, output collision checks and starter emulator
  movement/reset. Runtime rendering code was unchanged.

- The subsequent project-diagnostics change passed 11 focused project, starter,
  output-path and emulator checks; the full runtime suite was not repeated for
  this configuration-only change.

- The IDE-diagnostics validation passed 103 SDK tests with no skips, including
  nested-file error matching, generated-task builds and emulator regressions.
- Run `npm.cmd test` for current results; do not treat historical counts as live status.
- Physical hardware verification is pending and does not block emulator-focused work.
- Audio, advanced direct SGDK APIs, and performance under real game workloads
  require targeted validation rather than relying on API presence alone.
