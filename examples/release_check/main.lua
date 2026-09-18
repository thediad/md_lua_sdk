-- Integrated release check: hardware graphics, input, sound and saved best score.
local px=152
local py=108
local tx=184
local ty=108
local score=0
local best=0
local scroll=0
local muted=0
local record=array8(3)

function read_best()
  if load(0,record,3)==3 then
    if record[1]==83 and record[2]==1 and record[3]<=99 then best=record[3] end
  end
end

function labels()
  print("COLLECT THE INVADER",8,8,7)
  print("SCORE    BEST",8,24,7)
  print("   ",56,24,7)
  print(score,56,24,7)
  print("   ",120,24,7)
  print(best,120,24,7)
  print("B:RESET A:SAVE C:LOAD START:SOUND",8,208,7)
end

function _init()
  cls(0)
  map_show(0)
  read_best()
  labels()
  music(0)
  srand(123)
end

function _update60()
  if btn(0) then px-=2 end
  if btn(1) then px+=2 end
  if btn(2) then py-=2 end
  if btn(3) then py+=2 end
  px=mid(0,px,304)
  py=mid(48,py,184)
  scroll=(scroll+1)%256
  if abs(px-tx)<14 and abs(py-ty)<14 then
    score=min(score+1,99)
    best=max(best,score)
    tx=16+flr(rnd(272))
    ty=56+flr(rnd(120))
    sfx(0,2)
    labels()
  end
  if btnp(4) then
    px=152 py=108 tx=184 ty=108 score=0
    labels()
  end
  if btnp(6) then
    record[1]=83 record[2]=1 record[3]=best
    save(0,record,3)
    print("SAVED - QUIT AND REOPEN TO VERIFY",8,192,7)
  end
  if btnp(5) then
    read_best()
    labels()
  end
  if btnp(7) then
    if muted==0 then music(-1) muted=1 else music(0) muted=0 end
  end
end

function _draw()
  camera(0,scroll)
  -- Counteract the camera offset for actors while the background scrolls.
  spr(0,px,py+scroll,2,2)
  spr(2,tx,ty+scroll,2,2)
end
