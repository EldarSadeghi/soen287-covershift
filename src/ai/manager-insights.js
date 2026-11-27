// Read-only manager insights for chat (CS-065): scheduled hours per employee,
// coverage gaps and the coverage history of a shift. Nothing here writes.
import { HttpError } from '../auth/errors.js';
import { coverageHistory } from '../requests/history.js';
import { addDays, localDate } from '../schedules/publication.js';
import { businessInstant } from '../shifts/create.js';
import { timeOffBlockers } from '../time-off/service.js';

// CoverShift stores no overtime rule, so "close to overtime" uses this
// documented weekly line. Change it here; the chat card shows the value used.
export const OVERTIME_WEEKLY_HOURS = 40;
export const OVERTIME_MARGIN_HOURS = 4;
const MAX_PERIOD_DAYS = 31;
const HOUR = 3600000;

// The period [start, end) as instants for local dates from..through.
export function periodBounds(from, through, timezone) {
  const days =
    (Date.parse(through + 'T12:00Z') - Date.parse(from + 'T12:00Z')) /
      86400000 +
    1;
  if (days > MAX_PERIOD_DAYS)
    throw new HttpError(
      422,
      `Choose a period of at most ${MAX_PERIOD_DAYS} days.`,
    );
  const start = Date.parse(businessInstant(from + 'T00:00', timezone, 'from'));
  const end = Date.parse(
    businessInstant(addDays(through, 1) + 'T00:00', timezone, 'through'),
  );
  return { start, end, days };
}

const roundHours = (ms) => Math.round((ms / HOUR) * 100) / 100;

/**
 * Scheduled hours and shift counts per active employee in [start, end),
 * keyed by employee ID so employees who share a name are never merged.
 */
export function hoursByWorker(db, business, start, end) {
  const totals = new Map();
  for (const worker of db.users)
    if (
      worker.businessId === business.id &&
      worker.role === 'worker' &&
      !worker.deactivation
    )
      totals.set(worker.id, { worker, ms: 0, shifts: 0 });
  for (const shift of db.shifts) {
    const total = totals.get(shift.assignedWorkerId);
    if (
      !total ||
      shift.businessId !== business.id ||
      Date.parse(shift.startsAt) >= end ||
      Date.parse(shift.endsAt) <= start
    )
      continue;
    total.ms +=
      Math.min(end, Date.parse(shift.endsAt)) -
      Math.max(start, Date.parse(shift.startsAt));
    total.shifts += 1;
  }
  for (const total of totals.values()) total.hours = roundHours(total.ms);
  return totals;
}

/**
 * Scheduled hours per active employee in the period, counted like schedule
 * questions: saved shifts clipped to the period, using elapsed time (DST-safe).
 * `focus` picks who the answer is about; every row is still returned.
 */
export function teamHours(db, business, { from, through, focus, threshold }) {
  const { start, end, days } = periodBounds(from, through, business.timezone);
  if (focus === 'overtime' && days > 7)
    throw new HttpError(422, 'Choose one week to check overtime.');
  const totals = hoursByWorker(db, business, start, end);
  const rows = [...totals.values()]
    .map(({ worker, hours, shifts }) => ({
      workerName: worker.name,
      hours,
      shifts,
    }))
    .sort(
      (a, b) => b.hours - a.hours || a.workerName.localeCompare(b.workerName),
    );

  const hours = rows.map((row) => row.hours);
  const overtimeFrom = OVERTIME_WEEKLY_HOURS - OVERTIME_MARGIN_HOURS;
  const matches = {
    most: (row) => rows.length && row.hours === Math.max(...hours),
    fewest: (row) => rows.length && row.hours === Math.min(...hours),
    under: (row) => row.hours < threshold,
    over: (row) => row.hours > threshold,
    overtime: (row) => row.hours >= overtimeFrom,
    all: () => true,
  };
  return {
    focus,
    threshold: ['under', 'over'].includes(focus) ? threshold : null,
    overtimeLine: focus === 'overtime' ? OVERTIME_WEEKLY_HOURS : null,
    overtimeFrom: focus === 'overtime' ? overtimeFrom : null,
    teamHours: roundHours(
      hours.reduce((total, value) => total + value * HOUR, 0),
    ),
    matched: rows.filter(matches[focus]).map((row) => row.workerName),
    rows,
  };
}

/**
 * Upcoming shifts in the period that are not safely staffed: open for cover,
 * claimed but awaiting approval, or assigned to someone with approved or
 * pending time off and no coverage request. Time-off notes are never returned.
 */
export async function coverageGaps(
  db,
  business,
  userId,
  { from, through },
  now,
) {
  const { start, end } = periodBounds(from, through, business.timezone);
  const inPeriod = (shift) =>
    Date.parse(shift.startsAt) < end &&
    Date.parse(shift.endsAt) > Math.max(start, now);
  const rows = new Map();
  const { records } = await coverageHistory(
    { read: async () => db },
    userId,
    'manager',
    now,
  );
  for (const record of records) {
    if (
      !['open', 'pending'].includes(record.displayStatus) ||
      !inPeriod(record.shift)
    )
      continue;
    rows.set(record.shift.id, {
      title: record.shift.title,
      startsAt: record.shift.startsAt,
      endsAt: record.shift.endsAt,
      workerName: record.originalWorkerName,
      gap: record.displayStatus,
      claimantName:
        record.displayStatus === 'pending' ? record.claimantName : null,
    });
  }
  const covered = new Set(
    records
      .filter((record) =>
        ['open', 'pending', 'approved'].includes(record.displayStatus),
      )
      .map((record) => record.shift.id),
  );
  for (const request of db.timeOffRequests || []) {
    if (
      request.businessId !== business.id ||
      !['approved', 'pending'].includes(request.status)
    )
      continue;
    const worker = db.users.find((user) => user.id === request.workerId);
    for (const blocker of timeOffBlockers(db, request, now)) {
      if (
        blocker.kind !== 'assignment' ||
        covered.has(blocker.id) ||
        rows.has(blocker.id) ||
        !inPeriod(blocker)
      )
        continue;
      rows.set(blocker.id, {
        title: blocker.title,
        startsAt: blocker.startsAt,
        endsAt: blocker.endsAt,
        workerName: worker?.name ?? 'Team member',
        gap: 'timeOff',
        timeOffStatus: request.status,
      });
    }
  }
  return {
    rows: [...rows.values()].sort(
      (a, b) =>
        a.startsAt.localeCompare(b.startsAt) || a.title.localeCompare(b.title),
    ),
  };
}

/**
 * Shifts starting on one business-local date (optionally whose title contains
 * a word), with the current assignee and every coverage event, oldest first.
 * At most HISTORY_SHIFT_LIMIT rows; `total` counts every matching shift.
 */
export const HISTORY_SHIFT_LIMIT = 10;

export async function shiftHistory(db, business, userId, { from, title }, now) {
  const word = title?.trim().toLowerCase();
  const matching = db.shifts
    .filter(
      (shift) =>
        shift.businessId === business.id &&
        localDate(shift.startsAt, business.timezone) === from &&
        (!word || shift.title.toLowerCase().includes(word)),
    )
    .sort(
      (a, b) =>
        a.startsAt.localeCompare(b.startsAt) || a.id.localeCompare(b.id),
    );
  const shifts = matching.slice(0, HISTORY_SHIFT_LIMIT);
  const { records } = await coverageHistory(
    { read: async () => db },
    userId,
    'manager',
    now,
  );
  return {
    total: matching.length,
    rows: shifts.map((shift) => ({
      title: shift.title,
      startsAt: shift.startsAt,
      endsAt: shift.endsAt,
      workerName:
        db.users.find((user) => user.id === shift.assignedWorkerId)?.name ??
        'Team member',
      events: records
        .filter((record) => record.shift.id === shift.id)
        .flatMap((record) => record.events)
        .sort((a, b) => a.at.localeCompare(b.at))
        .slice(-20),
    })),
  };
}
