import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { workingSummary } from '../src/ai/working-summary.js';
import { buildDemoFixtures } from '../src/demo/fixtures.js';
import { prepareSchedule } from '../src/schedules/publication.js';
import { createShift } from '../src/shifts/create.js';
import { JsonStore } from '../src/storage/json-store.js';
import { routeChat, workingSummaryWeek } from '../public/ai-chat-routing.js';

const clock = () => Date.parse('2026-11-25T15:00:00Z');
const counts = summary => summary.sections.map(group => group.count);

test('summary prompts stay separate from explanations, drafting and discovery', () => {
  assert.equal(routeChat('Show my working week', false), 'summary');
  assert.equal(routeChat('Do I have any pending approvals this week?', true), 'summary');
  assert.equal(routeChat('What about next week?', false, 'summary'), 'summary');
  assert.equal(routeChat('Why is my coverage request pending?', false), 'explanation');
  assert.equal(routeChat('Find an open shift Thursday', false), 'search');
  assert.equal(routeChat('Draft two shifts for Sam Rivera', true), 'draft');
  assert.equal(workingSummaryWeek('Show my working week'), 'this');
  assert.equal(workingSummaryWeek('What about next week?'), 'next');
  assert.equal(workingSummaryWeek('Show pending approvals today'), null);
  assert.equal(workingSummaryWeek('Show this week and next week'), null);
});

test('published summaries scope coverage and use the latest date boundaries without writing', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'covershift-working-summary-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const store = new JsonStore(join(directory, 'db.json'));
  await buildDemoFixtures(store, { now: clock(), hash: async () => 'fictional-hash' });
  const managerId = 'manager_morgan';
  await prepareSchedule(store, managerId, { startsOn: '2026-11-30' }, clock);
  await createShift(store, managerId, { title: 'Private draft', assignedWorkerId: 'worker_jamie',
    startLocal: '2026-11-30T09:00', endLocal: '2026-11-30T12:00' }, clock);
  await store.transaction(db => {
    const business = { ...db.businesses[0], id: 'other_business' };
    const worker = { ...db.users.find(user => user.id === 'worker_alex'), id: 'other_worker',
      businessId: business.id, email: 'other@example.test' };
    const original = db.shifts.find(shift => shift.title === 'Afternoon coverage');
    db.businesses.push(business);
    db.users.push(worker);
    db.shifts.push({ ...original, id: 'other_shift', businessId: business.id,
      assignedWorkerId: worker.id, title: 'Other business coverage' });
    db.coverageRequests.push({ id: 'other_request', businessId: business.id, shiftId: 'other_shift',
      originalWorkerId: worker.id, claimantId: null, reviewerId: null, status: 'open',
      createdAt: original.createdAt, updatedAt: original.updatedAt });
  });
  const before = await store.read();
  const manager = await workingSummary(store, managerId, 'this', clock);
  const employee = await workingSummary(store, 'worker_jamie', 'this', clock);
  assert.deepEqual(counts(manager), [1, 2, 0, 1]);
  assert.doesNotMatch(JSON.stringify(manager), /Other business coverage/);
  assert.deepEqual(counts(employee), [2, 1, 0, 1]);
  assert.doesNotMatch(JSON.stringify(employee), /Weekend service|Afternoon coverage|Private draft|worker_alex/);
  assert.deepEqual([employee.startDate, employee.lastDate, employee.timezone, employee.asOf],
    ['2026-11-23', '2026-11-29', 'America/Toronto', new Date(clock()).toISOString()]);
  assert.deepEqual(counts(await workingSummary(store, 'worker_jamie', 'next', clock)), [0, 0, 0, 0]);
  assert.deepEqual(counts(await workingSummary(store, managerId, 'this', () => Date.parse('2026-11-27T14:00:00Z'))), [0, 1, 0, 1]);
  await assert.rejects(workingSummary(store, 'unknown', 'this', clock), { status: 401 });
  await assert.rejects(workingSummary(store, managerId, 'last', clock), { status: 422 });
  assert.deepEqual(await store.read(), before);
});
