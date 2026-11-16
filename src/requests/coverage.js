import { createHash } from 'node:crypto';
import { HttpError } from '../auth/errors.js';
import { createRecord } from '../storage/repositories.js';
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const requestRevision = request => digest(request);
export const coverageShiftRevision = (db, shift) => digest([shift, db.coverageRequests.filter(request => request.shiftId === shift.id)]);
export function coverageAccount(db, userId) {
  const user = db.users.find(user => user.id === userId);
  if (!user || user.passwordHash === null) throw new HttpError(401, 'Please sign in to continue.');
  if (user.role !== 'worker') throw new HttpError(403, 'Only workers can manage their coverage requests.');
  const business = db.businesses.find(b => b.id === user.businessId);
  if (!business) throw new HttpError(401, 'Please sign in to continue.');
  return { user, business };
}
export function cancelReason(request, shift, user, now) {
  if (!['open', 'pending'].includes(request.status)) return 'This request is already closed.';
  if (Date.parse(shift.startsAt) <= now) return 'This shift has started. Cancellation is no longer available.';
  if (shift.assignedWorkerId !== user.id) return 'You are no longer assigned to this shift.';
  return null;
}
export function coverageState(db, shift, now) {
  const active = db.coverageRequests.find(r => r.shiftId === shift.id && ['open', 'pending'].includes(r.status));
  return { revision: coverageShiftRevision(db, shift), request: active ? { id: active.id, status: active.status } : null, canRequest: Date.parse(shift.startsAt) > now && !active };
}
function inputRevision(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length !== 1 || typeof input.revision !== 'string' || !/^[a-f0-9]{64}$/.test(input.revision)) throw new HttpError(422, 'Refresh this page and submit only its current revision.');
  return input.revision;
}
export async function requestCoverage(store, userId, shiftId, input, clock = Date.now) {
  const revision = inputRevision(input);
  return store.transaction(db => {
    const { user, business } = coverageAccount(db, userId);
    const shift = db.shifts.find(s => s.id === shiftId && s.businessId === business.id && s.assignedWorkerId === user.id);
    if (!shift) throw new HttpError(404, 'Assigned shift not found. Refresh My shifts.');
    if (coverageShiftRevision(db, shift) !== revision) throw new HttpError(409, 'This shift or its coverage changed. Refresh My shifts before trying again.');
    const now = clock();
    if (Date.parse(shift.startsAt) <= now) throw new HttpError(409, 'Coverage can only be requested before the shift starts.');
    if (db.coverageRequests.some(r => r.shiftId === shift.id && ['open','pending'].includes(r.status))) throw new HttpError(409, 'This shift already has an active coverage request.');
    const request = createRecord({ businessId: business.id, shiftId: shift.id, originalWorkerId: user.id, claimantId: null, reviewerId: null, status: 'open' });
    request.createdAt = request.updatedAt = new Date(now).toISOString();
    db.coverageRequests.push(request);
    return { request: { id: request.id, status: request.status }, message: 'Coverage requested. You remain assigned until coverage is approved.' };
  });
}
export async function cancelCoverage(store, userId, requestId, input, clock = Date.now) {
  const revision = inputRevision(input);
  return store.transaction(db => {
    const { user, business } = coverageAccount(db, userId);
    const request = db.coverageRequests.find(r => r.id === requestId && r.businessId === business.id && r.originalWorkerId === user.id);
    if (!request) throw new HttpError(404, 'Coverage request not found. Refresh My requests.');
    if (requestRevision(request) !== revision) throw new HttpError(409, 'This request changed. Refresh My requests and review its current status.');
    const shift = db.shifts.find(s => s.id === request.shiftId && s.businessId === business.id);
    if (!shift) throw new HttpError(404, 'Shift not found.');
    const now = clock(); const reason = cancelReason(request, shift, user, now);
    if (reason) throw new HttpError(409, reason);
    request.status = 'cancelled';
    request.updatedAt = new Date(Math.max(now, Date.parse(request.updatedAt) + 1)).toISOString();
    // Keep claimant/reviewer metadata and the original shift assignment intact.
    return { request: { id: request.id, status: request.status }, message: 'Coverage request cancelled. You remain assigned to the shift.' };
  });
}
export async function ownRequests(store, userId, now = Date.now()) {
  const db = await store.read(); const { user, business } = coverageAccount(db, userId);
  const requests = db.coverageRequests.filter(r => r.businessId === business.id && r.originalWorkerId === user.id)
    .sort((a,b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id)).map(request => {
      const shift = db.shifts.find(s => s.id === request.shiftId && s.businessId === business.id);
      if (!shift) throw new Error('Invalid coverage shift reference');
      const reason = cancelReason(request, shift, user, now);
      const claimant = request.claimantId ? db.users.find(u => u.id === request.claimantId && u.businessId === business.id) : null;
      return { id: request.id, status: request.status, createdAt: request.createdAt, updatedAt: request.updatedAt, revision: requestRevision(request), canCancel: reason === null, cancelReason: reason, claimantName: claimant?.name ?? null, stillAssigned: shift.assignedWorkerId === user.id, shift: { id: shift.id, title: shift.title, startsAt: shift.startsAt, endsAt: shift.endsAt, status: Date.parse(shift.endsAt) <= now ? 'completed' : Date.parse(shift.startsAt) <= now ? 'in_progress' : 'upcoming' } };
    });
  const claims = db.coverageRequests.filter(r => r.businessId === business.id && r.claimantId === user.id && r.originalWorkerId !== user.id)
    .sort((a,b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id)).map(request => {
      const shift = db.shifts.find(s => s.id === request.shiftId && s.businessId === business.id);
      const original = db.users.find(u => u.id === request.originalWorkerId && u.businessId === business.id);
      if (!shift || !original) throw new Error('Invalid coverage claim reference');
      return { id: request.id, status: request.status, updatedAt: request.updatedAt, originalWorkerName: original.name, assignedToYou: shift.assignedWorkerId === user.id, shift: { id: shift.id, title: shift.title, startsAt: shift.startsAt, endsAt: shift.endsAt, status: Date.parse(shift.endsAt) <= now ? 'completed' : Date.parse(shift.startsAt) <= now ? 'in_progress' : 'upcoming' } };
    });
  return { requests, claims, timezone: business.timezone, asOf: new Date(now).toISOString() };
}
