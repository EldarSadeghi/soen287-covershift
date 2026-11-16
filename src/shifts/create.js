import { HttpError } from '../auth/errors.js';
import { createRecord } from '../storage/repositories.js';

// Interpret wall-clock input in the business timezone, never the server/browser
// timezone. Test candidate offsets on both sides of timezone transitions, then
// round-trip candidates so skipped/repeated times cannot silently shift.
export function businessInstant(value, timezone, field) {
  const fail = message => { throw new HttpError(422, message, { [field]: message }); };
  if (typeof value !== 'string' || !/^20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) fail('Enter a valid date and time between 2000 and 2099.');
  const naive = Date.parse(`${value}:00.000Z`);
  if (!Number.isFinite(naive) || new Date(naive).toISOString().slice(0, 16) !== value) fail('Enter a valid calendar date and time.');
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
  const local = instant => {
    const p = Object.fromEntries(formatter.formatToParts(new Date(instant)).map(part => [part.type, part.value]));
    return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}`;
  };
  const offsets = new Set();
  for (let hours = -48; hours <= 48; hours += 6) {
    const sample = naive + hours * 3600000;
    offsets.add(Date.parse(`${local(sample)}Z`) - sample);
  }
  const candidates = [...offsets].map(offset => naive - offset).filter(time => local(time) === `${value}:00`);
  if (!candidates.length) fail(`This local time does not exist in ${timezone} because the clocks change. Choose another time.`);
  if (candidates.length > 1) fail(`This local time occurs twice in ${timezone} because the clocks change. Choose an unambiguous time.`);
  return new Date(candidates[0]).toISOString();
}

export function validateShiftInput(input) {
  const keys = ['title', 'assignedWorkerId', 'startLocal', 'endLocal'];
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length !== keys.length || !keys.every(key => Object.hasOwn(input, key))) throw new HttpError(422, 'Submit only the shift title, worker, start and end times.');
  const title = typeof input.title === 'string' ? input.title.trim() : '';
  if (!title || title.length > 100) throw new HttpError(422, 'Enter a shift title using 1–100 characters.', { title: 'Enter a shift title using 1–100 characters.' });
  if (typeof input.assignedWorkerId !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(input.assignedWorkerId)) throw new HttpError(422, 'Choose a worker from your team.', { assignedWorkerId: 'Choose a worker from your team.' });
  return { ...input, title };
}
export function managerBusiness(db, managerId) {
  const manager = db.users.find(user => user.id === managerId);
  if (!manager || manager.passwordHash === null) throw new HttpError(401, 'Please sign in to continue.');
  if (manager.role !== 'manager') throw new HttpError(403, 'Only managers can manage shifts.');
  const business = db.businesses.find(business => business.id === manager.businessId);
  if (!business) throw new HttpError(401, 'Please sign in to continue.');
  return business;
}
export function assignmentFields(db, business, input, now, excludeId = null) {
  const worker = db.users.find(user => user.id === input.assignedWorkerId && user.businessId === business.id && user.role === 'worker');
  if (!worker) throw new HttpError(422, 'Choose a worker from your team.', { assignedWorkerId: 'Choose a worker from your team.' });
  const startsAt = businessInstant(input.startLocal, business.timezone, 'startLocal');
  const endsAt = businessInstant(input.endLocal, business.timezone, 'endLocal');
  if (Date.parse(startsAt) <= now) throw new HttpError(422, 'The shift must start in the future.', { startLocal: 'Choose a future start time.' });
  if (endsAt <= startsAt) throw new HttpError(422, 'The end must be after the start. For overnight shifts, choose the next day.', { endLocal: 'Choose an end date and time after the start.' });
  if (db.shifts.some(shift => shift.id !== excludeId && shift.businessId === business.id && shift.assignedWorkerId === worker.id && shift.startsAt < endsAt && startsAt < shift.endsAt)) throw new HttpError(409, 'This worker already has an overlapping shift. Choose another worker or time.', { assignedWorkerId: 'This worker has an overlapping shift.' });
  return { businessId: business.id, assignedWorkerId: worker.id, title: input.title, startsAt, endsAt };
}
export function savedShift(db, shift, timezone) {
  const worker = db.users.find(user => user.id === shift.assignedWorkerId);
  return { shift: { id: shift.id, title: shift.title, startsAt: shift.startsAt, endsAt: shift.endsAt, assignedWorker: { id: worker.id, name: worker.name } }, timezone };
}
export async function createShift(store, managerId, input, clock = Date.now) {
  input = validateShiftInput(input);
  return store.transaction(db => {
    const business = managerBusiness(db, managerId);
    const shift = createRecord(assignmentFields(db, business, input, clock()));
    db.shifts.push(shift);
    return savedShift(db, shift, business.timezone);
  });
}
