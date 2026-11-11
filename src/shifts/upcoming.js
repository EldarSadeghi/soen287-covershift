import { HttpError } from '../auth/errors.js';

// The user ID comes from the authenticated server session, never the URL or
// request body. Re-read identity and assignments together from one snapshot.
export async function upcomingWorkerShifts(store, userId, now = Date.now()) {
  const db = await store.read();
  const user = db.users.find(user => user.id === userId);
  if (!user || user.passwordHash === null) throw new HttpError(401, 'Please sign in to continue.');
  if (user.role !== 'worker') throw new HttpError(403, 'Only workers can access their assigned shifts.');
  const business = db.businesses.find(business => business.id === user.businessId);
  if (!business) throw new HttpError(401, 'Please sign in to continue.');
  const shifts = db.shifts
    .filter(shift => shift.businessId === business.id && shift.assignedWorkerId === user.id && Date.parse(shift.endsAt) > now)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.id.localeCompare(b.id))
    .map(({ id, title, startsAt, endsAt }) => ({ id, title, startsAt, endsAt, status: Date.parse(startsAt) <= now ? 'in_progress' : 'upcoming' }));
  return { shifts, timezone: business.timezone, asOf: new Date(now).toISOString() };
}
