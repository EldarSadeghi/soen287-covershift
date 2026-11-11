import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { JsonStore } from '../src/storage/json-store.js';
import { seedDemo } from '../src/storage/seed.js';
import { hashPassword, verifyPassword } from '../src/auth/passwords.js';
import { authenticate } from '../src/auth/login.js';
import { enableDemoAccounts } from '../src/auth/demo-accounts.js';
import { SessionStore, requireAccount } from '../src/auth/sessions.js';
import { createAppServer, createSignupLimiter } from '../src/app.js';
import { registerManager } from '../src/auth/signup.js';
import { HttpError } from '../src/auth/errors.js';
const passphrase = 'Fictional test access passphrase!';
async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), 'covershift-auth-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const store = new JsonStore(join(directory, 'covershift.json'));
  await seedDemo(store);
  return store;
}
function sessionCookie(value) { return value.split(';')[0]; }

test('password verifier accepts existing signup hashes and rejects wrong/null/malformed hashes', async () => {
  const hash = await hashPassword(passphrase);
  assert.equal(await verifyPassword(passphrase, hash), true);
  assert.equal(await verifyPassword('not the password', hash), false);
  assert.equal(await verifyPassword(passphrase, null), false);
  assert.equal(await verifyPassword(passphrase, 'scrypt$999999999999$bad'), false);
});

test('authentication normalizes email, returns only user ID, and gives identical unknown/wrong feedback', async t => {
  const store = await fixture(t);
  await store.transaction(db => { db.users[0].passwordHash = 'test hash'; });
  const fakeVerify = async (password, hash) => password === passphrase && hash === 'test hash';
  assert.equal(await authenticate(store, { email: ' MANAGER_MORGAN@EXAMPLE.TEST ', password: passphrase }, { verify: fakeVerify }), 'manager_morgan');
  const errors = [];
  for (const input of [{ email: 'manager_morgan@example.test', password: 'wrong' }, { email: 'missing@example.test', password: passphrase }, { email: 'worker_jamie@example.test', password: passphrase }]) {
    try { await authenticate(store, input, { verify: fakeVerify }); assert.fail('Should reject'); }
    catch (error) { errors.push({ status: error.status, message: error.message }); }
  }
  assert.deepEqual(errors, Array(3).fill({ status: 401, message: 'Email or password is incorrect.' }));
  await assert.rejects(authenticate(store, { email: 'manager_morgan@example.test', password: passphrase, role: 'manager' }, { verify: fakeVerify }), error => error.status === 422);
});

test('sessions expire by idle and absolute limits, rotate IDs, and invalidate logout', () => {
  let now = 0;
  const sessions = new SessionStore({ now: () => now, idleMs: 30, absoluteMs: 100 });
  const first = sessions.create('worker_jamie');
  const cookie = sessionCookie(first.cookie);
  assert.match(first.cookie, /HttpOnly; SameSite=Lax/);
  assert.doesNotMatch(first.cookie, /worker_jamie/);
  const account = sessions.get(cookie);
  assert.ok(sessions.validCsrf(account, account.csrfToken));
  assert.equal(sessions.validCsrf(account, 'tampered'), false);
  const rotated = sessions.create('worker_jamie', cookie);
  assert.notEqual(rotated.cookie, first.cookie);
  assert.equal(sessions.get(cookie), null);
  const rotatedCookie = sessionCookie(rotated.cookie);
  now = 29; assert.ok(sessions.get(rotatedCookie));
  now = 59; assert.equal(sessions.get(rotatedCookie), null);
  const absoluteCookie = sessionCookie(sessions.create('manager_morgan').cookie);
  for (now = 80; now < 159; now += 20) assert.ok(sessions.get(absoluteCookie));
  now = 159; assert.equal(sessions.get(absoluteCookie), null);
  const logoutCookie = sessionCookie(sessions.create('manager_morgan').cookie);
  assert.match(sessions.destroy(logoutCookie), /Max-Age=0/);
  assert.equal(sessions.get(logoutCookie), null);
  assert.equal(new SessionStore().get(logoutCookie), null);
  assert.equal(sessions.get('covershift_session=forged'), null);
});

test('HTTPS cookies use __Host prefix and capacity is bounded without evicting working sessions', () => {
  const sessions = new SessionStore({ secure: true, maxSessions: 1 });
  const first = sessions.create('user_one');
  assert.match(first.cookie, /^__Host-covershift=/);
  assert.match(first.cookie, /; Secure$/);
  assert.doesNotMatch(first.cookie, /Domain=/);
  assert.throws(() => sessions.create('user_two'), error => error.status === 503);
  assert.ok(sessions.get(sessionCookie(first.cookie)));
  assert.ok(sessions.create('user_one', sessionCookie(first.cookie)));
});

test('authorization reloads role/business from disk and rejects deleted or disabled accounts', async t => {
  const store = await fixture(t);
  const sessions = new SessionStore();
  await store.transaction(db => { db.users[1].passwordHash = 'test hash'; });
  const cookie = sessionCookie(sessions.create('worker_jamie').cookie);
  await assert.rejects(requireAccount(store, sessions, cookie, 'manager'), error => error.status === 403);
  assert.equal((await requireAccount(store, sessions, cookie, 'worker')).business.id, 'business_demo_cafe');
  await store.transaction(db => { db.users[1].passwordHash = null; });
  await assert.rejects(requireAccount(store, sessions, cookie), error => error.status === 401);
  assert.equal(sessions.get(cookie), null);
});

test('explicit demo setup hashes both roles and never resets existing credentials', async t => {
  const store = await fixture(t);
  assert.equal((await enableDemoAccounts(store, passphrase)).length, 2);
  const before = (await store.read()).users.slice(0, 2).map(user => user.passwordHash);
  assert.notEqual(before[0], before[1]);
  assert.deepEqual(await enableDemoAccounts(store, 'A different demo passphrase!'), []);
  assert.deepEqual((await store.read()).users.slice(0, 2).map(user => user.passwordHash), before);
});

test('HTTP enforces sessions, role/business access, cookie rotation, CSRF logout, and expiry', async t => {
  const store = await fixture(t);
  await store.transaction(db => {
    db.users[0].passwordHash = 'manager hash'; db.users[1].passwordHash = 'worker hash';
    db.businesses.push({ ...db.businesses[0], id: 'other_business', name: 'Other private café' });
    db.users.push({ ...db.users[0], id: 'manager_other', email: 'other@example.test', businessId: 'other_business' });
  });
  let now = 0;
  const sessions = new SessionStore({ now: () => now, idleMs: 1000, absoluteMs: 10000 });
  const fakeLogin = (db, input) => authenticate(db, input, { verify: async (password, hash) => password === passphrase && ['manager hash', 'worker hash'].includes(hash) });
  const server = createAppServer({ store, sessions, login: fakeLogin });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const get = (path, cookie) => fetch(origin + path, { redirect: 'manual', headers: cookie ? { Cookie: cookie } : {} });
  const post = (path, body, cookie, extra = {}) => fetch(origin + path, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}), ...extra }, body: JSON.stringify(body) });
  assert.equal((await get('/api/session')).status, 401);
  assert.equal((await get('/workspace/manager/overview')).headers.get('location'), '/login?expired=1');
  assert.equal((await get('/')).headers.get('location'), '/login');
  assert.equal((await get('/demo')).status, 200);
  const bad = await post('/api/login', { email: 'missing@example.test', password: passphrase });
  assert.equal(bad.status, 401);
  const login = await post('/api/login', { email: 'worker_jamie@example.test', password: passphrase });
  assert.equal(login.status, 200);
  assert.equal((await login.json()).redirectTo, '/workspace/worker/shifts');
  const workerCookie = sessionCookie(login.headers.get('set-cookie'));
  assert.match(login.headers.get('set-cookie'), /HttpOnly; SameSite=Lax/);
  assert.equal((await get('/workspace/worker/shifts', workerCookie)).status, 200);
  assert.equal((await get('/workspace/manager/overview', workerCookie)).status, 403);
  assert.equal((await get('/api/manager/context', workerCookie)).status, 403);
  assert.equal((await get('/api/worker/context', workerCookie)).status, 200);
  assert.equal((await get('/api/businesses/other_business/context', workerCookie)).status, 404);
  assert.equal((await get('/api/businesses/business_demo_cafe/context', workerCookie)).status, 200);
  const contextResponse = await get('/api/session', workerCookie);
  assert.equal(contextResponse.headers.get('cache-control'), 'no-store');
  const context = await contextResponse.json();
  assert.doesNotMatch(JSON.stringify(context), /password|hash|example.test/i);
  assert.equal((await post('/api/logout', {}, workerCookie)).status, 403);
  assert.equal((await post('/api/logout', {}, workerCookie, { 'X-CSRF-Token': context.csrfToken, Origin: 'https://outside.example' })).status, 403);
  assert.equal((await get('/api/session', workerCookie)).status, 200);
  const loginAgain = await post('/api/login', { email: 'worker_jamie@example.test', password: passphrase }, workerCookie);
  const newCookie = sessionCookie(loginAgain.headers.get('set-cookie'));
  assert.notEqual(newCookie, workerCookie);
  assert.equal((await get('/api/session', workerCookie)).status, 401);
  assert.equal((await post('/api/logout', {}, newCookie, { 'X-CSRF-Token': context.csrfToken })).status, 403);
  const fresh = await (await get('/api/session', newCookie)).json();
  const loggedOut = await post('/api/logout', {}, newCookie, { 'X-CSRF-Token': fresh.csrfToken });
  assert.equal(loggedOut.status, 204);
  assert.match(loggedOut.headers.get('set-cookie'), /Max-Age=0/);
  assert.equal((await get('/api/session', newCookie)).status, 401);
  const manager = await post('/api/login', { email: 'manager_morgan@example.test', password: passphrase });
  const managerCookie = sessionCookie(manager.headers.get('set-cookie'));
  assert.equal((await get('/api/manager/context', managerCookie)).status, 200);
  assert.equal((await get('/api/worker/context', managerCookie)).status, 403);
  assert.equal((await get('/workspace/manager/team', managerCookie)).status, 200);
  const other = await post('/api/login', { email: 'other@example.test', password: passphrase });
  const otherCookie = sessionCookie(other.headers.get('set-cookie'));
  assert.equal((await get('/api/businesses/business_demo_cafe/context', otherCookie)).status, 404);
  const otherContext = await (await get('/api/manager/context', otherCookie)).json();
  assert.equal(otherContext.business.id, 'other_business');
  assert.equal(otherContext.business.name, 'Other private café');
  now = 1001;
  assert.equal((await get('/api/session', managerCookie)).status, 401);
  const noJsPage = await (await get('/login')).text();
  assert.match(noJsPage, /method="post" action="\/api\/login"/);
  assert.equal((await post('/api/login', { email: 'manager_morgan@example.test', password: passphrase }, null, { Origin: 'https://outside.example' })).status, 403);
  assert.equal((await get('/data/covershift.json')).status, 404);
});

test('new signup accounts can authenticate through the same stored hash format', async t => {
  const store = await fixture(t);
  const created = await registerManager(store, { name: 'New Manager', businessName: 'New Café', email: 'new@example.test', password: passphrase, timezone: 'America/Toronto' });
  const userId = await authenticate(store, { email: 'new@example.test', password: passphrase });
  assert.equal(userId, created.manager.id);
  const sessions = new SessionStore();
  const cookie = sessionCookie(sessions.create(userId).cookie);
  const account = await requireAccount(store, sessions, cookie, 'manager');
  assert.equal(account.business.id, created.business.id);
  assert.notEqual(account.business.id, 'business_demo_cafe');
});

test('HTTP login throttles attempts before repeated password derivation', async t => {
  const store = await fixture(t);
  let verifications = 0;
  const server = createAppServer({ store, login: async () => { verifications++; throw new HttpError(401, 'Email or password is incorrect.'); }, limitLogin: createSignupLimiter({ limit: 1 }) });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const send = () => fetch(origin + '/api/login', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'missing@example.test', password: passphrase }) });
  await send();
  const denied = await send();
  assert.equal(denied.status, 429);
  assert.equal(denied.headers.get('retry-after'), '600');
  assert.equal(verifications, 1);
});
