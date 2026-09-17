# PICO-style Genesis runtime

The shared compiler supplies Lua semantics. These APIs use Genesis-owned
descriptors and runtime code on `luacretro-sync-test`.

The goal is Genesis-native development with convenient PICO-style Lua functions,
not PICO-8 cartridge compatibility. Hardware capabilities, predictable costs,
and emulator-tested behavior take priority. Persistence uses `save`/`load`;
`cartdata`/`dget`/`dset` are not planned, and all 128 save slots remain available.

## Controllers

`btn(button,player)` reports held state; `btnp(button,player)` reports a new
press on the current game loop and does not auto-repeat. The optional player
is 0 or 1; invalid players/buttons return false. IDs 0-3 are left/right/up/down,
4-7 are B/C/A/Start, and 8-11 are X/Y/Z/Mode on a six-button pad. Three-button
pads leave the extra buttons inactive. Input is sampled at game-loop boundaries;
a press entirely between samples can be missed during slow drawing.

Emulator regressions exercise both ports, every button, held/released states,
and repeated press edges with three- and six-button pads in NTSC and PAL.

## Maps and flags

Declare `local __p8map = hexdata("...")` for the initial map bytes. The runtime
copies up to 8192 bytes into one mutable 128x64 map. Short sources are padded
with zero; bytes beyond 8192 are ignored. Map coordinates are zero-based.

- `mget(x,y)` reads a tile; out-of-bounds reads return zero.
- `mset(x,y,tile)` writes a byte; out-of-bounds writes do nothing.
- `fget(sprite)` reads a flag byte; `fget(sprite,bit)` returns zero or one.
- `fset(sprite,flags)` replaces the byte; `fset(sprite,bit,on)` changes one bit.
- Sprites are 0-255 and bits are 0-7. Invalid indices read zero or do nothing.
- Flags initially contain zero, or the bytes supplied by `--gff sprites.gff`.
  The file must contain exactly 256 raw bytes, one byte per sprite ID, using
  the same binary format as GameTank's `.gff` assets. This is not the textual
  `__gff__` section of a `.p8` cartridge; export that section to binary first.
  Imported flags are available before Lua `_init` and remain mutable via
  `fset`. No sprite sheet is required to import or query flags.
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

Both `build` and `run` accept `--gff`; programmatic `buildMd` callers pass
`gffPath`. For example:

```powershell
node bin/mdlua.js build examples/imported_flags/main.lua --gff examples/imported_flags/sprites.gff -o flags.bin
```

The import adds 256 initialized bytes in ROM and uses the existing 256-byte
mutable flags array in RAM. It does not allocate a second runtime copy.
In hardware-text mode, `cls` waits for its plane-clear DMA to finish before
returning, so subsequent text and map writes can safely access the VDP.
Hardware plane updates are immediate and are not double-buffered: clearing
and redrawing a large text screen every frame can expose partial redraws.
Draw static hardware text once, as the number-print diagnostic does.

## Save slots

`save(slot,array8,n)` and `load(slot,array8,n)` use slots 0-127 in the default
32-KiB byte-wide SRAM mapping. Each 256-byte slot has two header bytes and up
to 254 payload bytes. Existing valid-slot data keeps the same layout. Invalid
slots no longer wrap around; negative lengths are rejected. `load` returns
zero for invalid input, an empty slot, or a slot without the expected marker.
Lua counts are capped to both 254 and the declared `array8` capacity. Dynamic
count expressions are evaluated once. Direct C callers of `md_save`/`md_load`
must still supply a sufficiently large array, or use their `_bounded` variants
with an explicit capacity. The shared compiler supplies checked array metadata;
this safety policy is implemented by Genesis-owned descriptors.

The `save_check` diagnostic covers the first/last slots, invalid inputs,
truncated reads, and empty saves. The emulator test exports SRAM to a file,
loads it into a fresh core instance, and verifies the saved payload. This
tests SRAM persistence through explicit export/import, not a frontend's
automatic save-file policy. The format does not provide checksums or atomic
recovery after interruption during a write.

## Numbers, clocks, and clipping

`realframes()` counts video interrupts since runtime initialization, rather
than completed game loops. `realsecs()` converts that count to 16.16 seconds
using nominal 60 Hz on NTSC and 50 Hz on PAL. Actual refresh rates differ
slightly from those nominal rates. These clocks continue advancing while a
slow bitmap draw spans multiple video frames; they are not an external clock
and cannot count interrupts suppressed by application code.

`t()`/`time()` retain their existing simulation-clock behavior: exactly 1/60
second per completed game loop, even on PAL or during slow rendering. Use
`realsecs()` when an effect should follow elapsed time instead of loop count.
The `clock_check` diagnostic shows a green bar after checking both clocks
during slow bitmap drawing; numeric rows show elapsed video frames, elapsed
seconds, simulation seconds, and the selected nominal video rate.

Numeric `print` preserves fractions with up to four rounded decimal places,
trims trailing zeros, and avoids displaying negative zero. The same formatter
serves explicit-position and cursor printing.

`clip()` resets bitmap clipping. `clip(x,y,w,h)` replaces the rectangle;
`clip(x,y,w,h,true)` intersects it with the previous rectangle. A zero or
negative width/height creates an empty rectangle. The result is bounded to the
256x160 bitmap before storage, so large widths/heights do not wrap at 32767.
Completely off-screen rectangles stay empty, including after intersection.
This clips bitmap pixels
and shapes, including bitmap text, but not hardware sprites, tilemaps, or
hardware text.

Once a bitmap verb activates bitmap mode, `print` draws the SGDK 8x8 font
directly into the 256x160 bitmap at pixel coordinates. Glyph backgrounds are
transparent; the requested color, clipping, `pget`, `cls`, and later drawing
all apply to its pixels. Text does not apply the camera, matching the existing
bitmap drawing wrappers. Print after the first bitmap verb: hardware text
drawn before activation is not converted into bitmap pixels. Other control bytes
and unsupported characters become `?`.
The font mask uses 768 ROM bytes and no additional RAM buffer. Regenerate it
from the bundled SGDK font with `node scripts/generate-bitmap-font.mjs`.

The `pget` wrapper reads even and odd pixel nibbles consistently with SGDK's
setter; it does not use the reversed getter in the pinned SGDK source.

In bitmap mode, `cls(color)` fills all 256x160 pixels with the selected palette
index, so `pget` observes the clear color. Clearing ignores the drawing clip
but does not change it. A colored clear before the first bitmap draw is retained
when bitmap mode starts. Hardware-plane mode continues to clear plane A and
select the VDP backdrop color.

`rectfill` intersects its rectangle with the clip region and bitmap bounds
before iterating, then fills packed pixel bytes while preserving neighboring
edge pixels. Huge offscreen rectangles therefore cost no more than a visible
full-screen fill. This does not imply a guaranteed bitmap frame rate.

## Diagnostic examples

- `pico_map_flags`: expect `RAM AND BOUNDS PASS`; ALL has four cells,
  MASK 1 has cells 1 and 3, MASK 2 has cells 2, 3, and 4, MASK 0 is empty.
- `number_print`: each numeric row must match the expected string below it.
- `imported_flags` (build with its `sprites.gff`): expect `FLAGS IMPORT PASS`;
  ALL has three cells, MASK 1 has cells 1 and 3, MASK 2 has cells 2 and 3.
- `bitmap_clip`: expect a red square with its lower-right quarter green,
  two adjacent colored pixels near the bitmap's top-left, and a green status
  bar below. A red status bar indicates failure.
- `bitmap_text`: red glyphs over green/black backgrounds, cropped glyphs,
  a green rectangle covering an earlier glyph, and matching `1.25` rows.
  The temporary `OLD` label must disappear.
- `bitmap_clear`: blue background, small white clipped square, and a green
  status bar confirming clear-color pixels in RAM and preserved clipping.
- `bitmap_fill`: a red bitmap with a green clipped rectangle, thin colored
  columns, and a green status bar confirming boundary-row pixels are intact
  in RAM. Regression screenshots cover the entire 256x160 bitmap, including
  its boundary scanlines.
- `bitmap_animation`: intentionally alternates the full bitmap between red
  and green, with two fixed reference squares. Automated tests run this ROM
  with US and European region headers, verify actual ~60/~50 Hz core timing,
  and check all pixels across 32 consecutive frames in each region. Both
  colors must appear, preventing a frozen display from passing.

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

## Bitmap border timing

The original SGDK bitmap blanking produced top/bottom edge flicker in Genesis
Plus GX and in a user test with BlastEm. The SDK now compiles a checked
adaptation of the pinned SGDK `bmp.c`: display transitions move four scanlines
outward into the border, and transfer batches decrease from 7/10 tile rows to
6/9 for NTSC/PAL. This retains all 160 bitmap rows but can reduce full-buffer
refresh throughput (20 tile rows now require four NTSC or three PAL batches).
The installed toolchain is not modified. Source drift fails the build so the
adaptation must be reviewed when upgrading SGDK. The user confirmed the updated
fill diagnostic has no flicker in BlastEm. Genesis Plus GX regression coverage
includes animated NTSC and PAL frames with no boundary exclusions. Physical
hardware validation remains pending; emulator tests provide the current
regression baseline.


### Multiline text

Both hardware and bitmap `print` accept actual line breaks in long-bracket strings:

```lua
print([[LEVEL 1
GET READY]],16,40,7)
```

Each line starts at the supplied x coordinate and advances eight pixels vertically.
LF, CRLF and CR line endings are accepted; CRLF counts as one break. Empty lines
consume a row. Text clips at screen edges; it does not wrap long lines horizontally.
Hardware text uses the 40x28 visible tile grid and selects the HUD/window plane
for each line. Bitmap text preserves pixel positioning, color and `clip`.

Cursor printing advances by the number of line breaks plus one after each call,
including a trailing empty line. Its next position wraps within 28 hardware rows
or 20 bitmap rows. A single multiline call clips below the screen rather than
wrapping its drawing back to the top. Explicit-position print does not move the cursor.

The shared compiler currently preserves backslash escapes in quoted strings:
`"A\nB"` does not supply a newline. Use actual line breaks in `[[...]]` as above.


### Imported PNG backgrounds

`map_show(0)` displays the `--map` image on plane B. The importer deduplicates
8x8 tiles and reserves tile ID 0 as transparent. IDs 1 and above are assigned
in first-occurrence order while scanning the image by tile rows; they are not
sprite-sheet IDs. Pixel order within each tile matches the source PNG.

`tget(0,col,row)` reads the map shadow within the 64x32 plane. Use a cell's
`tget` value when copying its tile to another cell with `tset`. `tset` accepts
only IDs from the imported tileset, including zero to clear a cell. Negative
or out-of-range IDs and coordinates are ignored; invalid reads return zero.
Without a map asset, reads return zero and writes do nothing.

Calling `map_show` again restores the source image's cells (cropped to 64x32).
Cells outside that source rectangle are not reset. The layer argument still
selects no additional maps: this wrapper owns one imported map on plane B.
The map shadow tracks these imported-map calls, not direct SGDK plane writes
or the separate byte-map API. Plane updates are immediate; draw static maps
once instead of uploading the whole background every frame.


### Audio playback and driver switching

`music(n)` plays a bank entry with looping enabled; `music(n,false)` plays once
and `music(-1)` stops the music. The source VGM must contain a loop point for
looping to repeat it. `sfx(n,2)` and `sfx(n,3)` select XGM2 PCM channels 2 and 3;
the omitted channel and other channel values use channel 3. Channel 1 is left
for music. These Lua channel numbers are distinct from SGDK's zero-based enums.

`pcm_play` uses SGDK's standalone PCM driver. It replaces XGM2 on the Z80 and
interrupts its playback; it cannot mix with XGM2 music. Use `sfx` for simultaneous
music and effects. Sequential switching is supported: the wrappers activate
the required driver before applying settings, including music's loop count.

Automated Genesis Plus GX tests in NTSC and PAL measure output for looping,
stopping, finite sound effects, standalone PCM and returning to play-once music.
They detect sound/silence and completion, not perceived quality or accurate
instrument timbre. Listening and physical hardware checks remain separate.
See [audio check](../examples/audio_check/README.md) for a listening ROM.


### Sprite sheet bounds

`spr` and `spr8` use zero-based tile IDs within the loaded sprite sheet (or the
four fallback tiles when no sheet is supplied). An invalid starting ID draws
nothing and consumes no hardware sprite slots. A multi-cell `spr` whose source
extends past the sheet draws only its valid cells; missing cells stay empty.
Flips mirror both the cells and their positions, including those empty areas.
Tile addressing remains row-major with the sheet width as the row stride.

`spr8` is a sheet-relative tile helper, not an arbitrary VRAM-address API. Use
SGDK's direct sprite functions if you manage your own VRAM tiles. Ordinary
multi-cell sprites still consume one hardware sprite entry per visible valid
cell; this change does not increase the Genesis sprite capacity.

The emulator regression covers invalid IDs without sprite-list exhaustion,
all four flip combinations, transparent borders, camera offsets and partial
source rectangles. Physical sprite-limit and scanline behavior remain unverified.
