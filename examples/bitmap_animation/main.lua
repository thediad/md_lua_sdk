local tick=0
function _update60()
  tick+=1
end
function _draw()
  local shade=8
  if tick%2==0 then shade=11 end
  rectfill(0,0,255,159,shade)
  rectfill(8,8,15,15,8)
  rectfill(24,8,31,15,11)
end
