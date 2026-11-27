import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { employeeLookup, historyWindow } from '../src/ai/employee-lookups.js';
import { answerScheduleQuestion } from '../src/ai/schedule-questions.js';
import { createIntentPasses } from '../src/ai/intent-pass.js';
import { validRoutingEntry } from '../src/ai/routing-log.js';
import { createAppServer } from '../src/app.js';
import { SessionStore } from '../src/auth/sessions.js';
import { buildDemoFixtures } from '../src/demo/fixtures.js';
import {
  listNotifications,
  markNotificationsRead,
} from '../src/notifications/service.js';
import { dutiesSchema } from '../src/shifts/create.js';
import { JsonStore } from '../src/storage/json-store.js';
import {
  historyPeriod,
  resolveChatTarget,
  routeChat,
} from '../public/ai-chat-routing.js';
import { showScheduleAnswer } from '../public/ai-schedule.js';
import { renderEmployeeLookup } from '../public/ai-employee-lookups.js';

const jamie = 'worker_jamie';
const timezone = 'America/Toronto';
const clock = () => Date.parse('2026-12-01T02:00Z');
const december = () => Date.parse('2026-12-01T06:00Z');

test('employee lookups preserve schedule, summary, status, and unsupported routes', () => {
  const examples = [
    ['What are my duties on Thursday?', 'questions'],
    ['What do I have to do on my next shift?', 'questions'],
    ["What's my schedule?", 'questions'],
    ['Did my claim get approved?', 'claimStatus'],
    ['Show my weekly summary', 'summary'],
    ['Which shifts did I pick up last month?', 'history'],
    ['What happened with my coverage requests in November?', 'history'],
    ['How many shifts have I given away?', 'history'],
    ['Any updates for me?', 'updates'],
  ];
  for (const [text, expected] of examples)
    assert.equal(routeChat(text, false), expected);
  const replyToHistory = (text) =>
    resolveChatTarget({
      text,
      manager: false,
      routed: routeChat(text, false),
      previous: { topic: 'history', text: 'Which period should I check?' },
    }).target;
  assert.equal(replyToHistory('November'), 'history');
  assert.equal(replyToHistory('November and delete my shift'), 'clarification');
  assert.equal(replyToHistory('hello'), 'clarification');
  assert.equal(
    historyPeriod('between October and November', '2026-11-30'),
    null,
  );
  assert.equal(
    historyPeriod(
      'What happened to my coverage requests in November 2025?',
      '2026-11-30',
    ),
    '2025-11',
  );
  assert.equal(
    historyPeriod('Show my coverage history', '2026-11-30'),
    'last-30-days',
  );
  assert.deepEqual(historyWindow('last-month', '2026-01-01'), {
    from: '2025-12-01',
    until: '2026-01-01',
  });
  for (const route of ['history', 'updates']) {
    assert.equal(
      validRoutingEntry({ route, decidedBy: 'local', clarification: false })
        .route,
      route,
    );
    assert.equal(
      createIntentPasses().issue(jamie, route, 'lookup', clock()),
      null,
    );
  }
});

test('employee lookup HTTP role gate and saved DTOs preserve duties and notification privacy', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'cs061-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const store = new JsonStore(join(dir, 'db.json'));
  const fixture = await buildDemoFixtures(store, {
    now: Date.parse('2026-11-26T17:00Z'),
    hash: async () => 'fictional-hash',
  });
  await store.transaction((db) => {
    dutiesSchema(db);
    db.shifts.find(
      (row) => row.id === fixture.scenarios.assignedThursday,
    ).duties = ['Jamie opens the counter'];
    db.shifts.find((row) => row.id === fixture.scenarios.manualShift).duties = [
      'OTHER EMPLOYEE CANARY',
    ];
  });
  const before = await readFile(store.filename, 'utf8');
  const result = await answerScheduleQuestion(
    store,
    jamie,
    {
      kind: 'schedule',
      startDate: '2026-12-03',
      endDate: '2026-12-04',
      workerName: '',
    },
    clock,
  );
  assert.ok(
    result.shifts.some((row) => row.duties.includes('Jamie opens the counter')),
  );
  assert.doesNotMatch(JSON.stringify(result), /OTHER EMPLOYEE CANARY/);
  const params = (value) => new URLSearchParams(value);
  const lookup = (value, user = jamie, now = clock) =>
    employeeLookup(store, user, params(value), now);
  assert.equal((await lookup({})).today, '2026-11-30');
  assert.equal(
    (await lookup({ kind: 'history', period: 'last-month' })).from,
    '2026-10-01',
  );
  const november = await lookup(
    { kind: 'history', period: 'last-month' },
    jamie,
    december,
  );
  assert.equal(november.from, '2026-11-01');
  assert.equal(november.through, '2026-11-30');
  assert.equal(november.counts.pickedUp, 1);
  assert.equal(november.total, 1);
  assert.equal(november.rows[0].title, 'Completed coverage');
  assert.equal((await lookup({ kind: 'history', period: '2025-01' })).total, 0);
  const notifications = await listNotifications(store, jamie, null, clock());
  const updates = await lookup({ kind: 'updates' });
  assert.ok(updates.unreadCount > 0);
  assert.equal(updates.unreadCount, notifications.unreadCount);
  assert.deepEqual(
    updates.rows.map((row) => row.title),
    notifications.notifications
      .filter((row) => row.readAt === null)
      .map((row) => row.title),
  );
  assert.equal(
    (await lookup({ kind: 'updates' }, 'worker_taylor')).rows.length,
    0,
  );
  assert.equal(await readFile(store.filename, 'utf8'), before);

  const sessions = new SessionStore();
  const server = createAppServer({ store, sessions, shiftClock: december });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}/api/worker/chat-lookup?kind=history&period=last-month`;
  const headers = (user) => ({
    Cookie: sessions.create(user).cookie.split(';')[0],
  });
  assert.equal((await fetch(url)).status, 401);
  assert.equal(
    (await fetch(url, { headers: headers('manager_morgan') })).status,
    403,
  );
  assert.equal(
    (await fetch(url, { headers: headers(jamie) })).headers.get(
      'cache-control',
    ),
    'no-store',
  );
  assert.equal(await readFile(store.filename, 'utf8'), before);

  await markNotificationsRead(
    store,
    jamie,
    { ids: notifications.notifications.map((row) => row.id) },
    clock,
  );
  const caughtUp = await lookup({ kind: 'updates' });
  assert.equal(caughtUp.unreadCount, 0);
  assert.ok(caughtUp.rows.length);
});

test('schedule card renders duties for each shift and skips empty lists', () => {
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
  const getText = (item) =>
    [item.textContent, ...item.children.flatMap(getText)].filter(Boolean);
  try {
    const card = node('div');
    const shift = {
      title: 'Opening',
      startsAt: '2026-12-03T14:00Z',
      endsAt: '2026-12-03T17:00Z',
      workerName: 'Jamie Lee',
      href: '/workspace/worker/shifts',
      duties: Array.from({ length: 11 }, (_, n) => 'Duty ' + (n + 1)),
    };
    const answer = {
      query: {
        kind: 'schedule',
        startDate: '2026-12-03',
        endDate: '2026-12-04',
      },
      timezone,
      total: 2,
      totalHours: 6,
      scope: 'Jamie Lee',
      asOf: new Date(clock()).toISOString(),
      shifts: [shift, { ...shift, title: 'No duties', duties: [] }],
      pendingClaims: 0,
      scheduleHref: '/workspace/worker/shifts',
    };
    showScheduleAnswer(card, answer, { dutiesFocus: true });
    const rendered = getText(card);
    assert.ok(rendered.includes('Focused on shift duties'));
    assert.equal(rendered.filter((text) => text === 'Shift duties').length, 1);
    assert.equal(rendered.filter((text) => /^Duty \d+$/.test(text)).length, 10);
    assert.ok(!rendered.includes('Duty 11'));
    showScheduleAnswer(card, {
      ...answer,
      query: { kind: 'next' },
      total: 1,
      totalHours: 3,
      shifts: [shift],
    });
    assert.ok(getText(card).includes('Duty 10'));
    assert.match(
      renderEmployeeLookup(card, {
        kind: 'updates',
        timezone,
        asOf: answer.asOf,
        rows: [],
        unreadCount: 0,
      }),
      /no updates/,
    );
  } finally {
    globalThis.document = original;
  }
});
