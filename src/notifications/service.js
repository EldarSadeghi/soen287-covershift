import {coverDisplayStatus} from '../cover/lifecycle.js';
import { createHash } from 'node:crypto';
import { HttpError } from '../auth/errors.js';
import { coverageDisplayState } from '../requests/status.js';
const eventKey = (r,e) => `${r.id}:${e.action}:${e.at}`;
export const coverageEventKeys = db => new Set(db.coverageRequests.flatMap(r => (r.history || []).map(e => eventKey(r,e))));
// Capture BEFORE a workflow and project AFTER matching, inside its storage lock.
// Existing histories are intentionally not backfilled on upgrade or restart.
export function publishCoverageNotifications(db, before) {
  const existing = new Set((db.notifications || []).map(n => n.id));
  for (const r of db.coverageRequests) for (const e of r.history || []) {
    if (before.has(eventKey(r,e)) || !['claimed','approved','rejected','cancelled'].includes(e.action) || !r.claimantId) continue;
    const recipients = new Set([r.claimantId]);
    if (['approved','rejected'].includes(e.action)) recipients.add(r.originalWorkerId);
    if (['claimed','cancelled'].includes(e.action)) for (const u of db.users) if (u.businessId === r.businessId && u.role === 'manager') recipients.add(u.id);
    for (const userId of recipients) {
      const user = db.users.find(u => u.id === userId && u.businessId === r.businessId);
      if (!user || user.deactivation || user.passwordHash === null) continue;
      const id = createHash('sha256').update(`${eventKey(r,e)}:${userId}`).digest('hex');
      if (existing.has(id)) continue;
      db.schemaVersion = Math.max(db.schemaVersion,8); db.availabilityRules ||= []; db.availabilityMatches ||= []; db.notifications ||= [];
      db.notifications.push({id,businessId:r.businessId,userId,requestId:r.id,action:e.action,createdAt:e.at,readAt:null});existing.add(id);
    }
  }
}
function account(db,userId) {
  const u=db.users.find(u=>u.id===userId && u.passwordHash !== null && !u.deactivation);
  if (!u) throw new HttpError(401,'Please sign in to continue.'); return u;
}
const messages = {
  claimed: {manager:'A coverage request needs your approval.',worker:'Your coverage request was submitted. You are not assigned until a manager approves.'},
  approved: {claimant:'Your request was approved. You are assigned to this shift.',original:'Coverage was approved. You are no longer assigned to this shift.'},
  rejected: {claimant:'Your request was rejected. The original worker remains assigned.',original:'The coverage claim was rejected. You remain assigned; coverage has reopened.'},
  cancelled: {manager:'The original worker cancelled this coverage request. No assignment was transferred.',worker:'The original worker cancelled this coverage request. You were not assigned.'},
};
function presentation(db,user,n,r,shift,status,groupKey){
 const assigned=shift?.assignedWorkerId===user.id;
 const headline={approved:'Cover approved',rejected:'Coverage claim rejected',cancelled:'Request cancelled',expired:'Request expired',declined:'Invitation declined',pending:user.role==='manager'?'Coverage needs your review':'Waiting for manager approval',awaiting_approval:user.role==='manager'?'Coverage needs your review':'Waiting for manager approval',open:'Coverage is open'}[status]||'Cover invitation received';
 const summary=status==='approved'?(user.role==='manager'?'The approved assignment is saved.':assigned?'You are assigned to this shift.':'You are no longer assigned to this shift.'):['pending','awaiting_approval'].includes(status)?(user.role==='manager'?'Review this claim before the assignment changes.':assigned?'You are still assigned until manager approval.':'You are not assigned until manager approval.') : status==='declined'?'The coworker declined this invitation.':status==='cancelled'?'This request was cancelled. No assignment was transferred.':status==='expired'?'This request is no longer available. Check the current schedule.':status==='rejected'?'The claim was rejected. Check the current request for next steps.':status==='open'?'This shift is waiting for a coverage claim.':'Review this invitation to accept or decline.';
 const eventMessage={sent:'Invitation sent',accepted:'Coworker accepted the invitation',claimed:'Coverage claim submitted',approved:'Manager approved the claim',rejected:'Manager rejected the claim',declined:'Coworker declined the invitation',cancelled:'Request cancelled',expired:'Invitation expired'}[n.action];
 return {groupKey,headline,summary,eventMessage,startsAt:shift?.startsAt||r.shiftSnapshot.startsAt,endsAt:shift?.endsAt||r.shiftSnapshot.endsAt,timezone:db.businesses.find(b=>b.id===user.businessId).timezone};
}
export async function listNotifications(store,userId,before=null,now=Date.now()) {
  const db=await store.read(),user=account(db,userId);
  const own=[...(db.notifications||[]),...(db.coverNotifications||[])].filter(n=>n.userId===user.id && n.businessId===user.businessId).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)||b.id.localeCompare(a.id));
  const offset=before===null ? 0 : own.findIndex(n=>n.id===before)+1;
  if (before!==null && offset===0) throw new HttpError(400,'Refresh notifications to start again.');
  const page=own.slice(offset,offset+20);
  return {unreadCount:own.filter(n=>n.readAt===null).length, next:offset+page.length<own.length?page.at(-1).id:null,notifications:page.map(n=>{
    if(n.invitationId){const r=db.coverInvitations.find(r=>r.id===n.invitationId);const message={sent:'A coworker asked you to cover a shift. Review it and accept or decline.',accepted:'Your coworker accepted. Manager approval is still required.',declined:'Your coworker declined your cover invitation.',cancelled:'The sender cancelled this cover invitation.',expired:'This cover invitation is no longer available. No shift was transferred.'}[n.action];const shift=db.shifts.find(s=>s.id===r.shiftId);const status=coverDisplayStatus(db,r,now);const view=presentation(db,user,n,r,shift,status==='pending'?'invited':status,r.requestId?'coverage:'+r.requestId:'invitation:'+r.id);return {...view,id:n.id,title:r.shiftSnapshot.title,message,createdAt:n.createdAt,readAt:n.readAt,currentStatus:coverDisplayStatus(db,r,now),href:`/workspace/${user.role}/cover?invitation=${r.id}`};}
    const r=db.coverageRequests.find(r=>r.id===n.requestId),shift=db.shifts.find(s=>s.id===r.shiftId);
    const audience=['approved','rejected'].includes(n.action)?(user.id===r.claimantId?'claimant':'original'):user.role;
    return {...presentation(db,user,n,r,shift,coverageDisplayState(r,shift,now).displayStatus,'coverage:'+r.id),id:n.id,title:shift.title,message:messages[n.action][audience],createdAt:n.createdAt,readAt:n.readAt,currentStatus:coverageDisplayState(r,shift,now).displayStatus,href:`/workspace/${user.role}/history?request=${r.id}`};
  })};
}
export async function markNotificationsRead(store,userId,input,clock=Date.now) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length!==1 || !Array.isArray(input.ids) || input.ids.length<1 || input.ids.length>100 || input.ids.some(id=>typeof id!=='string'||! /^[a-f0-9]{64}$/.test(id)) || new Set(input.ids).size!==input.ids.length) throw new HttpError(400,'Choose up to 100 displayed notifications.');
  return store.transaction(db=>{
    const user=account(db,userId),records=input.ids.map(id=>[...(db.notifications||[]),...(db.coverNotifications||[])].find(n=>n.id===id && n.userId===user.id && n.businessId===user.businessId));
    if (records.some(n=>!n)) throw new HttpError(404,'Notification not found.');
    for (const n of records) if(n.readAt===null)n.readAt=new Date(Math.max(clock(),Date.parse(n.createdAt))).toISOString();
    return {message:'Selected notifications marked as read.'};
  });
}
