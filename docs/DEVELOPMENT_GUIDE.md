# Genesis Lua development guide

This guide describes the `luacretro-sync-test` development branch. The goal is
Genesis-native games using convenient Lua functions, not PICO-8 cartridge
compatibility. Use this guide and [runtime details](PICO_RUNTIME.md) for current
behavior; [CHANGELOG](../CHANGELOG.md) records changes as development proceeds.

## Quick build on this workstation

The prepared starter is `C:\dev\genesis-sync-runtime\tutorial`:

```powershell
Set-Location C:\dev\genesis-sync-runtime\tutorial
.\build.cmd
```

Open `build\game.bin` in BlastEm. Edit `main.lua`, save, run `build.cmd` again,
then reload the ROM in the emulator. This launcher points to the sibling SDK
checkout; update its SDK path if you move the project.

No manual `NODE_OPTIONS` setting is needed with the new launcher. It applies
the pinned toolchain's Windows import workaround to the CLI and its workers.
The old external `windows-esm-validation.mjs` file is no longer required for
these commands. Programmatic `buildMd` users on Windows can preload the SDK's
`bin/windows-paths.mjs` themselves.

## SDK setup and alternative commands

Requirements: Node.js 24+ and the repository dependencies. In the current layout:

```text
C:\dev\luacretro                         canonical compiler
C:\dev\genesis\md_lua_sdk                Genesis SDK
C:\dev\genesis-sync-runtime\tutorial     starter game
```

The SDK currently uses a local `file:../../luacretro` dependency. Keep that
sibling checkout available. This is a development setup, not a published
standalone release configuration.

From the SDK directory:

```powershell
npm.cmd install                        # only when setting up dependencies
npm.cmd run build -- examples/hello/main.lua
npm.cmd run build -- --project C:\dev\genesis-sync-runtime\tutorial\mdlua.json
npm.cmd test
```

For an optional global command, run `npm.cmd link` once from the SDK directory.
Then, from your game's directory:

```powershell
mdlua.cmd build
mdlua.cmd run build/game.bin
```

`npm link` changes the installed command; it has not been run automatically.
The `run` window needs the optional SDL dependency. BlastEm can open the same
ROM without it. Both `build` and `run` read project configuration. From your
project directory, `mdlua.cmd run` rebuilds and launches the configured game;
`mdlua.cmd run --project path/to/mdlua.json` works from another directory.
All build overrides also work with `run`. To launch an existing ROM without
rebuilding or reading project configuration, use `mdlua.cmd run build/game.bin`
with no build options.

## Create a new game

With the SDK command installed:

```powershell
mdlua.cmd init my-game
Set-Location my-game
mdlua.cmd build
mdlua.cmd run
```

Without a global command, from the SDK checkout use
`node bin/mdlua-launch.mjs init ../my-game`, then build with
`node bin/mdlua-launch.mjs build --project ../my-game/mdlua.json`.

The new directory contains `main.lua`, `mdlua.json`, a README, a `.gitignore`
for build output, and `.vscode/tasks.json`.

Open the generated game folder itself in VS Code. Save your changes and press
**Ctrl+Shift+B** to build. **Terminal > Run Task > Genesis Lua: run** builds and
opens the optional SDL emulator. These process tasks use the Node executable
and SDK launcher paths recorded at project creation; no `npm link` or PowerShell
execution-policy change is needed. If those installations move, update their
paths in the tasks file. Tasks resolve `mdlua.json` from the opened game folder.

 The starter uses an 8x8 fallback sprite: D-pad moves it and B
resets its position. No asset downloads are needed. Creation requires a new
directory with an existing parent; existing directories and files are refused.
If creation fails partway through, the partial directory is retained for inspection.

## Project configuration

An optional `mdlua.json` in the working directory avoids repeating paths:

```json
{
  "entry": "main.lua",
  "out": "build/game.bin"
}
```

For a game with assets:

```json
{
  "entry": "main.lua",
  "out": "build/game.bin",
  "sheet": "assets/sprites.png",
  "map": "assets/background.png",
  "sfx": ["assets/shot.wav"],
  "music": ["assets/level.vgm"]
}
```

Omit assets you do not have. Additional optional settings are `gff` (256 raw
flag bytes) and `spriteVariants` (a scaling manifest). Music/SFX list order
determines zero-based IDs in Lua.

- Configuration paths are relative to the JSON file.
- Explicit command-line paths are relative to the terminal's directory and
  override the corresponding configuration setting.
- `--project path/to/mdlua.json` selects a configuration explicitly.
- Without configuration or an entry argument, build uses `main.lua`.
- Without an output setting, build writes `game.bin` beside the entry file.
- Missing flag values, unknown settings/options, and malformed JSON fail clearly.
- Existing explicit source/asset build arguments remain supported.
- The ROM output must differ from source, asset and project-configuration files.
  Collisions (including existing file aliases) are rejected before the build.
  Rebuilding to an existing ROM path is supported.

## Write the game

```lua
local x=156
local y=108

function _init()
  cls(1)
  print("D-PAD TO MOVE",8,8,7)
end

function _update60()
  if btn(0) then x-=2 end
  if btn(1) then x+=2 end
  if btn(2) then y-=2 end
  if btn(3) then y+=2 end
  x=mid(0,x,312)
  y=mid(32,y,216)
end

function _draw()
  spr(0,x,y)
end
```

This works without assets using a fallback 8x8 tile. `_init` runs once;
`_update60` runs once per game loop; `_draw` submits that loop's sprites. Static
hardware text and tilemaps persist, but the sprite list must be submitted each
loop. Avoid clearing and redrawing a static hardware text screen every frame.

The name `_update60` does not guarantee 60 updates per second: the normal video
rate is approximately 60 Hz NTSC or 50 Hz PAL, and expensive work slows the loop.
`_update`, used instead, runs every other loop. `time()` advances 1/60 second per
loop; `realsecs()` uses video interrupts and the region's nominal refresh rate.

### Multiline labels

Use a long-bracket string with actual line breaks:

```lua
print([[LEVEL 1
GET READY]],16,40,7)
```

Both drawing modes advance eight pixels per line and clip at the screen edges.
Cursor printing advances past all lines. Quoted backslash escapes currently stay
literal in the shared compiler; use `[[...]]` for multiline text.
See [the multiline example](../examples/multiline_text/README.md) for both modes.

## Language basics

- Ahead-of-time compilation: Lua becomes C, then native 68000 code via SGDK.
- Use ordinary functions, loops, boolean conditions, and `+=`/`-=` assignments.
- Conditions need booleans: `if lives > 0 then`, not `if lives then`.
- Fractional math uses 16.16 fixed point; integral values may use integer code.
- `array(n)` and `array8(n)` allocate fixed capacities. Arrays are 1-indexed;
  tile, button, player, sound, and save-slot IDs are zero-based.
- `array8` stores bytes. Use it for explicit save records and compact flags.
- Do not assume desktop Lua facilities such as dynamic modules, closures,
  metatables, or arbitrary runtime string building are supported.

## Working features and validation

"Emulator regression" means executable automated coverage, not physical-device
certification. Tests use Genesis Plus GX unless otherwise stated.

| Area | Available behavior | Evidence / important limits |
|---|---|---|
| Build | Lua to padded/checksummed `.bin`, bundled WASM toolchain | ROM builds and determinism tests; project CLI tested without external preload |
| Input | Two players, three/six-button pads, held and new-press queries | Both regions/ports, all buttons, simultaneous input, press/release regression |
| Sprites | `spr`, flips, palette/priority state, camera | Pixel regressions for bounds/flips/camera and 80-entry list overflow, clearing and reuse; one entry per visible valid tile |
| Pre-scaled sprites | Build-time variants, `ssprv`, matching literal `sspr` | Exact pixels/flips/transparency; 8-32 pixels per output axis; no runtime resampling |
| Backgrounds | PNG map import, plane-B display, scrolling, tile access | Emulator coverage for pixel orientation, tile writes/bounds and source restoration; one imported plane-B map |
| Byte maps / flags | Mutable bounded map data, flag byte/bit access, `--gff` | Runtime filtering/bounds/import regressions; separate from imported background maps |
| Bitmap drawing | Pixels, lines, rectangles, circles, clipping | Pixel regressions for circles, rectangles and clipping, including large dimensions; 256x160 buffer, about 41 KiB RAM |
| Bitmap clearing/text | True color-buffer clear, pixel-positioned glyphs | Clear/readback/clip/draw-order and multiline regressions |
| Bitmap timing | Border timing adaptation | Full-image animated NTSC/PAL regression; user confirmed static diagnostic flicker fix in BlastEm |
| Numbers / clocks | Fractional print, simulation and elapsed clocks | Formatting and slow-draw NTSC/PAL clock regressions |
| Saves | 128 slots, 254 payload bytes per slot, array-capacity clamping | Empty/boundary/invalid-count tests, dynamic count evaluated once, SRAM export/reload regression |
| Sound | PCM SFX and XGM2 music asset pipeline | NTSC/PAL output checks; user confirmed audio-check sequence in BlastEm (music stop/loop, PCM, both SFX channels and effects over music) |
| Direct SGDK calls | Generated descriptors and selected callback examples | Coverage varies by API; availability does not imply runtime verification |

## Hardware drawing versus bitmap drawing

Prefer hardware sprites and tile planes for a conventional Genesis game.
The main display is 320x224. A PNG sheet uses row-major 8x8 tiles:
`spr(0,x,y,2,2)` draws a 16x16 image using four current SDK sprite entries.
Export an 8-bit-per-channel PNG with dimensions divisible by eight and no more
than 15 opaque colors plus transparency per imported palette.

The default hardware layout has room for 1,424 asset tiles (45,568 bytes)
shared by the sprite sheet, deduplicated background tiles and pre-scaled variants.
SGDK's system tiles, font and display tables are reserved separately. A sheet
uses every 8x8 cell; a map counts unique tiles plus its transparent tile. Builds
that exceed this combined budget fail and leave the previous ROM intact.
Changing the VRAM layout with direct SGDK calls requires managing that layout yourself.

Each successful `build` prints a graphics budget, for example:

```text
Graphics tiles (default hardware layout): 4/1424 used, 1420 free (128 bytes used).
  Fallback sheet: 4; map: 0; pre-scaled: 0.
```

This reports the startup hardware tile assets. It is not total RAM usage or a
bitmap-mode memory budget. Programmatic `buildMd` callers can read the same
counts from the result's `graphics` field. `run` builds the same assets but does
not currently print this report; use `build` to inspect the budget.


Pixel/shape drawing activates the software bitmap engine. It has a different
memory/VRAM budget and lower full-buffer refresh throughput. Pre-scaled sprite
assets cannot currently share its VRAM layout. `camera` affects the hardware
path, not bitmap coordinates. See [pre-scaled sprites](PRESCALED_SPRITES.md).

## Known limitations / deliberate decisions

- Physical hardware verification is deferred; development continues on emulators.
- Save/load remains the persistence API. No cartdata/dget/dset mode or reserved slots.
- SRAM tests cover explicit export/import, not every emulator's automatic save policy.
- Ordinary input is sampled at game-loop boundaries; sufficiently short input during
  slow rendering can be missed. `btnp` has no automatic repeat.
- Hardware-plane updates are immediate and may expose partial large redraws.
- Bitmap transfer timing prioritizes stable edges over maximum throughput.
- The SDK is a compiled Lua subset and a Genesis API, not a PICO-8 emulator.
- Development changes remain local until deliberately published; local compiler
  dependencies need a distributable pin before a standalone release.

## Debugging and keeping this guide current

```powershell
# From the SDK directory:
node bin/mdlua-launch.mjs c path/to/main.lua
npm.cmd test
```

Use compiler diagnostics first, then check generated C when a behavior is unclear.
Build a small diagnostic for hardware-visible changes and add emulator assertions.

With each user-facing change, update the relevant guide/runtime section and add
an entry under Unreleased in the changelog. Identify what changed, how to use it,
what was tested, and any remaining limits. Keep automated results distinct from
user emulator reports and physical hardware results.
