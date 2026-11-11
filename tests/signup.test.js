import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { JsonStore } from '../src/storage/json-store.js';
import { registerManager, validateSignup, SignupError } from '../src/auth/signup.js';
import { createAppServer, createSignupLimiter } from '../src/app.js';
const valid = () => ({ name: 'Morgan Review', businessName: 'Review Café', email: 'review@example.test', password: 'A fictional long passphrase!', timezone: 'America/Toronto' });
const fakeHash = async () => 'test-only-password-hash';
async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), 'covershift-signup-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const store = new JsonStore(join(directory, 'covershift.json'));
  await store.initialize();
  return store;
}

test('signup persists a new business/manager and a verifiable salted scrypt hash', async t => {
  const store = await fixture(t);
  const input = valid();
  const result = await registerManager(store, { ...input, email: ' REVIEW@EXAMPLE.TEST ', name: ' Morgan Review ' });
  const db = await store.read();
  assert.equal(db.businesses.length, 1);
  assert.equal(db.users.length, 1);
  const user = db.users[0];
  assert.equal(user.businessId, db.businesses[0].id);
  assert.equal(user.role, 'manager');
  assert.equal(user.email, 'review@example.test');
  assert.equal(user.name, 'Morgan Review');
  assert.equal(db.businesses[0].timezone, 'America/Toronto');
  assert.notEqual(user.id, db.businesses[0].id);
  const [algorithm, N, r, p, salt, expected] = user.passwordHash.split('$');
  assert.equal(algorithm, 'scrypt');
  assert.equal(Number(N), 131072);
  assert.equal(salt.length, 32);
  const key = await promisify(scrypt)(input.password, salt, 64, { N: Number(N), r: Number(r), p: Number(p), maxmem: 256 * 1024 * 1024 });
  assert.ok(timingSafeEqual(key, Buffer.from(expected, 'hex')));
  assert.doesNotMatch(JSON.stringify(result), /password|hash|email|scrypt/i);
  assert.ok(!(await readFile(store.filename, 'utf8')).includes(input.password));
  assert.equal(result.manager.id, user.id);
});

test('invalid fields and client-selected roles/business IDs never create records', async t => {
  const store = await fixture(t);
  for (const invalid of [null, [], { ...valid(), password: 'short' }, { ...valid(), email: 'invalid' }, { ...valid(), businessName: ' ' }, { ...valid(), timezone: 'Not/AZone' }, { ...valid(), role: 'worker' }, { ...valid(), businessId: 'another_business' }]) {
    await assert.rejects(registerManager(store, invalid, { hash: fakeHash }), error => error instanceof SignupError && error.status === 422);
  }
  assert.equal((await store.read()).businesses.length, 0);
  assert.equal((await store.read()).users.length, 0);
  const spacedPassword = `  ${valid().password}  `;
  assert.equal(validateSignup({ ...valid(), password: spacedPassword }).password, spacedPassword);
});

test('concurrent duplicate emails create only one account and business', async t => {
  const store = await fixture(t);
  const results = await Promise.allSettled([
    registerManager(store, valid(), { hash: fakeHash }),
    registerManager(store, { ...valid(), email: 'REVIEW@example.test' }, { hash: fakeHash }),
  ]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(results.find(r => r.status === 'rejected').reason.status, 409);
  const db = await store.read();
  assert.equal(db.businesses.length, 1);
  assert.equal(db.users.length, 1);
  await assert.rejects(registerManager(store, valid(), { hash: () => { throw new Error('Should not hash a known duplicate'); } }), error => error.status === 409);
});

test('hashing failures leave no partial business or account', async t => {
  const store = await fixture(t);
  await assert.rejects(registerManager(store, valid(), { hash: async () => { throw new Error('Hashing failed'); } }), /Hashing failed/);
  assert.equal((await store.read()).businesses.length, 0);
  assert.equal((await store.read()).users.length, 0);
});

test('signup limiter blocks repeated attempts and expires them', () => {
  const limit = createSignupLimiter({ limit: 2, windowMs: 100 });
  limit('local', 0); limit('local', 1);
  assert.throws(() => limit('local', 2), error => error.status === 429);
  limit('different-address', 2);
  limit('local', 101);
});

test('HTTP signup rejects unsafe requests, creates accounts, and protects private files', async t => {
  const store = await fixture(t);
  const server = createAppServer({ store, signup: (store, input) => registerManager(store, input, { hash: fakeHash }), limitSignup: createSignupLimiter({ limit: 50 }) });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const send = (body, headers = {}, method = 'POST') => fetch(`${origin}/api/signup`, { method, headers: { Origin: origin, 'Content-Type': 'application/json', ...headers }, body: method === 'GET' ? undefined : body });
  assert.equal((await send(JSON.stringify(valid()), { Origin: 'https://outside.example' })).status, 403);
  assert.equal((await send(JSON.stringify(valid()), { Origin: '' })).status, 403);
  assert.equal((await send(JSON.stringify(valid()), { 'Content-Type': 'text/plain' })).status, 415);
  assert.equal((await send('{broken')).status, 400);
  assert.equal((await send('x'.repeat(9000))).status, 413);
  assert.equal((await send(null, {}, 'GET')).status, 405);
  assert.equal((await send(JSON.stringify({ ...valid(), role: 'manager' }))).status, 422);
  const response = await send(JSON.stringify(valid()));
  assert.equal(response.status, 201);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('set-cookie'), null);
  assert.equal((await response.json()).manager.role, 'manager');
  assert.equal((await send(JSON.stringify(valid()))).status, 409);
  for (const path of ['/data/covershift.json', '/src/auth/signup.js', '/covershift.json']) assert.equal((await fetch(origin + path)).status, 404);
  const page = await fetch(origin + '/signup');
  assert.equal(page.status, 200);
  const html = await page.text();
  assert.match(html, /Create your account/);
  // A script failure must never send the password in a GET query string.
  assert.match(html, /<form[^>]+method="post"[^>]+action="\/api\/signup"/);
  assert.match(page.headers.get('content-security-policy'), /frame-ancestors 'none'/);
  assert.equal((await store.read()).businesses.length, 1);
});
