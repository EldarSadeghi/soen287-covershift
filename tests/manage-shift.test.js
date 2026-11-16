import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { JsonStore } from '../src/storage/json-store.js';
import { seedDemo } from '../src/storage/seed.js';
import { createShift } from '../src/shifts/create.js';
import { manageShift, shiftRevision, shiftLockReason } from '../src/shifts/manage.js';
import { managerDashboard } from '../src/manager/dashboard.js';
import { upcomingWorkerShifts } from '../src/shifts/upcoming.js';
import { SessionStore } from '../src/auth/sessions.js';
import { createAppServer } from '../src/app.js';
const now = Date.parse('2026-11-16T12:00:00.000Z');
const clock = () => now;
const values = { title: 'Opening service', assignedWorkerId: 'worker_jamie', startLocal: '2026-11-20T09:00', endLocal: '2026-11-20T17:00' };
const status = n => e => e.status === n;
async function fixture(t) {
 const dir = await mkdtemp(join(tmpdir(), 'covershift-manage-')); t.after(() => rm(dir, { recursive: true, force: true }));
 const store = new JsonStore(join(dir, 'covershift.json')); await seedDemo(store);
 await store.transaction(db => { db.users[0].passwordHash = 'test hash'; db.users[1].passwordHash = 'test hash'; db.users[2].passwordHash = 'test hash'; db.businesses.push({ ...db.businesses[0], id: 'other', name: 'Other café' }); db.users.push({ ...db.users[0], id: 'other_manager', businessId: 'other', email: 'other@example.test' }, { ...db.users[1], id: 'other_worker', businessId: 'other', email: 'other_worker@example.test' }); });
 const created = await createShift(store, 'manager_morgan', values, clock);
 const snapshot = async () => (await store.read()).shifts.find(s => s.id === created.shift.id);
 return { store, id: created.shift.id, snapshot, revision: async () => shiftRevision(await snapshot()) };
}
test('edit persists title, overnight time and reassignment, updates both role views and preserves identity', async t => {
 const f = await fixture(t); const before = await f.snapshot();
 const response = await manageShift(f.store, 'manager_morgan', f.id, 'edit', { ...values, title: 'Closing service', assignedWorkerId: 'worker_alex', startLocal: '2026-11-20T22:00', endLocal: '2026-11-21T06:00', revision: await f.revision() }, clock);
 const saved = await new JsonStore(f.store.filename).read(); const shift = saved.shifts.find(s => s.id === f.id);
 assert.equal(response.shift.title, 'Closing service'); assert.equal(shift.id, before.id); assert.equal(shift.createdAt, before.createdAt); assert.ok(shift.updatedAt > before.updatedAt); assert.equal(shift.startsAt, '2026-11-21T03:00:00.000Z'); assert.equal(shift.endsAt, '2026-11-21T11:00:00.000Z');
 assert.ok(!(await upcomingWorkerShifts(f.store, 'worker_jamie', now)).shifts.some(s => s.id === f.id));
 assert.ok((await upcomingWorkerShifts(f.store, 'worker_alex', now)).shifts.some(s => s.id === f.id));
 assert.equal((await managerDashboard(f.store, 'manager_morgan', now)).shifts.find(s => s.id === f.id).assignedWorker.id, 'worker_alex');
});
test('deletion removes only eligible shift, leaves all other collections intact and survives reopen', async t => {
 const f = await fixture(t); const before = await f.store.read();
 const result = await manageShift(f.store, 'manager_morgan', f.id, 'delete', { revision: await f.revision() }, clock);
 assert.equal(result.deletedId, f.id);
 const after = await new JsonStore(f.store.filename).read();
 assert.deepEqual(after.shifts, before.shifts.filter(s => s.id !== f.id));
 for (const key of ['users', 'businesses', 'coverageRequests', 'schemaVersion']) assert.deepEqual(after[key], before[key]);
 assert.ok(!(await upcomingWorkerShifts(f.store, 'worker_jamie', now)).shifts.some(s => s.id === f.id));
 assert.equal((await managerDashboard(f.store, 'manager_morgan', now)).summary.shifts, before.shifts.filter(s => s.id !== f.id && Date.parse(s.endsAt) > now).length);
});
test('every linked coverage status blocks edit/delete without orphaning or modifying records', async t => {
 for (const coverageStatus of ['open', 'pending', 'approved', 'cancelled']) {
  const f = await fixture(t);
  await f.store.transaction(db => { const at = new Date(now).toISOString(); db.coverageRequests.push({ id: 'linked', businessId: db.shifts.find(s => s.id === f.id).businessId, shiftId: f.id, originalWorkerId: 'worker_jamie', claimantId: ['pending','approved'].includes(coverageStatus) ? 'worker_alex' : null, reviewerId: coverageStatus === 'approved' ? 'manager_morgan' : null, status: coverageStatus, createdAt: at, updatedAt: at }); });
  const before = await readFile(f.store.filename, 'utf8'); const revision = await f.revision();
  assert.match(shiftLockReason(await f.store.read(), await f.snapshot(), now), /coverage/);
  for (const action of ['edit', 'delete']) await assert.rejects(manageShift(f.store, 'manager_morgan', f.id, action, { ...(action === 'edit' ? values : {}), revision }, clock), status(409));
  assert.equal(await readFile(f.store.filename, 'utf8'), before);
 }
});
test('started/ended shifts are locked at the exact start boundary, including attempts to move them into future', async t => {
 const f = await fixture(t); const revision = await f.revision(); const shift = await f.snapshot();
 for (const instant of [Date.parse(shift.startsAt), Date.parse(shift.endsAt)]) for (const action of ['edit','delete']) await assert.rejects(manageShift(f.store, 'manager_morgan', f.id, action, { ...(action === 'edit' ? { ...values, startLocal: '2026-11-25T09:00', endLocal: '2026-11-25T17:00' } : {}), revision }, () => instant), status(409));
});
test('stale submissions and concurrent edit/delete cannot overwrite a more recent change', async t => {
 const f = await fixture(t); const revision = await f.revision();
 await manageShift(f.store, 'manager_morgan', f.id, 'edit', { ...values, title: 'Updated once', revision }, clock);
 assert.notEqual(await f.revision(), revision);
 for (const action of ['edit','delete']) await assert.rejects(manageShift(f.store, 'manager_morgan', f.id, action, { ...(action === 'edit' ? values : {}), revision }, clock), status(409));
 const fresh = await f.revision();
 const results = await Promise.allSettled([manageShift(f.store, 'manager_morgan', f.id, 'edit', { ...values, title: 'Second edit', revision: fresh }, clock), manageShift(f.store, 'manager_morgan', f.id, 'delete', { revision: fresh }, clock)]);
 assert.equal(results.filter(r => r.status === 'fulfilled').length, 1); assert.equal(results.find(r => r.status === 'rejected').reason.status, 409);
 assert.equal((await f.snapshot()).title, 'Second edit');
});
test('edit excludes its own interval, rejects overlapping reassignment, and serializes conflicts with creation', async t => {
 const f = await fixture(t);
 await manageShift(f.store, 'manager_morgan', f.id, 'edit', { ...values, revision: await f.revision() }, clock);
 await createShift(f.store, 'manager_morgan', { ...values, assignedWorkerId: 'worker_alex' }, clock);
 await assert.rejects(manageShift(f.store, 'manager_morgan', f.id, 'edit', { ...values, assignedWorkerId: 'worker_alex', revision: await f.revision() }, clock), status(409));
 const edit = { ...values, startLocal: '2026-11-22T09:00', endLocal: '2026-11-22T17:00' };
 const results = await Promise.allSettled([manageShift(f.store, 'manager_morgan', f.id, 'edit', { ...edit, revision: await f.revision() }, clock), createShift(f.store, 'manager_morgan', edit, clock)]);
 assert.equal(results.filter(r => r.status === 'fulfilled').length, 1); assert.equal(results.find(r => r.status === 'rejected').reason.status, 409);
});
test('foreign/worker access, forged fields, invalid dates, assignment and missing revisions do not change storage', async t => {
 const f = await fixture(t); const before = await readFile(f.store.filename, 'utf8'); const revision = await f.revision();
 for (const action of ['edit','delete']) {
  const body = { ...(action === 'edit' ? values : {}), revision };
  await assert.rejects(manageShift(f.store, 'other_manager', f.id, action, body, clock), status(404));
  await assert.rejects(manageShift(f.store, 'worker_jamie', f.id, action, body, clock), status(403));
 }
 for (const changes of [{ assignedWorkerId: 'other_worker' }, { assignedWorkerId: 'manager_morgan' }, { startLocal: '2026-02-30T09:00' }, { startLocal: '2026-11-16T06:00' }, { endLocal: values.startLocal }, { businessId: 'other' }, { revision: null }, { revision: '' }]) await assert.rejects(manageShift(f.store, 'manager_morgan', f.id, 'edit', { ...values, revision, ...changes }, clock), status(422));
 await assert.rejects(manageShift(f.store, 'manager_morgan', f.id, 'delete', { revision, title: 'extra' }, clock), status(422));
 assert.equal(await readFile(f.store.filename, 'utf8'), before);
});
test('dashboard exposes safe revision and lock reasons consistent with server policy', async t => {
 const f = await fixture(t); const result = await managerDashboard(f.store, 'manager_morgan', now);
 const editable = result.shifts.find(s => s.id === f.id);
 assert.equal(editable.revision, await f.revision()); assert.equal(editable.lockReason, null);
 assert.match(result.shifts.find(s => s.id === 'shift_monday').lockReason, /started/);
 assert.doesNotMatch(JSON.stringify(result), /passwordHash|tokenHash|example.test/);
});
test('HTTP edit/delete require session, role, Origin, CSRF and JSON; persisted changes reflect in role endpoints', async t => {
 const f = await fixture(t); const sessions = new SessionStore(); const server = createAppServer({ store: f.store, sessions, shiftClock: clock });
 await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
 const origin = `http://127.0.0.1:${server.address().port}`; const cookie = sessions.create('manager_morgan').cookie.split(';')[0]; const workerCookie = sessions.create('worker_jamie').cookie.split(';')[0]; const otherCookie = sessions.create('other_manager').cookie.split(';')[0];
 const account = await (await fetch(origin + '/api/session', { headers: { Cookie: cookie } })).json();
 const post = (action, body, headers = {}, query = '') => fetch(`${origin}/api/manager/shifts/${f.id}/${action}${query}`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', Cookie: cookie, 'X-CSRF-Token': account.csrfToken, ...headers }, body: JSON.stringify(body) });
 const revision = await f.revision();
 for (const action of ['edit','delete']) {
  const body = { ...(action === 'edit' ? values : {}), revision };
  for (const [headers, code] of [[{ Cookie: '' },401],[{ Cookie: workerCookie },403],[{ Origin: 'https://foreign.test' },403],[{ 'X-CSRF-Token': '' },403],[{ 'Content-Type': 'text/plain' },415],[{ 'Sec-Fetch-Site': 'cross-site' },403]]) assert.equal((await post(action, body, headers)).status, code);
  const other = await (await fetch(origin + '/api/session', { headers: { Cookie: otherCookie } })).json();
  assert.equal((await post(action, body, { Cookie: otherCookie, 'X-CSRF-Token': other.csrfToken })).status, 404);
  assert.equal((await post(action, body, {}, '?businessId=other')).status, 400);
 }
 const response = await post('edit', { ...values, title: 'Edited over HTTP', revision }); assert.equal(response.status, 200);
 assert.equal((await post('delete', { revision })).status, 409);
 const latest = await (await fetch(origin + '/api/manager/dashboard', { headers: { Cookie: cookie } })).json();
 const edited = latest.shifts.find(s => s.id === f.id); assert.equal(edited.title, 'Edited over HTTP');
 const deleted = await post('delete', { revision: edited.revision }); assert.equal(deleted.status, 200);
 assert.equal((await post('delete', { revision: edited.revision })).status, 404);
 const worker = await (await fetch(origin + '/api/worker/shifts', { headers: { Cookie: workerCookie } })).json(); assert.ok(!worker.shifts.some(s => s.id === f.id));
});
