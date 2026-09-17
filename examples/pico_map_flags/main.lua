-- PICO map RAM is zero-filled after these four source cells.
local __p8map=hexdata("01020301")
local passed=0
local labels_drawn=0

function _init()
  if fget(0)~=0 or fget(1)~=0 or fget(255)~=0 then return end
  fset(1,1)
  fset(2,2)
  fset(3,3)
  mset(3,0,2)
  mset(127,63,3)
  mset(-1,0,99)
  fset(3,7,true)
  fset(3,7,false)
  if mget(3,0)==2 and mget(127,63)==3 and mget(4,0)==0 and mget(-1,0)==0 and mget(128,0)==0 and fget(3)==3 and fget(3,0)==1 and fget(3,1)==1 and fget(3,8)==0 then
    passed=1
  end
end

function _update60()
end

function _draw()
  -- Plane text persists. Repeated full-plane clears can erase labels while
  -- the display is scanning them; only the hardware sprites need resubmission.
  if labels_drawn==0 then
    cls(0)
    print("PICO MAP / FLAGS",8,8,7)
    if passed==1 then print("RAM AND BOUNDS PASS",8,24,7) else print("FAIL",8,24,7) end
    print("ALL",8,48,7)
    print("MASK 1",8,72,7)
    print("MASK 2",8,96,7)
    print("MASK 0",8,120,7)
    labels_drawn=1
  end
  map(0,0,112,48,4,1)
  map(0,0,112,72,4,1,1)
  map(0,0,112,96,4,1,2)
  map(0,0,112,120,4,1,0)
end
