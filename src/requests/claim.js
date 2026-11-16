import { createHash } from 'node:crypto';
import { HttpError } from '../auth/errors.js';
import { coverageAccount } from './coverage.js';
import { findClaimConflicts } from '../../public/claim-conflicts.js';
export const claimRevision = (request, shift) => createHash('sha256').update(JSON.stringify([request, shift])).digest('hex');
export function claimCommitments(db, user, now) {
  const shifts = db.shifts.filter(s => s.businessId === user.businessId && Date.parse(s.endsAt) > now);
  const pending = new Set(db.coverageRequests.filter(r => r.businessId === user.businessId && r.status === 'pending' && r.claimantId === user.id).map(r => r.shiftId));
  return shifts.filter(s => s.assignedWorkerId === user.id || pending.has(s.id)).map(s => ({ id: s.id, title: s.title, startsAt: s.startsAt, endsAt: s.endsAt, kind: s.assignedWorkerId === user.id ? 'assigned' : 'pending_claim' }));
}
function inspect(db, userId, requestId, input, now) {
  const { user, business } = coverageAccount(db, userId);
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length !== 1 || typeof input.revision !== 'string' || !/^[a-f0-9]{64}$/.test(input.revision)) throw new HttpError(422, 'Refresh the board and submit only the current request revision.');
  const request = db.coverageRequests.find(r => r.id === requestId && r.businessId === business.id);
  if (!request) throw new HttpError(404, 'Coverage request not found. Refresh the board.');
  if (request.originalWorkerId === user.id) throw new HttpError(409, 'You cannot claim your own coverage request.');
  const shift = db.shifts.find(s => s.id === request.shiftId && s.businessId === business.id);
  if (!shift || request.status !== 'open' || request.claimantId !== null || request.reviewerId !== null || shift.assignedWorkerId !== request.originalWorkerId || Date.parse(shift.startsAt) <= now) throw new HttpError(409, 'This request is no longer available. Refresh the board.');
  if (claimRevision(request, shift) !== input.revision) throw new HttpError(409, 'This request changed. Refresh the board and review it again.');
  const commitments = claimCommitments(db, user, now);
  return { user, request, shift, commitments, conflicts: findClaimConflicts(shift, commitments), timezone: business.timezone };
}
export async function checkClaim(store, userId, requestId, input, clock = Date.now) {
  const result = inspect(await store.read(), userId, requestId, input, clock());
  // Preview is non-mutating and does not reserve the request. Final claim must
  // repeat everything in the exclusive transaction; this result is advisory.
  return { canClaim: result.conflicts.length === 0, conflicts: result.conflicts, commitments: result.commitments, timezone: result.timezone };
}
export async function claimCoverage(store, userId, requestId, input, clock = Date.now) {
  return store.transaction(db => {
    const now = clock(); const result = inspect(db, userId, requestId, input, now);
    if (result.conflicts.length) throw new HttpError(409, 'This shift overlaps your assigned shifts or pending claims. You cannot claim it.', { conflicts: result.conflicts });
    const request = result.request;
    request.claimantId = result.user.id; request.status = 'pending';
    request.updatedAt = new Date(Math.max(now, Date.parse(request.updatedAt) + 1)).toISOString();
    return { request: { id: request.id, status: request.status }, message: 'Claim submitted for manager approval. The original worker remains assigned until approval.' };
  });
}
