import { coverageAccount } from './coverage.js';

export async function openShiftBoard(store, userId, now = Date.now()) {
  // Authenticate and scope from the same saved snapshot as the board data.
  const db = await store.read(); const { user, business } = coverageAccount(db, userId);
  const shifts = new Map(db.shifts.filter(s => s.businessId === business.id).map(s => [s.id, s]));
  const workers = new Map(db.users.filter(u => u.businessId === business.id && u.role === 'worker').map(u => [u.id, u]));
  const requests = [];
  for (const request of db.coverageRequests) {
    if (request.businessId !== business.id || request.status !== 'open' || request.claimantId !== null || request.reviewerId !== null || request.originalWorkerId === user.id) continue;
    const shift = shifts.get(request.shiftId); const original = workers.get(request.originalWorkerId);
    if (!shift || !original || shift.assignedWorkerId !== original.id || shift.assignedWorkerId === user.id || Date.parse(shift.startsAt) <= now) continue;
    requests.push({ id: request.id, status: 'open', originalWorkerName: original.name, shift: { id: shift.id, title: shift.title, startsAt: shift.startsAt, endsAt: shift.endsAt, status: 'upcoming' } });
  }
  requests.sort((a,b) => a.shift.startsAt.localeCompare(b.shift.startsAt) || a.id.localeCompare(b.id));
  return { requests, timezone: business.timezone, asOf: new Date(now).toISOString() };
}
