function _update60()
end

function _draw()
  cls(0)
  print("PRE-SCALED SPRITES",8,8,7)
  print("8    24    32    SOURCE",8,32,7)
  ssprv(0,16,48)
  sspr(0,0,16,16,48,48,24,24)
  ssprv(2,96,48)
  spr(0,176,48,2,2)
  print("FLIP X / Y / XY",8,88,7)
  ssprv(2,16,104,true,false)
  ssprv(2,64,104,false,true)
  ssprv(2,112,104,true,true)
  print("NONUNIFORM 24 X 16",8,160,7)
  ssprv(3,16,184)
end
