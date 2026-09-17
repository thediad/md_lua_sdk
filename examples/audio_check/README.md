# Audio listening check

Build from the SDK directory:

```powershell
node bin/mdlua-launch.mjs build --project examples/audio_check/mdlua.json
```

Open `build/game.bin` in an emulator with audio enabled. Buttons below are Genesis
button names; keyboard mappings depend on the emulator.

1. Startup: a repeating 440 Hz tone.
2. B: music stops.
3. Left and right: a roughly half-second 880 Hz effect on channels 2 and 3.
4. C: standalone PCM plays the effect once, replacing the music driver.
5. A: the 440 Hz music plays once for roughly a quarter second, then stops.
6. Start: the music loops again. Left/right can play effects over this music.

Report missing sound, effects that never stop, or A looping after C. The assets
are generated sine-wave WAV and PSG-tone VGM fixtures, not borrowed game audio.
Automated tests check sound/silence and duration in NTSC and PAL. Listening is
still needed to assess clicks, distortion and real emulator audio output.
