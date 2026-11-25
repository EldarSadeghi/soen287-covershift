import {createHash} from 'node:crypto';
import {coverEligibility} from './eligibility.js';
export const coverDigest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const coverShiftFingerprint=shift=>coverDigest(shift);
export function inviteInvalidReason(db,r,now){
  const sender=db.users.find(u=>u.id===r.senderId&&u.businessId===r.businessId),shift=db.shifts.find(s=>s.id===r.shiftId&&s.businessId===r.businessId);
  if(!sender||sender.deactivation||!sender.passwordHash)return 'The sender is no longer active.';
  if(!shift||coverShiftFingerprint(shift)!==r.shiftSnapshot.revision||shift.assignedWorkerId!==r.senderId)return 'The shift changed or was removed.';
  const active=db.coverageRequests.find(c=>c.shiftId===r.shiftId&&['open','pending'].includes(c.status));
  if(active&&active.status!=='open')return 'Another coverage claim is already pending.';
  return coverEligibility(db,r.recipientId,shift,now);
}
export function coverEvent(db,r,action,actorId,now){
  const at=new Date(Math.max(now,Date.parse(r.updatedAt)+1)).toISOString();
  r.status={sent:'pending',accepted:'accepted',declined:'declined',cancelled:'cancelled',expired:'expired'}[action];r.updatedAt=at;
  r.history.push({action,actorId,at});
  const recipients=action==='sent'?[r.recipientId]:['declined','accepted'].includes(action)?[r.senderId]:action==='cancelled'?[r.recipientId]:[r.senderId,r.recipientId];
  for(const userId of recipients){const u=db.users.find(u=>u.id===userId&&u.businessId===r.businessId&&!u.deactivation&&u.passwordHash);if(!u)continue;
    const id=coverDigest([r.id,action,at,userId]);db.coverNotifications||=[];
    if(!db.coverNotifications.some(n=>n.id===id))db.coverNotifications.push({id,businessId:r.businessId,userId,invitationId:r.id,action,createdAt:at,readAt:null});
  }
}
export function settleCoverInvitations(db,now){
  let count=0;for(const r of db.coverInvitations||[])if(r.status==='pending'&&inviteInvalidReason(db,r,now)){coverEvent(db,r,'expired',null,now);count++;}return count;
}
export function coverDisplayStatus(db,r,now){
  if(r.status==='pending')return inviteInvalidReason(db,r,now)?'expired':'pending';
  if(r.status==='accepted'){const request=db.coverageRequests.find(c=>c.id===r.requestId);return request?.status==='pending'?(Date.parse(r.shiftSnapshot.startsAt)<=now?'expired':'awaiting_approval'):request?.status||'expired';}
  return r.status;
}
