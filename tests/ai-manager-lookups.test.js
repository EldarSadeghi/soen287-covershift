import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createAppServer } from '../src/app.js';
import { SessionStore } from '../src/auth/sessions.js';
import { buildDemoFixtures } from '../src/demo/fixtures.js';
import { JsonStore } from '../src/storage/json-store.js';
import { createShift } from '../src/shifts/create.js';
import {
  getSchedulePeriod,
  prepareSchedule,
  publishSchedule,
} from '../src/schedules/publication.js';
import { requestTimeOff } from '../src/time-off/service.js';
import { managerLookup } from '../src/ai/manager-lookups.js';
import { workingSummary } from '../src/ai/working-summary.js';
import { validRoutingEntry } from '../src/ai/routing-log.js';
import { createIntentPasses } from '../src/ai/intent-pass.js';
import {
  MANAGER_LOOKUPS,
  resolveChatTarget,
  routeChat,
} from '../public/ai-chat-routing.js';
import { managerLookupQuery } from '../public/ai-manager-lookups.js';

const manager = 'manager_morgan';
const clock = () => Date.parse('2026-11-27T02:00:00Z');

test('manager lookup routing keeps scheduling, availability and status separate', () => {
  const cases = [
    ['Who can work tomorrow?', 'teamAvailability'],
    ['Who is working tomorrow?', 'questions'],
    ['Who is on the rota Thursday night?', 'questions'],
    ['Is anyone scheduled Thursday night?', 'clarification'],
    ["Who's off tomorrow?", 'teamTimeOff'],
    ['Is "Afternoon coverage" covered?', 'coverageStatus'],
    ['Has the next schedule been published?', 'publicationStatus'],
    ['Who has the most hours this week?', 'teamHours'],
    ['Any coverage gaps next week?', 'coverageGaps'],
    ["What happened with Saturday's closing shift?", 'shiftHistory'],
    ["Who can cover Jamie's Friday shift?", 'replacements'],
  ];
  for (const [text, intent] of cases)
    assert.equal(routeChat(text, true), intent);
  assert.ok(
    !MANAGER_LOOKUPS.includes(
      routeChat('Is anyone scheduled Thursday night?', true),
    ),
  );
  for (const route of MANAGER_LOOKUPS) {
    const previous = { text: 'Which date should I check?', topic: route };
    const resolve = (text) =>
      resolveChatTarget({
        text,
        manager: true,
        routed: routeChat(text, true),
        previous,
      }).target;
    assert.equal(resolve('December 3'), route);
    assert.equal(resolve('Publish the schedule'), 'clarification');
    assert.equal(
      validRoutingEntry({ route, decidedBy: 'local', clarification: false })
        .route,
      route,
    );
    assert.equal(
      createIntentPasses().issue(manager, route, 'lookup', clock()),
      null,
    );
    assert.notEqual(
      routeChat(cases.find((row) => row[1] === route)[0], false),
      route,
    );
  }
});

test('lookup requests parse ranges, titles and the next publication period', () => {
  const query = (kind, text) => managerLookupQuery(kind, text, '2026-11-26');
  assert.deepEqual(
    query('teamTimeOff', 'Who is off from December 3 through December 5?')
      .params,
    { kind: 'teamTimeOff', from: '2026-12-03', through: '2026-12-05' },
  );
  assert.deepEqual(
    query('coverageStatus', 'Is "Afternoon coverage" covered?').params,
    { kind: 'coverageStatus', title: 'Afternoon coverage' },
  );
  assert.deepEqual(
    query('publicationStatus', 'Has the next schedule been published?').params,
    { kind: 'publicationStatus' },
  );
  assert.match(
    query('coverageStatus', 'Coverage status?').question,
    /^Which date/,
  );
});

test('server scopes all lookups, uses business dates, removes notes, and stays read-only', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'covershift-cs059-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const store = new JsonStore(join(root, 'db.json'));
  const timezone = 'America/Vancouver';
  await buildDemoFixtures(store, {
    now: clock(),
    timezone,
    hash: async () => 'fictional-hash',
  });
  const leave = await requestTimeOff(
    store,
    'worker_sam',
    {
      startLocal: '2026-12-03T23:00',
      endLocal: '2026-12-04T00:00',
      timezone,
      allDay: false,
      note: 'PRIVATE CANARY',
      submissionId: randomUUID(),
    },
    clock,
  );
  assert.equal(leave.request.status, 'pending');
  await store.transaction((db) => {
    db.businesses.push({ ...db.businesses[0], id: 'other' });
    db.users.push({
      ...db.users.find((user) => user.id === manager),
      id: 'other_manager',
      businessId: 'other',
      email: 'other-manager@example.test',
    });
  });
  const before = await store.read();
  const lookup = (params, user = manager) =>
    managerLookup(store, user, new URLSearchParams(params), clock);
  assert.deepEqual(await lookup({}), { today: '2026-11-26', timezone });
  const timeOff = await lookup({ kind: 'teamTimeOff', from: '2026-12-03' });
  assert.equal(timeOff.rows[0].workerName, 'Sam Rivera');
  assert.doesNotMatch(JSON.stringify(timeOff), /PRIVATE CANARY|submissionId/);
  assert.deepEqual(
    (await lookup({ kind: 'teamTimeOff', from: '2026-12-04' })).rows,
    [],
  );
  assert.deepEqual(
    (await lookup({ kind: 'teamTimeOff', from: '2026-12-03' }, 'other_manager'))
      .rows,
    [],
  );
  const coverage = await lookup({ kind: 'coverageStatus', from: '2026-12-04' });
  assert.equal(coverage.rows[0].workerName, 'Jamie Lee');
  assert.equal(coverage.rows[0].status, 'pending');
  assert.deepEqual(
    (
      await lookup(
        { kind: 'coverageStatus', from: '2026-12-04' },
        'other_manager',
      )
    ).rows,
    [],
  );
  assert.equal(
    (await lookup({ kind: 'coverageStatus', title: 'Completed coverage' }))
      .rows[0].status,
    'approved',
  );
  const publication = await lookup({ kind: 'publicationStatus' });
  assert.deepEqual(
    [
      publication.from,
      publication.dueOn,
      publication.dueStatus,
      publication.unpublished,
    ],
    ['2026-11-30', '2026-11-23', 'overdue', 0],
  );
  const summary = await workingSummary(store, manager, 'this', clock);
  assert.equal(
    summary.sections.find((group) => group.label.startsWith('Time-off')).count,
    1,
  );
  assert.equal(
    summary.sections.find((group) =>
      group.label.startsWith('Schedule publication'),
    ).rows[0].title,
    'Publication overdue',
  );
  assert.doesNotMatch(JSON.stringify(summary), /PRIVATE CANARY/);

  const sessions = new SessionStore();
  const server = createAppServer({ store, sessions, shiftClock: clock });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/api/manager/chat-lookup`;
  const cookie = (user) => sessions.create(user).cookie.split(';')[0];
  for (const params of [
    'kind=teamTimeOff&from=2026-12-03',
    'kind=coverageStatus&from=2026-12-04',
    'kind=publicationStatus',
  ]) {
    assert.equal((await fetch(base + '?' + params)).status, 401);
    assert.equal(
      (
        await fetch(base + '?' + params, {
          headers: { Cookie: cookie('worker_alex') },
        })
      ).status,
      403,
    );
    const result = await fetch(base + '?' + params, {
      headers: { Cookie: cookie(manager) },
    });
    assert.equal(result.status, 200);
    assert.equal(result.headers.get('cache-control'), 'no-store');
    assert.doesNotMatch(await result.text(), /PRIVATE CANARY/);
  }
  assert.deepEqual(await store.read(), before);

  const startsOn = publication.from;
  await prepareSchedule(store, manager, { startsOn }, clock);
  await createShift(
    store,
    manager,
    {
      title: 'Fictional prep',
      assignedWorkerId: 'worker_jamie',
      startLocal: '2026-12-01T09:00',
      endLocal: '2026-12-01T10:00',
    },
    clock,
  );
  assert.equal((await lookup({ kind: 'publicationStatus' })).unpublished, 1);
  assert.equal(
    (await lookup({ kind: 'publicationStatus' }, 'other_manager')).unpublished,
    0,
  );
  const { revision } = await getSchedulePeriod(
    store,
    manager,
    startsOn,
    clock(),
  );
  await publishSchedule(store, manager, { startsOn, revision }, clock);
  const published = await lookup({ kind: 'publicationStatus', from: startsOn });
  assert.equal(published.dueStatus, 'published');
  assert.equal(published.unpublished, 0);
  assert.equal(published.publishedAt, new Date(clock()).toISOString());
});
