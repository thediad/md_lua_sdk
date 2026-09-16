# Pre-scaled sprites

Declare the sizes a game needs, then generate their pixels at build time.
There is no gameplay-time resampling. All declared variants are loaded once
into VRAM at startup; each draw uses one hardware sprite entry.

## Declare and build

```json
{
  "budgetBytes": 2048,
  "variants": [
    { "source": [0, 0, 16, 16], "size": [8, 8] },
    { "source": [0, 0, 16, 16], "size": [24, 24] },
    { "source": [0, 0, 16, 16], "size": [32, 32] }
  ]
}
```

`source` is x, y, width, height in sheet pixels. `size` is destination width
and height. IDs are zero-based positions in the list; reordering it changes
IDs. Every animation frame/source rectangle needs its own declarations.

```powershell
node bin/mdlua.js build examples/prescaled/main.lua --sheet examples/prescaled/sheet.png --sprite-variants examples/prescaled/variants.json -o scaled.bin
```

The same flags work with `run`. Programmatic callers pass `sheetPath` and
`spriteVariantsPath` to `buildMd`; its result includes a `spriteVariants`
report with per-variant bytes, dimensions, IDs, and hardware sprite counts.

## Draw

```lua
ssprv(1, 100, 60)            -- variant 1 at x=100,y=60
ssprv(2, 140, 60, true)      -- horizontal flip
ssprv(size_id, x, y, fx, fy)  -- runtime selection among declared sizes

-- A literal sspr request also resolves to its matching declared variant:
sspr(0, 0, 16, 16, 100, 60, 24, 24)
```

`ssprv` returns true when it submits a sprite. An invalid runtime ID,
fully offscreen sprite, or exhausted 80-entry sprite list returns false.
An invalid literal ID is rejected at compile time. Camera,
`spr_pal`, and `spr_prio` state apply as with ordinary sprites.

Scaled `sspr` requests require literal source/destination dimensions matching
a declaration. Positions and flip flags may vary. For runtime size selection,
use `ssprv`. Unscaled `sspr` remains available for aligned source rectangles
8-32 pixels wide/high. Unsupported requests produce an error instead of
silently ignoring scaling or rounding the crop. `mdlua c` has no asset manifest;
use the build command to resolve declared variants.

## Limits and costs

- Destination dimensions: 8, 16, 24, or 32 pixels per axis, independently.
- Source: any positive integer rectangle entirely inside the sheet.
- Sampling: deterministic nearest-neighbor, retaining the original palette
  indices and transparent color zero.
- Graphics size: width × height / 2 bytes per variant in both ROM and VRAM.
  The generated lookup table additionally uses 6 ROM bytes per variant.
- Default variant graphics budget: 8192 bytes; override with `budgetBytes`.
  This excludes the original sheet and background map, which retain their
  own graphics storage. There is no compression or deduplication of variants.
- The build also rejects a combined sheet/map/variant layout extending into
  the default SGDK plane tables at VRAM address 0xC000.
- Hardware scanline limits still apply. One hardware entry per variant does
  not eliminate the per-scanline sprite/pixel limits.
- Bitmap drawing is rejected in variant builds because its VRAM allocation
  overlaps these assets. Use the hardware sprite/tile path. Direct SGDK VRAM
  remapping or sprite-engine allocation must preserve this SDK-owned layout.

The included diagnostic compares original art with small, large, nonuniform,
and flipped variants. Emulator tests compare every output pixel to the source.
Run it in MD.emu or on hardware before relying on a large sprite workload.
