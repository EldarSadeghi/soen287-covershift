import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { JsonStore } from '../src/storage/json-store.js';
import { seedDemo } from '../src/storage/seed.js';
import { businessInstant, createShift } from '../src/shifts/create.js';
import { managerDashboard } from '../src/manager/dashboard.js';
import { upcomingWorkerShifts } from '../src/shifts/upcoming.js';
import { SessionStore } from '../src/auth/sessions.js';
import { createAppServer } from '../src/app.js';
const now = Date.parse('2026-11-16T12:00:00.000Z');
const input = { title: ' Opening service ', assignedWorkerId: 'worker_jamie', startLocal: '2026-11-17T09:00', endLocal: '2026-11-17T17:00' };
const status = n => e => e.status === n;
async function fixture(t) {
 const dir = await mkdtemp(join(tmpdir(), 'covershift-create-')); t.after(() => rm(dir, { recursive: true, force: true }));
 const store = new JsonStore(join(dir, 'covershift.json')); await seedDemo(store);
 await store.transaction(db => { db.users[0].passwordHash = 'test hash'; db.users[1].passwordHash = 'test hash'; db.businesses.push({ ...db.businesses[0], id: 'other', name: 'Other café' }); db.users.push({ ...db.users[0], id: 'other_manager', businessId: 'other', email: 'other@example.test' }, { ...db.users[1], id: 'other_worker', businessId: 'other', email: 'other_worker@example.test' }); });
 return store;
}
test('business time conversion is independent of host timezone, handles fractional offsets and DST', () => {
 assert.equal(businessInstant('2026-11-17T09:00', 'America/Toronto', 'startLocal'), '2026-11-17T14:00:00.000Z');
 assert.equal(businessInstant('2027-07-01T09:00', 'America/Toronto', 'startLocal'), '2027-07-01T13:00:00.000Z');
 assert.equal(businessInstant('2027-07-01T09:00', 'Asia/Kathmandu', 'startLocal'), '2027-07-01T03:15:00.000Z');
 assert.equal(businessInstant('2027-07-01T09:00', 'UTC', 'startLocal'), '2027-07-01T09:00:00.000Z');
 for (const value of ['2027-03-14T02:30', '2027-11-07T01:30']) assert.throws(() => businessInstant(value, 'America/Toronto', 'startLocal'), status(422));
 assert.throws(() => businessInstant('2027-10-03T02:15', 'Australia/Lord_Howe', 'endLocal'), status(422));
});
test('strict calendar validation rejects impossible dates, normalization, offsets and nonstrings', () => {
 for (const value of ['2027-02-29T09:00', '2026-04-31T09:00', '2027-01-01T24:00', '2027-01-01T09:60', '2027-13-01T09:00', '2027-01-01T09:00Z', '2027-01-01T09:00:00', '1999-01-01T09:00', null, {}, '']) assert.throws(() => businessInstant(value, 'UTC', 'startLocal'), status(422));
 assert.equal(businessInstant('2028-02-29T09:00', 'UTC', 'startLocal'), '2028-02-29T09:00:00.000Z');
});
test('saved assignment appears in manager and assigned worker views and survives store reopen', async t => {
 const store = await fixture(t); const before = await store.read();
 const result = await createShift(store, 'manager_morgan', input, () => now);
 assert.equal(result.shift.title, 'Opening service'); assert.equal(result.shift.startsAt, '2026-11-17T14:00:00.000Z'); assert.equal(result.shift.assignedWorker.id, 'worker_jamie');
 const reopened = new JsonStore(store.filename); const db = await reopened.read();
 assert.equal(db.shifts.length, before.shifts.length + 1); assert.deepEqual(db.users, before.users); assert.equal(db.schemaVersion, before.schemaVersion);
 assert.ok((await managerDashboard(reopened, 'manager_morgan', now)).shifts.some(s => s.id === result.shift.id));
 assert.ok((await upcomingWorkerShifts(reopened, 'worker_jamie', now)).shifts.some(s => s.id === result.shift.id));
 assert.ok(!(await upcomingWorkerShifts(reopened, 'other_worker', now)).shifts.some(s => s.id === result.shift.id));
 assert.doesNotMatch(JSON.stringify(result), /email|passwordHash|businessId/);
});
test('overnight shifts and pending-login workers are supported; adjacent shifts are allowed', async t => {
 const store = await fixture(t);
 const first = await createShift(store, 'manager_morgan', { ...input, assignedWorkerId: 'worker_alex', startLocal: '2026-11-17T22:00', endLocal: '2026-11-18T06:00' }, () => now);
 assert.equal(first.shift.endsAt, '2026-11-18T11:00:00.000Z');
 await createShift(store, 'manager_morgan', { ...input, assignedWorkerId: 'worker_alex', startLocal: '2026-11-18T06:00', endLocal: '2026-11-18T07:00' }, () => now);
});
test('invalid input, past or reversed ranges, forged assignments and roles never change disk', async t => {
 const store = await fixture(t); const before = await readFile(store.filename, 'utf8');
 for (const changes of [{ title: ' ' }, { title: 'x'.repeat(101) }, { startLocal: '2026-11-16T07:00' }, { endLocal: input.startLocal }, { endLocal: '2026-11-17T08:00' }, { assignedWorkerId: 'other_worker' }, { assignedWorkerId: 'manager_morgan' }, { assignedWorkerId: 'missing' }, { assignedWorkerId: 3 }, { businessId: 'other' }, { startsAt: '2026-11-17T14:00:00.000Z' }]) await assert.rejects(createShift(store, 'manager_morgan', { ...input, ...changes }, () => now), status(422));
 await assert.rejects(createShift(store, 'worker_jamie', input, () => now), status(403));
 await assert.rejects(createShift(store, 'missing', input, () => now), status(401));
 assert.equal(await readFile(store.filename, 'utf8'), before);
});
test('overlaps are rejected atomically under concurrent creation; other workers may work at same time', async t => {
 const store = await fixture(t);
 const attempts = await Promise.allSettled([createShift(store, 'manager_morgan', input, () => now), createShift(store, 'manager_morgan', { ...input, startLocal: '2026-11-17T16:00', endLocal: '2026-11-17T19:00' }, () => now)]);
 assert.equal(attempts.filter(x => x.status === 'fulfilled').length, 1); assert.equal(attempts.find(x => x.status === 'rejected').reason.status, 409);
 for (const times of [['08:00','20:00'],['10:00','11:00'],['08:00','10:00']]) await assert.rejects(createShift(store, 'manager_morgan', { ...input, startLocal: `2026-11-17T${times[0]}`, endLocal: `2026-11-17T${times[1]}` }, () => now), status(409));
 await createShift(store, 'manager_morgan', { ...input, assignedWorkerId: 'worker_alex' }, () => now);
});
test('HTTP creation enforces method, session, role, business, origin, CSRF and JSON before persisting', async t => {
 const store = await fixture(t); const sessions = new SessionStore(); const server = createAppServer({ store, sessions, shiftClock: () => now });
 await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
 const origin = `http://127.0.0.1:${server.address().port}`; const manager = sessions.create('manager_morgan'); const worker = sessions.create('worker_jamie');
 const cookie = manager.cookie.split(';')[0];
 const account = await (await fetch(origin + '/api/session', { headers: { Cookie: cookie } })).json();
 const post = (body, headers = {}, path = '/api/manager/shifts') => fetch(origin + path, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', Cookie: cookie, 'X-CSRF-Token': account.csrfToken, ...headers }, body: JSON.stringify(body) });
 const count = (await store.read()).shifts.length;
 assert.equal((await fetch(origin + '/api/manager/shifts')).status, 405);
 for (const [headers, code] of [[{ Cookie: '' },401],[{ Cookie: worker.cookie.split(';')[0] },403],[{ Origin: 'https://foreign.test' },403],[{ 'X-CSRF-Token': '' },403],[{ 'Content-Type': 'text/plain' },415],[{ 'Sec-Fetch-Site': 'cross-site' },403]]) assert.equal((await post(input, headers)).status, code);
 assert.equal((await post(input, {}, '/api/manager/shifts?businessId=other')).status, 400);
 assert.equal((await post({ ...input, assignedWorkerId: 'other_worker' })).status, 422);
 assert.equal((await store.read()).shifts.length, count);
 const response = await post(input); assert.equal(response.status, 201); const created = await response.json();
 assert.equal((await post(input)).status, 409);
 const workerView = await (await fetch(origin + '/api/worker/shifts', { headers: { Cookie: worker.cookie.split(';')[0] } })).json();
 assert.ok(workerView.shifts.some(s => s.id === created.shift.id));
 assert.equal((await store.read()).shifts.length, count + 1);
});
