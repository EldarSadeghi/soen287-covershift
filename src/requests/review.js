import { recordCoverageEvent } from './history.js';
import { HttpError } from '../auth/errors.js';
import { managerBusiness } from '../shifts/create.js';
import { createRecord } from '../storage/repositories.js';
import { claimRevision, claimCommitments } from './claim.js';
import { findClaimConflicts } from '../../public/claim-conflicts.js';

export function reviewState(db, request, shift, now) {
  const claimant = db.users.find(u => u.id === request.claimantId && u.businessId === request.businessId && u.role === 'worker');
  const reason = request.status !== 'pending' ? 'This claim is no longer pending.' : shift.assignedWorkerId !== request.originalWorkerId ? 'The original assignment changed.' : Date.parse(shift.startsAt) <= now ? 'This shift has started. Decisions are no longer available.' : null;
  const conflicts = claimant ? findClaimConflicts(shift, claimCommitments(db, claimant, now)) : [];
  const approvalReason = reason || (!claimant || claimant.passwordHash === null ? 'The claimant needs an active employee account.' : conflicts.length ? 'The claimant has overlapping assigned shifts or pending claims.' : null);
  return { revision: claimRevision(request, shift), canApprove: !approvalReason, canReject: !reason, approvalReason, rejectionReason: reason, conflicts };
}
export async function reviewCoverage(store, managerId, requestId, decision, input, clock = Date.now) {
  return store.transaction(db => {
    const business = managerBusiness(db, managerId);
    if (!['approve', 'reject'].includes(decision) || !input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length !== 1 || typeof input.revision !== 'string' || !/^[a-f0-9]{64}$/.test(input.revision)) throw new HttpError(422, 'Submit only the current claim revision.');
    const request = db.coverageRequests.find(r => r.id === requestId && r.businessId === business.id);
    if (!request) throw new HttpError(404, 'Coverage claim not found.');
    const shift = db.shifts.find(s => s.id === request.shiftId && s.businessId === business.id);
    const now = clock(); const state = reviewState(db, request, shift, now);
    if (state.revision !== input.revision) throw new HttpError(409, 'This claim changed. Refresh approvals and review it again.');
    const reason = decision === 'approve' ? state.approvalReason : state.rejectionReason;
    if (reason) throw new HttpError(409, `${reason} Refresh approvals.`, { conflicts: state.conflicts });
    const updatedAt = new Date(Math.max(now, Date.parse(request.updatedAt) + 1, Date.parse(shift.updatedAt) + 1)).toISOString();
    const previous = { ...request };
    request.reviewerId = managerId; request.updatedAt = updatedAt;
    if (decision === 'approve') {
      request.status = 'approved'; shift.assignedWorkerId = request.claimantId; shift.updatedAt = updatedAt;
    } else {
      // Retain this claim as an immutable rejected outcome; reopen with a fresh
      // request ID so old claimant/reviewer history and stale revisions survive.
      db.schemaVersion = Math.max(db.schemaVersion, 3); request.status = 'rejected';
      const reopened = { ...createRecord({ businessId: business.id, shiftId: shift.id, originalWorkerId: request.originalWorkerId, claimantId: null, reviewerId: null, status: 'open' }), createdAt: updatedAt, updatedAt };
      recordCoverageEvent(db, reopened, 'reopened', managerId, updatedAt);
      db.coverageRequests.push(reopened);
    }
    recordCoverageEvent(db, request, decision === 'approve' ? 'approved' : 'rejected', managerId, updatedAt, previous);
    return { request: { id: request.id, status: request.status }, message: decision === 'approve' ? 'Coverage approved. The shift is now assigned to the claimant.' : 'Claim rejected. The original worker remains assigned. Coverage was reopened; check the queue for any new eligible request.' };
  });
}
