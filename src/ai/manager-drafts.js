// Manager drafts prepared from chat (CS-068). Read-only: these build what the
// manager reviews; saving goes through the existing batch save or the
// Schedule edit form, with their usual checks.
import { HttpError } from '../auth/errors.js';
import { businessLocal } from '../../public/manage-shift.js';
import {
  addDays,
  effectiveShifts,
  localDate,
} from '../schedules/publication.js';
import { shiftRevision } from '../shifts/manage.js';
import { periodBounds } from './manager-insights.js';
import { lockReason } from './shift-edit.js';

export const MAX_COPY_SHIFTS = 40;
export const DUTY_SHIFT_CHOICES = 10;
const MAX_DUTIES = 10;

const isMonday = (day) => new Date(day + 'T12:00Z').getUTCDay() === 1;
const nameOf = (db, id) =>
  db.users.find((user) => user.id === id)?.name ?? 'Team member';
const activeWorker = (db, business, id) =>
  db.users.find(
    (user) =>
      user.id === id &&
      user.businessId === business.id &&
      user.role === 'worker' &&
      !user.deactivation,
  );
// The shifts the manager sees on Schedule, including private drafts.
const visibleShifts = (db, business) =>
  effectiveShifts(db).filter((shift) => shift.businessId === business.id);

/**
 * Copies of the shifts starting in the business week beginning `source`
 * (a Monday), moved to the week beginning `target`: same title, employee,
 * local times and duties. Shifts that can't be copied are listed with a reason.
 */
export function copyWeekDraft(db, business, { source, target }, now) {
  if (!isMonday(source) || !isMonday(target) || target <= source)
    throw new HttpError(422, 'Choose a week to copy and a later week.');
  const { timezone } = business;
  const { start, end } = periodBounds(source, addDays(source, 6), timezone);
  const offset =
    (Date.parse(target + 'T12:00Z') - Date.parse(source + 'T12:00Z')) /
    86400000;
  const move = (instant) => {
    const local = businessLocal(instant, timezone);
    return addDays(local.slice(0, 10), offset) + local.slice(10);
  };
  const shifts = [];
  const skipped = [];
  const rows = visibleShifts(db, business)
    .filter((shift) => {
      const at = Date.parse(shift.startsAt);
      return at >= start && at < end;
    })
    .sort(
      (a, b) =>
        a.startsAt.localeCompare(b.startsAt) || a.id.localeCompare(b.id),
    );
  for (const shift of rows) {
    const row = {
      title: shift.title,
      workerName: nameOf(db, shift.assignedWorkerId),
    };
    const copy = {
      title: shift.title,
      assignedWorkerId: shift.assignedWorkerId,
      startLocal: move(shift.startsAt),
      endLocal: move(shift.endsAt),
      ...(shift.duties?.length && { duties: [...shift.duties] }),
    };
    if (!activeWorker(db, business, shift.assignedWorkerId))
      skipped.push({ ...row, reason: 'Employee is no longer active' });
    else if (
      copy.startLocal <= businessLocal(new Date(now).toISOString(), timezone)
    )
      skipped.push({ ...row, reason: 'The copy would start in the past' });
    else if (shifts.length >= MAX_COPY_SHIFTS)
      skipped.push({
        ...row,
        reason: `Over the ${MAX_COPY_SHIFTS}-shift limit`,
      });
    else shifts.push(copy);
  }
  const workers = db.users
    .filter(
      (user) =>
        user.businessId === business.id &&
        user.role === 'worker' &&
        !user.deactivation,
    )
    .map(({ id, name }) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return {
    source,
    target,
    total: rows.length,
    shifts,
    skipped,
    withDuties: shifts.filter((shift) => shift.duties).length,
    workers,
  };
}

/**
 * The shift on business-local date `from` (optionally narrowed by a title word
 * and the assigned employee's name) to add a duty to, as the Schedule edit form
 * needs it. One match is returned with its edit lock, if any; several are listed.
 */
export function dutyShift(db, business, { from, title, worker }, now) {
  const { timezone } = business;
  const word = title?.trim().toLowerCase();
  const person = worker?.trim().toLowerCase();
  const matches = visibleShifts(db, business)
    .filter((shift) => {
      const name = nameOf(db, shift.assignedWorkerId).toLowerCase();
      return (
        localDate(shift.startsAt, timezone) === from &&
        (!word ||
          shift.title
            .toLowerCase()
            .split(/\s+/)
            .some((part) => part.startsWith(word))) &&
        (!person || name === person || name.split(/\s+/).includes(person))
      );
    })
    .sort(
      (a, b) =>
        a.startsAt.localeCompare(b.startsAt) || a.id.localeCompare(b.id),
    );
  // Every choice carries what the Schedule edit form needs, so picking one
  // from a list opens it directly. Rechecked when the edit is saved.
  const row = (shift) => {
    const duties = shift.duties || [];
    return {
      id: shift.id,
      title: shift.title,
      workerName: nameOf(db, shift.assignedWorkerId),
      startsAt: shift.startsAt,
      endsAt: shift.endsAt,
      revision: shiftRevision(shift),
      duties,
      draft: {
        title: shift.title,
        assignedWorkerId: shift.assignedWorkerId,
        startLocal: businessLocal(shift.startsAt, timezone),
        endLocal: businessLocal(shift.endsAt, timezone),
      },
      locked: lockReason(db, shift, now) || null,
      full: duties.length >= MAX_DUTIES,
    };
  };
  if (matches.length !== 1)
    return {
      status: matches.length ? 'choose' : 'none',
      total: matches.length,
      shifts: matches.slice(0, DUTY_SHIFT_CHOICES).map(row),
    };
  return { status: 'ready', shift: row(matches[0]) };
}
