function _update60()
end

function _draw()
  cls(0)
  clip(16,16,32,32)
  rectfill(0,0,80,80,8)
  clip(32,32,32,32,true)
  rectfill(0,0,80,80,11)
  clip(0,0,0,0)
  pset(20,20,7)
  clip()
  pset(4,4,7)
  pset(5,4,9)
  if pget(20,20)==8 and pget(36,36)==11 and pget(52,52)==0 and pget(4,4)==7 and pget(5,4)==9 then
    rectfill(8,80,120,87,11) -- green status bar means all checks passed
  else
    rectfill(8,80,120,87,8) -- red status bar means failure
  end
end
