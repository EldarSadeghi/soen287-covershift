import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { JsonStore } from '../src/storage/json-store.js';
import { seedDemo } from '../src/storage/seed.js';
import { validateDatabase } from '../src/storage/model.js';
import { listWorkers, addWorker, reissueSetup, setupDetails, completeSetup } from '../src/manager/workers.js';
import { SessionStore } from '../src/auth/sessions.js';
import { createAppServer } from '../src/app.js';
import { authenticate } from '../src/auth/login.js';
const now = Date.parse('2026-11-14T12:00:00.000Z');
const input = { name: 'New Worker', email: 'NEW@example.test ' };
const fake = { clock: () => now, hash: async () => 'test hash' };
async function fixture(t) {
  const dir = await mkdtemp(join(tmpdir(), 'covershift-team-')); t.after(() => rm(dir, { recursive: true, force: true }));
  const store = new JsonStore(join(dir, 'covershift.json')); await seedDemo(store);
  await store.transaction(db => { db.users[0].passwordHash = 'test hash'; db.users[1].passwordHash = 'test hash'; db.businesses.push({ ...db.businesses[0], id: 'other', name: 'Other business' }); db.users.push({ ...db.users[0], id: 'other_manager', businessId: 'other', email: 'other@example.test' }); });
  return store;
}
const status = n => e => e.status === n;
test('add worker atomically upgrades v1 without altering existing records; roster is scoped and safe', async t => {
  const store = await fixture(t); const before = await store.read();
  const created = await addWorker(store, 'manager_morgan', input, now); const db = await store.read();
  assert.equal(before.schemaVersion, 1); assert.equal(db.schemaVersion, 2);
  assert.deepEqual(db.users.slice(0, before.users.length), before.users); assert.deepEqual(db.shifts, before.shifts); assert.deepEqual(db.businesses, before.businesses);
  assert.match(created.setupToken, /^[a-f0-9]{64}$/); assert.equal(created.worker.email, 'new@example.test');
  const user = db.users.at(-1); assert.equal(user.role, 'worker'); assert.equal(user.businessId, before.users[0].businessId); assert.equal(user.passwordHash, null); assert.notEqual(user.setup.tokenHash, created.setupToken);
  assert.doesNotMatch(await readFile(store.filename, 'utf8'), new RegExp(created.setupToken));
  assert.equal((await listWorkers(store, 'other_manager', now)).workers.length, 0);
  assert.equal((await listWorkers(store, 'manager_morgan', now)).workers.length, 5);
  assert.doesNotMatch(JSON.stringify(await listWorkers(store, 'manager_morgan', now)), /tokenHash|setupToken|passwordHash/);
});
test('strict fields, duplicate race, role and business boundaries reject unauthorized changes', async t => {
  const store = await fixture(t);
  await assert.rejects(addWorker(store, 'manager_morgan', { ...input, role: 'manager' }, now), status(422));
  await assert.rejects(addWorker(store, 'manager_morgan', { name: ' ', email: 'bad' }, now), status(422));
  await assert.rejects(addWorker(store, 'worker_jamie', input, now), status(403));
  const results = await Promise.allSettled([addWorker(store, 'manager_morgan', input, now), addWorker(store, 'manager_morgan', input, now)]);
  assert.equal(results.filter(x => x.status === 'fulfilled').length, 1); assert.equal(results.find(x => x.status === 'rejected').reason.status, 409);
  const created = results.find(x => x.status === 'fulfilled').value;
  await assert.rejects(reissueSetup(store, 'other_manager', created.worker.id, {}, now), status(404));
  await assert.rejects(reissueSetup(store, 'manager_morgan', 'manager_morgan', {}, now), status(404));
  await assert.rejects(reissueSetup(store, 'manager_morgan', 'worker_jamie', {}, now), status(409));
});
test('setup survives reopening storage, expires at boundary, and replacement invalidates original', async t => {
  const store = await fixture(t); const created = await addWorker(store, 'manager_morgan', input, now);
  const reopened = new JsonStore(store.filename);
  assert.equal((await setupDetails(reopened, { token: created.setupToken }, now)).email, 'new@example.test');
  await assert.rejects(setupDetails(store, { token: created.setupToken }, now + 86400000), status(400));
  const replacement = await reissueSetup(store, 'manager_morgan', created.worker.id, {}, now + 1);
  await assert.rejects(setupDetails(store, { token: created.setupToken }, now), status(400));
  assert.equal((await setupDetails(store, { token: replacement.setupToken }, now + 2)).name, 'New Worker');
});
test('single-use completion is atomic, cannot reset accounts, and cannot change role or business', async t => {
  const store = await fixture(t); const created = await addWorker(store, 'manager_morgan', input, now);
  const body = { token: created.setupToken, password: 'Worker passphrase for tests!' };
  await assert.rejects(completeSetup(store, { ...body, businessId: 'other' }, fake), status(422));
  await assert.rejects(completeSetup(store, { ...body, password: 'short' }, fake), status(422));
  const outcomes = await Promise.allSettled([completeSetup(store, body, fake), completeSetup(store, body, fake)]);
  assert.equal(outcomes.filter(x => x.status === 'fulfilled').length, 1); assert.equal(outcomes.find(x => x.status === 'rejected').reason.status, 400);
  await assert.rejects(completeSetup(store, body, fake), status(400));
  const user = (await store.read()).users.find(x => x.id === created.worker.id);
  assert.equal(user.passwordHash, 'test hash'); assert.equal(user.setup, undefined); assert.equal(user.role, 'worker');
  await assert.rejects(reissueSetup(store, 'manager_morgan', user.id, {}, now), status(409));
});
test('expiry and link rotation are rechecked after password hashing', async t => {
  const store = await fixture(t); const created = await addWorker(store, 'manager_morgan', input, now);
  let clock = now;
  await assert.rejects(completeSetup(store, { token: created.setupToken, password: 'Worker passphrase for tests!' }, { clock: () => clock, hash: async () => { clock += 86400000; return 'test hash'; } }), status(400));
  await assert.rejects(completeSetup(store, { token: created.setupToken, password: 'Worker passphrase for tests!' }, { clock: () => now, hash: async () => { await reissueSetup(store, 'manager_morgan', created.worker.id, {}, now); return 'test hash'; } }), status(400));
  assert.equal((await store.read()).users.at(-1).passwordHash, null);
});
test('v2 setup metadata is restricted to pending workers and rejects extra fields', async t => {
  const store = await fixture(t); await addWorker(store, 'manager_morgan', input, now); const db = await store.read();
  for (const change of [d => { d.schemaVersion = 1; }, d => { d.users.at(-1).setup.token = 'raw'; }, d => { d.users.at(-1).setup.tokenHash = 'raw'; }, d => { d.users.at(-1).passwordHash = 'test hash'; }, d => { d.users.at(-1).role = 'manager'; }]) { const draft = structuredClone(db); change(draft); assert.throws(() => validateDatabase(draft)); }
});
test('HTTP manager mutations enforce session, CSRF, origin, JSON, and fixed business; setup creates usable worker login', async t => {
  const store = await fixture(t); const sessions = new SessionStore();
  const server = createAppServer({ store, sessions, setupClock: () => now });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const manager = sessions.create('manager_morgan'); const worker = sessions.create('worker_jamie');
  const cookie = manager.cookie.split(';')[0]; const session = await (await fetch(origin + '/api/session', { headers: { Cookie: cookie } })).json();
  const post = (path, body, headers = {}) => fetch(origin + path, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', Cookie: cookie, 'X-CSRF-Token': session.csrfToken, ...headers }, body: JSON.stringify(body) });
  assert.equal((await fetch(origin + '/api/manager/workers')).status, 401);
  assert.equal((await post('/api/manager/workers', input, { Cookie: worker.cookie.split(';')[0] })).status, 403);
  assert.equal((await post('/api/manager/workers', input, { 'X-CSRF-Token': '' })).status, 403);
  assert.equal((await post('/api/manager/workers', input, { Origin: 'https://other.test' })).status, 403);
  assert.equal((await post('/api/manager/workers', input, { 'Content-Type': 'text/plain' })).status, 415);
  const response = await post('/api/manager/workers', input); assert.equal(response.status, 201); const created = await response.json();
  assert.equal((await post('/api/worker-setup/details', { token: created.setupToken }, { Cookie: '' })).status, 200);
  const password = 'A real worker test passphrase!';
  const complete = await post('/api/worker-setup/complete', { token: created.setupToken, password }, { Cookie: '' });
  assert.equal(complete.status, 200); assert.equal(complete.headers.get('set-cookie'), null);
  assert.equal(await authenticate(store, { email: 'new@example.test', password }), created.worker.id);
  const user = (await store.read()).users.at(-1); assert.match(user.passwordHash, /^scrypt\$/); assert.doesNotMatch(await readFile(store.filename, 'utf8'), /A real worker test passphrase!/);
  assert.equal((await post('/api/worker-setup/complete', { token: created.setupToken, password })).status, 400);
  assert.equal((await fetch(origin + '/api/session', { headers: { Cookie: cookie } })).status, 200);
  assert.equal((await fetch(origin + '/setup')).status, 200);
});
