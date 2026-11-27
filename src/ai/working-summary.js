import { HttpError } from '../auth/errors.js';
import { coverageDisplayState } from '../requests/status.js';
import { listTimeOff } from '../time-off/service.js';
import { addDays, getSchedulePeriod } from '../schedules/publication.js';
import { businessInstant } from '../shifts/create.js';
import { businessCalendar } from './schedule-questions.js';

const limit = 5;
const shiftFields = ({ title, startsAt, endsAt }) => ({ title, startsAt, endsAt });
const section = (label, rows, href, linkLabel) => ({ label, count: rows.length, rows: rows.slice(0, limit), href, linkLabel });

export async function workingSummary(store, userId, week, clock = Date.now) {
  if (!['this', 'next'].includes(week)) throw new HttpError(422, 'Choose this week or next week.');
  const db = await store.read();
  const user = db.users.find(row => row.id === userId && row.passwordHash !== null && !row.deactivation);
  const business = db.businesses.find(row => row.id === user?.businessId);
  if (!business || !['worker', 'manager'].includes(user?.role)) throw new HttpError(401, 'Please sign in to continue.');
  const now = clock();
  const { timezone } = business;
  const calendar = businessCalendar(now, timezone);
  const { startDate, endDate } = week === 'next' ? calendar.nextWeek : calendar.thisWeek;
  const start = Date.parse(businessInstant(startDate + 'T00:00', timezone, 'startDate'));
  const end = Date.parse(businessInstant(endDate + 'T00:00', timezone, 'endDate'));

  // The published collection is the same source the employee schedule uses.
  const shifts = db.shifts.filter(shift => shift.businessId === business.id &&
    Date.parse(shift.startsAt) < end && Date.parse(shift.endsAt) > start)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.id.localeCompare(b.id));
  const byId = new Map(shifts.map(shift => [shift.id, shift]));
  const manager = user.role === 'manager';
  const coverage = db.coverageRequests.filter(request => request.businessId === business.id &&
    byId.has(request.shiftId) && (manager || request.originalWorkerId === user.id || request.claimantId === user.id))
    .map(request => ({ request, shift: byId.get(request.shiftId) }))
    .sort((a, b) => a.shift.startsAt.localeCompare(b.shift.startsAt) || a.request.id.localeCompare(b.request.id))
    .map(({ request, shift }) => ({
      ...shiftFields(shift),
      status: coverageDisplayState(request, shift, now).displayStatus,
      ...(!manager && { relationship: request.originalWorkerId === user.id ? 'Your coverage request' : 'Your claim' }),
    }));
  const pending = coverage.filter(row => row.status === 'pending');
  const open = coverage.filter(row => row.status === 'open');
  const sections = manager ? [
    section('Claims awaiting approval', pending, '/workspace/manager/approvals', 'Open Approvals'),
    section('Open requests for cover', open, '/workspace/manager/schedule', 'Open Schedule'),
  ] : [
    section('Upcoming assigned shifts', shifts.filter(shift => shift.assignedWorkerId === user.id &&
      Date.parse(shift.endsAt) > now).map(shiftFields), '/workspace/worker/shifts', 'Open My shifts'),
    section('Coverage awaiting approval', pending, '/workspace/worker/requests', 'Open My requests'),
    section('Open requests for cover', open, '/workspace/worker/requests', 'Open My requests'),
    section('Other coverage outcomes', coverage.filter(row => !['pending', 'open'].includes(row.status)),
      '/workspace/worker/requests', 'Open My requests'),
  ];
  if (manager) {
    const snapshot = { read: async () => db };
    const { requests } = await listTimeOff(snapshot, userId, 'manager', () => now);
    const leave = requests.filter(row => row.status === 'pending')
      .map(({ workerName, startsAt, endsAt }) => ({ title: workerName, startsAt, endsAt }));
    const period = await getSchedulePeriod(snapshot, userId, null, now);
    const publication = ['due', 'overdue'].includes(period.dueStatus)
      ? [{ title: period.dueStatus === 'due' ? 'Publication due today' : 'Publication overdue',
          detail: `Monday ${period.dueOn} · ${period.drafts.length} unpublished changes` }]
      : [];
    sections.push(
      section('Time-off requests awaiting review', leave, '/workspace/manager/time-off', 'Open Time off'),
      section('Schedule publication due or overdue', publication, '/workspace/manager/schedule', 'Open Schedule'),
    );
  }
  return { kind: 'working_summary', title: manager ? 'Your team’s attention summary' : 'Your working week',
    week, startDate, lastDate: addDays(endDate, -1), timezone, asOf: new Date(now).toISOString(), sections };
}
