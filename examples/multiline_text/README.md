# Multiline text check

From this directory, run `mdlua build`, then open `build/game.bin` in an emulator.
Without a global command, run `node ../../bin/mdlua-launch.mjs build`.

The initial display uses hardware text. Lines should align eight pixels apart,
with a blank row before AFTER A BLANK LINE. VISIBLE FIRST ROW appears at the top;
the preceding line is off-screen. The top-right label is intentionally cut short
in the narrower bitmap display. Press Genesis B to enter bitmap mode.
The display becomes a centered 256x160 area with a colored clipped label below.
Restart the ROM to return to hardware text. This example uses actual newlines in
long-bracket Lua strings. Quoted backslash escapes are currently kept literal.
