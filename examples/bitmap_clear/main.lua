local initialized=0
function _init()
  cls(8)
  pset(0,0,8) -- activates the bitmap after a colored clear
  if pget(255,159)==8 and pget(1,0)==8 then initialized=1 end
end
function _update60()
end
function _draw()
  clip(32,32,8,8)
  cls(12) -- clears the entire bitmap but preserves the drawing clip
  rectfill(0,0,255,159,7)
  local passed=0
  if initialized==1 and pget(0,0)==12 and pget(255,159)==12 and pget(31,32)==12 and pget(32,32)==7 and pget(40,32)==12 then passed=1 end
  clip()
  if passed==1 then rectfill(8,8,120,15,11) else rectfill(8,8,120,15,8) end
  rectfill(240,8,247,15,11) -- green status reference
  rectfill(240,24,247,31,12) -- blue clear-color reference
end
