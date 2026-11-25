import { createHash } from 'node:crypto';
import { HttpError } from '../auth/errors.js';
import { assertPrepared, effectiveShifts, ensureScheduleSchema, publicationEnabled, stageShift } from '../schedules/publication.js';
import { createRecord } from '../storage/repositories.js';
import { assignmentFields, managerBusiness, validateShiftInput } from './create.js';

export const MAX_BATCH_SHIFTS = 5;
const validBatchId = value => typeof value === 'string' && /^[a-f0-9-]{36}$/.test(value);
const receiptFor = (db, business, managerId, batchId) => (db.shiftBatches || []).find(row =>
  row.businessId === business.id && row.managerId === managerId && row.id === batchId);
const receipt = ({ id, count, draft }) => ({ batchId: id, count, draft });

export function batchAssignments(db, business, shifts, now) {
  if (!Array.isArray(shifts) || shifts.length < 2 || shifts.length > MAX_BATCH_SHIFTS) {
    throw new HttpError(422, 'Review between two and five shifts.');
  }
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
  if (!input || Object.keys(input).length !== 3 || !validBatchId(input.batchId) ||
      !Array.isArray(input.shifts) || typeof input.timezone !== 'string') {
    throw new HttpError(422, 'Submit the reviewed batch, its confirmation ID and timezone.');
  }
  const { batchId, shifts, timezone } = input;
  const fingerprint = createHash('sha256').update(JSON.stringify([timezone, shifts.map(shift =>
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
    const fields = batchAssignments(db, business, shifts, clock());
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
