# First standalone release checklist

Scope: Genesis-native games using the documented Lua subset and curated APIs.
Windows/VS Code is the initial validated development environment. Save/load is
the persistence API. PICO-8 cartridge compatibility is outside this release.
Hardware verification is deferred; the release must say emulator-tested.

## 1. Supported API and numeric behavior

- [x] Establish this release scope and completion checklist.
- [x] Reject silently inactive layer visibility/priority calls (compiler regression).
- [x] Finish the scoped numeric boundary tests: abs, RNG, sign/min/max/mid, rounding,
  square root, trig/atan2, division/modulo and constant/runtime agreement.
  Boundary coverage includes each listed family. General runtime overflow and
  exact fractional/trigonometric folding equivalence are outside the supported
  contract; see [numeric behavior](NUMERIC_BEHAVIOR.md).
  Found and corrected tiny negative fractional floor quotients becoming zero;
  runtime now agrees with the folded result for that boundary and both signs.
  Corrected Genesis constant folding of `sgn(0)` from one to zero to match the
  runtime; ROM checks compare folded and runtime signs for zero and both signs.
  Added missing integer min/max fallback helpers; function-call arguments and
  omitted second arguments now build and pass single-evaluation ROM checks.
  Corrected the lexer's rounded upper range limit; the exact maximum literal
  now compiles and passes Genesis ROM checks. Rounding results beyond the
  fixed-point range are documented as integer-only results.
  Runtime ceiling now rounds upper-bound fractions without overflowing. Conversion
  of its 32768 integer result back to fixed point remains outside the supported range.
  Folded global initializers outside the supported range now fail compilation
  (scalars, non-byte array fills and numeric tables); runtime overflow remains
  unsupported rather than dynamically checked.
- [x] Record remaining numeric limits explicitly; resolve known numeric release blockers.
  Full SDK checkpoint: 119 tests passed without skips. This closes the scoped
  audit, not a claim of exhaustive correctness for every possible input.

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

From the SDK checkout, run `npm.cmd run release:check` for the static package
audit. It examines npm's actual dry-run file list, requires an exact compiler
version or full Git revision, and rejects missing runtime files or generated
example builds. It does not publish, install, run package lifecycle scripts or
verify remote availability. A nonzero exit currently reports the local compiler
dependency as a release blocker; this is expected for the development manifest.

- [ ] Replace the sibling compiler dependency with a reproducible distributable
  dependency after verifying the exact canonical revision is available.
- [x] Inspect package contents and install into a clean isolated directory.
  Initial `npm pack --dry-run` audit found and excluded example build output.
  Local SDK/compiler tarballs installed with a validation-only compiler override;
  lifecycle scripts were disabled. This does not validate a final remote pin.
- [x] Create and build a new project without sibling development repositories.
- [x] Verify saved VS Code task paths and CLI diagnostics from the clean install.
  Installed CLI and generated task each built a 524288-byte starter ROM. Invalid
  Lua reported its absolute source location. See [installation evidence](INSTALL_VALIDATION.md).

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
  [Draft notes](RELEASE_NOTES_DRAFT.md) propose 0.4.0-rc.1 and list compatibility
  changes. Version availability and the final manifest update remain pending.
- [ ] Explicit publishing decision, then publish/tag the reviewed candidate.

Optional future work: physical hardware certification, additional platforms and
asset formats, broader bitmap optimization and additional convenience APIs.
None should silently expand this first-release checklist.

Baseline: commit 279f75d passed 112 SDK tests, no skips. This is historical
evidence; rerun tests for the final candidate. Development commits are local.

Completed user checkpoint: [release-check instructions](../examples/release_check/README.md).
Packaging and the final documentation pass are still open, not release-ready.
The required canonical compiler revision is local (d8c37f8). A read-only GitHub
lookup on 2026-09-19 found the remote branch still at 74ca7d0. Do not pin that
older revision or publish the development manifest. Publishing the reviewed
compiler revision and verifying the final remote dependency remain release steps.
Current automated checkpoint: 119 Genesis tests and 50 canonical compiler tests
passed without skips. Integrated ROM screen layout was inspected in Genesis Plus GX.
