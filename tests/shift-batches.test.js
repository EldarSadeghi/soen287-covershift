import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { buildDemoFixtures } from '../src/demo/fixtures.js';
import { createAiShiftDrafter } from '../src/ai/shift-draft.js';
import { getSchedulePeriod, prepareSchedule, publishSchedule } from '../src/schedules/publication.js';
import { JsonStore } from '../src/storage/json-store.js';
import { getShiftBatchReceipt, saveShiftBatch } from '../src/shifts/batch.js';
import { requestsShiftBatch, routeChat } from '../public/ai-chat-routing.js';

const clock = () => Date.parse('2026-11-25T15:00:00Z');
const manager = 'manager_morgan';
const worker = 'worker_sam';

async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), 'covershift-batch-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const store = new JsonStore(join(directory, 'db.json'));
  await buildDemoFixtures(store, { now: clock(), hash: async () => 'fictional-hash' });
  return store;
}
const shift = (title, startLocal, endLocal, assignedWorkerId = worker) => ({ title, startLocal, endLocal, assignedWorkerId });
const input = (shifts = [
  shift('Opening service', '2026-12-08T09:00', '2026-12-08T12:00'),
  shift('Closing service', '2026-12-08T22:00', '2026-12-09T02:00'),
]) => ({ batchId: randomUUID(), timezone: 'America/Toronto', shifts });

test('batch routing preserves manager schedule questions and employee boundaries', () => {
  assert.equal(requestsShiftBatch('Draft two shifts for Sam and Alex'), true);
  assert.equal(requestsShiftBatch('Draft Opening for Sam and Closing for Alex'), true);
  assert.equal(routeChat('Show shifts for Alex', true, null), 'questions');
  assert.notEqual(routeChat('Draft two shifts for Sam', false, null), 'draft');
});

test('batch saves are atomic, private with publication, and idempotent on a concurrent retry', async t => {
  const store = await fixture(t);
  await prepareSchedule(store, manager, { startsOn: '2026-12-07' }, clock);
  const before = await store.read();
  const rejected = input([shift('Good', '2026-12-08T09:00', '2026-12-08T12:00'), shift('Overlap', '2026-12-08T11:00', '2026-12-08T13:00')]);
  await assert.rejects(saveShiftBatch(store, manager, rejected, clock), { status: 409, message: /Shift 2/ });
  assert.deepEqual(await store.read(), before);
  const batch = input();
  const [first, second] = await Promise.all([saveShiftBatch(store, manager, batch, clock), saveShiftBatch(store, manager, batch, clock)]);
  assert.deepEqual(first, { batchId: batch.batchId, count: 2, draft: true });
  assert.deepEqual(second, first);
  assert.deepEqual(await getShiftBatchReceipt(store, manager, batch.batchId), first);
  assert.deepEqual((await store.read()).shifts, before.shifts);
  assert.equal((await store.read()).scheduleDrafts.length, 2);
  await assert.rejects(saveShiftBatch(store, manager, { ...batch, shifts: batch.shifts.map(row => ({...row, title: 'Different'})) }, clock), { status: 409 });
  await assert.rejects(getShiftBatchReceipt(store, worker, batch.batchId), { status: 403 });
  const period = await getSchedulePeriod(store, manager, '2026-12-07', clock());
  assert.equal(period.published.length, 0);
  await publishSchedule(store, manager, { startsOn: period.startsOn, revision: period.revision },
    () => Date.parse('2026-11-30T15:00:00Z'));
  const published = await store.read();
  assert.equal(published.scheduleDrafts.length, 0);
  assert.equal(published.shifts.length, before.shifts.length + 2);
  await prepareSchedule(store, manager, { startsOn: '2026-12-14' }, clock);
  assert.equal((await store.read()).schemaVersion, 14);
  assert.deepEqual(await getShiftBatchReceipt(store, manager, batch.batchId), first);
});

test('a second invalid row or competing save leaves all rows unsaved', async t => {
  const store = await fixture(t);
  const batch = input();
  const before = await store.read();
  const invalid = { ...batch, shifts: [batch.shifts[0], shift('DST gap', '2027-03-14T02:30', '2027-03-14T04:00')] };
  await assert.rejects(saveShiftBatch(store, manager, invalid, clock), { status: 422, message: /Shift 2.*does not exist/ });
  await assert.rejects(saveShiftBatch(store, worker, batch, clock), { status: 403 });
  assert.deepEqual(await store.read(), before);
  const missingPeriod = '2027-03-15';
  await prepareSchedule(store, manager, { startsOn: '2026-12-07' }, clock);
  await assert.rejects(saveShiftBatch(store, manager, input([batch.shifts[0],
    shift('Outside', missingPeriod + 'T09:00', missingPeriod + 'T12:00')]), clock), { status: 409, message: /Shift 2/ });
  assert.equal((await store.read()).scheduleDrafts.length, 0);
  const competition = await Promise.allSettled([saveShiftBatch(store, manager, batch, clock), saveShiftBatch(store, manager, input(), clock)]);
  assert.equal(competition.filter(item => item.status === 'fulfilled').length, 1);
  assert.equal(competition.find(item => item.status === 'rejected').reason.status, 409);
  assert.equal((await store.read()).scheduleDrafts.length, 2);
});

test('AI batch returns editable, scoped rows and makes no schedule writes', async t => {
  const store = await fixture(t);
  const before = await store.read();
  const drafter = createAiShiftDrafter({ apiKey: 'fictional', allowance: { reserve() {} }, fetchImpl: async (_url, request) => {
    const payload = JSON.parse(request.body);
    assert.equal(payload.text.format.name, 'shift_batch');
    assert.equal(payload.store, false);
    const sam = JSON.parse(payload.input).workers.find(row => row.name === 'Sam Rivera');
    const shifts = input().shifts.map(({assignedWorkerId, ...row}) => ({ ...row, worker: sam.ref }));
    return Response.json({ status: 'completed', output: [{ type: 'message', content: [
      { type: 'output_text', text: JSON.stringify({ kind: 'batch', question: '', shifts }) },
    ] }] });
  } });
  const data = await drafter(store, manager, { description: 'Draft two shifts for Sam', batch: true }, clock);
  assert.equal(data.kind, 'batch');
  assert.deepEqual(data.shifts, input().shifts);
  assert.ok(data.workers.some(row => row.id === worker));
  assert.deepEqual(await store.read(), before);
});
