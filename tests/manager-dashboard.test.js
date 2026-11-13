import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { JsonStore } from '../src/storage/json-store.js';
import { seedDemo } from '../src/storage/seed.js';
import { managerDashboard } from '../src/manager/dashboard.js';
import { SessionStore } from '../src/auth/sessions.js';
import { authenticate } from '../src/auth/login.js';
import { registerManager } from '../src/auth/signup.js';
import { createAppServer } from '../src/app.js';
const now = Date.parse('2026-11-12T12:00:00.000Z');
const passphrase = 'Fictional milestone passphrase!';
async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), 'covershift-manager-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const store = new JsonStore(join(directory, 'covershift.json'));
  await seedDemo(store);
  await store.transaction(db => { db.users[0].passwordHash = 'test hash'; db.users[1].passwordHash = 'test hash'; });
  return store;
}
async function serverFixture(t, store) {
  const sessions = new SessionStore();
  const server = createAppServer({ store, sessions, shiftClock: () => now,
    signup: (store, input) => registerManager(store, input, { hash: async () => 'test hash' }),
    login: (store, input) => authenticate(store, input, { verify: async (password, hash) => password === passphrase && hash === 'test hash' }),
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const origin = `http://127.0.0.1:${server.address().port}`;
  return { sessions, get: (path, cookie) => fetch(origin + path, { redirect: 'manual', headers: cookie ? { Cookie: cookie } : {} }),
    post: (path, body, cookie, headers = {}) => fetch(origin + path, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}), ...headers }, body: JSON.stringify(body) }) };
}

test('manager summary returns sorted business shifts and pending people without sensitive account data or writes', async t => {
  const store = await fixture(t);
  const before = await readFile(store.filename, 'utf8');
  const result = await managerDashboard(store, 'manager_morgan', now);
  assert.deepEqual(result.summary, { workers: 4, shifts: 5, pendingClaims: 1 });
  assert.deepEqual(result.shifts.map(s => s.id), ['shift_thursday', 'shift_friday', 'shift_saturday', 'shift_sunday', 'shift_monday']);
  assert.equal(result.shifts[0].status, 'in_progress');
  assert.equal(result.shifts[1].assignedWorker.name, 'Alex Morgan');
  assert.equal(result.pendingClaims[0].originalWorker.name, 'Alex Morgan');
  assert.equal(result.pendingClaims[0].claimant.name, 'Taylor Brooks');
  assert.equal(result.pendingClaims[0].shift.assignedWorker.id, 'worker_alex');
  assert.equal(result.timezone, 'America/Toronto');
  assert.doesNotMatch(JSON.stringify(result), /password|email|example.test/);
  assert.equal(await readFile(store.filename, 'utf8'), before);
});

test('each manager sees only their own business including claim participants and counts', async t => {
  const store = await fixture(t);
  await store.transaction(db => {
    db.businesses.push({ ...db.businesses[0], id: 'other_business', name: 'Other private café' });
    db.users.push({ ...db.users[0], id: 'manager_other', businessId: 'other_business', email: 'manager_other@example.test' });
    for (const [id, name] of [['worker_other', 'Other worker'], ['claimant_other', 'Other claimant']]) db.users.push({ ...db.users[1], id, name, businessId: 'other_business', email: `${id}@example.test` });
    db.shifts.push({ ...db.shifts[0], id: 'shift_other', businessId: 'other_business', assignedWorkerId: 'worker_other', title: 'Other business private shift' });
    db.coverageRequests.push({ ...db.coverageRequests[0], id: 'request_other', businessId: 'other_business', shiftId: 'shift_other', originalWorkerId: 'worker_other', claimantId: 'claimant_other' });
  });
  const original = await managerDashboard(store, 'manager_morgan', now);
  assert.deepEqual(original.summary, { workers: 4, shifts: 5, pendingClaims: 1 });
  assert.doesNotMatch(JSON.stringify(original), /Other worker|Other claimant|shift_other|request_other/);
  const other = await managerDashboard(store, 'manager_other', now);
  assert.deepEqual(other.summary, { workers: 2, shifts: 1, pendingClaims: 1 });
  assert.equal(other.shifts[0].assignedWorker.id, 'worker_other');
  assert.equal(other.pendingClaims[0].claimant.id, 'claimant_other');
  assert.doesNotMatch(JSON.stringify(other), /Jamie Lee|Alex Morgan|Taylor Brooks/);
});

test('completed shifts leave the schedule but unresolved pending claims remain visible', async t => {
  const store = await fixture(t);
  const boundary = Date.parse('2026-11-13T23:00:00.000Z');
  const result = await managerDashboard(store, 'manager_morgan', boundary);
  assert.deepEqual(result.shifts.map(s => s.id), ['shift_saturday', 'shift_sunday', 'shift_monday']);
  assert.equal(result.pendingClaims.length, 1);
  assert.equal(result.pendingClaims[0].shift.status, 'completed');
  assert.equal(result.pendingClaims[0].status, 'pending');
  assert.equal(result.summary.pendingClaims, 1);
});

test('new businesses return empty data and access re-checks stored roles and credentials', async t => {
  const store = await fixture(t);
  await store.transaction(db => {
    db.businesses.push({ ...db.businesses[0], id: 'empty_business', name: 'New café' });
    db.users.push({ ...db.users[0], id: 'manager_new', businessId: 'empty_business', email: 'new@example.test' });
  });
  const empty = await managerDashboard(store, 'manager_new', now);
  assert.deepEqual(empty.summary, { workers: 0, shifts: 0, pendingClaims: 0 });
  assert.deepEqual(empty.shifts, []); assert.deepEqual(empty.pendingClaims, []);
  await assert.rejects(managerDashboard(store, 'worker_jamie', now), error => error.status === 403);
  await assert.rejects(managerDashboard(store, 'missing_manager', now), error => error.status === 401);
  await store.transaction(db => { db.users[0].passwordHash = null; });
  await assert.rejects(managerDashboard(store, 'manager_morgan', now), error => error.status === 401);
});

test('manager API rejects workers, forged filters, and mutations and reflects saved records', async t => {
  const store = await fixture(t); const { sessions, get, post } = await serverFixture(t, store);
  const manager = sessions.create('manager_morgan').cookie.split(';')[0];
  const worker = sessions.create('worker_jamie').cookie.split(';')[0];
  assert.equal((await get('/api/manager/dashboard')).status, 401);
  assert.equal((await get('/api/manager/dashboard', worker)).status, 403);
  assert.equal((await get('/api/manager/dashboard?businessId=other_business', manager)).status, 400);
  const response = await get('/api/manager/dashboard', manager);
  assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal((await response.json()).summary.pendingClaims, 1);
  await store.transaction(db => { db.shifts[0].title = 'Saved manager update'; });
  assert.equal((await (await get('/api/manager/dashboard', manager)).json()).shifts[0].title, 'Saved manager update');
  const before = await readFile(store.filename, 'utf8');
  assert.equal((await post('/api/manager/dashboard', {}, manager)).status, 405);
  assert.equal((await post('/api/manager/approvals/request_friday/approve', {}, manager)).status, 404);
  assert.equal(await readFile(store.filename, 'utf8'), before);
});

test('milestone walkthrough: signup, own empty dashboard, both-role pages, logout and protected routes', async t => {
  const store = await fixture(t); const { get, post } = await serverFixture(t, store);
  const signup = await post('/api/signup', { name: 'Milestone Manager', businessName: 'Milestone Café', email: 'milestone@example.test', password: passphrase, timezone: 'America/Toronto' });
  assert.equal(signup.status, 201);
  const created = await signup.json();
  const login = await post('/api/login', { email: 'milestone@example.test', password: passphrase });
  assert.equal(login.status, 200);
  const manager = login.headers.get('set-cookie').split(';')[0];
  const identity = await (await get('/api/session', manager)).json();
  assert.equal(identity.business.id, created.business.id);
  const dashboard = await (await get('/api/manager/dashboard', manager)).json();
  assert.deepEqual(dashboard.summary, { workers: 0, shifts: 0, pendingClaims: 0 });
  for (const page of ['overview', 'schedule', 'approvals', 'team']) assert.equal((await get(`/workspace/manager/${page}`, manager)).status, 200);
  assert.equal((await post('/api/logout', {}, manager, { 'X-CSRF-Token': identity.csrfToken })).status, 204);
  assert.equal((await get('/api/manager/dashboard', manager)).status, 401);
  const workerLogin = await post('/api/login', { email: 'worker_jamie@example.test', password: passphrase });
  const worker = workerLogin.headers.get('set-cookie').split(';')[0];
  for (const page of ['shifts', 'open', 'requests']) assert.equal((await get(`/workspace/worker/${page}`, worker)).status, 200);
  assert.equal((await (await get('/api/worker/shifts', worker)).json()).shifts.length, 3);
  assert.equal((await get('/api/manager/dashboard', worker)).status, 403);
  assert.equal((await get('/workspace/manager/overview', worker)).status, 403);
  const workerIdentity = await (await get('/api/session', worker)).json();
  assert.equal((await post('/api/logout', {}, worker, { 'X-CSRF-Token': workerIdentity.csrfToken })).status, 204);
  assert.equal((await get('/workspace/worker/shifts', worker)).status, 303);
  assert.equal((await get('/demo')).status, 200);
});
