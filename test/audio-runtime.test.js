import {test} from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,writeFile,readFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import {LibretroHost} from "romdev-core-host";
import {core} from "romdev-core-gpgx";
import {buildMd} from "../compiler/build-md.mjs";
import {makePsgVgm} from "./vgm-fixture.mjs";
import {makeWav} from "./wav-fixture.mjs";

test("music stops, PCM plays, and play-once survives switching audio drivers",async()=>{
  const work=await mkdtemp(path.join(tmpdir(),"mdlua-audio-runtime-"));
  const song=path.join(work,"tone.vgm"),sample=path.join(work,"tone.wav");
  await writeFile(song,makePsgVgm({melodyHz:[440],noteSamples:11025}));
  await writeFile(sample,makeWav({secs:0.5,hz:880}));
  const source=path.join(work,"main.lua"),rom=path.join(work,"audio.bin");
  await writeFile(source,`function _init() music(0) end
function _update60()
  if btnp(0) then sfx(0,2) end
  if btnp(1) then sfx(0,3) end
  if btnp(2) then sfx(0,4) end
  if btnp(4) then music(-1) end
  if btnp(5) then pcm_play(0,3,false) end
  if btnp(6) then music(0,false) end
  if btnp(7) then music(0) end
end
function _draw() end
`);
  await buildMd(source,rom,{musicPaths:[song],sfxPaths:[sample]});
  const original=await readFile(rom);
  for(const region of ["U","E"]) {
  const bytes=Buffer.from(original);
  bytes.fill(32,0x1f0,0x200);bytes[0x1f0]=region.charCodeAt(0);
  const regionalRom=path.join(work,`${region}.bin`);await writeFile(regionalRom,bytes);
  const host=new LibretroHost({saveDir:work});
  try {
    await host.loadCore(core.jsPath,core.wasmPath);
    await host.loadMedia({platform:"genesis",path:regionalRom});
    const level=(frames)=>{
      host.state.audioRing.length=0;
      host.stepFrames(frames);
      let sum=0,squares=0,n=0;
      for(const chunk of host.state.audioRing) for(const v of chunk) {sum+=v;squares+=v*v;n++;}
      assert.ok(n>0,"core must provide audio samples");
      return Math.sqrt(Math.max(0,squares/n-(sum/n)**2));
    };
    const press=(key)=>{
      host.setInput({ports:[{[key]:true},{}]});host.stepFrames(3);
      host.setInput({ports:[{},{}]});host.stepFrames(3);
    };
    const fps=host.getStatus().coreFps;
    assert.ok(region==="U" ? fps>59 && fps<61 : fps>49 && fps<51,"expected region timing");
    host.stepFrames(90);
    assert.ok(level(12)>100,"looped music remains audible beyond song duration");
    press("b");host.stepFrames(30);
    assert.ok(level(12)<10,"music(-1) silences the song");
    for(const key of ["left","right","up"]) {
      press(key);
      assert.ok(level(8)>100,`sample effect plays for ${key}`);
      host.stepFrames(60);
      const tail=level(12);
      assert.ok(tail<10,`sample effect finishes (${key}, RMS ${tail})`);
    }
    press("a");
    assert.ok(level(8)>100,"standalone PCM produces audio");
    host.stepFrames(60);
    assert.ok(level(12)<10,"non-looping PCM finishes");
    press("y");
    assert.ok(level(4)>100,"music starts again after PCM driver");
    host.stepFrames(60);
    assert.ok(level(12)<10,"play-once must finish after returning from PCM");
    press("start");host.stepFrames(60);
    assert.ok(level(12)>100,"default looping can restart after play-once");
  } finally {host.unloadMedia();}
  }
});
