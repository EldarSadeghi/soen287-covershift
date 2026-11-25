import { createHash, randomUUID } from 'node:crypto';
import { HttpError } from '../auth/errors.js';
import { managerBusiness, assignmentFields, dutiesSchema } from '../shifts/create.js';
import { shiftLockReason } from '../shifts/manage.js';

export const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function localDate(instant, timezone) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(instant)).map(p=>[p.type,p.value]));
  return `${p.year}-${p.month}-${p.day}`;
}
export function addDays(day, count) { return new Date(Date.parse(day+'T12:00Z')+count*86400000).toISOString().slice(0,10); }
export function nextScheduleMonday(now, timezone) {
  const today=localDate(now,timezone), weekday=new Date(today+'T12:00Z').getUTCDay();
  return addDays(today,7-((weekday+6)%7));
}
export function periodDates(start) {
  if(typeof start!=='string'||!/^20\d{2}-\d{2}-\d{2}$/.test(start)||!Number.isFinite(Date.parse(start+'T12:00Z'))||new Date(start+'T12:00Z').toISOString().slice(0,10)!==start||new Date(start+'T12:00Z').getUTCDay()!==1)throw new HttpError(422,'Choose a Monday between 2000 and 2099.');
  return {startsOn:start,endsOn:addDays(start,13),dueOn:addDays(start,-7)};
}
export const publicationEnabled=(db,businessId)=>(db.schedulePeriods||[]).some(p=>p.businessId===businessId);
export const inPeriod=(s,p)=>{const day=localDate(s.startsAt,p.timezone);return day>=p.startsOn&&day<=p.endsOn;};
export const draftShift=(db,id)=>(db.scheduleDrafts||[]).find(d=>d.id===id);
export function effectiveShifts(db) {
  const changed=new Set((db.scheduleDrafts||[]).map(d=>d.id));
  return [...db.shifts.filter(s=>!changed.has(s.id)),...(db.scheduleDrafts||[]).filter(d=>!d.deleted).map(d=>d.shift)];
}
export function ensureScheduleSchema(db){dutiesSchema(db);db.schemaVersion=Math.max(db.schemaVersion,13);db.schedulePeriods||=[];db.scheduleDrafts||=[];db.schedulePublications||=[];db.scheduleNotifications||=[];}
export function assertPrepared(db, business, shift) {
  if(!(db.schedulePeriods||[]).some(p=>p.businessId===business.id&&inPeriod(shift,p)))throw new HttpError(409,'Prepare a two-week schedule containing this shift’s start date before saving it.');
}
export function stageShift(db,business,shift,original,deleted=false){
  assertPrepared(db,business,shift);ensureScheduleSchema(db);
  const existing=draftShift(db,shift.id);
  const record={id:shift.id,businessId:business.id,baseRevision:existing?existing.baseRevision:original?digest(original):null,deleted,shift};
  db.scheduleDrafts=db.scheduleDrafts.filter(d=>d.id!==shift.id);
  if(!deleted||record.baseRevision!==null)db.scheduleDrafts.push(record);
  return record;
}
function scopedDrafts(db,p){return (db.scheduleDrafts||[]).filter(d=>d.businessId===p.businessId&&(inPeriod(d.shift,p)||db.shifts.some(s=>s.id===d.id&&inPeriod(s,p))));}
function revision(db,p){return digest([p,scopedDrafts(db,p),db.shifts.filter(s=>s.businessId===p.businessId&&inPeriod(s,p)),db.users.filter(u=>u.businessId===p.businessId),db.coverageRequests.filter(r=>r.businessId===p.businessId),db.timeOffRequests?.filter(r=>r.businessId===p.businessId)]);}
function view(db,business,start,now){
  const p=(db.schedulePeriods||[]).find(p=>p.businessId===business.id&&p.startsOn===start)||{id:null,businessId:business.id,...periodDates(start),timezone:business.timezone};
  const drafts=scopedDrafts(db,p),publications=(db.schedulePublications||[]).filter(r=>r.periodId===p.id),last=publications.at(-1),today=localDate(now,business.timezone);
  const person=id=>db.users.find(u=>u.id===id)?.name||'Employee';
  return {...p,enabled:publicationEnabled(db,business.id),revision:revision(db,p),asOf:new Date(now).toISOString(),publishedAt:last?.at||null,publishedLate:Boolean(publications[0]&&localDate(publications[0].at,business.timezone)>p.dueOn),dueStatus:last?'published':today<p.dueOn?'upcoming':today===p.dueOn?'due':'overdue',
    drafts:drafts.map(d=>({id:d.id,revision:digest(d.shift),title:d.shift.title,workerName:person(d.shift.assignedWorkerId),startsAt:d.shift.startsAt,endsAt:d.shift.endsAt,action:d.deleted?'remove':d.baseRevision?'update':'add'})),
    published:db.shifts.filter(s=>s.businessId===p.businessId&&inPeriod(s,p)).map(s=>({id:s.id,title:s.title,workerName:person(s.assignedWorkerId),startsAt:s.startsAt,endsAt:s.endsAt})),
    history:publications.map(r=>({id:r.id,at:r.at,managerName:person(r.managerId),changes:r.changes.length})).reverse()};
}
export async function getSchedulePeriod(store,userId,start,now=Date.now()) {const db=await store.read(),b=managerBusiness(db,userId);return view(db,b,start||nextScheduleMonday(now,b.timezone),now);}
export async function prepareSchedule(store,userId,input,clock=Date.now){
  if(!input||Object.keys(input).sort().join(',')!=='startsOn')throw new HttpError(422,'Submit only the schedule start date.');
  return store.transaction(db=>{const b=managerBusiness(db,userId),dates=periodDates(input.startsOn),now=clock();if(dates.endsOn<localDate(now,b.timezone))throw new HttpError(422,'Prepare a current or future schedule.');ensureScheduleSchema(db);if(!db.schedulePeriods.some(p=>p.businessId===b.id&&p.startsOn===dates.startsOn))db.schedulePeriods.push({id:randomUUID(),businessId:b.id,...dates,timezone:b.timezone});return view(db,b,dates.startsOn,now);});
}
function validateFutureShift(db,b,shift,now){
  const local=t=>{const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:b.timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(t)).map(p=>[p.type,p.value]));return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;};
  assignmentFields(db,b,{title:shift.title,assignedWorkerId:shift.assignedWorkerId,startLocal:local(shift.startsAt),endLocal:local(shift.endsAt),...(shift.duties?{duties:shift.duties}:{})},now,shift.id);
  const pending=db.coverageRequests.filter(r=>r.status==='pending'&&r.claimantId===shift.assignedWorkerId).map(r=>db.shifts.find(s=>s.id===r.shiftId));
  if(pending.some(s=>s.id!==shift.id&&s.startsAt<shift.endsAt&&shift.startsAt<s.endsAt))throw new HttpError(409,'A draft conflicts with a pending coverage claim. Resolve it before publication.');
}
export async function publishSchedule(store,userId,input,clock=Date.now){
  if(!input||Object.keys(input).sort().join(',')!=='revision,startsOn'||typeof input.revision!=='string'||!/^[a-f0-9]{64}$/.test(input.revision))throw new HttpError(422,'Refresh and review the current schedule before publication.');
  return store.transaction(db=>{
    const b=managerBusiness(db,userId),now=clock();periodDates(input.startsOn);
    const p=(db.schedulePeriods||[]).find(p=>p.businessId===b.id&&p.startsOn===input.startsOn);if(!p)throw new HttpError(409,'Prepare this schedule first.');
    const receipt=(db.schedulePublications||[]).find(r=>r.periodId===p.id&&r.revision===input.revision);if(receipt)return {publicationId:receipt.id,replayed:true,...view(db,b,p.startsOn,now)};
    if(revision(db,p)!==input.revision)throw new HttpError(409,'The schedule or team changed. Refresh and review again.');
    const drafts=scopedDrafts(db,p),prior=db.schedulePublications.some(r=>r.periodId===p.id);
    if(!drafts.length&&prior)throw new HttpError(409,'There are no unpublished changes for this period.');
    const changes=[];
    for(const d of drafts){
      const before=db.shifts.find(s=>s.id===d.id)||null;
      if((before?digest(before):null)!==d.baseRevision)throw new HttpError(409,'A published shift changed while its draft was being prepared. Discard that draft and review again.');
      if(before){const reason=shiftLockReason(db,before,now);if(reason)throw new HttpError(409,reason);if(!inPeriod(before,p))throw new HttpError(409,'Choose a schedule period containing both the original and draft start dates.');}
      if(!inPeriod(d.shift,p))throw new HttpError(409,'Choose a schedule period containing both the original and draft start dates.');
      if(Date.parse(d.shift.startsAt)<=now)throw new HttpError(409,'A draft shift has started. Discard or reschedule it before publication.');
      changes.push({before:before?structuredClone(before):null,after:d.deleted?null:structuredClone(d.shift)});
    }
    const ids=new Set(drafts.map(d=>d.id));
    const candidate={...db,shifts:[...db.shifts.filter(s=>!ids.has(s.id)),...drafts.filter(d=>!d.deleted).map(d=>d.shift)]};
    for(const d of drafts.filter(d=>!d.deleted))validateFutureShift(candidate,b,d.shift,now);
    // New leave or pending-claim conflicts also block an unchanged future shift in this window.
    for(const s of candidate.shifts.filter(s=>s.businessId===b.id&&inPeriod(s,p)&&Date.parse(s.startsAt)>now))validateFutureShift(candidate,b,s,now);
    const at=new Date(now).toISOString(),record={id:randomUUID(),businessId:b.id,periodId:p.id,managerId:userId,at,revision:input.revision,changes};
    db.shifts=candidate.shifts;db.scheduleDrafts=db.scheduleDrafts.filter(d=>!ids.has(d.id));db.schedulePublications.push(record);
    const recipients=new Set([...changes.flatMap(c=>[c.before?.assignedWorkerId,c.after?.assignedWorkerId]),...(!prior?db.shifts.filter(s=>s.businessId===b.id&&inPeriod(s,p)).map(s=>s.assignedWorkerId):[])].filter(Boolean));
    for(const workerId of recipients){const u=db.users.find(u=>u.id===workerId&&!u.deactivation);if(u)db.scheduleNotifications.push({id:digest([record.id,workerId]),businessId:b.id,userId:workerId,publicationId:record.id,createdAt:at,readAt:null});}
    return {publicationId:record.id,replayed:false,...view(db,b,p.startsOn,now)};
  });
}
export async function discardDraft(store,userId,id,input){return store.transaction(db=>{const b=managerBusiness(db,userId),d=draftShift(db,id);if(!d||d.businessId!==b.id)throw new HttpError(404,'Draft not found.');if(!input||Object.keys(input).join(',')!=='revision'||input.revision!==digest(d.shift))throw new HttpError(409,'Draft changed. Refresh first.');db.scheduleDrafts=db.scheduleDrafts.filter(d=>d.id!==id);return {message:'Draft discarded. Published shifts are unchanged.'};});}
