import { HttpError } from '../auth/errors.js';
import { coverageHistory } from '../requests/history.js';
import {
  addDays,
  getSchedulePeriod,
  localDate,
} from '../schedules/publication.js';
import { managerBusiness } from '../shifts/create.js';
import { listTimeOff } from '../time-off/service.js';
import { coverageGaps, shiftHistory, teamHours } from './manager-insights.js';
import { replacementSuggestions } from './replacements.js';
import { copyWeekDraft, dutyShift } from './manager-drafts.js';

const kinds = new Set([
  'teamTimeOff',
  'coverageStatus',
  'publicationStatus',
  'teamHours',
  'coverageGaps',
  'shiftHistory',
  'replacements',
  'copyWeek',
  'shiftDuties',
]);
const HOURS_FOCUS = new Set([
  'most',
  'fewest',
  'under',
  'over',
  'overtime',
  'all',
]);

function validateDate(date) {
  const instant = Date.parse(date + 'T12:00Z');
  if (
    !/^20\d{2}-\d{2}-\d{2}$/.test(date) ||
    !Number.isFinite(instant) ||
    new Date(instant).toISOString().slice(0, 10) !== date
  ) {
    throw new HttpError(422, 'Choose a valid calendar date.');
  }
}

export function timeOffRow({ workerName, startsAt, endsAt, status, allDay }) {
  return { workerName, startsAt, endsAt, status, allDay };
}

export async function managerLookup(store, userId, query, clock = Date.now) {
  const db = await store.read();
  const business = managerBusiness(db, userId);
  const snapshot = { read: async () => db };
  const now = clock();
  const timezone = business.timezone;
  const asOf = new Date(now).toISOString();
  if (!query.size) return { today: localDate(now, timezone), timezone };
  const kind = query.get('kind');
  if (
    !kinds.has(kind) ||
    [...query.keys()].some(
      (key) =>
        ![
          'kind',
          'from',
          'through',
          'title',
          'focus',
          'hours',
          'worker',
        ].includes(key) || query.getAll(key).length !== 1,
    )
  ) {
    throw new HttpError(422, 'Choose a supported manager lookup.');
  }
  const from = query.get('from');
  const through = query.get('through') ?? from;
  const title = query.get('title')?.trim().toLowerCase();
  if (from !== null) validateDate(from);
  if (through !== null) validateDate(through);
  if (
    (from && through < from) ||
    (!from && through) ||
    (query.has('title') &&
      (![
        'coverageStatus',
        'shiftHistory',
        'replacements',
        'shiftDuties',
      ].includes(kind) ||
        !title ||
        title.length > 120))
  ) {
    throw new HttpError(422, 'Choose an ordered date range or a shift title.');
  }
  const metadata = { kind, timezone, asOf, from, through };

  // CS-068: from is the week to copy and through the week to copy it to.
  if (kind === 'copyWeek') {
    if (
      !from ||
      from === through ||
      ['title', 'worker', 'focus', 'hours'].some((key) => query.has(key))
    )
      throw new HttpError(422, 'Choose a week to copy and a later week.');
    return {
      ...metadata,
      ...copyWeekDraft(db, business, { source: from, target: through }, now),
    };
  }
  if (kind === 'shiftDuties') {
    const worker = query.get('worker')?.trim();
    if (!from || from !== through || query.has('focus') || query.has('hours'))
      throw new HttpError(422, 'Choose the date of the shift.');
    if (query.has('worker') && (!worker || worker.length > 80))
      throw new HttpError(422, 'Choose the employee whose shift it is.');
    return {
      ...metadata,
      ...dutyShift(db, business, { from, title, worker }, now),
    };
  }
  if (kind === 'replacements') {
    const worker = query.get('worker')?.trim();
    if (!from || from !== through)
      throw new HttpError(422, 'Choose the date of the shift to cover.');
    if (query.has('focus') || query.has('hours'))
      throw new HttpError(422, 'Choose a supported manager lookup.');
    if (query.has('worker') && (!worker || worker.length > 80))
      throw new HttpError(422, 'Choose the employee whose shift needs cover.');
    return {
      ...metadata,
      title: query.get('title'),
      worker: query.get('worker'),
      ...replacementSuggestions(db, business, { from, title, worker }, now),
    };
  }
  if (query.has('worker'))
    throw new HttpError(422, 'Choose a supported manager lookup.');

  if (['teamHours', 'coverageGaps', 'shiftHistory'].includes(kind)) {
    if (!from) throw new HttpError(422, 'Choose a date or period to check.');
    if (kind === 'shiftHistory' && from !== through)
      throw new HttpError(422, 'Choose one date for shift history.');
    if (kind !== 'teamHours' && (query.has('focus') || query.has('hours')))
      throw new HttpError(422, 'Choose a supported manager lookup.');
    if (kind === 'teamHours') {
      const focus = query.get('focus') ?? 'all';
      const threshold = Number(query.get('hours'));
      const needsHours = ['under', 'over'].includes(focus);
      if (
        !HOURS_FOCUS.has(focus) ||
        needsHours !== query.has('hours') ||
        (needsHours &&
          (!Number.isInteger(threshold) || threshold < 1 || threshold > 168))
      )
        throw new HttpError(
          422,
          'Choose who to compare, such as under 20 hours.',
        );
      return {
        ...metadata,
        ...teamHours(db, business, { from, through, focus, threshold }),
      };
    }
    const lookup = kind === 'coverageGaps' ? coverageGaps : shiftHistory;
    return {
      ...metadata,
      ...(kind === 'shiftHistory' && { title: query.get('title') }),
      ...(await lookup(db, business, userId, { from, through, title }, now)),
    };
  }

  if (kind === 'publicationStatus') {
    if (from !== through)
      throw new HttpError(
        422,
        'Choose one date in the two-week schedule period.',
      );
    const date = from && new Date(from + 'T12:00Z');
    const monday = date && addDays(from, -((date.getUTCDay() + 6) % 7));
    const period = await getSchedulePeriod(snapshot, userId, monday, now);
    return {
      ...metadata,
      from: period.startsOn,
      through: period.endsOn,
      publishedAt: period.publishedAt,
      dueOn: period.dueOn,
      dueStatus: period.dueStatus,
      unpublished: period.drafts.length,
    };
  }
  if (!from && !title) throw new HttpError(422, 'Choose a date to check.');
  // Compare local dates, including records that end exactly at midnight.
  const overlaps = ({ startsAt, endsAt }) =>
    !from ||
    (localDate(startsAt, timezone) <= through &&
      localDate(Date.parse(endsAt) - 1, timezone) >= from);

  if (kind === 'teamTimeOff') {
    const { requests } = await listTimeOff(
      snapshot,
      userId,
      'manager',
      () => now,
    );
    const rows = requests
      .filter(
        (row) => ['approved', 'pending'].includes(row.status) && overlaps(row),
      )
      .map(timeOffRow);
    return { ...metadata, rows };
  }

  const { records } = await coverageHistory(snapshot, userId, 'manager', now);
  const rows = records
    .filter(
      (row) =>
        ['open', 'pending', 'approved'].includes(row.displayStatus) &&
        overlaps(row.shift) &&
        (!title || row.shift.title.toLowerCase() === title),
    )
    .map(({ shift, displayStatus, claimantName, originalWorkerName }) => ({
      title: shift.title,
      startsAt: shift.startsAt,
      endsAt: shift.endsAt,
      status: displayStatus,
      workerName: displayStatus === 'open' ? originalWorkerName : claimantName,
    }));
  return { ...metadata, title: query.get('title'), rows };
}
