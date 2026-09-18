# Integrated release check

From the SDK directory:

```powershell
node bin/mdlua-launch.mjs build --project examples/release_check/mdlua.json
```

Open `build/release-check.bin` in this example's directory in BlastEm.
It uses the existing Starfall graphics and synthetic audio-check tones.

1. Move with the D-pad. Touch the invader to increase SCORE; it relocates.
   The background should scroll while the labels stay still.
2. Confirm collection plays an effect over looping music. Start toggles music.
3. Collect several times, then press A to save BEST. Note its value.
4. Close BlastEm normally, then reopen the exact same ROM. BEST should retain
   the value; SCORE starts at zero. This is the automatic emulator save check.
5. B resets the current run while keeping BEST. C reloads the saved BEST.

The example uses save slot 0 and writes only when A is pressed. Keep the ROM
name/path stable during persistence testing, since emulator saves may follow it.
Scores cap at 99. This is an integration diagnostic, not a performance benchmark.
