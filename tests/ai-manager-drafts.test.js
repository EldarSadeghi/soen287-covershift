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
import { managerLookup } from '../src/ai/manager-lookups.js';
import { ROUTES } from '../src/ai/routing-log.js';
import { manageShift } from '../src/shifts/manage.js';
import { createShift } from '../src/shifts/create.js';
import { MAX_COPY_SHIFTS, saveShiftBatch } from '../src/shifts/batch.js';
import { WRITE_CAPABLE } from '../scripts/ai-eval/evaluate.js';
import { MANAGER_DRAFTS, routeChat } from '../public/ai-chat-routing.js';
import {
  copyWeekBatch,
  copyWeeks,
  dutyQuery,
  newEmployee,
  takeNewEmployee,
} from '../public/ai-manager-drafts.js';

const clock = () => Date.parse('2026-11-27T02:00:00Z'); // Thursday Nov 26 in Toronto
const timezone = 'America/Toronto';
const manager = 'manager_morgan';

test('manager draft routes, with existing routes unchanged and none for employees', () => {
  for (const [text, route] of [
    ['Add Sam Rivera as an employee', 'addEmployee'],
    ['add a new worker called Priya Shah, priya@example.com', 'addEmployee'],
    ['onboard Dana Kim', 'addEmployee'],
    ['hire a new employee', 'addEmployee'],
    ["Copy this week's schedule to next week", 'copyWeek'],
    ['copy last week to this week', 'copyWeek'],
    ["Add 'restock fridge' to Friday's opening shift", 'shiftDuties'],
    ["add a duty to restock the fridge on Jamie's Friday shift", 'shiftDuties'],
    // Existing routes keep their answers.
    ['add sam to the friday evening shift 4 to 9pm', 'draft'],
    ['create a shift for Jamie Lee on Dec 5 from 9 AM to 1 PM', 'draft'],
    ['How do I add a new employee?', 'help'],
  ])
    assert.equal(routeChat(text, true, null), route, text);
  assert.notEqual(
    routeChat('add jamie to the team schedule friday', true, null),
    'addEmployee',
  );
  for (const text of [
    'Add Sam Rivera as an employee',
    "Copy this week's schedule to next week",
    "Add 'restock fridge' to Friday's opening shift",
  ])
    assert.ok(!MANAGER_DRAFTS.includes(routeChat(text, false, null)), text);
  for (const route of MANAGER_DRAFTS) {
    assert.ok(ROUTES.has(route), route);
    assert.ok(WRITE_CAPABLE.has(route), route);
  }
});

test('reads the new employee, the weeks to copy and the duty request', () => {
  assert.deepEqual(newEmployee('Add Sam Rivera as an employee'), {
    name: 'Sam Rivera',
    email: '',
  });
  assert.deepEqual(
    newEmployee('add a new worker called Priya Shah, priya@example.com'),
    { name: 'Priya Shah', email: 'priya@example.com' },
  );
  assert.deepEqual(newEmployee('add Priya to the team'), {
    name: 'Priya',
    email: '',
  });
  assert.deepEqual(newEmployee('hire a new employee'), { name: '', email: '' });
  assert.deepEqual(
    copyWeeks("Copy this week's schedule to next week", '2026-11-26'),
    { source: '2026-11-23', target: '2026-11-30' },
  );
  assert.deepEqual(copyWeeks('copy last week to this week', '2026-11-26'), {
    source: '2026-11-16',
    target: '2026-11-23',
  });
  assert.deepEqual(
    copyWeeks('duplicate next week into the week after', '2026-11-26'),
    { source: '2026-11-30', target: '2026-12-07' },
  );
  assert.equal(copyWeeks('copy next week to this week', '2026-11-26'), null);
  assert.deepEqual(
    dutyQuery("Add 'restock fridge' to Friday's opening shift", '2026-11-26'),
    {
      duty: 'restock fridge',
      params: { kind: 'shiftDuties', from: '2026-11-27', title: 'opening' },
    },
  );
  assert.deepEqual(
    dutyQuery(
      "add a duty to restock the fridge on Jamie Lee's Saturday shift",
      '2026-11-26',
    ).params,
    {
      kind: 'shiftDuties',
      from: '2026-11-28',
      worker: 'Jamie Lee',
    },
  );
  assert.deepEqual(
    dutyQuery("add a task to Friday's closing shift: wipe tables", '2026-11-26')
      .duty,
    'wipe tables',
  );
  assert.match(
    dutyQuery('add a duty to the opening shift', '2026-11-26').question,
    /^What duty/,
  );
  assert.match(
    dutyQuery('add “wipe tables” to the closing shift', '2026-11-26').question,
    /^Which date/,
  );
  assert.match(
    dutyQuery(`add "${'x'.repeat(161)}" to Friday's shift`, '2026-11-26')
      .question,
    /160 characters/,
  );
  // The Team handoff is for this account only, and only briefly.
  const store = new Map();
  const storage = {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => store.set(key, value),
    removeItem: (key) => store.delete(key),
  };
  const account = { user: { id: 'manager_morgan' }, business: { id: 'b1' } };
  storage.setItem(
    'covershift.ai.add-employee',
    JSON.stringify({
      owner: JSON.stringify(['manager_morgan', 'b1']),
      at: Date.now(),
      name: 'Sam Rivera',
      email: '',
    }),
  );
  assert.deepEqual(takeNewEmployee(account, storage), {
    name: 'Sam Rivera',
    email: '',
  });
  assert.equal(takeNewEmployee(account, storage), null);
  storage.setItem(
    'covershift.ai.add-employee',
    JSON.stringify({
      owner: JSON.stringify(['someone_else', 'b1']),
      at: Date.now(),
      name: 'Sam',
      email: '',
    }),
  );
  assert.equal(takeNewEmployee(account, storage), null);
});

test('copies a week into a reviewed batch of up to 40, saved with the usual checks', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'covershift-cs068-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const store = new JsonStore(join(root, 'db.json'));
  await buildDemoFixtures(store, {
    now: clock(),
    timezone,
    hash: async () => 'fictional-hash',
  });
  const add = (title, workerId, startLocal, endLocal, duties) =>
    createShift(
      store,
      manager,
      {
        title,
        assignedWorkerId: workerId,
        startLocal,
        endLocal,
        ...(duties && { duties }),
      },
      clock,
    );
  // A shift with duties, an overnight shift, and one for an employee who
  // then leaves (as left behind before CS-068; deactivation is set directly).
  await add(
    'Prep with duties',
    'worker_sam',
    '2026-12-01T08:00',
    '2026-12-01T10:00',
    ['Unlock the doors', 'Start the coffee'],
  );
  await add(
    'Overnight stock',
    'worker_sam',
    '2026-12-04T22:00',
    '2026-12-05T06:00',
  );
  await add(
    'Leaver shift',
    'worker_taylor',
    '2026-12-02T09:00',
    '2026-12-02T13:00',
  );
  await store.transaction((db) => {
    const leaver = db.users.find((user) => user.id === 'worker_taylor');
    leaver.passwordHash = null;
    leaver.deactivation = {
      at: '2026-11-26T12:00:00.000Z',
      managerId: manager,
    };
    leaver.updatedAt = leaver.deactivation.at;
    delete leaver.setup;
  });
  const before = JSON.stringify(await store.read());
  const lookup = (params, user = manager) =>
    managerLookup(store, user, new URLSearchParams(params), clock);
  const data = await lookup({
    kind: 'copyWeek',
    from: '2026-11-30',
    through: '2026-12-07',
  });
  assert.equal(data.total, 8);
  assert.deepEqual(data.skipped, [
    {
      title: 'Leaver shift',
      workerName: 'Taylor Brooks',
      reason: 'Employee is no longer active',
    },
  ]);
  const opening = data.shifts.find(
    (shift) => shift.title === 'Opening service',
  );
  assert.deepEqual(opening, {
    title: 'Opening service',
    assignedWorkerId: 'worker_jamie',
    startLocal: '2026-12-10T09:00',
    endLocal: '2026-12-10T12:00',
  });
  assert.deepEqual(
    data.shifts.find((shift) => shift.title === 'Prep with duties').duties,
    ['Unlock the doors', 'Start the coffee'],
  );
  const overnight = data.shifts.find(
    (shift) => shift.title === 'Overnight stock',
  );
  assert.deepEqual(
    [overnight.startLocal, overnight.endLocal],
    ['2026-12-11T22:00', '2026-12-12T06:00'],
  );
  assert.ok(!data.workers.some((worker) => worker.id === 'worker_taylor'));
  const prepared = copyWeekBatch({ ...data, timezone });
  assert.equal(prepared.batch.copy, true);
  assert.match(
    prepared.batch.warning,
    /Not copied: Leaver shift \(Taylor Brooks\): Employee is no longer active\./,
  );
  assert.match(prepared.batch.warning, /1 copy keeps its duties\./);
  // Copies that would start in the past are skipped.
  const past = await lookup({
    kind: 'copyWeek',
    from: '2026-11-16',
    through: '2026-11-23',
  });
  assert.ok(
    past.skipped.every(
      (row) => row.reason === 'The copy would start in the past',
    ),
  );
  // Bad weeks and other people's businesses are refused; nothing was saved.
  for (const params of [
    { kind: 'copyWeek', from: '2026-12-01', through: '2026-12-08' },
    { kind: 'copyWeek', from: '2026-12-07', through: '2026-11-30' },
    { kind: 'copyWeek', from: '2026-11-30', through: '2026-12-07', title: 'x' },
  ])
    await assert.rejects(lookup(params), /week|ordered/i);
  await assert.rejects(
    lookup(
      { kind: 'copyWeek', from: '2026-11-30', through: '2026-12-07' },
      'worker_alex',
    ),
  );
  assert.equal(JSON.stringify(await store.read()), before);

  // The copy flag allows up to 40 shifts within one week; others stay at five.
  const save = (shifts, copy) =>
    saveShiftBatch(
      store,
      manager,
      {
        batchId: randomUUID(),
        timezone,
        shifts,
        ...(copy !== undefined && { copy }),
      },
      clock,
    );
  await assert.rejects(save(data.shifts), /between two and five/);
  await assert.rejects(save(data.shifts, 'yes'), /Submit the reviewed batch/);
  const twoWeeks = [
    data.shifts[0],
    {
      ...data.shifts[1],
      startLocal: '2026-12-15T09:00',
      endLocal: '2026-12-15T12:00',
    },
  ];
  await assert.rejects(save(twoWeeks, true), /same Monday–Sunday week/);
  const many = Array.from({ length: MAX_COPY_SHIFTS + 1 }, (_, n) => ({
    ...data.shifts[0],
    startLocal: `2026-12-1${n % 7}T0${n % 9}:00`,
  }));
  await assert.rejects(save(many, true), /between one and 40/);
  const saved = await save(data.shifts, true);
  assert.equal(saved.count, data.shifts.length);
  const db = await store.read();
  const copied = db.shifts.find(
    (shift) =>
      shift.title === 'Prep with duties' &&
      shift.startsAt.startsWith('2026-12-08'),
  );
  assert.deepEqual(copied.duties, ['Unlock the doors', 'Start the coffee']);
  // Saving the same copies again would overlap: the usual checks apply.
  await assert.rejects(save(data.shifts, true), /Shift 1/);
});

test('finds the shift for a duty and prepares an edit that saves through the edit form', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'covershift-cs068-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const store = new JsonStore(join(root, 'db.json'));
  await buildDemoFixtures(store, {
    now: clock(),
    timezone,
    hash: async () => 'fictional-hash',
  });
  const lookup = (params) =>
    managerLookup(store, manager, new URLSearchParams(params), clock);
  const ready = await lookup({
    kind: 'shiftDuties',
    from: '2026-12-03',
    title: 'opening',
  });
  assert.equal(ready.status, 'ready');
  assert.equal(ready.shift.title, 'Opening service');
  assert.equal(ready.shift.locked, null);
  assert.deepEqual(ready.shift.draft, {
    title: 'Opening service',
    assignedWorkerId: 'worker_jamie',
    startLocal: '2026-12-03T09:00',
    endLocal: '2026-12-03T12:00',
  });
  assert.equal(
    (await lookup({ kind: 'shiftDuties', from: '2026-12-03', worker: 'jamie' }))
      .shift.title,
    'Opening service',
  );
  const choose = await lookup({ kind: 'shiftDuties', from: '2026-12-03' });
  assert.equal(choose.status, 'choose');
  assert.ok(choose.shifts.every((shift) => shift.revision && shift.draft));
  // A shift with a linked coverage request can't be edited.
  assert.match(
    choose.shifts.find((shift) => shift.title === 'Afternoon coverage').locked,
    /linked coverage requests/,
  );
  assert.equal(
    (
      await lookup({
        kind: 'shiftDuties',
        from: '2026-12-03',
        title: 'closing',
      })
    ).status,
    'none',
  );
  assert.equal(
    (
      await lookup({
        kind: 'shiftDuties',
        from: '2026-12-03',
        worker: 'Taylor',
      })
    ).status,
    'none',
  );
  // The prepared edit is what the Schedule form submits; the revision guards it.
  const { id, revision, draft } = ready.shift;
  const result = await manageShift(
    store,
    manager,
    id,
    'edit',
    { revision, ...draft, duties: ['restock fridge'] },
    clock,
  );
  assert.deepEqual(result.shift.duties, ['restock fridge']);
  await assert.rejects(
    manageShift(
      store,
      manager,
      id,
      'edit',
      { revision, ...draft, duties: ['again'] },
      clock,
    ),
    /changed since you opened it/,
  );

  // HTTP: managers only, read-only.
  const sessions = new SessionStore();
  const server = createAppServer({ store, sessions, shiftClock: clock });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const before = JSON.stringify(await store.read());
  const url = `http://127.0.0.1:${server.address().port}/api/manager/chat-lookup?kind=shiftDuties&from=2026-12-03`;
  const cookie = (user) => ({
    headers: { Cookie: sessions.create(user).cookie.split(';')[0] },
  });
  assert.equal((await fetch(url)).status, 401);
  assert.equal((await fetch(url, cookie('worker_alex'))).status, 403);
  assert.equal((await fetch(url, cookie(manager))).status, 200);
  assert.equal(JSON.stringify(await store.read()), before);
});
