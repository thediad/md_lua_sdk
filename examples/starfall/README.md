# Starfall

From the SDK directory:

```powershell
node bin/mdlua-launch.mjs build --project examples/starfall/mdlua.json
```

Open `examples/starfall/build/starfall.bin` in BlastEm. Move with the D-pad,
fire with Genesis B, and press B after winning or losing to restart.
The on-screen `O` prompt refers to B.

The project file includes the sheet and background. It uses the SDK's built-in
demo music and PSG effect fallback; no PCM sample bank is supplied by default.
To supply your own audio, add `music` and `sfx` arrays to a copy of the project
configuration. Asset paths are relative to that configuration file.

For the integrated audio/save acceptance test, use
[release_check](../release_check/README.md), whose project includes explicit
synthetic music and PCM assets and a saved best score.
