import { HttpError } from '../auth/errors.js';
import { coverageHistory } from '../requests/history.js';
import {
  addDays,
  getSchedulePeriod,
  localDate,
} from '../schedules/publication.js';
import { managerBusiness } from '../shifts/create.js';
import { listTimeOff } from '../time-off/service.js';

const kinds = new Set(['teamTimeOff', 'coverageStatus', 'publicationStatus']);

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
        !['kind', 'from', 'through', 'title'].includes(key) ||
        query.getAll(key).length !== 1,
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
      (kind !== 'coverageStatus' || !title || title.length > 120))
  ) {
    throw new HttpError(422, 'Choose an ordered date range or a shift title.');
  }
  const metadata = { kind, timezone, asOf, from, through };

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
