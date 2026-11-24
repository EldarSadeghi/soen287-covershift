import {createHash,randomUUID} from 'node:crypto';
import {HttpError} from '../auth/errors.js';
import {coverageAccount} from '../requests/coverage.js';
import {businessInstant,managerBusiness} from '../shifts/create.js';
import {intervalsOverlap} from '../../public/claim-conflicts.js';
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value);
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
function employee(db,id){const result=coverageAccount(db,id);if(result.user.deactivation)throw new HttpError(401,'Please sign in to continue.');return result;}
export function timeOffFields(input,timezone,now,requireFuture=true) {
  const keys=['startLocal','endLocal','allDay','note','submissionId','timezone'];
  if(!input||Array.isArray(input)||Object.keys(input).length!==keys.length||!keys.every(k=>Object.hasOwn(input,k))||!uuid(input.submissionId)||typeof input.allDay!=='boolean'||input.timezone!==timezone)throw new HttpError(422,'Review the dates in your current business timezone before submitting.');
  if(typeof input.note!=='string'||input.note.length>500||/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(input.note))throw new HttpError(422,'Use an optional note of up to 500 characters.');
  const startsAt=businessInstant(input.startLocal,timezone,'startLocal'),endsAt=businessInstant(input.endLocal,timezone,'endLocal');
  const wallDuration=Date.parse(input.endLocal+'Z')-Date.parse(input.startLocal+'Z');
  if(endsAt<=startsAt||wallDuration>366*86400000||wallDuration<=0)throw new HttpError(422,'The end must follow the start, within 366 calendar days.');
  if(input.allDay&&(!input.startLocal.endsWith('T00:00')||!input.endLocal.endsWith('T00:00')))throw new HttpError(422,'Full-day leave must start and end at midnight in your business timezone.');
  if(requireFuture&&(Date.parse(startsAt)<=now||Date.parse(startsAt)>now+366*86400000))throw new HttpError(422,'Time off must start in the future, within one year.');
  return {startsAt,endsAt,timezone,allDay:input.allDay,note:input.note.trim(),submissionId:input.submissionId};
}
export function timeOffBlockers(db,r,now) {
  const assigned=db.shifts.filter(s=>s.businessId===r.businessId&&s.assignedWorkerId===r.workerId&&Date.parse(s.endsAt)>now&&intervalsOverlap(s,r)).map(s=>({id:s.id,title:s.title,kind:'assignment',startsAt:s.startsAt,endsAt:s.endsAt}));
  for(const claim of db.coverageRequests.filter(c=>c.businessId===r.businessId&&c.claimantId===r.workerId&&c.status==='pending')){
    const shift=db.shifts.find(s=>s.id===claim.shiftId&&s.businessId===r.businessId);
    if(shift&&Date.parse(shift.endsAt)>now&&intervalsOverlap(shift,r))assigned.push({id:shift.id,requestId:claim.id,title:shift.title,kind:'pending_claim',startsAt:shift.startsAt,endsAt:shift.endsAt});
  }
  return assigned.sort((a,b)=>a.startsAt.localeCompare(b.startsAt)||a.id.localeCompare(b.id));
}
export function timeOffState(db,r,now) {
  const worker=db.users.find(u=>u.id===r.workerId),blockers=timeOffBlockers(db,r,now),active=Boolean(worker&&!worker.deactivation&&worker.passwordHash!==null);
  const other=(db.timeOffRequests||[]).some(x=>x.id!==r.id&&x.workerId===r.workerId&&x.businessId===r.businessId&&x.status==='approved'&&intervalsOverlap(r,x));
  const approvalReason=r.status!=='pending'?'This request is no longer pending.':!active?'The employee is inactive or cannot sign in.':Date.parse(r.startsAt)<=now?'This time-off period has started.':blockers.length?'Resolve overlapping assignments and pending claims before approving.':other?'Another approved time-off request overlaps this period.':null;
  return {revision:digest([r,active,blockers,other]),blockers,canApprove:!approvalReason,approvalReason,canReject:r.status==='pending',canCancel:active&&['pending','approved'].includes(r.status)&&Date.parse(r.startsAt)>now};
}
function dto(db,r,role,now){
  const state=timeOffState(db,r,now),worker=db.users.find(u=>u.id===r.workerId);
  return {...r,workerName:worker.name,reviewerName:db.users.find(u=>u.id===r.reviewerId)?.name||null,
    history:r.history.map(e=>({...e,actorName:db.users.find(u=>u.id===e.actorId).name})),
    ...state,canApprove:role==='manager'&&state.canApprove,canReject:role==='manager'&&state.canReject,canCancel:role==='worker'&&state.canCancel,
    periodState:Date.parse(r.endsAt)<=now?'past':Date.parse(r.startsAt)<=now?'in_progress':'future'};
}
export async function listTimeOff(store,userId,role,clock=Date.now){
  const db=await store.read(),business=role==='manager'?managerBusiness(db,userId):employee(db,userId).business,now=clock();
  return {requests:(db.timeOffRequests||[]).filter(r=>r.businessId===business.id&&(role==='manager'||r.workerId===userId)).sort((a,b)=>(a.status==='pending'?0:1)-(b.status==='pending'?0:1)||b.createdAt.localeCompare(a.createdAt)||b.id.localeCompare(a.id)).map(r=>dto(db,r,role,now)),timezone:business.timezone,asOf:new Date(now).toISOString()};
}
export async function requestTimeOff(store,userId,input,clock=Date.now){
  return store.transaction(db=>{
    const {business}=employee(db,userId),now=clock(),values=timeOffFields(input,business.timezone,now,false);
    const existing=(db.timeOffRequests||[]).find(r=>r.workerId===userId&&r.submissionId===values.submissionId);
    if(existing){if(existing.businessId!==business.id||Object.keys(values).some(k=>existing[k]!==values[k]))throw new HttpError(409,'This submission was already used for different time off. Refresh your requests.');return {replayed:true,request:dto(db,existing,'worker',now),message:'This request was already saved. Check its current status.'};}
    timeOffFields(input,business.timezone,now);
    const mine=(db.timeOffRequests||[]).filter(r=>r.workerId===userId&&r.businessId===business.id);
    if(mine.some(r=>['pending','approved'].includes(r.status)&&intervalsOverlap(r,values)))throw new HttpError(409,'A pending or approved time-off request already overlaps these dates. Refresh your requests.');
    if(mine.filter(r=>r.status==='pending').length>=20)throw new HttpError(409,'You already have 20 pending requests. Resolve or cancel an existing request first.');
    const at=new Date(now).toISOString(),r={id:randomUUID(),businessId:business.id,workerId:userId,...values,status:'pending',reviewerId:null,createdAt:at,updatedAt:at,history:[{action:'requested',actorId:userId,at,status:'pending'}]};
    db.schemaVersion=Math.max(db.schemaVersion,9);db.availabilityRules||=[];db.availabilityMatches||=[];db.notifications||=[];db.timeOffRequests||=[];db.timeOffRequests.push(r);
    return {request:dto(db,r,'worker',now),message:'Time-off request submitted. Your schedule is unchanged until manager approval.'};
  });
}
export function recordTimeOffEvent(r,action,actorId,now){
  const at=new Date(Math.max(now,Date.parse(r.updatedAt)+1)).toISOString();r.status={approve:'approved',reject:'rejected',cancel:'cancelled',cancel_inactive:'cancelled'}[action];r.updatedAt=at;r.history.push({action,actorId,at,status:r.status});
}
export async function decideTimeOff(store,userId,role,id,action,input,clock=Date.now){
  return store.transaction(db=>{
    const business=role==='manager'?managerBusiness(db,userId):employee(db,userId).business;
    if(!input||Array.isArray(input)||Object.keys(input).length!==1||typeof input.revision!=='string'||!/^[a-f0-9]{64}$/.test(input.revision)||!(role==='manager'?['approve','reject']:['cancel']).includes(action))throw new HttpError(422,'Submit only the current request revision and an allowed action.');
    const r=(db.timeOffRequests||[]).find(r=>r.id===id&&r.businessId===business.id&&(role==='manager'||r.workerId===userId));if(!r)throw new HttpError(404,'Time-off request not found. Refresh the list.');
    const now=clock(),state=timeOffState(db,r,now);
    if(state.revision!==input.revision)throw new HttpError(409,'This request or its commitments changed. Refresh and review it again.');
    if(action==='approve'&&!state.canApprove)throw new HttpError(409,state.approvalReason,{blockers:state.blockers});
    if(action==='reject'&&!state.canReject||action==='cancel'&&!state.canCancel)throw new HttpError(409,'This action is no longer available. Refresh the requests.');
    if(role==='manager')r.reviewerId=userId;recordTimeOffEvent(r,action,userId,now);
    return {request:dto(db,r,role,now),message:action==='approve'?'Time off approved. New overlapping assignments and coverage claims are blocked.':action==='reject'?'Time-off request rejected. Existing assignments are unchanged.':'Time-off request cancelled. Existing assignments and submitted coverage claims are unchanged.'};
  });
}
