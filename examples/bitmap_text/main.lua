local frames=0
function _update60()
  frames+=1
end
function _draw()
  cls(0)
  pset(0,0,0) -- enter bitmap mode before printing
  rectfill(240,0,247,7,8)
  rectfill(248,0,255,7,11)
  rectfill(8,12,40,30,11)
  print("A",13,17,8) -- pixel positioning and transparent glyph background
  print("A",-3,50,8) -- screen-edge clipping
  clip(20,75,4,8)
  print("A",17,75,8)
  clip()
  print("A",40,50,8)
  rectfill(40,50,47,57,11) -- later drawing covers text
  print(1.25,16,104,7)
  print("1.25",16,120,7)
  if frames<10 then print("OLD",80,50,8) end -- must disappear after cls
end
