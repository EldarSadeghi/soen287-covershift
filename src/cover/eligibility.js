import {coversPeriod} from '../availability/intervals.js';
import {claimCommitments} from '../requests/claim.js';
import {findClaimConflicts} from '../../public/claim-conflicts.js';
export function coverEligibility(db,recipientId,shift,now){
  const worker=db.users.find(u=>u.id===recipientId&&u.role==='worker'&&u.businessId===shift.businessId);
  if(!worker||worker.deactivation||!worker.passwordHash)return 'This coworker is no longer eligible.';
  if(Date.parse(shift.startsAt)<=now)return 'The shift has started.';
  const business=db.businesses.find(b=>b.id===shift.businessId);
  const windows=(db.availabilityWindows||[]).filter(r=>r.workerId===recipientId&&r.businessId===shift.businessId&&r.status==='confirmed'&&r.timezone===business.timezone);
  if(!coversPeriod(windows,shift)||findClaimConflicts(shift,claimCommitments(db,worker,now)).length)return 'This coworker is no longer available for the full shift.';
  return null;
}
export function directedApprovalReason(db,request,shift,now){
  const invitation=(db.coverInvitations||[]).find(r=>r.requestId===request.id&&r.status==='accepted');
  return invitation?coverEligibility(db,invitation.recipientId,shift,now):null;
}
