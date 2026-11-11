import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { JsonStore } from '../src/storage/json-store.js';
import { seedDemo } from '../src/storage/seed.js';
import { upcomingWorkerShifts } from '../src/shifts/upcoming.js';
import { formatShiftTime } from '../public/shift-time.js';
import { SessionStore } from '../src/auth/sessions.js';
import { createAppServer } from '../src/app.js';
const now = Date.parse('2026-11-12T12:00:00.000Z');
async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), 'covershift-shifts-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const store = new JsonStore(join(directory, 'covershift.json'));
  await seedDemo(store);
  await store.transaction(db => { db.users[0].passwordHash = 'manager test hash'; db.users[1].passwordHash = 'worker test hash'; });
  return store;
}

test('upcoming shifts filter by authenticated worker, exclude completed boundaries, and sort deterministically', async t => {
  const store = await fixture(t);
  await store.transaction(db => {
    const shift = db.shifts[0];
    db.shifts.push(
      { ...shift, id: 'shift_current', startsAt: '2026-11-12T11:00:00.000Z', endsAt: '2026-11-12T13:00:00.000Z' },
      { ...shift, id: 'shift_finished', startsAt: '2026-11-12T09:00:00.000Z', endsAt: '2026-11-12T12:00:00.000Z' },
      { ...shift, id: 'shift_a', title: 'Same start, stable order' },
    );
    db.businesses.push({ ...db.businesses[0], id: 'other_business', name: 'Other private café' });
    db.users.push({ ...db.users[1], id: 'worker_other', businessId: 'other_business', email: 'other@example.test' });
    db.shifts.push({ ...shift, id: 'shift_other', businessId: 'other_business', assignedWorkerId: 'worker_other', title: 'Private other business shift' });
    db.shifts.reverse();
  });
  const result = await upcomingWorkerShifts(store, 'worker_jamie', now);
  assert.deepEqual(result.shifts.map(s => s.id), ['shift_current', 'shift_a', 'shift_thursday', 'shift_saturday', 'shift_monday']);
  assert.deepEqual(result.shifts.map(s => s.status), ['in_progress', 'in_progress', 'in_progress', 'upcoming', 'upcoming']);
  assert.equal(result.timezone, 'America/Toronto');
  assert.equal(result.asOf, new Date(now).toISOString());
  assert.doesNotMatch(JSON.stringify(result), /private|assignedWorkerId|email|password|businessId|shift_friday|shift_sunday/i);
});

test('end-time exclusion is exact to the millisecond and returns an honest empty state', async t => {
  const store = await fixture(t);
  const mondayEnd = Date.parse('2026-11-16T17:30:00.000Z');
  assert.equal((await upcomingWorkerShifts(store, 'worker_jamie', mondayEnd - 1)).shifts.length, 1);
  assert.deepEqual((await upcomingWorkerShifts(store, 'worker_jamie', mondayEnd)).shifts, []);
  const taylor = (await store.read()).users.find(user => user.id === 'worker_taylor');
  await store.transaction(db => { db.users.find(user => user.id === taylor.id).passwordHash = 'test hash'; });
  assert.deepEqual((await upcomingWorkerShifts(store, taylor.id, now)).shifts, []);
});

test('shift reads reflect saved changes and re-check current account identity', async t => {
  const store = await fixture(t);
  await store.transaction(db => { db.shifts[0].title = 'Saved title change'; });
  const reopened = new JsonStore(store.filename);
  assert.equal((await upcomingWorkerShifts(reopened, 'worker_jamie', now)).shifts[0].title, 'Saved title change');
  await assert.rejects(upcomingWorkerShifts(store, 'manager_morgan', now), error => error.status === 403);
  await assert.rejects(upcomingWorkerShifts(store, 'missing_worker', now), error => error.status === 401);
  await store.transaction(db => { db.users[1].passwordHash = null; });
  await assert.rejects(upcomingWorkerShifts(store, 'worker_jamie', now), error => error.status === 401);
});

test('formatting uses business timezone instead of machine timezone and handles overnight dates', () => {
  const shift = { startsAt: '2026-11-12T03:00:00.000Z', endsAt: '2026-11-12T11:00:00.000Z' };
  const toronto = formatShiftTime(shift, 'America/Toronto');
  assert.equal(toronto.date, 'Wednesday, November 11, 2026');
  assert.equal(toronto.startTime, '10:00 PM EST');
  assert.equal(toronto.endTime, '6:00 AM EST');
  assert.equal(toronto.endDate, 'Thursday, November 12, 2026');
  assert.equal(toronto.duration, '8 hours');
  const utc = formatShiftTime(shift, 'UTC');
  assert.equal(utc.date, 'Thursday, November 12, 2026');
  assert.equal(utc.endDate, null);
  assert.equal(formatShiftTime({ startsAt: shift.startsAt, endsAt: '2026-11-12T03:01:00.000Z' }, 'UTC').duration, '1 minute');
});

test('daylight-saving repeated clock times include offsets and use actual elapsed duration', () => {
  const result = formatShiftTime({ startsAt: '2026-11-01T05:30:00.000Z', endsAt: '2026-11-01T06:30:00.000Z' }, 'America/Toronto');
  assert.equal(result.startTime, '1:30 AM EDT');
  assert.equal(result.endTime, '1:30 AM EST');
  assert.equal(result.duration, '1 hour');
  assert.equal(result.endDate, null);
});

test('HTTP shift endpoint denies anonymous/managers and cannot select another worker via URL parameters', async t => {
  const store = await fixture(t);
  const sessions = new SessionStore();
  const worker = sessions.create('worker_jamie').cookie.split(';')[0];
  const manager = sessions.create('manager_morgan').cookie.split(';')[0];
  const server = createAppServer({ store, sessions, shiftClock: () => now });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const get = (path, cookie) => fetch(origin + path, { headers: cookie ? { Cookie: cookie } : {} });
  assert.equal((await get('/api/worker/shifts')).status, 401);
  assert.equal((await get('/api/worker/shifts', manager)).status, 403);
  assert.equal((await get('/api/worker/shifts?userId=worker_alex', worker)).status, 400);
  assert.equal((await get('/api/worker/shifts?businessId=other_business', worker)).status, 400);
  const response = await get('/api/worker/shifts', worker);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual((await response.json()).shifts.map(s => s.id), ['shift_thursday', 'shift_saturday', 'shift_monday']);
  await store.transaction(db => { db.shifts[0].title = 'Freshly saved title'; });
  assert.equal((await (await get('/api/worker/shifts', worker)).json()).shifts[0].title, 'Freshly saved title');
  assert.equal((await fetch(origin + '/api/worker/shifts', { method: 'POST', headers: { Cookie: worker } })).status, 405);
  sessions.destroy(worker);
  assert.equal((await get('/api/worker/shifts', worker)).status, 401);
});
