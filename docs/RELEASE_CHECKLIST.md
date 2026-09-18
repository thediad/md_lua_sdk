# First standalone release checklist

Scope: Genesis-native games using the documented Lua subset and curated APIs.
Windows/VS Code is the initial validated development environment. Save/load is
the persistence API. PICO-8 cartridge compatibility is outside this release.
Hardware verification is deferred; the release must say emulator-tested.

## 1. Supported API and numeric behavior

- [x] Establish this release scope and completion checklist.
- [x] Reject silently inactive layer visibility/priority calls (compiler regression).
- [ ] Finish numeric boundary tests: abs, RNG, sign/min/max/mid, rounding,
  square root, trig/atan2, division/modulo and constant/runtime agreement.
  Boundary coverage now includes each listed family; a final review of overflow
  and constant-folding differences remains before checking this item off.
- [ ] Record remaining numeric limits explicitly; resolve release-blocking bugs.

## 2. Integrated game validation

- [x] Prepare a reproducible example with movement, collisions, scrolling,
  sprites, music/effects and save/load.
- [x] Automate a sustained play session and check resource limits/visible results.
  `examples/release_check`: 113/1424 tiles, collection/save assertions and about
  26 seconds of simulated input; not a maximum-load benchmark.
- [x] User checks the example in BlastEm and normal quit/reopen save persistence.
  User reports the ROM works as intended and BEST survives reopening. Existing
  isolated audio and starter confirmations remain valid; hardware is unverified.

## 3. Standalone installation

- [ ] Replace the sibling compiler dependency with a reproducible distributable
  dependency after verifying the exact canonical revision is available.
- [ ] Inspect package contents and install into a clean isolated directory.
  Initial `npm pack --dry-run` audit found and excluded example build output.
  The source/asset package contents are checked; isolated installation is pending.
- [ ] Create and build a new project without sibling development repositories.
- [ ] Verify saved VS Code task paths and CLI diagnostics from the clean install.

## 4. Documentation and release candidate

- [ ] Reconcile README, guide, cheat sheets and example build commands.
  README and numeric sections now distinguish this branch from published packages,
  document the sibling compiler requirement and remove PICO-8 overflow promises.
  Hello and Starfall now have project manifests and documented launcher commands;
  both commands built 524288-byte ROMs successfully. Remaining API descriptions
  and other examples still need review.
- [x] Label direct SGDK APIs as advanced and individually validated, not covered
  merely because a descriptor exists.
- [ ] Run final automated suite and clean-install smoke test; record evidence.
- [ ] Choose release version and assemble release notes with compatibility changes.
- [ ] Explicit publishing decision, then publish/tag the reviewed candidate.

Optional future work: physical hardware certification, additional platforms and
asset formats, broader bitmap optimization and additional convenience APIs.
None should silently expand this first-release checklist.

Baseline: commit 279f75d passed 112 SDK tests, no skips. This is historical
evidence; rerun tests for the final candidate. Development commits are local.

Completed user checkpoint: [release-check instructions](../examples/release_check/README.md).
Packaging and the final documentation pass are still open, not release-ready.
The required canonical compiler revision is currently local (3775b5e); GitHub
availability could not be verified during the package audit. Do not replace the
sibling dependency with an unverified remote pin or publish the development manifest.
Current automated checkpoint: 115 Genesis tests and 48 canonical compiler tests
passed without skips. Integrated ROM screen layout was inspected in Genesis Plus GX.
