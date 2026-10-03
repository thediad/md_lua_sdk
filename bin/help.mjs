const buildOptions = `  --project FILE          Select mdlua.json (default: current directory)
  -o FILE                 Output ROM (default: game.bin beside the entry)
  --sheet FILE            Sprite-sheet PNG
  --map FILE              Background PNG
  --gff FILE              256-byte sprite flag file
  --sprite-variants FILE  Pre-scaled sprite manifest (requires --sheet)
  --sfx FILE,...          WAV effects in bank order
  --music FILE,...        VGM/VGZ/XGC songs in bank order

CLI paths are relative to the current directory; config paths are relative
to mdlua.json. CLI values override project settings.`;

const topics = {
  init: `Usage: mdlua init <new-directory>

Create a playable starter with mdlua.json and VS Code build/run tasks.
The parent directory must exist; an existing destination is never replaced.`,
  project: `Usage: mdlua project show [--project FILE]
       mdlua project set <sheet|map|gff|spriteVariants> <file> [--project FILE]
       mdlua project unset <sheet|map|gff|spriteVariants> [--project FILE]
       mdlua project add <music|sfx> <file> [--project FILE]
       mdlua project remove <music|sfx> <number> [--project FILE]

Safely inspect or update asset paths in mdlua.json. Existing single assets must
be removed before replacement. Asset files are referenced, never copied or
overwritten. Music and SFX numbers are shown by the project show command.`,
  inspect: `Usage: mdlua inspect <sheet|map|audio|variants> [--project FILE]

Inspect registered Genesis graphics using the same PNG decoder as the build.
Reports graphics layout, palettes, VRAM use, converted audio sizes, or declared
sprite-variant costs without writing a ROM or changing the project.`,
  preview: `Usage: mdlua preview <sheet|map> [--project FILE]

Build a temporary visual graphics inspector ROM. Sheet previews select real
row-major tile IDs; map previews pan the hardware tile plane with the D-pad.
Project source and assets are never modified.`,
  build: `Usage: mdlua build [main.lua] [options]

Build a Genesis ROM. Without an entry, use the project entry or main.lua.
Print graphics tile usage after a successful build.

${buildOptions}`,
  check: `Usage: mdlua check [main.lua] [options]

Validate Lua, project settings, and configured assets without compiling or
writing a ROM. Uses the same options and checks as build.

${buildOptions}`,
  run: `Usage: mdlua run [main.lua] [build options]
       mdlua run game.bin

Build the project and open the optional SDL emulator. Passing a .bin alone
opens that ROM without rebuilding or reading project configuration.
The same ROM can be opened in BlastEm or another Genesis emulator.

${buildOptions}`,
  c: `Usage: mdlua c <main.lua>

Print generated C to stdout for debugging; diagnostics go to stderr.
Accepts one source file. This command does not load project assets or manifests.`,
};

export function helpText(topic) {
  if (topic !== undefined) {
    if (!Object.hasOwn(topics, topic)) throw new Error(`unknown help topic: ${topic}`);
    return topics[topic];
  }
  return `Genesis Lua SDK

Usage: mdlua <command> [options]

  init <directory>   Create a new game and VS Code tasks
  project ...        Safely inspect or update project assets
  inspect ...        Report registered sheet or map layout
  preview ...        Build a visual sheet or map inspector ROM
  check [main.lua]   Validate source and assets without writing a ROM
  build [main.lua]   Build a ROM using mdlua.json or explicit options
  run [main.lua]     Build and launch; run game.bin launches an existing ROM
  c <main.lua>       Print generated C for debugging
  help [command]    Show general or command-specific help

Use mdlua <command> --help for details.
Guide: docs/DEVELOPMENT_GUIDE.md in the SDK checkout.`;
}
