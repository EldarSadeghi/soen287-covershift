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
  return {timezone:business.timezone,checkedAt:new Date(now).toISOString(),windows:(db.availabilityWindows||[]).filter(r=>r.workerId===user.id&&r.businessId===business.id).sort((a,b)=>b.startsAt.localeCompare(a.startsAt)||a.id.localeCompare(b.id)).map(r=>dto(r,now))};
}
export async function saveWindow(store,userId,input,clock=Date.now){
  if(!exact(input,['window','submissionId'])||typeof input.submissionId!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(input.submissionId))throw new HttpError(422,'Confirm the availability window shown.');
  return store.transaction(db=>{
    const {user,business}=workerAccount(db,userId),now=clock(),values=windowFields(input.window,business.timezone,now,false);
    const mine=(db.availabilityWindows||[]).filter(r=>r.workerId===user.id&&r.businessId===business.id),existing=mine.find(r=>r.submissionId===input.submissionId);
    if(existing){if(Object.keys(values).some(k=>existing[k]!==values[k]))throw new HttpError(409,'This submission was already used for different times. Refresh your availability.');return {window:dto(existing,now),replayed:true,message:'This window was already saved. Check its current status.'};}
    windowFields(input.window,business.timezone,now);
    if(mine.filter(r=>r.status==='confirmed'&&Date.parse(r.endsAt)>now).length>=60||mine.length>=1000)throw new HttpError(409,'Availability limit reached (60 current, 1000 total). Withdraw unused windows or contact your manager.');
    if(mine.some(r=>r.status==='confirmed'&&r.timezone===business.timezone&&r.startsAt===values.startsAt&&r.endsAt===values.endsAt))throw new HttpError(409,'You already saved these times. Refresh your availability.');
    const at=new Date(now).toISOString(),r={id:randomUUID(),businessId:business.id,workerId:user.id,...values,submissionId:input.submissionId,status:'confirmed',createdAt:at,updatedAt:at};
    db.schemaVersion=Math.max(db.schemaVersion,10);db.availabilityRules||=[];db.availabilityMatches||=[];db.notifications||=[];db.timeOffRequests||=[];db.availabilityWindows||=[];db.availabilityWindows.push(r);
    return {window:dto(r,now),replayed:false,message:'Availability saved. Your managers can see these times; coworkers can check your availability status. No shift was requested or assigned.'};
  });
}
export async function withdrawWindow(store,userId,id,input,clock=Date.now){
  if(!exact(input,['revision'])||typeof input.revision!=='string'||!/^[a-f0-9]{64}$/.test(input.revision))throw new HttpError(422,'Use the current availability revision.');
  return store.transaction(db=>{
    const {user,business}=workerAccount(db,userId),now=clock(),r=(db.availabilityWindows||[]).find(r=>r.id===id&&r.workerId===user.id&&r.businessId===business.id);
    if(!r)throw new HttpError(404,'Availability window not found.');
    if(windowRevision(r)!==input.revision||r.status!=='confirmed'||Date.parse(r.endsAt)<=now)throw new HttpError(409,'This window changed or expired. Refresh before trying again.');
    r.status='withdrawn';r.updatedAt=new Date(Math.max(now,Date.parse(r.updatedAt)+1)).toISOString();
    return {window:dto(r,now),message:'Availability withdrawn. Existing shifts, coverage requests and automatic rules are unchanged.'};
  });
}
export function coversPeriod(windows,period){
  let end=period.startsAt;
  for(const r of [...windows].sort((a,b)=>a.startsAt.localeCompare(b.startsAt))){if(r.startsAt>end)break;if(r.endsAt>end)end=r.endsAt;if(end>=period.endsAt)return true;}
  return false;
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
  return availabilitySnapshot(db,business,input,clock());
}
export async function coworkerAvailability(store,workerId,input,clock=Date.now){
  const db=await store.read(),{user,business}=workerAccount(db,workerId);
  const snapshot=availabilitySnapshot(db,business,input,clock(),user.id);
  // Employee browsing receives derived eligibility only, never conflict causes or raw windows.
  return {...snapshot,workers:snapshot.workers.map(({id,name,status})=>({id,name,status,reasons:[status==='available'?'Confirmed availability for this period':status==='unavailable'?'Not available for this period':'Availability is not confirmed for the full period']}))};
}
