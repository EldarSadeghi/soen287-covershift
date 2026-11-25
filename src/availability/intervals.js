export function coversPeriod(windows,period){
  let end=period.startsAt;
  for(const r of [...windows].sort((a,b)=>a.startsAt.localeCompare(b.startsAt))){if(r.startsAt>end)break;if(r.endsAt>end)end=r.endsAt;if(end>=period.endsAt)return true;}
  return false;
}
