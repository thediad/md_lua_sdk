// Patch the pinned SGDK source at build time, leaving node_modules untouched.
// Keep display-enable transitions in the border rather than on bitmap pixels.
export function bitmapTimingSource(source) {
  const edits = [
    ["((screenHeight - BMP_HEIGHT) >> 1) - 1", "((screenHeight - BMP_HEIGHT) >> 1) - 5", 2],
    ["(scrh - vborder) - (VDP_getHIntCounter() + vcnt + 3)", "(scrh - vborder + 4) - (VDP_getHIntCounter() + vcnt + 3)", 1],
    // Shorter blank interval: reserve one tile row of transfer time.
    ["#define NTSC_TILES_BW           7", "#define NTSC_TILES_BW           6", 1],
    ["#define PAL_TILES_BW            10", "#define PAL_TILES_BW            9", 1],
  ];
  for (const [before, after, count] of edits) {
    if (source.split(before).length - 1 !== count) throw new Error("SGDK bitmap source changed; review bitmap timing patch before building");
    source = source.replaceAll(before, after);
  }
  return source;
}
