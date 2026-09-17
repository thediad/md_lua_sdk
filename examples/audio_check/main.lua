function _init()
  cls(1)
  print([[AUDIO CHECK
B: STOP MUSIC
C: STANDALONE PCM
A: MUSIC ONCE
START: MUSIC LOOP
LEFT/RIGHT: SFX 2/3]],8,8,7)
  music(0)
end
function _update60()
  if btnp(0) then sfx(0,2) end
  if btnp(1) then sfx(0,3) end
  if btnp(4) then music(-1) end
  if btnp(5) then pcm_play(0,3,false) end
  if btnp(6) then music(0,false) end
  if btnp(7) then music(0) end
end
function _draw() end
