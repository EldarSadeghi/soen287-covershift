import { HttpError } from '../auth/errors.js';

export async function managerDashboard(store, userId, now = Date.now()) {
  const db = await store.read();
  const manager = db.users.find(user => user.id === userId);
  if (!manager || manager.passwordHash === null) throw new HttpError(401, 'Please sign in to continue.');
  if (manager.role !== 'manager') throw new HttpError(403, 'Only managers can access this dashboard.');
  const business = db.businesses.find(business => business.id === manager.businessId);
  if (!business) throw new HttpError(401, 'Please sign in to continue.');
  const workers = new Map(db.users.filter(user => user.businessId === business.id && user.role === 'worker').map(user => [user.id, user]));
  const businessShifts = new Map(db.shifts.filter(shift => shift.businessId === business.id).map(shift => [shift.id, shift]));
  const person = id => { const worker = workers.get(id); if (!worker) throw new Error('Invalid business worker reference'); return { id: worker.id, name: worker.name }; };
  const timing = shift => Date.parse(shift.endsAt) <= now ? 'completed' : Date.parse(shift.startsAt) <= now ? 'in_progress' : 'upcoming';
  const shiftView = shift => ({ id: shift.id, title: shift.title, startsAt: shift.startsAt, endsAt: shift.endsAt, status: timing(shift), assignedWorker: person(shift.assignedWorkerId) });
  const shifts = [...businessShifts.values()].filter(shift => Date.parse(shift.endsAt) > now)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.id.localeCompare(b.id)).map(shiftView);
  const pendingClaims = db.coverageRequests.filter(request => request.businessId === business.id && request.status === 'pending')
    .map(request => {
      const shift = businessShifts.get(request.shiftId);
      if (!shift) throw new Error('Invalid business shift reference');
      return { id: request.id, status: 'pending', createdAt: request.createdAt, shift: shiftView(shift), originalWorker: person(request.originalWorkerId), claimant: person(request.claimantId) };
    }).sort((a, b) => a.shift.startsAt.localeCompare(b.shift.startsAt) || a.id.localeCompare(b.id));
  // Pending claims on completed shifts remain visible for attention rather than
  // silently disappearing. This endpoint does not approve or change assignments.
  return { timezone: business.timezone, asOf: new Date(now).toISOString(), summary: { workers: workers.size, shifts: shifts.length, pendingClaims: pendingClaims.length }, shifts, pendingClaims };
}
