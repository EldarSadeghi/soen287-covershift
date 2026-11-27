import { createHash } from 'node:crypto';
import { HttpError } from '../auth/errors.js';
import { assertPrepared, effectiveShifts, ensureScheduleSchema, publicationEnabled, stageShift } from '../schedules/publication.js';
import { createRecord } from '../storage/repositories.js';
import { assignmentFields, managerBusiness, validateShiftInput } from './create.js';

export const MAX_BATCH_SHIFTS = 5;
// A copied week (CS-068) may hold more, if every shift starts in one
// Monday–Sunday week; the same checks apply to each shift.
export const MAX_COPY_SHIFTS = 40;
const validBatchId = value => typeof value === 'string' && /^[a-f0-9-]{36}$/.test(value);
const receiptFor = (db, business, managerId, batchId) => (db.shiftBatches || []).find(row =>
  row.businessId === business.id && row.managerId === managerId && row.id === batchId);
const receipt = ({ id, count, draft }) => ({ batchId: id, count, draft });

function oneWeek(shifts) {
  const days = shifts.map(shift => typeof shift?.startLocal === 'string' ? shift.startLocal.slice(0, 10) : '');
  if (days.some(day => !/^20\d{2}-\d{2}-\d{2}$/.test(day))) return false;
  const monday = day => { const date = new Date(day + 'T12:00Z'); date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7); return date.toISOString().slice(0, 10); };
  return new Set(days.map(monday)).size === 1;
}

export function batchAssignments(db, business, shifts, now, { copy = false } = {}) {
  const limit = copy ? MAX_COPY_SHIFTS : MAX_BATCH_SHIFTS;
  if (!Array.isArray(shifts) || shifts.length < (copy ? 1 : 2) || shifts.length > limit) {
    throw new HttpError(422, copy ? `Review between one and ${MAX_COPY_SHIFTS} copied shifts.` : 'Review between two and five shifts.');
  }
  if (copy && !oneWeek(shifts)) throw new HttpError(422, 'A copied week must start every shift in the same Monday–Sunday week.');
  const draft = publicationEnabled(db, business.id);
  const candidate = { ...db, shifts: draft ? effectiveShifts(db) : [...db.shifts] };
  return shifts.map((input, index) => {
    try {
      const fields = assignmentFields(candidate, business, validateShiftInput(input), now);
      if (draft) assertPrepared(db, business, fields);
      candidate.shifts.push(fields);
      return fields;
    } catch (error) {
      if (!(error instanceof HttpError)) throw error;
      throw new HttpError(error.status, `Shift ${index + 1}: ${error.message}`, error.fields);
    }
  });
}

export async function saveShiftBatch(store, managerId, input, clock = Date.now) {
  const keys = input && typeof input === 'object' ? Object.keys(input) : [];
  if (!input || !(keys.length === 3 || (keys.length === 4 && input.copy === true)) || !validBatchId(input.batchId) ||
      !Array.isArray(input.shifts) || typeof input.timezone !== 'string') {
    throw new HttpError(422, 'Submit the reviewed batch, its confirmation ID and timezone.');
  }
  const { batchId, shifts, timezone } = input;
  const copy = input.copy === true;
  const fingerprint = createHash('sha256').update(JSON.stringify([timezone, ...(copy ? ['copy'] : []), shifts.map(shift =>
    shift && typeof shift === 'object' ? Object.fromEntries(Object.entries(shift).sort(([a], [b]) => a.localeCompare(b))) : shift
  )])).digest('hex');
  return store.transaction(db => {
    const business = managerBusiness(db, managerId);
    const saved = receiptFor(db, business, managerId, batchId);
    if (saved) {
      if (saved.fingerprint !== fingerprint) throw new HttpError(409, 'This confirmation ID already saved a different batch.');
      return receipt(saved);
    }
    if (business.timezone !== timezone) throw new HttpError(409, 'The business timezone changed. Review a new batch.');
    const fields = batchAssignments(db, business, shifts, clock(), { copy });
    const draft = publicationEnabled(db, business.id);
    for (const values of fields) {
      const shift = createRecord(values);
      if (draft) stageShift(db, business, shift, null);
      else db.shifts.push(shift);
    }
    ensureScheduleSchema(db);
    db.schemaVersion = 14;
    db.shiftBatches ||= [];
    const record = { id: batchId, businessId: business.id, managerId, fingerprint, count: fields.length, draft };
    db.shiftBatches.push(record);
    return receipt(record);
  });
}

export async function getShiftBatchReceipt(store, managerId, batchId) {
  const db = await store.read();
  const business = managerBusiness(db, managerId);
  const saved = receiptFor(db, business, managerId, batchId);
  if (!saved) throw new HttpError(404, 'No saved receipt for this batch yet.');
  return receipt(saved);
}
