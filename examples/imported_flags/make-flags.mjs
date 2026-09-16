import { writeFileSync } from "node:fs";
const flags = new Uint8Array(256);
flags.set([128, 1, 2, 3]);
flags[255] = 165;
writeFileSync(new URL("sprites.gff", import.meta.url), flags);
