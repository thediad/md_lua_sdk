-- Build with --gff examples/imported_flags/sprites.gff (no sheet required).
local __p8map=hexdata("010203")
local passed=0
function _init()
  if fget(0)==128 and fget(1)==1 and fget(2)==2 and fget(3)==3 and fget(254)==0 and fget(255)==165 then
    fset(3,1)
    fset(3,1,true)
    fset(255,7,false)
    fset(-1,99)
    fset(256,99)
    if fget(3)==3 and fget(255)==37 and fget(0,7)==1 and fget(0)==128 then
      passed=1
    end
  end
end
function _update60()
end
function _draw()
  cls(0)
  if passed==1 then print("FLAGS IMPORT PASS",8,24,7) else print("FAIL",8,24,7) end
  print("ALL",8,48,7)
  map(0,0,112,48,3,1)
  print("MASK 1",8,72,7)
  map(0,0,112,72,3,1,1)
  print("MASK 2",8,96,7)
  map(0,0,112,96,3,1,2)
end
