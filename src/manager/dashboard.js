import {publicationEnabled,effectiveShifts,draftShift} from '../schedules/publication.js';
import { coverageDisplayState } from '../requests/status.js';
import { reviewState } from '../requests/review.js';
import { shiftRevision, shiftLockReason } from '../shifts/manage.js';
import { HttpError } from '../auth/errors.js';

export async function managerDashboard(store, userId, now = Date.now()) {
  const db = await store.read();
  const manager = db.users.find(user => user.id === userId);
  if (!manager || manager.passwordHash === null) throw new HttpError(401, 'Please sign in to continue.');
  if (manager.role !== 'manager') throw new HttpError(403, 'Only managers can access this dashboard.');
  const business = db.businesses.find(business => business.id === manager.businessId);
  if (!business) throw new HttpError(401, 'Please sign in to continue.');
  const workers = new Map(db.users.filter(user => user.businessId === business.id && user.role === 'worker').map(user => [user.id, user]));
  const businessShifts = new Map(effectiveShifts(db).filter(shift => shift.businessId === business.id).map(shift => [shift.id, shift]));
  const publishedShifts=new Map(db.shifts.filter(s=>s.businessId===business.id).map(s=>[s.id,s]));
  const person = id => { const worker = workers.get(id); if (!worker) throw new Error('Invalid business worker reference'); return { id: worker.id, name: worker.name }; };
  const timing = shift => Date.parse(shift.endsAt) <= now ? 'completed' : Date.parse(shift.startsAt) <= now ? 'in_progress' : 'upcoming';
  const shiftView = shift => ({ id: shift.id, draft:Boolean(draftShift(db,shift.id)), title: shift.title, duties:shift.duties||[], startsAt: shift.startsAt, endsAt: shift.endsAt, status: timing(shift), revision: shiftRevision(shift), lockReason: shiftLockReason(db, publishedShifts.get(shift.id)||shift, now), assignedWorker: person(shift.assignedWorkerId) });
  const shifts = [...businessShifts.values()].filter(shift => Date.parse(shift.endsAt) > now)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.id.localeCompare(b.id)).map(shiftView);
  const coverage = db.coverageRequests.filter(request => request.businessId === business.id);
  const expiredCoverage = coverage.filter(request => coverageDisplayState(request, publishedShifts.get(request.shiftId), now).displayStatus === 'expired').length;
  const pendingClaims = coverage.filter(request => request.status === 'pending' && Date.parse(publishedShifts.get(request.shiftId).startsAt) > now)
    .map(request => {
      const shift = publishedShifts.get(request.shiftId);
      if (!shift) throw new Error('Invalid business shift reference');
      return { id: request.id, ...reviewState(db, request, shift, now), status: 'pending', createdAt: request.createdAt, shift: {...shiftView(shift),draft:false}, originalWorker: person(request.originalWorkerId), claimant: person(request.claimantId) };
    }).sort((a, b) => a.shift.startsAt.localeCompare(b.shift.startsAt) || a.id.localeCompare(b.id));
  // Expired unresolved records remain available in History, not in the
  // actionable approval queue. Reading never creates a decision or a write.
  return { publicationEnabled:publicationEnabled(db,business.id), timezone: business.timezone, asOf: new Date(now).toISOString(), summary: { workers: [...workers.values()].filter(u=>!u.deactivation).length, shifts: shifts.length, pendingClaims: pendingClaims.length, expiredCoverage }, shifts, pendingClaims };
}
