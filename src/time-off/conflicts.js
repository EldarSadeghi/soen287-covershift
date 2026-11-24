import {intervalsOverlap} from '../../public/claim-conflicts.js';
// Shared deterministic eligibility; private notes/history never leave this module.
export function approvedTimeOff(db, workerId) {
  const worker=db.users.find(u=>u.id===workerId);
  return (db.timeOffRequests||[]).filter(r=>r.workerId===workerId&&r.businessId===worker?.businessId&&r.status==='approved');
}
export function timeOffCommitments(db, workerId) {
  return approvedTimeOff(db,workerId).map(r=>({id:'time_off_'+r.id,title:'Approved time off',kind:'time_off',startsAt:r.startsAt,endsAt:r.endsAt}));
}
export function leaveConflicts(db,workerId,interval) {
  return timeOffCommitments(db,workerId).filter(r=>intervalsOverlap(interval,r));
}
