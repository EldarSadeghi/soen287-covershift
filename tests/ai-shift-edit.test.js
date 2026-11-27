import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { createAiShiftEditor } from '../src/ai/shift-edit.js';
import { createIntentPasses } from '../src/ai/intent-pass.js';
import { validRoutingEntry } from '../src/ai/routing-log.js';
import { buildDemoFixtures } from '../src/demo/fixtures.js';
import { prepareSchedule } from '../src/schedules/publication.js';
import { createShift } from '../src/shifts/create.js';
import { manageShift } from '../src/shifts/manage.js';
import { JsonStore } from '../src/storage/json-store.js';
import { decideTimeOff, requestTimeOff } from '../src/time-off/service.js';
import { routeChat } from '../public/ai-chat-routing.js';

const manager = 'manager_morgan';
const clock = () => Date.parse('2026-11-26T17:00Z');
const timezone = 'America/Toronto';
const input = { description: "Move Jamie's Friday shift to 10 AM" };

async function fixture(t) {
  const dir = await mkdtemp(join(tmpdir(), 'covershift-edit-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const store = new JsonStore(join(dir, 'db.json'));
  const fixture = await buildDemoFixtures(store, {
    now: clock(),
    hash: async () => 'fixture-hash',
  });
  let reply = {
    kind: 'edit',
    question: '',
    employee: 'w1',
    date: '2026-12-04',
    shiftTitle: '',
    shiftTime: '',
    timing: 'move',
    title: '',
    worker: '',
    startLocal: '2026-12-04T10:00',
    endLocal: '',
  };
  const provider = [];
  const edit = createAiShiftEditor({
    apiKey: 'fictional',
    allowance: { reserve() {} },
    async fetchImpl(_url, options) {
      provider.push(JSON.parse(JSON.parse(options.body).input));
      return Response.json({
        status: 'completed',
        output: [
          {
            type: 'message',
            content: [{ type: 'output_text', text: JSON.stringify(reply) }],
          },
        ],
      });
    },
  });
  return {
    store,
    fixture,
    provider,
    set: (values) => {
      reply = { ...reply, ...values };
    },
    run: (body = input, managerId = manager, now = clock) =>
      edit(store, managerId, body, now),
    bytes: () => readFile(store.filename, 'utf8'),
  };
}

test('edit routing remains distinct from create, schedule questions and unsupported commands', () => {
  assert.equal(routeChat(input.description, true), 'shiftEdit');
  assert.equal(
    routeChat('Actually make it 11 AM', true, 'shiftEdit'),
    'shiftEdit',
  );
  assert.equal(
    routeChat('Delete that shift', true, 'shiftEdit'),
    'clarification',
  );
  assert.equal(
    routeChat('Create a shift for Jamie', true, 'shiftEdit'),
    'draft',
  );
  assert.equal(
    routeChat('Who’s working Friday?', true, 'shiftEdit'),
    'questions',
  );
  assert.notEqual(routeChat(input.description, false), 'shiftEdit');
  assert.equal(
    validRoutingEntry({
      route: 'shiftEdit',
      decidedBy: 'local',
      clarification: false,
    }).route,
    'shiftEdit',
  );
  const passes = createIntentPasses();
  const token = passes.issue(manager, 'shiftEdit', input.description, clock());
  assert.equal(
    passes.redeem(token, manager, 'shiftEdit', input.description, clock()),
    true,
  );
  assert.equal(
    passes.redeem(token, manager, 'shiftEdit', input.description, clock()),
    false,
  );
});

test('one match and correction stay read-only and retain the same source revision', async (t) => {
  const f = await fixture(t);
  const before = await f.bytes();
  const result = await f.run();
  assert.equal(result.kind, 'shiftEdit');
  assert.equal(result.id, f.fixture.scenarios.assignedFriday);
  assert.deepEqual(
    [result.before.startLocal, result.draft.startLocal, result.draft.endLocal],
    ['2026-12-04T14:00', '2026-12-04T10:00', '2026-12-04T14:00'],
  );
  f.set({
    employee: '',
    date: '',
    title: null,
    worker: null,
    startLocal: '2026-12-04T11:00',
    endLocal: null,
  });
  const base = {
    id: result.id,
    revision: result.revision,
    draft: result.draft,
  };
  const revised = await f.run({ description: 'Actually make it 11 AM', base });
  assert.deepEqual(
    [
      revised.id,
      revised.revision,
      revised.draft.startLocal,
      revised.draft.endLocal,
    ],
    [result.id, result.revision, '2026-12-04T11:00', '2026-12-04T15:00'],
  );
  assert.ok(
    f.provider.every(
      (value) =>
        !JSON.stringify(value).includes(result.id) &&
        !JSON.stringify(value).includes(result.revision),
    ),
  );
  assert.equal(await f.bytes(), before);
  await manageShift(
    f.store,
    manager,
    revised.id,
    'edit',
    { ...revised.draft, revision: revised.revision },
    clock,
  );
  await assert.rejects(
    manageShift(
      f.store,
      manager,
      result.id,
      'edit',
      { ...result.draft, revision: result.revision },
      clock,
    ),
    { status: 409 },
  );
  await assert.rejects(f.run({ description: 'Actually make it noon', base }), {
    status: 409,
  });
});

test('matching excludes other businesses and inactive staff and handles multiple and missing shifts', async (t) => {
  const f = await fixture(t);
  const initial = await f.run();
  await createShift(
    f.store,
    manager,
    {
      title: 'Early service',
      assignedWorkerId: 'worker_jamie',
      startLocal: '2026-12-04T06:00',
      endLocal: '2026-12-04T08:00',
    },
    clock,
  );
  const multiple = await f.run();
  assert.equal(multiple.kind, 'editChoices');
  assert.deepEqual(
    multiple.choices.map((choice) => choice.title),
    ['Early service', 'Afternoon service'],
  );
  f.set({ shiftTitle: 'Absent title' });
  assert.match((await f.run()).message, /No matching shift/);
  await f.store.transaction((db) => {
    db.businesses.push({ ...db.businesses[0], id: 'other' });
    db.users.push({
      ...db.users[0],
      id: 'other_manager',
      email: 'other@example.test',
      businessId: 'other',
    });
    for (const rule of db.availabilityRules) {
      if (rule.workerId === 'worker_jamie') rule.status = 'cancelled';
    }
    const worker = db.users.find((row) => row.id === 'worker_jamie');
    const at = new Date(clock()).toISOString();
    Object.assign(worker, {
      deactivation: { at, managerId: manager },
      passwordHash: null,
      updatedAt: at,
    });
  });
  await assert.rejects(
    f.run(
      { ...input, base: { id: initial.id, revision: initial.revision } },
      'other_manager',
    ),
    { status: 409 },
  );
  await assert.rejects(
    f.run({ ...input, base: { id: initial.id, revision: initial.revision } }),
    { status: 422 },
  );
  await assert.rejects(f.run(input, 'worker_alex'), { status: 403 });
});

test('started shifts, linked coverage, overlaps, approved leave and invalid times block previews', async (t) => {
  const f = await fixture(t);
  f.set({ employee: 'w2', shiftTitle: 'Morning coverage' });
  assert.match((await f.run()).message, /linked coverage/);
  f.set({
    employee: 'w1',
    shiftTitle: '',
    timing: 'keep',
    startLocal: '2026-12-04T19:00',
  });
  await assert.rejects(f.run(), { status: 422 });
  assert.match(
    (await f.run(input, manager, () => Date.parse('2026-12-04T20:00Z')))
      .message,
    /has started/,
  );
  await createShift(
    f.store,
    manager,
    {
      title: 'Early service',
      assignedWorkerId: 'worker_jamie',
      startLocal: '2026-12-04T07:00',
      endLocal: '2026-12-04T09:00',
    },
    clock,
  );
  f.set({
    shiftTitle: 'Afternoon service',
    timing: 'move',
    startLocal: '2026-12-04T08:00',
  });
  await assert.rejects(f.run(), /overlapping shift/);
  const { request } = await requestTimeOff(
    f.store,
    'worker_jamie',
    {
      allDay: false,
      note: '',
      timezone,
      submissionId: randomUUID(),
      startLocal: '2026-12-04T18:00',
      endLocal: '2026-12-04T19:00',
    },
    clock,
  );
  await decideTimeOff(
    f.store,
    manager,
    'manager',
    request.id,
    'approve',
    { revision: request.revision },
    clock,
  );
  f.set({ startLocal: '2026-12-04T18:00' });
  await assert.rejects(f.run(), /approved time off/);
});

test('unpublished drafts can be previewed and the existing edit keeps them private', async (t) => {
  const f = await fixture(t);
  await prepareSchedule(f.store, manager, { startsOn: '2026-11-30' }, clock);
  const draft = await createShift(
    f.store,
    manager,
    {
      title: 'Private prep',
      assignedWorkerId: 'worker_jamie',
      startLocal: '2026-12-02T09:00',
      endLocal: '2026-12-02T12:00',
      duties: ['Stock shelves'],
    },
    clock,
  );
  f.set({ date: '2026-12-02', startLocal: '2026-12-02T10:00' });
  const preview = await f.run();
  assert.equal(preview.id, draft.shift.id);
  assert.equal(preview.publication, true);
  const saved = await manageShift(
    f.store,
    manager,
    preview.id,
    'edit',
    { ...preview.draft, revision: preview.revision },
    clock,
  );
  assert.equal(saved.draft, true);
  assert.deepEqual(saved.shift.duties, ['Stock shelves']);
  assert.equal(
    (await f.store.read()).shifts.some((shift) => shift.id === preview.id),
    false,
  );
});
