export function makeWav({ sr = 22050, secs = 0.25, hz = 440, bits = 16, ch = 1 } = {}) {
  const n = Math.floor(sr * secs);
  const bytesPer = bits / 8;
  const data = new Uint8Array(n * bytesPer * ch);
  const dv = new DataView(data.buffer);
  for (let i = 0; i < n; i++) {
    const v = Math.sin(2 * Math.PI * hz * i / sr);
    for (let c = 0; c < ch; c++) {
      if (bits === 16) dv.setInt16((i * ch + c) * 2, Math.round(v * 12000), true);
      else data[i * ch + c] = 128 + Math.round(v * 100);
    }
  }
  const out = new Uint8Array(44 + data.length);
  const hv = new DataView(out.buffer);
  const w = (s, o) => { for (let i = 0; i < s.length; i++) out[o + i] = s.charCodeAt(i); };
  w("RIFF", 0); hv.setUint32(4, 36 + data.length, true); w("WAVE", 8);
  w("fmt ", 12); hv.setUint32(16, 16, true); hv.setUint16(20, 1, true); hv.setUint16(22, ch, true);
  hv.setUint32(24, sr, true); hv.setUint32(28, sr * bytesPer * ch, true);
  hv.setUint16(32, bytesPer * ch, true); hv.setUint16(34, bits, true);
  w("data", 36); hv.setUint32(40, data.length, true);
  out.set(data, 44);
  return out;
}

