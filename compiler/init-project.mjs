import path from "node:path";
import { fileURLToPath } from "node:url";
import { mkdir, writeFile } from "node:fs/promises";

const main = `-- Genesis hardware sprite starter. No external assets required.
local x=156
local y=108

function _init()
  cls(1)
  print("D-PAD TO MOVE",8,8,7)
  print("B TO RESET",8,24,7)
end

function _update60()
  if btn(0) then x-=2 end
  if btn(1) then x+=2 end
  if btn(2) then y-=2 end
  if btn(3) then y+=2 end
  x=mid(0,x,312)
  y=mid(40,y,216)
  if btnp(4) then x=156 y=108 end
end

function _draw()
  spr(0,x,y)
end
`;

export async function initProject(args, cwd = process.cwd()) {
  if (args.length !== 1 || !args[0].trim() || args[0].startsWith("-")) {
    throw new Error("usage: mdlua init <new-directory>");
  }
  const directory = path.resolve(cwd, args[0]);
  // Exclusive creation also rejects existing empty folders and symlinks.
  // Do not remove the directory on failure: it may contain user edits.
  try {
    await mkdir(directory);
  } catch (error) {
    if (error.code === "EEXIST") throw new Error(`project destination already exists: ${directory}`);
    throw error;
  }
  const launcher = fileURLToPath(new URL("../bin/mdlua-launch.mjs", import.meta.url));
  const tasks = ["build", "run"].map(command => ({
    label: `Genesis Lua: ${command}`, type: "process", command: process.execPath,
    args: [launcher, command, "--project", "${workspaceFolder}/mdlua.json"],
    options: { cwd: "${workspaceFolder}" },
    problemMatcher: [{ owner: "mdlua", fileLocation: "absolute", pattern: {
      regexp: "^(.+):(\\d+):(\\d+): (error|warning): (.*)$",
      file: 1, line: 2, column: 3, severity: 4, message: 5,
    } }],
    ...(command === "build" ? { group: { kind: "build", isDefault: true } } : {}),
  }));
  await mkdir(path.join(directory, ".vscode"));
  const files = {
    ".vscode/tasks.json": JSON.stringify({ version: "2.0.0", tasks }, null, 2) + "\n",
    "main.lua": main,
    "mdlua.json": JSON.stringify({ entry: "main.lua", out: "build/game.bin" }, null, 2) + "\n",
    ".gitignore": "/build/\n",
    "README.md": `# Genesis Lua starter

Open this folder in VS Code, save your Lua changes, then press **Ctrl+Shift+B**
to build. Lua errors and warnings appear in the Problems panel with source locations.
Use **Terminal > Run Task > Genesis Lua: run** to build and open the
optional emulator. These tasks use the Node and SDK paths found when the project
was created; no global command is required. If you move the SDK or reinstall
Node elsewhere, update those paths in .vscode/tasks.json.

With the SDK command installed, you can also run from this directory:

\x60\x60\x60powershell
mdlua.cmd build
mdlua.cmd run
\x60\x60\x60

On other systems use \x60mdlua\x60. Without a globally installed command, use
\x60node /path/to/md_lua_sdk/bin/mdlua-launch.mjs build\x60 from this directory.
The SDK and its dependencies must already be installed.

Open \x60build/game.bin\x60 in BlastEm or another Genesis emulator. The bundled
run command requires the optional SDL dependency. Edit \x60main.lua\x60, then rebuild.
Use the D-pad to move the 8x8 fallback sprite and B to reset its position.

\x60mdlua.json\x60 holds paths relative to this directory. Add sheet, map, music,
or sfx settings when you have assets. See the SDK's docs/DEVELOPMENT_GUIDE.md.

The game uses hardware sprites on a 320x224 screen. Static text is drawn once;
sprites are submitted each loop. Update rate follows the video region and workload.
`,
  };
  for (const [name, contents] of Object.entries(files)) {
    await writeFile(path.join(directory, name), contents, { flag: "wx" });
  }
  return directory;
}
