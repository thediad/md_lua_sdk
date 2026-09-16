// Resample indexed sheet pixels at build time; preserve palette/transparency.
export function spriteVariants(sheet, manifest) {
  if (!manifest || !Array.isArray(manifest.variants)) throw new Error("sprite variants: expected { variants: [...] }");
  const budget = manifest.budgetBytes ?? 8192;
  if (!Number.isInteger(budget) || budget < 0) throw new Error("sprite variants: invalid budgetBytes");
  const width = sheet.tilesAcross * 8, height = sheet.tilesDown * 8;
  const words = [], variants = [], seen = new Set();
  const pixel = (x, y) => (sheet.words[((y >> 3) * sheet.tilesAcross + (x >> 3)) * 8 + (y & 7)] >>> ((7 - (x & 7)) * 4)) & 15;
  for (const [id, spec] of manifest.variants.entries()) {
    if (!Array.isArray(spec?.source) || spec.source.length !== 4 || !Array.isArray(spec.size) || spec.size.length !== 2) throw new Error(`sprite variant ${id}: expected source [x,y,w,h] and size [w,h]`);
    const [sx, sy, sw, sh] = spec.source, [dw, dh] = spec.size;
    if (![sx, sy, sw, sh, dw, dh].every(Number.isInteger) || sx < 0 || sy < 0 || sw <= 0 || sh <= 0 || sx + sw > width || sy + sh > height) throw new Error(`sprite variant ${id}: source rectangle is outside the sheet`);
    if (dw < 8 || dh < 8 || dw > 32 || dh > 32 || dw % 8 || dh % 8) throw new Error(`sprite variant ${id}: destination dimensions must be multiples of 8 between 8 and 32`);
    const key = [...spec.source, ...spec.size].join(",");
    if (seen.has(key)) throw new Error(`sprite variant ${id}: duplicate source/size`);
    seen.add(key);
    const bytes = dw * dh / 2;
    if (words.length * 4 + bytes > budget) throw new Error(`sprite variants exceed budgetBytes (${budget})`);
    const tileOffset = words.length / 8;
    // Hardware multi-tile sprites use column-major tiles.
    for (let tx = 0; tx < dw / 8; tx++) for (let ty = 0; ty < dh / 8; ty++) {
      for (let py = 0; py < 8; py++) {
        let word = 0;
        for (let px = 0; px < 8; px++) word |= pixel(sx + Math.floor((tx * 8 + px) * sw / dw), sy + Math.floor((ty * 8 + py) * sh / dh)) << ((7 - px) * 4);
        words.push(word >>> 0);
      }
    }
    variants.push({ id, source: [...spec.source], size: [...spec.size], tileOffset, bytes, hardwareSprites: 1 });
  }
  return { words, variants, bytes: words.length * 4, budgetBytes: budget };
}

export function ssprEmitter(variants = [], sheetSize = null) {
  return (call, { argAt, cName }) => {
    const literal = i => call.args[i]?.kind === "number" ? call.args[i].value : null;
    const source = [0, 1, 2, 3].map(literal);
    const size = [call.args[6] ? literal(6) : source[2], call.args[7] ? literal(7) : source[3]];
    if ([...source, ...size].some(v => v === null)) throw new Error("sspr source and dimensions must be literal; use ssprv(id,x,y) to select declared variants dynamically");
    const request = [...source, ...size];
    if (sheetSize && (source[0] < 0 || source[1] < 0 || source[0] + source[2] > sheetSize[0] || source[1] + source[3] > sheetSize[1])) throw new Error("sspr source rectangle is outside the sheet");
    const variant = variants.find(v => [...v.source, ...v.size].every((value, i) => value === request[i]));
    if (variant) return `${cName("lc_sspr_variant")}(${variant.id}, ${argAt(call, 4, "int", "0")}, ${argAt(call, 5, "int", "0")}, ${argAt(call, 8, "flip", "0")}, ${argAt(call, 9, "flip", "0")})`;
    if (size[0] !== source[2] || size[1] !== source[3]) throw new Error(`sspr ${source.join(",")} -> ${size.join("x")} is undeclared; add it to --sprite-variants`);
    if (source.some(v => v < 0 || v % 8) || source[2] < 8 || source[3] < 8 || source[2] > 32 || source[3] > 32) throw new Error("unscaled sspr needs an aligned 8-32 pixel source rectangle; declare a variant for other crops");
    const args = Array.from({ length: 8 }, (_, i) => argAt(call, i, "int", "0"));
    return `${cName("lc_sspr")}(${args.join(", ")}, ${argAt(call, 8, "flip", "0")} | (${argAt(call, 9, "flip", "0")} << 1))`;
  };
}

export function variantEmitter(variants = []) {
  return (call, { argAt, cName }) => {
    if (!variants.length) throw new Error("ssprv requires --sheet and --sprite-variants");
    const id = call.args[0];
    const value = id.kind === "number" ? id.value : id.kind === "neg" && id.expr?.kind === "number" ? -id.expr.value : null;
    if (value !== null && (!Number.isInteger(value) || value < 0 || value >= variants.length)) throw new Error("ssprv variant ID is not declared");
    return `${cName("lc_sspr_variant")}(${["int", "int", "int", "flip", "flip"].map((kind, i) => argAt(call, i, kind, "0")).join(", ")})`;
  };
}
