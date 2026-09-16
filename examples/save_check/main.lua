local data=array8(256)
local result=array8(256)
local frames=0
local status=0
function _update60()
  frames+=1
  if frames~=20 then return end
  if load(0,result,2)==2 and result[1]==11 and result[2]==22 then
    status=2
    return
  end
  if load(0,result,256)~=0 then status=3 return end
  for i=1,256 do data[i]=i%256 result[i]=99 end
  save(127,data,256)
  if load(127,result,256)~=254 or result[1]~=1 or result[254]~=254 or result[255]~=99 then status=3 return end
  if load(127,result,-1)~=0 or load(127,result,0)~=0 then status=3 return end
  data[1]=11 data[2]=22
  save(0,data,2)
  data[1]=33
  save(-1,data,1) save(128,data,1) save(256,data,1) save(0,data,-1)
  if load(-1,result,1)~=0 or load(128,result,1)~=0 or load(256,result,1)~=0 then status=3 return end
  if load(0,result,1)~=1 or result[1]~=11 then status=3 return end
  if load(0,result,256)~=2 or result[2]~=22 then status=3 return end
  save(1,data,0)
  if load(1,result,256)~=0 then status=3 return end
  status=1
end
function _draw()
  if frames==21 then
    cls(0)
    if status==1 then print("SAVE PASS",8,24,7)
    elseif status==2 then print("RELOAD PASS",8,24,7)
    else print("FAIL",8,24,7) end
    print("SAVE PASS",8,40,7)
    print("RELOAD PASS",8,56,7)
  end
end
