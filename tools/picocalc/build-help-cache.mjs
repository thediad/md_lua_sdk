#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { wrap } from "../../bin/mdapi.mjs";

const sdk = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export function renderHelpCache(api, width = 38) {
  const files = new Map();
  for (const entry of api.entries) {
    const sections = [
      entry.signature,
      `[${entry.category}; ${entry.status}]`,
      entry.description,
      `Returns: ${entry.returns}`,
      entry.example ? `Example: ${entry.example}` : entry.exampleNote,
      "F8: full API browser",
    ];
    const text = sections.map(section => wrap(section, width)).join("\n\n") + "\n";
    for (const name of [entry.name, ...entry.aliases]) {
      const key = name.toLowerCase();
      if (!/^[a-z_][a-z0-9_]*$/.test(key)) continue;
      files.set(`${key}.txt`, text);
    }
  }
  return files;
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url))) {
  const output = process.argv[2];
  if (!output || process.argv.length !== 3) {
    console.error("Usage: node build-help-cache.mjs OUTPUT_DIRECTORY");
    process.exit(2);
  }
  if (fs.existsSync(output)) {
    console.error(`Refusing to replace existing help cache: ${output}`);
    process.exit(2);
  }
  const api = JSON.parse(fs.readFileSync(path.join(sdk, "docs/api.json"), "utf8"));
  const files = renderHelpCache(api);
  fs.mkdirSync(output, { recursive: false });
  for (const [name, text] of files) fs.writeFileSync(path.join(output, name), text);
  fs.writeFileSync(path.join(output, ".entry-count"), `${api.entries.length}\n`);
  console.log(`Rendered ${files.size} names from ${api.entries.length} API entries.`);
}
