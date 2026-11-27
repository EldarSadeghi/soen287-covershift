import { HttpError } from '../auth/errors.js';
import { addDays, localDate } from '../schedules/publication.js';
import { coverageHistory } from '../requests/history.js';
import { listNotifications } from '../notifications/service.js';

const limit = 5;
function firstOfMonth(year, month) {
  return new Date(Date.UTC(year, month - 1, 1, 12)).toISOString().slice(0, 10);
}

export function historyWindow(period, today) {
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  const tomorrow = addDays(today, 1);
  if (period === 'last-30-days')
    return { from: addDays(today, -29), until: tomorrow };
  if (period === 'this-year') return { from: year + '-01-01', until: tomorrow };
  if (period === 'last-month')
    return {
      from: firstOfMonth(year, month - 1),
      until: firstOfMonth(year, month),
    };
  const named = /^(month|20\d{2})-(0[1-9]|1[0-2])$/.exec(period);
  if (named) {
    const targetMonth = Number(named[2]);
    const targetYear =
      named[1] === 'month'
        ? year - Number(targetMonth > month)
        : Number(named[1]);
    return {
      from: firstOfMonth(targetYear, targetMonth),
      until: firstOfMonth(targetYear, targetMonth + 1),
    };
  }
  const date = new Date(period + 'T12:00Z');
  if (
    /^20\d{2}-\d{2}-\d{2}$/.test(period) &&
    Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 10) === period
  ) {
    return { from: period, until: addDays(period, 1) };
  }
  throw new HttpError(
    422,
    'Choose a valid period, such as last month, November or this year.',
  );
}

export async function employeeLookup(store, userId, query, clock = Date.now) {
  const db = await store.read();
  const user = db.users.find(
    (row) => row.id === userId && row.passwordHash && !row.deactivation,
  );
  const business = db.businesses.find((row) => row.id === user?.businessId);
  if (!business) throw new HttpError(401, 'Please sign in to continue.');
  if (user.role !== 'worker')
    throw new HttpError(403, 'This lookup is for employees.');
  const timezone = business.timezone;
  const now = clock();
  const today = localDate(now, timezone);
  const asOf = new Date(now).toISOString();
  const readOnlyStore = { read: async () => db };
  if (!query.size) return { today, timezone };

  const kind = query.get('kind');
  const period = query.get('period');
  if (kind === 'updates' && query.size === 1) {
    const unread = await listNotifications(readOnlyStore, userId, null, now, {
      unreadOnly: true,
    });
    const page = unread.unreadCount
      ? unread
      : await listNotifications(readOnlyStore, userId, null, now);
    return {
      kind,
      timezone,
      asOf,
      unreadCount: unread.unreadCount,
      rows: page.notifications
        .slice(0, limit)
        .map(({ headline, title, message, createdAt, href, linkLabel }) => ({
          headline,
          title,
          message,
          createdAt,
          href,
          linkLabel,
        })),
    };
  }
  if (kind !== 'history' || query.size !== 2 || period === null) {
    throw new HttpError(422, 'Choose a supported employee lookup.');
  }
  const { from, until } = historyWindow(period, today);
  const { records } = await coverageHistory(
    readOnlyStore,
    userId,
    'worker',
    now,
  );
  const own = new Map(
    db.coverageRequests
      .filter((row) => row.businessId === business.id)
      .map((row) => [row.id, row]),
  );
  const counts = {
    pickedUp: 0,
    givenAway: 0,
    pending: 0,
    declinedOrExpired: 0,
  };
  const rows = records
    .filter(({ shift }) => {
      const day = localDate(shift.startsAt, timezone);
      return from <= day && day < until;
    })
    .sort((a, b) => b.shift.startsAt.localeCompare(a.shift.startsAt))
    .map(({ id, shift, displayStatus }) => {
      const relation = own.get(id).claimantId === userId ? 'claim' : 'request';
      if (displayStatus === 'approved')
        counts[relation === 'claim' ? 'pickedUp' : 'givenAway']++;
      if (['open', 'pending'].includes(displayStatus)) counts.pending++;
      if (['rejected', 'expired'].includes(displayStatus))
        counts.declinedOrExpired++;
      return {
        title: shift.title,
        startsAt: shift.startsAt,
        status: displayStatus,
        relation,
      };
    });
  return {
    kind,
    timezone,
    asOf,
    from,
    through: addDays(until, -1),
    counts,
    total: rows.length,
    rows: rows.slice(0, limit),
  };
}
