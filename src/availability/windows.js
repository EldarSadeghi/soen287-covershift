import {settleCoverInvitations} from '../cover/lifecycle.js';
import {coversPeriod} from './intervals.js';
export {coversPeriod} from './intervals.js';
import {createHash,randomUUID} from 'node:crypto';
import {HttpError} from '../auth/errors.js';
import {availabilityAccount} from './rules.js';
import {managerBusiness,businessInstant} from '../shifts/create.js';
import {claimCommitments} from '../requests/claim.js';
import {intervalsOverlap} from '../../public/claim-conflicts.js';

export const windowRevision=r=>createHash('sha256').update(JSON.stringify(r)).digest('hex');
const exact=(input,keys)=>input&&typeof input==='object'&&!Array.isArray(input)&&Object.keys(input).length===keys.length&&keys.every(k=>Object.hasOwn(input,k));
export function windowFields(input,timezone,now,requireFuture=true){
  if(!exact(input,['startLocal','endLocal','timezone'])||input.timezone!==timezone)throw new HttpError(422,'Review the selected times in your current business timezone.');
  const startsAt=businessInstant(input.startLocal,timezone,'startLocal'),endsAt=businessInstant(input.endLocal,timezone,'endLocal');
  const duration=Date.parse(input.endLocal+'Z')-Date.parse(input.startLocal+'Z');
  if(duration<=0||duration>86400000)throw new HttpError(422,'Choose a period of up to 24 local hours. Overnight periods must end on the next date.');
  if(requireFuture&&(Date.parse(startsAt)<=now||Date.parse(startsAt)>now+90*86400000))throw new HttpError(422,'Choose a future start within the next 90 days.');
  return {startsAt,endsAt,timezone};
}
function workerAccount(db,userId){const a=availabilityAccount(db,userId);if(a.user.role!=='worker')throw new HttpError(403,'Only employees can save their availability.');return a;}
const dto=(r,now)=>({...r,status:r.status==='withdrawn'?'withdrawn':Date.parse(r.endsAt)<=now?'expired':'confirmed',revision:windowRevision(r)});
export async function listWindows(store,userId,clock=Date.now){
  const db=await store.read(),{user,business}=workerAccount(db,userId),now=clock();
  return {timezone:business.timezone,checkedAt:new Date(now).toISOString(),horizon:availabilityHorizon(business.timezone,now),windows:(db.availabilityWindows||[]).filter(r=>r.workerId===user.id&&r.businessId===business.id).sort((a,b)=>b.startsAt.localeCompare(a.startsAt)||a.id.localeCompare(b.id)).map(r=>dto(r,now))};
}
export async function saveWindow(store,userId,input,clock=Date.now){
  if(!exact(input,['window','submissionId'])||typeof input.submissionId!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(input.submissionId))throw new HttpError(422,'Confirm the availability window shown.');
  return store.transaction(db=>{
    const {user,business}=workerAccount(db,userId),now=clock();settleCoverInvitations(db,now);const values=windowFields(input.window,business.timezone,now,false);
    const mine=(db.availabilityWindows||[]).filter(r=>r.workerId===user.id&&r.businessId===business.id),existing=mine.find(r=>r.submissionId===input.submissionId);
    if(existing){if(Object.keys(values).some(k=>existing[k]!==values[k]))throw new HttpError(409,'This submission was already used for different times. Refresh your availability.');return {window:dto(existing,now),replayed:true,message:'This window was already saved. Check its current status.'};}
    windowFields(input.window,business.timezone,now);
    if(mine.filter(r=>r.status==='confirmed'&&Date.parse(r.endsAt)>now).length>=60||mine.length>=1000)throw new HttpError(409,'Availability limit reached (60 current, 1000 total). Withdraw unused windows or contact your manager.');
    if(mine.some(r=>r.status==='confirmed'&&r.timezone===business.timezone&&r.startsAt===values.startsAt&&r.endsAt===values.endsAt))throw new HttpError(409,'You already saved these times. Refresh your availability.');
    const at=new Date(now).toISOString(),r={id:randomUUID(),businessId:business.id,workerId:user.id,...values,submissionId:input.submissionId,status:'confirmed',createdAt:at,updatedAt:at};
    db.schemaVersion=Math.max(db.schemaVersion,10);db.availabilityRules||=[];db.availabilityMatches||=[];db.notifications||=[];db.timeOffRequests||=[];db.availabilityWindows||=[];db.availabilityWindows.push(r);
    return {window:dto(r,now),replayed:false,message:'Availability saved. Your managers can see these times; coworkers can see your free availability in the next 14 days. No shift was requested or assigned.'};
  });
}
export async function withdrawWindow(store,userId,id,input,clock=Date.now){
  if(!exact(input,['revision'])||typeof input.revision!=='string'||!/^[a-f0-9]{64}$/.test(input.revision))throw new HttpError(422,'Use the current availability revision.');
  return store.transaction(db=>{
    const {user,business}=workerAccount(db,userId),now=clock(),r=(db.availabilityWindows||[]).find(r=>r.id===id&&r.workerId===user.id&&r.businessId===business.id);
    if(!r)throw new HttpError(404,'Availability window not found.');
    if(windowRevision(r)!==input.revision||r.status!=='confirmed'||Date.parse(r.endsAt)<=now)throw new HttpError(409,'This window changed or expired. Refresh before trying again.');
    r.status='withdrawn';r.updatedAt=new Date(Math.max(now,Date.parse(r.updatedAt)+1)).toISOString();settleCoverInvitations(db,now);
    return {window:dto(r,now),message:'Availability withdrawn. Existing shifts, coverage requests and automatic rules are unchanged.'};
  });
}
function availabilitySnapshot(db,business,input,now,excludeWorkerId=null){
  const period=windowFields(input,business.timezone,now);
  const workers=db.users.filter(u=>u.businessId===business.id&&u.role==='worker'&&!u.deactivation&&u.id!==excludeWorkerId).sort((a,b)=>a.name.localeCompare(b.name)||a.id.localeCompare(b.id)).map(u=>{
    const reasons=[];
    if(!u.passwordHash)reasons.push('Account setup incomplete');
    const conflicts=claimCommitments(db,u,now).filter(r=>intervalsOverlap(period,r));
    for(const kind of new Set(conflicts.map(c=>c.kind==='time_off'?'Approved time off':c.kind==='pending_claim'?'Pending coverage claim':'Assigned shift')))reasons.push(kind);
    const windows=(db.availabilityWindows||[]).filter(r=>r.workerId===u.id&&r.businessId===business.id&&r.status==='confirmed'&&r.timezone===business.timezone&&intervalsOverlap(period,r));
    const covered=coversPeriod(windows,period),status=reasons.length?'unavailable':covered?'available':'unknown';
    return {id:u.id,name:u.name,status,reasons:reasons.length?reasons:[covered?'Confirmed availability covers the entire period':windows.length?'Saved availability covers only part of this period':'No confirmed availability for this period']};
  });
  return {timezone:business.timezone,...period,checkedAt:new Date(now).toISOString(),workers};
}

export async function teamAvailability(store,managerId,input,clock=Date.now){
  const db=await store.read(),business=managerBusiness(db,managerId);
  const now = clock();
  if (!Object.keys(input).length) {
    return { timezone: business.timezone, today: availabilityHorizon(business.timezone, now).startDate };
  }
  if (!exact(input, ['date'])) return availabilitySnapshot(db,business,input,now);

  const { date } = input;
  const timezone = business.timezone;
  const startsAt = businessInstant(date + 'T00:00', timezone, 'date');
  const next = new Date(date + 'T00:00Z');
  next.setUTCDate(next.getUTCDate() + 1);
  const endsAt = businessInstant(next.toISOString().slice(0, 10) + 'T00:00', timezone, 'date');
  if (Date.parse(endsAt) <= now || Date.parse(startsAt) > now + 90 * 86400000) {
    throw new HttpError(422, 'Choose today or a date within the next 90 days.');
  }
  const remaining = { startsAt: new Date(Math.max(now, Date.parse(startsAt))).toISOString(), endsAt };
  const workers = db.users.filter(u => u.businessId === business.id && u.role === 'worker' && !u.deactivation)
    .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
    .map(worker => {
      const identity = { id: worker.id, name: worker.name };
      if (!worker.passwordHash) {
        return { ...identity, status: 'unavailable', reasons: ['Account setup incomplete'], windows: [] };
      }
      const saved = (db.availabilityWindows || []).filter(window =>
        window.workerId === worker.id && window.businessId === business.id &&
        window.status === 'confirmed' && window.timezone === timezone);
      const commitments = claimCommitments(db, worker, now);
      const windows = freeWindows(saved, commitments, remaining);
      if (windows.length) return { ...identity, status: 'available', reasons: ['Confirmed free time'], windows };
      const hadAvailability = saved.some(window => intervalsOverlap(window, remaining));
      if (hadAvailability) return { ...identity, status: 'unavailable', reasons: ['Existing commitments overlap the confirmed availability'], windows };
      return { ...identity, status: 'unknown', reasons: ['No confirmed free time for this date'], windows };
    });
  return { timezone, checkedAt: new Date(now).toISOString(), workers };
}
export async function coworkerAvailability(store,workerId,input,clock=Date.now){
  const db=await store.read(),{user,business}=workerAccount(db,workerId);
  const snapshot=availabilitySnapshot(db,business,input,clock(),user.id);
  // Employee browsing receives derived eligibility only, never conflict causes or raw windows.
  return {...snapshot,workers:snapshot.workers.map(({id,name,status})=>({id,name,status,reasons:[status==='available'?'Confirmed availability for this period':status==='unavailable'?'Not available for this period':'Availability is not confirmed for the full period']}))};
}

// Today plus the next 13 local dates, from now through exclusive day-15 midnight.
// Find the first instant of the ending local date, including zones that skip midnight.
export function availabilityHorizon(timezone,now){
  const formatter=new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'});
  const dateAt=at=>{const p=Object.fromEntries(formatter.formatToParts(new Date(at)).map(p=>[p.type,p.value]));return `${p.year}-${p.month}-${p.day}`;};
  const startDate=dateAt(now),end=new Date(startDate+'T12:00:00Z');end.setUTCDate(end.getUTCDate()+14);const target=end.toISOString().slice(0,10);
  let low=Date.parse(target+'T00:00:00Z')-48*3600000,high=low+96*3600000;
  while(low<high){const mid=Math.floor((low+high)/2);if(dateAt(mid)<target)low=mid+1;else high=mid;}
  end.setUTCDate(end.getUTCDate()-1);
  return {startsAt:new Date(now).toISOString(),endsAt:new Date(low).toISOString(),startDate,endDate:end.toISOString().slice(0,10),days:14};
}
export function mergeWindows(windows){
  const merged=[];
  for(const r of [...windows].sort((a,b)=>a.startsAt.localeCompare(b.startsAt)||a.endsAt.localeCompare(b.endsAt))){
    const last=merged.at(-1);if(last&&r.startsAt<=last.endsAt){if(r.endsAt>last.endsAt)last.endsAt=r.endsAt;}
    else merged.push({startsAt:r.startsAt,endsAt:r.endsAt});
  }
  return merged;
}
export function freeWindows(windows,commitments,horizon){
  let slots=mergeWindows(windows.filter(r=>intervalsOverlap(r,horizon)).map(r=>({startsAt:r.startsAt<horizon.startsAt?horizon.startsAt:r.startsAt,endsAt:r.endsAt>horizon.endsAt?horizon.endsAt:r.endsAt})));
  for(const busy of mergeWindows(commitments)){
    slots=slots.flatMap(slot=>!intervalsOverlap(slot,busy)?[slot]:[
      ...(slot.startsAt<busy.startsAt?[{startsAt:slot.startsAt,endsAt:busy.startsAt}]:[]),
      ...(busy.endsAt<slot.endsAt?[{startsAt:busy.endsAt,endsAt:slot.endsAt}]:[])
    ]);
  }
  return slots;
}
export async function coworkerUpcomingWindows(store,workerId,clock=Date.now){
  const db=await store.read(),{user,business}=workerAccount(db,workerId),now=clock(),horizon=availabilityHorizon(business.timezone,now);
  const workers=db.users.filter(u=>u.role==='worker'&&u.businessId===business.id&&!u.deactivation&&u.id!==user.id).sort((a,b)=>a.name.localeCompare(b.name)||a.id.localeCompare(b.id)).map(u=>({
    id:u.id,name:u.name,windows:u.passwordHash?freeWindows((db.availabilityWindows||[]).filter(r=>r.workerId===u.id&&r.businessId===business.id&&r.status==='confirmed'&&r.timezone===business.timezone),claimCommitments(db,u,now),horizon):[]
  }));
  return {timezone:business.timezone,checkedAt:new Date(now).toISOString(),horizon,workers};
}
