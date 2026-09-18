# Hello Genesis

From the SDK directory:

```powershell
node bin/mdlua-launch.mjs build --project examples/hello/mdlua.json
```

Open `examples/hello/build/hello.bin` in BlastEm. The D-pad moves the sprite.
No asset files are required; this uses the SDK's fallback sprite sheet.

With the CLI linked, run `mdlua.cmd build` from this example's directory.
For a new game with VS Code tasks and bounded movement/reset, use `mdlua init`;
see the [development guide](../../docs/DEVELOPMENT_GUIDE.md).
