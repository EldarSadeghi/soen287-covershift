import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { buildDemoFixtures } from '../src/demo/fixtures.js';
import { JsonStore } from '../src/storage/json-store.js';
import { managerLookup } from '../src/ai/manager-lookups.js';
import {
  EXCLUSION_REASONS,
  REPLACEMENT_SHIFT_CHOICES,
  eligibleByInvitationRule,
  replacementSuggestions,
} from '../src/ai/replacements.js';
import {
  DATE_QUESTION,
  renderReplacements,
  replacementQuery,
  replacementWorker,
} from '../public/ai-replacements.js';
import { resolveChatTarget, routeChat } from '../public/ai-chat-routing.js';

const now = Date.parse('2026-11-27T15:00:00Z');
const tz = 'America/Toronto';

// Fictional business: the Friday Dec 4 opening (14:00–17:00 UTC) needs cover.
function makeDb() {
  const worker = (id, name, extra = {}) => ({
    id,
    name,
    role: 'worker',
    businessId: 'b1',
    passwordHash: 'h',
    ...extra,
  });
  const shift = (
    id,
    workerId,
    startsAt,
    endsAt,
    title = 'Shift ' + id,
    businessId = 'b1',
  ) => ({
    id,
    businessId,
    assignedWorkerId: workerId,
    title,
    startsAt,
    endsAt,
  });
  const window = (workerId, startsAt, endsAt, extra = {}) => ({
    id: 'w-' + workerId + startsAt,
    workerId,
    businessId: 'b1',
    status: 'confirmed',
    timezone: tz,
    startsAt,
    endsAt,
    ...extra,
  });
  const allDay = (workerId) =>
    window(workerId, '2026-12-04T05:00:00.000Z', '2026-12-05T05:00:00.000Z');
  return {
    businesses: [
      { id: 'b1', timezone: tz },
      { id: 'b2', timezone: tz },
    ],
    users: [
      { id: 'm', name: 'Morgan Chen', role: 'manager', businessId: 'b1' },
      worker('jamie', 'Jamie Lee'),
      worker('alex', 'Alex Morgan'),
      worker('sam', 'Sam Rivera'),
      worker('taylor', 'Taylor Brooks'),
      worker('casey', 'Casey Park'),
      worker('drew', 'Drew Fox', {
        deactivation: { at: '2026-11-01T00:00:00Z' },
      }),
      worker('robin', 'Robin Vale', { passwordHash: null }),
      worker('lee', 'Lee Other', { businessId: 'b2' }),
    ],
    shifts: [
      shift(
        'open',
        'jamie',
        '2026-12-04T14:00:00.000Z',
        '2026-12-04T17:00:00.000Z',
        'Opening service',
      ),
      shift(
        'close',
        'alex',
        '2026-12-04T22:00:00.000Z',
        '2026-12-05T02:00:00.000Z',
        'Closing service',
      ),
      // Alex works 8 more hours that week (12 with the closing); Taylor 3.
      shift(
        'a-mon',
        'alex',
        '2026-11-30T14:00:00.000Z',
        '2026-11-30T22:00:00.000Z',
      ),
      shift(
        't-tue',
        'taylor',
        '2026-12-01T14:00:00.000Z',
        '2026-12-01T17:00:00.000Z',
      ),
      // Casey already works during the opening.
      shift(
        'c-fri',
        'casey',
        '2026-12-04T15:00:00.000Z',
        '2026-12-04T18:00:00.000Z',
      ),
      shift(
        'past',
        'jamie',
        '2026-11-27T13:00:00.000Z',
        '2026-11-27T20:00:00.000Z',
        'Started shift',
      ),
      shift(
        'other',
        'lee',
        '2026-12-04T14:00:00.000Z',
        '2026-12-04T17:00:00.000Z',
        'Other business',
        'b2',
      ),
    ],
    availabilityWindows: [
      allDay('alex'),
      allDay('taylor'),
      allDay('casey'),
      allDay('robin'),
      allDay('drew'),
      allDay('lee'),
      // Sam is free for only part of the opening.
      window('sam', '2026-12-04T14:00:00.000Z', '2026-12-04T16:00:00.000Z'),
      // A withdrawn window never counts.
      window('jamie', '2026-12-04T05:00:00.000Z', '2026-12-05T05:00:00.000Z', {
        status: 'withdrawn',
      }),
    ],
    coverageRequests: [],
    timeOffRequests: [
      {
        id: 'to1',
        workerId: 'taylor',
        businessId: 'b1',
        status: 'pending',
        startsAt: '2026-12-04T05:00:00.000Z',
        endsAt: '2026-12-05T05:00:00.000Z',
        note: 'PRIVATE CANARY',
      },
    ],
  };
}

test('suggestions follow the cover-invitation rule and rank by hours that week', () => {
  const db = makeDb();
  const business = db.businesses[0];
  const result = replacementSuggestions(
    db,
    business,
    { from: '2026-12-04', title: 'opening' },
    now,
  );
  assert.equal(result.status, 'ready');
  assert.deepEqual(result.shift.workerName, 'Jamie Lee');
  assert.deepEqual(
    [result.weekFrom, result.weekThrough],
    ['2026-11-30', '2026-12-06'],
  );
  // Pending time off does not block (only approved time off does), so Taylor
  // can take it; Taylor has fewer hours than Alex, so ranks first.
  assert.deepEqual(result.suggestions, [
    { workerName: 'Taylor Brooks', weekHours: 3 },
    { workerName: 'Alex Morgan', weekHours: 12 },
  ]);
  assert.deepEqual(result.excluded, [
    { workerName: 'Casey Park', weekHours: 3, reason: EXCLUSION_REASONS.busy },
    { workerName: 'Robin Vale', weekHours: 0, reason: EXCLUSION_REASONS.setup },
    {
      workerName: 'Sam Rivera',
      weekHours: 0,
      reason: EXCLUSION_REASONS.unavailable,
    },
  ]);
  // The assignee, deactivated employees and other businesses never appear.
  const listed = [...result.suggestions, ...result.excluded].map(
    (row) => row.workerName,
  );
  for (const name of ['Jamie Lee', 'Drew Fox', 'Lee Other'])
    assert.ok(!listed.includes(name), name);
  // Same answer as the invitation check for every active coworker.
  const shift = db.shifts.find((row) => row.id === 'open');
  for (const worker of db.users.filter(
    (user) =>
      user.role === 'worker' &&
      user.businessId === 'b1' &&
      !user.deactivation &&
      user.id !== 'jamie',
  ))
    assert.equal(
      result.suggestions.some((row) => row.workerName === worker.name),
      eligibleByInvitationRule(db, worker.id, shift, now),
      worker.name,
    );
  assert.doesNotMatch(
    JSON.stringify(result),
    /PRIVATE CANARY|note|email|password/i,
  );

  // Approved time off and a pending claim both block, with the generic reason.
  db.timeOffRequests[0].status = 'approved';
  db.coverageRequests.push({
    id: 'r1',
    businessId: 'b1',
    status: 'pending',
    claimantId: 'alex',
    shiftId: 'close',
  });
  db.shifts.find((row) => row.id === 'close').startsAt =
    '2026-12-04T16:00:00.000Z';
  const blocked = replacementSuggestions(
    db,
    business,
    { from: '2026-12-04', title: 'opening' },
    now,
  );
  assert.deepEqual(blocked.suggestions, []);
  assert.equal(
    blocked.excluded.find((row) => row.workerName === 'Taylor Brooks').reason,
    EXCLUSION_REASONS.busy,
  );
  assert.equal(
    blocked.excluded.find((row) => row.workerName === 'Alex Morgan').reason,
    EXCLUSION_REASONS.busy,
  );
  for (const worker of ['alex', 'taylor'])
    assert.equal(
      eligibleByInvitationRule(db, worker, db.shifts[0], now),
      false,
      worker,
    );
});

test('the shift is chosen by date, title and assignee; several are listed, none and started say so', () => {
  const db = makeDb();
  const business = db.businesses[0];
  const find = (params) => replacementSuggestions(db, business, params, now);
  const both = find({ from: '2026-12-04' });
  assert.equal(both.status, 'choose');
  assert.deepEqual(
    both.shifts.map((row) => row.title),
    ['Opening service', 'Shift c-fri', 'Closing service'],
  );
  assert.equal(
    find({ from: '2026-12-04', worker: 'Jamie' }).shift.title,
    'Opening service',
  );
  assert.equal(
    find({ from: '2026-12-04', worker: 'alex morgan' }).shift.title,
    'Closing service',
  );
  assert.equal(
    find({ from: '2026-12-04', worker: 'Mor' }).status,
    'none',
    'whole name parts only',
  );
  assert.deepEqual(find({ from: '2026-12-06' }), {
    status: 'none',
    total: 0,
    shifts: [],
  });
  assert.equal(find({ from: '2026-11-27' }).status, 'started');

  for (let n = 0; n < 12; n += 1)
    db.shifts.push({ ...db.shifts[0], id: 'x' + n, title: 'Extra ' + n });
  const many = find({ from: '2026-12-04' });
  assert.equal(many.total, 15);
  assert.equal(many.shifts.length, REPLACEMENT_SHIFT_CHOICES);
});

test('the endpoint is manager only, stays in the business, validates its input and never writes', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'covershift-cs066-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const store = new JsonStore(join(root, 'db.json'));
  await buildDemoFixtures(store, {
    now,
    timezone: tz,
    hash: async () => 'fictional-hash',
  });
  await store.transaction((db) => {
    db.businesses.push({ ...db.businesses[0], id: 'other' });
    db.users.push({
      ...db.users.find((user) => user.id === 'manager_morgan'),
      id: 'other_manager',
      businessId: 'other',
      email: 'other-manager@example.test',
    });
  });
  const before = await readFile(store.filename, 'utf8');
  const lookup = (params, user = 'manager_morgan') =>
    managerLookup(store, user, new URLSearchParams(params), () => now);

  const ready = await lookup({
    kind: 'replacements',
    from: '2026-12-03',
    title: 'opening',
  });
  assert.equal(ready.status, 'ready');
  assert.equal(ready.shift.title, 'Opening service');
  assert.equal(
    (
      await lookup(
        { kind: 'replacements', from: '2026-12-03' },
        'other_manager',
      )
    ).status,
    'none',
  );
  await assert.rejects(
    lookup({ kind: 'replacements', from: '2026-12-03' }, 'worker_alex'),
    { status: 403 },
  );
  for (const params of [
    { kind: 'replacements' },
    { kind: 'replacements', from: '2026-12-03', through: '2026-12-04' },
    { kind: 'replacements', from: '2026-12-03', worker: ' ' },
    { kind: 'replacements', from: '2026-12-03', focus: 'most' },
    {
      kind: 'teamHours',
      from: '2026-12-01',
      through: '2026-12-07',
      worker: 'Jamie',
    },
  ])
    await assert.rejects(
      lookup(params),
      { status: 422 },
      JSON.stringify(params),
    );
  assert.equal(
    await readFile(store.filename, 'utf8'),
    before,
    'lookups never write',
  );
});

test('the chat routes replacement questions and reads the shift from them', () => {
  for (const text of [
    'Who can cover Jamie’s Friday shift?',
    'who could replace Sam on Saturday',
    'find a replacement for the December 5 closing shift',
    'who can take the opening shift tomorrow?',
    'is there anyone who can cover the Saturday close?',
    'can anyone fill in for Taylor on Sunday',
  ])
    assert.equal(routeChat(text, true, null), 'replacements', text);
  for (const [text, route] of [
    ['who is working Friday', 'questions'],
    ['who’s free Friday', 'teamAvailability'],
    ['who can work Friday', 'teamAvailability'],
    ['who covered Jamie’s shift', 'coverageStatus'],
    ['who can cover?', 'clarification'],
    ['who can cover for me on Saturday', 'clarification'],
  ])
    assert.equal(routeChat(text, true, null), route, text);
  // Employees keep their own routes for the same words.
  assert.notEqual(
    routeChat('Who can cover Jamie’s Friday shift?', false, null),
    'replacements',
  );

  const today = '2026-11-26';
  assert.deepEqual(
    replacementQuery('Who can cover Jamie’s Friday shift?', today).params,
    {
      kind: 'replacements',
      from: '2026-11-27',
      through: '2026-11-27',
      worker: 'Jamie',
    },
  );
  assert.deepEqual(
    replacementQuery(
      'find a replacement for the December 5 closing shift',
      today,
    ).params,
    {
      kind: 'replacements',
      from: '2026-12-05',
      through: '2026-12-05',
      title: 'closing',
    },
  );
  assert.equal(
    replacementQuery('who can cover the opening shift', today).question,
    DATE_QUESTION,
  );
  assert.equal(
    replacementWorker('who can cover the opening shift tomorrow'),
    null,
  );
  assert.equal(
    replacementWorker('can anyone fill in for Taylor on Sunday'),
    'Taylor',
  );
  // Day and month names are not employees.
  assert.equal(replacementWorker('who can cover Friday’s shift'), null);
  assert.equal(replacementWorker('who can take the December 5 closing'), null);

  // Follow-ups: a date after "Which date…", a title after "Which shift…".
  const question = 'Who can cover Jamie’s shift?';
  assert.deepEqual(
    replacementQuery(question + ' Friday', today, 'Friday').params.from,
    '2026-11-27',
  );
  assert.deepEqual(
    replacementQuery(
      'who can cover Friday’s shift? the opening one',
      today,
      'the opening one',
    ).params,
    {
      kind: 'replacements',
      from: '2026-11-27',
      through: '2026-11-27',
      title: 'opening',
    },
  );
  for (const [previous, reply] of [
    [DATE_QUESTION, 'December 5'],
    [
      'Which shift should I check? There are 2 on Dec 4, 2026.',
      'Opening service',
    ],
  ])
    assert.equal(
      resolveChatTarget({
        text: reply,
        manager: true,
        routed: routeChat(reply, true, null),
        previous: { topic: 'replacements', text: previous },
      }).target,
      'replacements',
      reply,
    );
});

test('the card lists suggestions, exclusions and honest empty states', () => {
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
  const texts = (item) =>
    [item.textContent, ...item.children.flatMap(texts)].filter(Boolean);
  try {
    const db = makeDb();
    const base = {
      kind: 'replacements',
      from: '2026-12-04',
      through: '2026-12-04',
      timezone: tz,
      asOf: new Date(now).toISOString(),
    };
    const card = node('div');
    const ready = {
      ...base,
      ...replacementSuggestions(
        db,
        db.businesses[0],
        { from: '2026-12-04', title: 'opening' },
        now,
      ),
    };
    assert.equal(
      renderReplacements(card, ready),
      '2 employees can take Opening service: Taylor Brooks (3 hours this week) and Alex Morgan (12 hours this week).',
    );
    assert.ok(
      texts(card).includes(
        'Sam Rivera · Not confirmed available for the full shift',
      ),
    );
    assert.ok(
      texts(card).some((text) =>
        /^Ranked by fewest scheduled hours/.test(text),
      ),
    );

    assert.match(
      renderReplacements(card, { ...ready, suggestions: [] }),
      /^Nobody is confirmed available for the full shift/,
    );
    const choose = {
      ...base,
      ...replacementSuggestions(
        db,
        db.businesses[0],
        { from: '2026-12-04' },
        now,
      ),
    };
    assert.match(
      renderReplacements(card, choose),
      /^Which shift should I check\? There are 3 on /,
    );
    assert.match(
      renderReplacements(card, {
        ...base,
        status: 'none',
        total: 0,
        shifts: [],
        title: 'brunch',
        worker: null,
      }),
      /^No shifts matching “brunch” on /,
    );
  } finally {
    globalThis.document = original;
  }
});
