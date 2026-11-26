import assert from 'node:assert/strict';
import test from 'node:test';
import { chmod, mkdtemp, readFile, readdir, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { clarificationSuggestions, routeChat } from '../public/ai-chat-routing.js';
import { AiAllowance } from '../src/ai/allowance.js';
import { RoutingLog, summarizeRoutingLog, validRoutingEntry } from '../src/ai/routing-log.js';
import { aiStartupWarnings } from '../src/ai/startup-check.js';
import { JsonStore } from '../src/storage/json-store.js';
import { seedDemo } from '../src/storage/seed.js';
import { SessionStore } from '../src/auth/sessions.js';
import { createAppServer } from '../src/app.js';

const now = Date.parse('2026-11-23T16:00:00Z');
const temp = async (t, name) => {
  const dir = await mkdtemp(join(tmpdir(), `covershift-${name}-`));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
};

test('clarification suggestions route locally to the intended task, without the classifier', () => {
  const expected = { false: ['questions', 'search', 'availability'], true: ['questions', 'draft', 'summary'] };
  for (const manager of [false, true]) {
    const suggestions = clarificationSuggestions(manager);
    assert.equal(suggestions.length, 3);
    assert.deepEqual(suggestions.map(([, text]) => routeChat(text, manager, null)), expected[manager]);
    for (const [label] of suggestions) assert.ok(label.length <= 18, `${label} fits a small button`);
  }
});

test('allowance status reports turns left today without reserving', async t => {
  const dir = join(await temp(t, 'usage'), 'ai-usage');
  const allowance = new AiAllowance(dir, { total: 5, daily: 3 });
  assert.deepEqual(await allowance.status('u', now, 'America/Toronto'), { daily: 3, remainingToday: 3 });
  assert.equal((await allowance.reserve('u', now, 'America/Toronto')).remainingToday, 2);
  assert.equal((await allowance.reserve('u', now, 'America/Toronto', { newTurn: false })).remainingToday, 2);
  assert.deepEqual(await allowance.status('u', now, 'America/Toronto'), { daily: 3, remainingToday: 2 });
  assert.deepEqual(await allowance.status('other', now, 'America/Toronto'), { daily: 3, remainingToday: 3 });
  await allowance.reserve('other', now, 'America/Toronto');
  await allowance.reserve('other', now, 'America/Toronto');
  // Only 5 calls in total: one left, so nobody can have more than one turn left.
  assert.deepEqual(await allowance.status('u', now, 'America/Toronto'), { daily: 3, remainingToday: 1 });
  assert.equal((await readdir(dir)).length, 4, 'status never writes');
  await writeFile(join(dir, 'oops.txt'), 'x');
  await assert.rejects(allowance.status('u', now, 'America/Toronto'), { status: 503 });
});

test('routing records accept only route metadata', () => {
  assert.deepEqual(validRoutingEntry({ route: 'search', decidedBy: 'classifier', clarification: false }),
    { route: 'search', decidedBy: 'classifier', clarification: false });
  for (const bad of [
    null, [], {}, { route: 'search', decidedBy: 'classifier' },
    { route: 'search', decidedBy: 'classifier', clarification: true },
    { route: 'deleteEverything', decidedBy: 'local', clarification: false },
    { route: 'search', decidedBy: 'guess', clarification: false },
    { route: 'search', decidedBy: 'local', clarification: false, text: 'my private message' },
  ]) assert.throws(() => validRoutingEntry(bad), { status: 422 }, JSON.stringify(bad));
});

test('the routing log stores no identities, uses the business-local month and is capped', async t => {
  const dir = join(await temp(t, 'routing'), 'ai-routing');
  const log = new RoutingLog(dir, { maxPerMonth: 2 });
  // 2026-12-01 02:00 UTC is still November 30 in Toronto.
  const lateNovember = Date.parse('2026-12-01T02:00:00Z');
  assert.equal(await log.append('worker', { route: 'questions', decidedBy: 'local', clarification: false }, lateNovember, 'America/Toronto'), true);
  assert.equal(await log.append('manager', { route: 'clarification', decidedBy: 'classifier', clarification: true }, lateNovember, 'America/Toronto'), true);
  assert.equal(await log.append('worker', { route: 'search', decidedBy: 'local', clarification: false }, lateNovember, 'America/Toronto'), false);
  assert.deepEqual(await readdir(dir), ['2026-11.jsonl']);
  const lines = (await readFile(join(dir, '2026-11.jsonl'), 'utf8')).trim().split('\n').map(line => JSON.parse(line));
  assert.deepEqual(lines, [
    { day: '2026-11-30', role: 'employee', route: 'questions', decidedBy: 'local', clarification: false },
    { day: '2026-11-30', role: 'manager', route: 'clarification', decidedBy: 'classifier', clarification: true },
  ]);
  const summary = await summarizeRoutingLog(dir);
  assert.deepEqual([summary.total, summary.clarifications, summary.byDecider], [2, 1, { local: 1, classifier: 1 }]);
  assert.equal((await summarizeRoutingLog(join(dir, 'missing'))).total, 0);
});

test('startup warnings explain half-configured AI and never include the key', async t => {
  const dir = await temp(t, 'startup');
  const key = 'sk-test-private-value';
  assert.deepEqual(await aiStartupWarnings({ apiKey: undefined, model: undefined, usageDirectory: join(dir, 'a') }), []);
  assert.deepEqual(await aiStartupWarnings({ apiKey: key, model: undefined, usageDirectory: join(dir, 'b') }), []);
  const noKey = await aiStartupWarnings({ apiKey: '', model: 'gpt-6-luna', usageDirectory: join(dir, 'c') });
  assert.match(noKey[0], /OPENAI_API_KEY is missing/);
  const blankModel = await aiStartupWarnings({ apiKey: key, model: '  ', usageDirectory: join(dir, 'd') });
  assert.match(blankModel[0], /OPENAI_MODEL is blank/);
  const locked = join(dir, 'locked');
  await mkdir(locked);
  await chmod(locked, 0o500);
  t.after(() => chmod(locked, 0o700).catch(() => {})); // the temp folder may already be removed
  const unwritable = await aiStartupWarnings({ apiKey: key, model: 'gpt-6-luna', usageDirectory: join(locked, 'ai-usage') });
  assert.match(unwritable.at(-1), /cannot be written/);
  for (const warning of [...noKey, ...blankModel, ...unwritable]) assert.doesNotMatch(warning, new RegExp(key));
});

test('usage and routing-log endpoints enforce sign-in, CSRF and scope', async t => {
  const dir = await temp(t, 'endpoints');
  const store = new JsonStore(join(dir, 'covershift.json'));
  await seedDemo(store);
  await store.transaction(db => { for (const user of db.users) user.passwordHash = 'fictional hash'; });
  const sessions = new SessionStore();
  const allowance = new AiAllowance(join(dir, 'ai-usage'));
  const routingLog = new RoutingLog(join(dir, 'ai-routing'));
  const server = createAppServer({ store, sessions, shiftClock: () => now, aiAllowance: allowance, routingLog });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const cookie = sessions.create('worker_jamie').cookie.split(';')[0];
  const { csrfToken } = await (await fetch(`${base}/api/session`, { headers: { Cookie: cookie } })).json();
  const headers = { Cookie: cookie, Origin: base, 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken };
  const record = JSON.stringify({ route: 'questions', decidedBy: 'local', clarification: false });

  assert.equal((await fetch(`${base}/api/ai-usage`)).status, 401);
  assert.equal((await fetch(`${base}/api/ai-usage?userId=worker_alex`, { headers: { Cookie: cookie } })).status, 400);
  const usage = await fetch(`${base}/api/ai-usage`, { headers: { Cookie: cookie } });
  assert.deepEqual([usage.status, await usage.json()], [200, { daily: 20, remainingToday: 20 }]);

  const post = (extra = {}, body = record) => fetch(`${base}/api/ai-routing-log`, { method: 'POST', headers: { ...headers, ...extra }, body });
  assert.equal((await fetch(`${base}/api/ai-routing-log`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base }, body: record })).status, 401);
  assert.equal((await post({ 'X-CSRF-Token': 'wrong' })).status, 403);
  assert.equal((await post({ Origin: 'https://evil.test' })).status, 403);
  assert.equal((await post({}, JSON.stringify({ route: 'questions', decidedBy: 'local', clarification: false, text: 'secret' }))).status, 422);
  assert.equal((await post()).status, 204);
  const saved = await readFile(join(dir, 'ai-routing', '2026-11.jsonl'), 'utf8');
  assert.doesNotMatch(saved, /worker_jamie|Jamie|secret/);
  assert.match(saved, /"role":"employee","route":"questions"/);

  const unconfigured = createAppServer({ store, sessions, shiftClock: () => now });
  await new Promise(resolve => unconfigured.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => unconfigured.close(resolve)));
  assert.equal((await fetch(`http://127.0.0.1:${unconfigured.address().port}/api/ai-usage`, { headers: { Cookie: cookie } })).status, 503);
});
