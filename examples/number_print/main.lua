function _update60()
end

-- Static hardware text only needs drawing once. Repeated full-plane clears
-- can expose partial redraws during active display on the Genesis.
function _init()
  cls(0)
  print("NUMERIC / EXPECTED",8,8,7)
  print(12.5,8,24,7)
  print("12.5",8,40,7)
  print(-0.25,8,64,7)
  print("-0.25",8,80,7)
  print(-32767.99998,8,104,7)
  print("-32768",8,120,7)
  print(1.99998,8,144,7)
  print("2",8,160,7)
  print(0.00001,8,184,7)
  print("0",8,200,7)
end

function _draw()
end
