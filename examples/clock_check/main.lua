local loops=0
local start_frames=0
local start_secs=0
local start_game=0
local hz=60
local checked=0
local passed=0
local measured_frames=0
local measured_secs=0.0
local measured_game=0.0
function _init()
  if SYS_isPAL()~=0 then hz=50 end
end
function _update60()
  if loops==2 then
    start_frames=realframes()
    start_secs=realsecs()
    start_game=time()
  end
  if loops==22 then
    local frames=realframes()-start_frames
    local secs=realsecs()-start_secs
    local game=time()-start_game
    measured_frames=frames
    measured_secs=secs
    measured_game=game
    -- Bitmap transfer waits span several video frames per game loop.
    if frames>30 and abs(secs-frames/hz)<0.03 and abs(game-20/60)<0.001 and secs>game then
      passed=1
    end
    checked=1
  end
  loops+=1
end
function _draw()
  rectfill(0,0,255,159,0)
  rectfill(8,8,15,15,11) -- green reference
  rectfill(24,8,31,15,8) -- red reference
  if checked==0 then
    rectfill(40,40,120,60,9)
  elseif passed==1 then
    rectfill(40,40,120,60,11)
  else
    rectfill(40,40,120,60,8)
  end
  print(measured_frames,8,80,7)
  print(measured_secs,8,96,7)
  print(measured_game,8,112,7)
  print(hz,8,128,7)
end
