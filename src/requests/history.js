import { coverageDisplayState } from './status.js';
import { HttpError } from '../auth/errors.js';
// Called only inside the same exclusive transaction as the successful mutation.
export function recordCoverageEvent(db, request, action, actorId, at, previous = null) {
  db.schemaVersion = Math.max(db.schemaVersion, 4);
  if (!request.history) request.history = previous ? [{ action: 'legacy', actorId: null, at: previous.updatedAt, status: previous.status }] : [];
  request.history.push({ action, actorId, at, status: request.status });
}
export async function coverageHistory(store, userId, role, now = Date.now()) {
  const db = await store.read(); const user = db.users.find(u => u.id === userId);
  if (!user || user.passwordHash === null) throw new HttpError(401, 'Please sign in to continue.');
  if (!['worker', 'manager'].includes(role) || user.role !== role) throw new HttpError(403, 'This history is not available for your account role.');
  const business = db.businesses.find(b => b.id === user.businessId);
  if (!business) throw new HttpError(401, 'Please sign in to continue.');
  const person = id => id === null ? null : db.users.find(u => u.id === id && u.businessId === business.id)?.name ?? 'Team member';
  const records = db.coverageRequests.filter(r => r.businessId === business.id && (role === 'manager' || r.originalWorkerId === user.id || r.claimantId === user.id)).map(r => {
    const shift = db.shifts.find(s => s.id === r.shiftId && s.businessId === business.id);
    const events = r.history || [{ action: 'legacy', actorId: null, at: r.updatedAt, status: r.status }];
    return { id: r.id, status: r.status, ...coverageDisplayState(r, shift, now), updatedAt: r.updatedAt, originalWorkerName: person(r.originalWorkerId), claimantName: person(r.claimantId), reviewerName: person(r.reviewerId), assignedWorkerName: person(shift.assignedWorkerId),
      shift: { id: shift.id, title: shift.title, duties:shift.duties||[], startsAt: shift.startsAt, endsAt: shift.endsAt, status: Date.parse(shift.endsAt) <= now ? 'completed' : Date.parse(shift.startsAt) <= now ? 'in_progress' : 'upcoming' },
      events: events.map(e => ({ action: e.action, status: e.status, at: e.at, actorName: person(e.actorId) })) };
  }).sort((a,b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id));
  return { records, timezone: business.timezone, asOf: new Date(now).toISOString() };
}
