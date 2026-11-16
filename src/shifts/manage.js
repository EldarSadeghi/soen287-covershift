import { createHash } from 'node:crypto';
import { HttpError } from '../auth/errors.js';
import { validateShiftInput, managerBusiness, assignmentFields, savedShift } from './create.js';

// A digest of all stored shift fields prevents same-millisecond lost updates
// without adding a schema version or returning private database fields.
export const shiftRevision = shift => createHash('sha256').update(JSON.stringify(shift)).digest('hex');
export function shiftLockReason(db, shift, now) {
  if (Date.parse(shift.startsAt) <= now) return 'This shift has started. It cannot be edited or deleted.';
  if (db.coverageRequests.some(request => request.shiftId === shift.id)) return 'This shift has linked coverage requests. Editing and deletion are locked to preserve requests and history.';
  return null;
}
export async function manageShift(store, managerId, shiftId, action, input, clock = Date.now) {
  const keys = action === 'edit' ? ['revision', 'title', 'assignedWorkerId', 'startLocal', 'endLocal'] : ['revision'];
  if (!['edit', 'delete'].includes(action)) throw new HttpError(404, 'Action not found.');
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length !== keys.length || !keys.every(key => Object.hasOwn(input, key)) || typeof input.revision !== 'string' || !/^[a-f0-9]{64}$/.test(input.revision)) throw new HttpError(422, 'Refresh the schedule and submit the requested fields with its current revision.');
  const { revision, ...values } = input;
  const edit = action === 'edit' ? validateShiftInput(values) : null;
  return store.transaction(db => {
    const business = managerBusiness(db, managerId);
    const shift = db.shifts.find(shift => shift.id === shiftId && shift.businessId === business.id);
    if (!shift) throw new HttpError(404, 'Shift not found. Refresh the schedule.');
    if (shiftRevision(shift) !== revision) throw new HttpError(409, 'This shift changed since you opened it. Cancel, refresh the schedule, and review the latest version.');
    const now = clock();
    const reason = shiftLockReason(db, shift, now);
    if (reason) throw new HttpError(409, reason);
    if (action === 'delete') {
      db.shifts.splice(db.shifts.indexOf(shift), 1);
      return { message: 'The shift was deleted.', deletedId: shift.id };
    }
    const fields = assignmentFields(db, business, edit, now, shift.id);
    Object.assign(shift, fields, { updatedAt: new Date(Math.max(now, Date.parse(shift.updatedAt) + 1)).toISOString() });
    return savedShift(db, shift, business.timezone);
  });
}
