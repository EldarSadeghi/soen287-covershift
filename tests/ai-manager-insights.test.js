import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { buildDemoFixtures } from '../src/demo/fixtures.js';
import { JsonStore } from '../src/storage/json-store.js';
import { requestTimeOff } from '../src/time-off/service.js';
import { managerLookup } from '../src/ai/manager-lookups.js';
import {
  HISTORY_SHIFT_LIMIT,
  OVERTIME_WEEKLY_HOURS,
  shiftHistory,
  teamHours,
} from '../src/ai/manager-insights.js';
import {
  historyTitle,
  hoursFocus,
  insightPeriod,
  insightQuery,
  renderInsight,
} from '../public/ai-manager-insights.js';

const manager = 'manager_morgan';
const clock = () => Date.parse('2026-11-27T02:00:00Z');

function hoursDb() {
  const business = { id: 'b1', timezone: 'America/Toronto' };
  const worker = (id, name, extra = {}) => ({
    id,
    name,
    role: 'worker',
    businessId: 'b1',
    ...extra,
  });
  const shift = (
    id,
    assignedWorkerId,
    startsAt,
    endsAt,
    businessId = 'b1',
  ) => ({
    id,
    businessId,
    assignedWorkerId,
    title: 'Shift ' + id,
    startsAt,
    endsAt,
  });
  return {
    business,
    db: {
      users: [
        worker('a', 'Avery'),
        worker('b', 'Blake'),
        worker('c', 'Casey'),
        worker('d', 'Drew', { deactivation: { at: '2026-10-01T00:00:00Z' } }),
        { id: 'x', name: 'Other business', role: 'worker', businessId: 'b2' },
        { id: 'm', name: 'Manager', role: 'manager', businessId: 'b1' },
      ],
      shifts: [
        // Week of Mon 2026-10-26 to Sun 2026-11-01 in Toronto (DST ends Nov 1).
        shift('1', 'a', '2026-10-26T13:00:00Z', '2026-10-26T21:00:00Z'), // 8 h
        shift('2', 'a', '2026-10-27T13:00:00Z', '2026-10-28T01:00:00Z'), // 12 h
        shift('3', 'a', '2026-10-28T13:00:00Z', '2026-10-28T21:00:00Z'), // 8 h
        shift('4', 'a', '2026-10-29T13:00:00Z', '2026-10-29T23:00:00Z'), // 10 h
        // Saturday 22:00 EDT to Sunday 03:00 EST: 6 elapsed hours across the change.
        shift('5', 'b', '2026-11-01T02:00:00Z', '2026-11-01T08:00:00Z'),
        // Sunday 22:00 EST to Monday 02:00: only 2 hours fall in the week.
        shift('6', 'b', '2026-11-02T03:00:00Z', '2026-11-02T07:00:00Z'),
        shift('7', 'd', '2026-10-27T13:00:00Z', '2026-10-27T21:00:00Z'),
        shift('8', 'x', '2026-10-27T13:00:00Z', '2026-10-27T21:00:00Z', 'b2'),
      ],
    },
  };
}

test('team hours: active employees only, clipped to the week, DST-safe, with each focus', () => {
  const { db, business } = hoursDb();
  const week = { from: '2026-10-26', through: '2026-11-01' };
  const all = teamHours(db, business, { ...week, focus: 'all' });
  assert.deepEqual(all.rows, [
    { workerName: 'Avery', hours: 38, shifts: 4 },
    { workerName: 'Blake', hours: 8, shifts: 2 },
    { workerName: 'Casey', hours: 0, shifts: 0 },
  ]);
  assert.equal(all.teamHours, 46);
  const focus = (name, threshold) =>
    teamHours(db, business, { ...week, focus: name, threshold }).matched;
  assert.deepEqual(focus('most'), ['Avery']);
  assert.deepEqual(focus('fewest'), ['Casey']);
  assert.deepEqual(focus('under', 10), ['Blake', 'Casey']);
  assert.deepEqual(focus('over', 10), ['Avery']);
  const overtime = teamHours(db, business, { ...week, focus: 'overtime' });
  assert.deepEqual(
    [overtime.matched, overtime.overtimeLine],
    [['Avery'], OVERTIME_WEEKLY_HOURS],
  );
  assert.throws(
    () =>
      teamHours(db, business, {
        from: '2026-10-26',
        through: '2026-11-08',
        focus: 'overtime',
      }),
    { status: 422 },
  );
  assert.throws(
    () =>
      teamHours(db, business, {
        from: '2026-10-01',
        through: '2026-11-08',
        focus: 'all',
      }),
    { status: 422 },
  );
});

test('coverage gaps and shift history use saved records, stay in the business and never expose notes', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'covershift-cs065-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const store = new JsonStore(join(root, 'db.json'));
  const timezone = 'America/Vancouver';
  await buildDemoFixtures(store, {
    now: clock(),
    timezone,
    hash: async () => 'fictional-hash',
  });
  // Alex has a shift on Dec 8 and asks for that day off (pending).
  await store.transaction((db) => {
    db.shifts.push({
      ...db.shifts[0],
      id: 'gap-shift',
      title: 'Inventory count',
      assignedWorkerId: 'worker_alex',
      startsAt: '2026-12-08T18:00:00.000Z',
      endsAt: '2026-12-08T22:00:00.000Z',
    });
    db.businesses.push({ ...db.businesses[0], id: 'other' });
    db.users.push({
      ...db.users.find((user) => user.id === manager),
      id: 'other_manager',
      businessId: 'other',
      email: 'other-manager@example.test',
    });
  });
  await requestTimeOff(
    store,
    'worker_alex',
    {
      startLocal: '2026-12-08T00:00',
      endLocal: '2026-12-09T00:00',
      timezone,
      allDay: true,
      note: 'PRIVATE CANARY',
      submissionId: randomUUID(),
    },
    clock,
  );
  const before = await readFile(store.filename, 'utf8');
  const lookup = (params, user = manager) =>
    managerLookup(store, user, new URLSearchParams(params), clock);

  const gaps = await lookup({
    kind: 'coverageGaps',
    from: '2026-12-01',
    through: '2026-12-14',
  });
  const byTitle = Object.fromEntries(gaps.rows.map((row) => [row.title, row]));
  assert.equal(byTitle['Inventory count'].gap, 'timeOff');
  assert.equal(byTitle['Inventory count'].timeOffStatus, 'pending');
  assert.ok(
    gaps.rows.some(
      (row) => row.gap === 'pending' && row.claimantName === 'Jamie Lee',
    ),
  );
  assert.ok(
    !gaps.rows.some((row) => row.title === 'Completed coverage'),
    'approved cover is not a gap',
  );
  assert.doesNotMatch(JSON.stringify(gaps), /PRIVATE CANARY|submissionId|note/);
  assert.deepEqual(
    (
      await lookup(
        { kind: 'coverageGaps', from: '2026-12-01', through: '2026-12-14' },
        'other_manager',
      )
    ).rows,
    [],
  );

  const history = await lookup({ kind: 'shiftHistory', from: '2026-12-04' });
  const claimed = history.rows.find((row) => row.events.length);
  assert.ok(claimed, 'a Dec 4 shift has coverage activity');
  assert.deepEqual(claimed.events.map((event) => event.action).slice(0, 2), [
    'requested',
    'claimed',
  ]);
  assert.ok(
    claimed.events.every((event, i, all) => !i || all[i - 1].at <= event.at),
    'oldest first',
  );
  const filtered = await lookup({
    kind: 'shiftHistory',
    from: '2026-12-08',
    title: 'inventory',
  });
  assert.deepEqual(
    filtered.rows.map((row) => [row.title, row.workerName, row.events.length]),
    [['Inventory count', 'Alex Morgan', 0]],
  );
  assert.deepEqual(
    (
      await lookup({
        kind: 'shiftHistory',
        from: '2026-12-08',
        title: 'nothing like this',
      })
    ).rows,
    [],
  );

  for (const params of [
    {
      kind: 'teamHours',
      from: '2026-12-01',
      through: '2026-12-07',
      focus: 'under',
    },
    {
      kind: 'teamHours',
      from: '2026-12-01',
      through: '2026-12-07',
      focus: 'loudest',
    },
    {
      kind: 'teamHours',
      from: '2026-12-01',
      through: '2026-12-07',
      focus: 'over',
      hours: '0',
    },
    { kind: 'teamHours', focus: 'most' },
    { kind: 'shiftHistory', from: '2026-12-01', through: '2026-12-02' },
    {
      kind: 'coverageGaps',
      from: '2026-12-01',
      through: '2026-12-02',
      focus: 'most',
    },
    {
      kind: 'coverageGaps',
      from: '2026-12-01',
      through: '2026-12-02',
      title: 'x',
    },
  ]) {
    await assert.rejects(
      lookup(params),
      { status: 422 },
      JSON.stringify(params),
    );
  }
  await assert.rejects(
    lookup(
      { kind: 'teamHours', from: '2026-12-01', through: '2026-12-07' },
      'worker_alex',
    ),
    { status: 403 },
  );
  assert.equal(
    await readFile(store.filename, 'utf8'),
    before,
    'lookups never write',
  );
});

test('the chat reads periods, focus and shift titles from the question', () => {
  const today = '2026-11-26'; // Thursday
  assert.deepEqual(insightPeriod('this week', today), {
    from: '2026-11-23',
    through: '2026-11-29',
  });
  assert.deepEqual(insightPeriod('who is under 20 hours next week', today), {
    from: '2026-11-30',
    through: '2026-12-06',
  });
  assert.deepEqual(insightPeriod('gaps for the next two weeks', today), {
    from: '2026-11-26',
    through: '2026-12-09',
  });
  assert.deepEqual(insightPeriod('December 3 through December 5', today), {
    from: '2026-12-03',
    through: '2026-12-05',
  });
  assert.equal(insightPeriod('who has the most hours', today), null);

  assert.deepEqual(hoursFocus('who’s under 20 hours'), {
    focus: 'under',
    hours: '20',
  });
  assert.deepEqual(hoursFocus('who is over 30 hours'), {
    focus: 'over',
    hours: '30',
  });
  assert.deepEqual(hoursFocus('anyone close to overtime'), {
    focus: 'overtime',
  });
  assert.deepEqual(hoursFocus('who has the most hours'), { focus: 'most' });
  assert.deepEqual(hoursFocus('show hours by employee'), { focus: 'all' });

  assert.equal(
    historyTitle('what happened with Saturday’s closing shift?'),
    'closing',
  );
  assert.equal(
    historyTitle('show the history of the December 5 opening shift'),
    'opening',
  );
  assert.equal(
    historyTitle('history of "Front counter" shift on Friday'),
    'Front counter',
  );
  assert.equal(historyTitle('what happened with the shift on Friday'), null);

  assert.deepEqual(
    insightQuery('teamHours', 'who has the most hours', today).params,
    {
      kind: 'teamHours',
      from: '2026-11-23',
      through: '2026-11-29',
      focus: 'most',
    },
  );
  assert.deepEqual(
    insightQuery('coverageGaps', 'any coverage gaps?', today).params,
    {
      kind: 'coverageGaps',
      from: '2026-11-26',
      through: '2026-12-09',
    },
  );
  assert.deepEqual(
    insightQuery(
      'shiftHistory',
      'what happened with Saturday’s closing shift?',
      today,
    ).params,
    {
      kind: 'shiftHistory',
      from: '2026-11-28',
      through: '2026-11-28',
      title: 'closing',
    },
  );
  assert.match(
    insightQuery('shiftHistory', 'what happened with the closing shift?', today)
      .question,
    /^Which date/,
  );
});

test('a reversed range is asked about instead of replaced by the default period', () => {
  const today = '2026-11-26';
  for (const kind of ['teamHours', 'coverageGaps']) {
    const query = insightQuery(
      kind,
      'Who has the most hours from December 5 to December 3?',
      today,
    );
    assert.equal(query.params, undefined, kind);
    assert.match(query.question, /ends before it starts/);
  }
  assert.deepEqual(insightPeriod('December 5 to December 3', today), {
    reversed: true,
  });
});

test('shift history reports every matching shift when it shows only the first ten', async () => {
  const business = { id: 'b1', timezone: 'America/Toronto' };
  const db = {
    businesses: [business],
    users: [
      { id: 'a', name: 'Avery', role: 'worker', businessId: 'b1' },
      { id: 'm', name: 'Morgan', role: 'manager', businessId: 'b1' },
    ],
    shifts: Array.from({ length: HISTORY_SHIFT_LIMIT + 1 }, (_, n) => ({
      id: 's' + n,
      businessId: 'b1',
      assignedWorkerId: 'a',
      title: 'Shift ' + n,
      startsAt: `2026-12-05T${String(13 + n).padStart(2, '0')}:00:00Z`,
      endsAt: `2026-12-05T${String(13 + n).padStart(2, '0')}:30:00Z`,
    })),
    coverageRequests: [],
  };
  const result = await shiftHistory(
    db,
    business,
    'm',
    { from: '2026-12-05' },
    clock(),
  );
  assert.equal(result.rows.length, HISTORY_SHIFT_LIMIT);
  assert.equal(result.total, HISTORY_SHIFT_LIMIT + 1);

  const node = (tag) => ({
    tag,
    children: [],
    classList: { add() {} },
    setAttribute() {},
    append(...values) {
      this.children.push(...values);
    },
    replaceChildren() {
      this.children = [];
    },
  });
  const original = globalThis.document;
  globalThis.document = { createElement: node };
  try {
    const data = {
      kind: 'shiftHistory',
      from: '2026-12-05',
      through: '2026-12-05',
      timezone: business.timezone,
      asOf: new Date(clock()).toISOString(),
      ...result,
    };
    assert.match(
      renderInsight(node('div'), data),
      /^Showing 10 of 11 shifts on /,
    );
    assert.match(
      renderInsight(node('div'), {
        ...data,
        rows: data.rows.slice(0, 2),
        total: 2,
      }),
      /^2 shifts on /,
    );
  } finally {
    globalThis.document = original;
  }
});
