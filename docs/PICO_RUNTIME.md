# PICO-style Genesis runtime

The shared compiler supplies Lua semantics. These APIs use Genesis-owned
descriptors and runtime code on `luacretro-sync-test`.

## Maps and flags

Declare `local __p8map = hexdata("...")` for the initial map bytes. The runtime
copies up to 8192 bytes into one mutable 128x64 map. Short sources are padded
with zero; bytes beyond 8192 are ignored. Map coordinates are zero-based.

- `mget(x,y)` reads a tile; out-of-bounds reads return zero.
- `mset(x,y,tile)` writes a byte; out-of-bounds writes do nothing.
- `fget(sprite)` reads a flag byte; `fget(sprite,bit)` returns zero or one.
- `fset(sprite,flags)` replaces the byte; `fset(sprite,bit,on)` changes one bit.
- Sprites are 0-255 and bits are 0-7. Invalid indices read zero or do nothing.
- Flags initially contain zero and are set from Lua. Importing a PICO flag
  asset is not implemented yet.
- `map(cx,cy,sx,sy,cw,ch[,layers])` stamps 8x8 sheet tiles onto plane B.
  Defaults are `0,0,0,0,128,64`; an omitted mask draws every nonzero tile.
  A supplied mask draws tiles sharing any flag bit; zero draws none.
  Tile zero, filtered tiles, and missing sheet tiles leave existing plane cells
  unchanged. Source cells and destination plane cells are bounds-checked.

Map RAM costs 8 KiB and flags cost 256 bytes when linked. Bitmap drawing also
needs about 41 KiB, so test combined bitmap/map games for memory pressure.
PICO map state is separate from the `--map` asset and `tget`/`tset` plane APIs.
Only one PICO cart map is supported. Destination positions are tile-aligned;
plane scrolling remains subject to Genesis hardware behavior.

## Numbers and clipping

Numeric `print` preserves fractions with up to four rounded decimal places,
trims trailing zeros, and avoids displaying negative zero. The same formatter
serves explicit-position and cursor printing.

`clip()` resets bitmap clipping. `clip(x,y,w,h)` replaces the rectangle;
`clip(x,y,w,h,true)` intersects it with the previous rectangle. A zero or
negative width/height creates an empty rectangle. This clips bitmap pixels
and shapes, including bitmap text, but not hardware sprites, tilemaps, or
hardware text.

Once a bitmap verb activates bitmap mode, `print` draws the SGDK 8x8 font
directly into the 256x160 bitmap at pixel coordinates. Glyph backgrounds are
transparent; the requested color, clipping, `pget`, `cls`, and later drawing
all apply to its pixels. Text does not apply the camera, matching the existing
bitmap drawing wrappers. Print after the first bitmap verb: hardware text
drawn before activation is not converted into bitmap pixels. Control bytes
and unsupported characters become `?`; newline layout is not implemented.
The font mask uses 768 ROM bytes and no additional RAM buffer. Regenerate it
from the bundled SGDK font with `node scripts/generate-bitmap-font.mjs`.

The `pget` wrapper reads even and odd pixel nibbles consistently with SGDK's
setter; it does not use the reversed getter in the pinned SGDK source.

## Diagnostic examples

- `pico_map_flags`: expect `RAM AND BOUNDS PASS`; ALL has four cells,
  MASK 1 has cells 1 and 3, MASK 2 has cells 2, 3, and 4, MASK 0 is empty.
- `number_print`: each numeric row must match the expected string below it.
- `bitmap_clip`: expect a red square with its lower-right quarter green,
  two adjacent colored pixels near the bitmap's top-left, and a green status
  bar below. A red status bar indicates failure.
- `bitmap_text`: red glyphs over green/black backgrounds, cropped glyphs,
  a green rectangle covering an earlier glyph, and matching `1.25` rows.
  The temporary `OLD` label must disappear.

`test/pico-runtime.test.js` builds and runs the diagnostics in Genesis Plus GX and
checks their framebuffers. Physical-device or MD.emu testing is still useful
for timing, memory pressure, and display behavior.

## Remaining hardware-dependent work

`sspr` supports explicitly declared pre-scaled variants; `ssprv` selects them
at runtime. See [PRESCALED_SPRITES.md](PRESCALED_SPRITES.md) for declarations,
memory costs, and the initial 8-32 pixel size limits. Dynamic software scaling
is not implemented.
Bitmap text composition has pixel-level emulator coverage; physical-device
timing remains unverified. Palette transparency is constrained by tile/sprite
color-zero transparency and is not a general PICO `palt` implementation.
