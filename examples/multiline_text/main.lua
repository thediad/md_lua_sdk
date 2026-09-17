-- Starts with hardware text. Press B to enter bitmap mode.
local bitmap=0
function labels()
  print([[MULTILINE TEXT
SECOND LINE

AFTER A BLANK LINE]],16,16,7)
  print([[PRESS B FOR BITMAP
TEXT SHOULD STAY ALIGNED]],16,72,7)
  print([[ABOVE SCREEN
VISIBLE FIRST ROW]],176,-8,7)
end
function _init()
  cls(1)
  labels()
end
function _update60()
  if btnp(4) then bitmap=1 end
end
function _draw()
  if bitmap==1 then
    pset(0,0,0)
    cls(1)
    labels()
    clip(20,112,120,16)
    print([[CLIPPED TEXT
SECOND ROW]],16,112,10)
    clip()
  end
end
