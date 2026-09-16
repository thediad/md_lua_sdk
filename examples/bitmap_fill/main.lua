function _update60()
end
function _draw()
  -- Huge coordinates must cost no more work than a visible full-screen fill.
  clip()
  rectfill(-30000,-30000,30000,30000,8)
  clip(11,13,20,18)
  rectfill(30000,30000,-30000,-30000,11)
  clip()
  rectfill(41,40,41,47,7) -- odd single-pixel column
  rectfill(44,40,44,47,9) -- even single-pixel column
  rectfill(51,40,54,47,12) -- preserve both neighboring nibbles
  clip(0,0,0,0)
  rectfill(0,0,255,159,0)
  clip()
  rectfill(300,200,400,300,0) -- fully offscreen
  if pget(0,0)==8 and pget(255,0)==8 and pget(0,159)==8 and pget(171,159)==8 and pget(255,159)==8 then
    rectfill(80,8,95,15,11) -- green: boundary rows are intact in bitmap RAM
  else
    rectfill(80,8,95,15,7)
  end
end
