import {randomUUID} from 'node:crypto';
import {HttpError} from '../auth/errors.js';
import {coverageAccount,coverageShiftRevision} from '../requests/coverage.js';
import {claimInDatabase,claimRevision} from '../requests/claim.js';
import {recordCoverageEvent} from '../requests/history.js';
import {availabilityHorizon} from '../availability/windows.js';
import {coverEligibility} from './eligibility.js';
import {coverDigest,coverShiftFingerprint,coverEvent,settleCoverInvitations,inviteInvalidReason,coverDisplayStatus} from './lifecycle.js';
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(v);
const revision=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
function account(db,id){const a=coverageAccount(db,id);if(a.user.deactivation)throw new HttpError(401,'Please sign in to continue.');return a;}
function recipient(db,user,id){const r=db.users.find(u=>u.id===id&&u.businessId===user.businessId&&u.role==='worker'&&u.passwordHash&&!u.deactivation&&u.id!==user.id);if(!r)throw new HttpError(404,'Coworker not found. Refresh availability.');return r;}
function pendingFor(db,shift,now){return (db.coverInvitations||[]).some(r=>r.shiftId===shift.id&&r.status==='pending'&&!inviteInvalidReason(db,r,now));}
function optionRevision(db,shift,id,now){return coverDigest([shift,id,coverageShiftRevision(db,shift),(db.availabilityWindows||[]).filter(r=>r.workerId===id),db.shifts.filter(s=>s.assignedWorkerId===id),db.coverageRequests.filter(r=>r.claimantId===id),(db.timeOffRequests||[]).filter(r=>r.workerId===id),db.users.find(u=>u.id===id),db.businesses.find(b=>b.id===shift.businessId)]);}
function eligible(db,user,shift,to,now){
  const business=db.businesses.find(b=>b.id===user.businessId),h=availabilityHorizon(business.timezone,now);
  if(!shift||shift.businessId!==user.businessId||shift.assignedWorkerId!==user.id||shift.startsAt<h.startsAt||shift.endsAt>h.endsAt||Date.parse(shift.startsAt)<=now)return false;
  if(coverEligibility(db,to.id,shift,now)||pendingFor(db,shift,now))return false;
  if(db.coverageRequests.some(c=>c.shiftId===shift.id&&c.status==='pending'))return false;
  if((db.coverInvitations||[]).some(r=>r.shiftId===shift.id&&r.recipientId===to.id&&r.shiftSnapshot.revision===coverShiftFingerprint(shift)))return false;
  return true;
}
export async function coverOptions(store,userId,recipientId,clock=Date.now){
  const db=await store.read(),{user,business}=account(db,userId),to=recipient(db,user,recipientId),now=clock();
  return {recipient:{id:to.id,name:to.name},timezone:business.timezone,shifts:db.shifts.filter(s=>eligible(db,user,s,to,now)).sort((a,b)=>a.startsAt.localeCompare(b.startsAt)||a.id.localeCompare(b.id)).map(s=>({id:s.id,title:s.title,startsAt:s.startsAt,endsAt:s.endsAt,revision:optionRevision(db,s,to.id,now)}))};
}
function dto(db,r,user,now){
  const status=coverDisplayStatus(db,r,now),shift=db.shifts.find(s=>s.id===r.shiftId);
  return {id:r.id,submissionId:r.submissionId,senderId:r.senderId,recipientId:r.recipientId,senderName:db.users.find(u=>u.id===r.senderId)?.name,recipientName:db.users.find(u=>u.id===r.recipientId)?.name,note:r.note,status,revision:coverDigest([r,shift,status]),requestId:r.requestId,createdAt:r.createdAt,updatedAt:r.updatedAt,shift:{id:r.shiftId,title:r.shiftSnapshot.title,startsAt:r.shiftSnapshot.startsAt,endsAt:r.shiftSnapshot.endsAt},timezone:r.shiftSnapshot.timezone,canAccept:status==='pending'&&user.id===r.recipientId,canDecline:status==='pending'&&user.id===r.recipientId,canCancel:status==='pending'&&user.id===r.senderId,history:r.history};
}
export async function listCoverInvitations(store,userId,clock=Date.now){
  const db=await store.read(),user=db.users.find(u=>u.id===userId&&!u.deactivation&&u.passwordHash);if(!user)throw new HttpError(401,'Please sign in to continue.');
  return {invitations:(db.coverInvitations||[]).filter(r=>r.businessId===user.businessId&&(user.role==='manager'||r.senderId===user.id||r.recipientId===user.id)).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)||b.id.localeCompare(a.id)).map(r=>dto(db,r,user,clock())),timezone:db.businesses.find(b=>b.id===user.businessId).timezone};
}
export async function sendCoverInvitation(store,userId,input,clock=Date.now){
  if(!exact(input,['recipientId','shiftId','revision','submissionId','note'])||!uuid(input.submissionId)||!revision(input.revision)||typeof input.recipientId!=='string'||typeof input.shiftId!=='string'||typeof input.note!=='string'||input.note.length>500||/[\x00-\x1f]/.test(input.note))throw new HttpError(422,'Confirm a current shift and an optional message up to 500 characters.');
  return store.transaction(db=>{
    const {user,business}=account(db,userId),now=clock();settleCoverInvitations(db,now);
    const existing=(db.coverInvitations||[]).find(r=>r.senderId===user.id&&r.submissionId===input.submissionId);
    if(existing){if(existing.shiftId!==input.shiftId||existing.recipientId!==input.recipientId||existing.note!==input.note.trim())throw new HttpError(409,'This submission was already used. Refresh cover requests.');return {invitation:dto(db,existing,user,now),replayed:true,message:'This invitation was already saved. Check its current status.'};}
    const to=recipient(db,user,input.recipientId),shift=db.shifts.find(s=>s.id===input.shiftId);
    if(!eligible(db,user,shift,to,now)||optionRevision(db,shift,to.id,now)!==input.revision)throw new HttpError(409,'The shift or availability changed, or an invitation already exists. Refresh and review again.');
    const mine=(db.coverInvitations||[]).filter(r=>r.senderId===user.id);
    if(mine.length>=1000||mine.filter(r=>Date.parse(r.createdAt)>now-86400000).length>=20)throw new HttpError(429,'Invitation limit reached. You can send up to 20 per day.');
    db.schemaVersion=Math.max(db.schemaVersion,11);for(const key of ['availabilityRules','availabilityMatches','notifications','timeOffRequests','availabilityWindows','coverInvitations','coverNotifications'])db[key]||=[];
    const at=new Date(now).toISOString(),r={id:randomUUID(),businessId:business.id,senderId:user.id,recipientId:to.id,shiftId:shift.id,shiftSnapshot:{title:shift.title,startsAt:shift.startsAt,endsAt:shift.endsAt,timezone:business.timezone,revision:coverShiftFingerprint(shift)},submissionId:input.submissionId,note:input.note.trim(),status:'pending',requestId:null,createdAt:at,updatedAt:at,history:[]};
    db.coverInvitations.push(r);coverEvent(db,r,'sent',user.id,now);
    return {invitation:dto(db,r,user,now),replayed:false,message:'Cover invitation sent. Your coworker must accept, then a manager must approve. You remain assigned.'};
  });
}
export async function decideCoverInvitation(store,userId,id,action,input,clock=Date.now){
  if(!['accept','decline','cancel'].includes(action)||!exact(input,['revision'])||!revision(input.revision))throw new HttpError(422,'Confirm only the current invitation.');
  return store.transaction(db=>{
    const {user,business}=account(db,userId),now=clock();settleCoverInvitations(db,now);
    const r=(db.coverInvitations||[]).find(r=>r.id===id&&r.businessId===business.id&&(action==='cancel'?r.senderId:r.recipientId)===user.id);
    if(!r)throw new HttpError(404,'Cover invitation not found.');
    const current=dto(db,r,user,now);
    if(r.status!=='pending'||current.revision!==input.revision||inviteInvalidReason(db,r,now))throw new HttpError(409,'This invitation changed or expired. Refresh cover requests.');
    if(action==='accept'){
      const shift=db.shifts.find(s=>s.id===r.shiftId);let request=db.coverageRequests.find(c=>c.shiftId===shift.id&&c.status==='open');
      if(!request){const at=new Date(now).toISOString();request={id:randomUUID(),businessId:business.id,shiftId:shift.id,originalWorkerId:r.senderId,claimantId:null,reviewerId:null,status:'open',createdAt:at,updatedAt:at};recordCoverageEvent(db,request,'requested',r.senderId,at);db.coverageRequests.push(request);}
      claimInDatabase(db,user.id,request.id,{revision:claimRevision(request,shift)},now);r.requestId=request.id;coverEvent(db,r,'accepted',user.id,now);
    }else coverEvent(db,r,action==='decline'?'declined':'cancelled',user.id,now);
    return {invitation:dto(db,r,user,now),message:action==='accept'?'Accepted and submitted for manager approval. The original worker remains assigned.':action==='decline'?'Invitation declined. No shift was changed.':'Invitation cancelled. No shift was changed.'};
  });
}
