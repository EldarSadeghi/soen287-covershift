// Replacement suggestions for managers in chat (CS-066): who could take a
// shift, using exactly the rule cover invitations use (coverEligibility), and
// ranked by scheduled hours that week. Read-only: nothing is sent or saved.
import { findClaimConflicts } from '../../public/claim-conflicts.js';
import { coversPeriod } from '../availability/intervals.js';
import { coverEligibility } from '../cover/eligibility.js';
import { claimCommitments } from '../requests/claim.js';
import { addDays, localDate } from '../schedules/publication.js';
import { teamHours } from './manager-insights.js';

export const REPLACEMENT_SHIFT_CHOICES = 10;

// Generic reasons only: never a time-off note, private cause or contact.
export const EXCLUSION_REASONS = {
  busy: 'Has another shift, claim or time off then',
  unavailable: 'Not confirmed available for the full shift',
  setup: 'Hasn’t finished setting up their login',
};

const nameOf = (db, id) =>
  db.users.find((user) => user.id === id)?.name ?? 'Team member';

function shiftRow(db, shift) {
  return {
    title: shift.title,
    startsAt: shift.startsAt,
    endsAt: shift.endsAt,
    workerName: nameOf(db, shift.assignedWorkerId),
  };
}

// The reason an employee can't take the shift, or null. Kept in step with
// coverEligibility: a test checks that null here means null there.
function exclusion(db, worker, shift, timezone, now) {
  if (!worker.passwordHash) return 'setup';
  if (findClaimConflicts(shift, claimCommitments(db, worker, now)).length)
    return 'busy';
  const windows = (db.availabilityWindows || []).filter(
    (window) =>
      window.workerId === worker.id &&
      window.businessId === shift.businessId &&
      window.status === 'confirmed' &&
      window.timezone === timezone,
  );
  return coversPeriod(windows, shift) ? null : 'unavailable';
}

/**
 * Shifts starting on business-local date `from`, optionally narrowed by a
 * title word and the assigned employee's name. One match gets suggestions;
 * several are listed so the manager can choose; none returns an empty list.
 */
export function replacementSuggestions(
  db,
  business,
  { from, title, worker },
  now,
) {
  const word = title?.trim().toLowerCase();
  const person = worker?.trim().toLowerCase();
  const shifts = db.shifts
    .filter(
      (shift) =>
        shift.businessId === business.id &&
        localDate(shift.startsAt, business.timezone) === from &&
        (!word || shift.title.toLowerCase().includes(word)) &&
        (!person ||
          nameOf(db, shift.assignedWorkerId)
            .toLowerCase()
            .split(/\s+/)
            .some((part) => part === person) ||
          nameOf(db, shift.assignedWorkerId).toLowerCase() === person),
    )
    .sort(
      (a, b) =>
        a.startsAt.localeCompare(b.startsAt) || a.id.localeCompare(b.id),
    );
  if (shifts.length !== 1)
    return {
      status: shifts.length ? 'choose' : 'none',
      total: shifts.length,
      shifts: shifts
        .slice(0, REPLACEMENT_SHIFT_CHOICES)
        .map((shift) => shiftRow(db, shift)),
    };

  const [shift] = shifts;
  if (Date.parse(shift.startsAt) <= now)
    return { status: 'started', shift: shiftRow(db, shift) };

  // Hours in the shift's business week (Monday–Sunday), as in team hours.
  const weekday = (new Date(from + 'T12:00Z').getUTCDay() + 6) % 7;
  const weekFrom = addDays(from, -weekday);
  const weekThrough = addDays(weekFrom, 6);
  const hours = new Map(
    teamHours(db, business, {
      from: weekFrom,
      through: weekThrough,
      focus: 'all',
    }).rows.map((row) => [row.workerName, row.hours]),
  );

  const suggestions = [];
  const excluded = [];
  for (const candidate of db.users) {
    if (
      candidate.businessId !== business.id ||
      candidate.role !== 'worker' ||
      candidate.deactivation ||
      candidate.id === shift.assignedWorkerId
    )
      continue;
    const reason = exclusion(db, candidate, shift, business.timezone, now);
    const row = {
      workerName: candidate.name,
      weekHours: hours.get(candidate.name) ?? 0,
    };
    if (reason) excluded.push({ ...row, reason: EXCLUSION_REASONS[reason] });
    else suggestions.push(row);
  }
  const byName = (a, b) => a.workerName.localeCompare(b.workerName);
  return {
    status: 'ready',
    shift: shiftRow(db, shift),
    weekFrom,
    weekThrough,
    suggestions: suggestions.sort(
      (a, b) => a.weekHours - b.weekHours || byName(a, b),
    ),
    excluded: excluded.sort(byName),
  };
}

// Exported for the test that keeps this in step with cover invitations.
export function eligibleByInvitationRule(db, workerId, shift, now) {
  return coverEligibility(db, workerId, shift, now) === null;
}
