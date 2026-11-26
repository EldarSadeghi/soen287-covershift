import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { JsonStore } from '../src/storage/json-store.js';
import { seedDemo } from '../src/storage/seed.js';
import { SessionStore } from '../src/auth/sessions.js';
import { createAppServer } from '../src/app.js';
import { AiAllowance } from '../src/ai/allowance.js';
import { createAiIntentClassifier } from '../src/ai/intent.js';
import { createAiShiftSearcher } from '../src/ai/shift-search.js';
import { createAiScheduleAnswerer } from '../src/ai/schedule-questions.js';
import { createIntentPasses, takeIntentPass } from '../src/ai/intent-pass.js';

const now = Date.parse('2026-11-23T16:00:00Z');
const clock = () => now;
const reply = value => Response.json({
  status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(value) }] }],
});
const searchClarification = { kind: 'clarification', question: 'Which date should I search?', date: '', startLocal: '', endLocal: '', title: '' };
const scheduleClarification = { kind: 'clarification', question: 'Which week?', startDate: '', endDate: '', workerName: '' };

// One fake provider for every feature: it answers by the request's schema name.
function provider(intent = 'search') {
  const calls = [];
  const fetchImpl = async (_, { body }) => {
    const name = JSON.parse(body).text.format.name;
    calls.push(name);
    if (name === 'covershift_intent') return reply({ intent: typeof intent === 'function' ? intent() : intent });
    if (name === 'existing_shift_search') return reply(searchClarification);
    if (name === 'schedule_question') return reply(scheduleClarification);
    throw new Error(`Unexpected schema ${name}`);
  };
  return { fetchImpl, calls };
}

async function startServer(t, { intent, aiOptions = {}, withIntent = true } = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'covershift-intent-route-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const store = new JsonStore(join(dir, 'covershift.json'));
  await seedDemo(store);
  // Seeded accounts have no password until setup; sessions require a completed account.
  await store.transaction(db => { for (const user of db.users) user.passwordHash = 'fictional hash'; });
  const usageDir = join(dir, 'ai-usage');
  const fake = provider(intent);
  const options = { apiKey: 'test-secret', allowance: new AiAllowance(usageDir), fetchImpl: fake.fetchImpl, ...aiOptions };
  const sessions = new SessionStore();
  const server = createAppServer({
    store, sessions, shiftClock: clock,
    aiIntent: withIntent ? createAiIntentClassifier(options) : null,
    aiSearch: createAiShiftSearcher(options),
    aiSchedule: createAiScheduleAnswerer(options),
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  async function signIn(userId) {
    const cookie = sessions.create(userId).cookie.split(';')[0];
    const { csrfToken } = await (await fetch(`${base}/api/session`, { headers: { Cookie: cookie } })).json();
    return { Cookie: cookie, Origin: base, 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken };
  }
  const post = (path, headers, body) => fetch(base + path, { method: 'POST', headers, body: JSON.stringify(body) });
  const usage = async () => (await readdir(usageDir).catch(() => [])).filter(name => name.endsWith('.json')).length;
  return { base, signIn, post, usage, calls: fake.calls };
}

test('/api/ai-intent enforces session, CSRF, origin, JSON and signed-in scope', async t => {
  const app = await startServer(t);
  const headers = await app.signIn('worker_jamie');
  const body = { description: 'Could you pull up when I punch in?' };

  assert.equal((await app.post('/api/ai-intent', { 'Content-Type': 'application/json', Origin: app.base }, body)).status, 401);
  assert.equal((await app.post('/api/ai-intent', { ...headers, 'X-CSRF-Token': 'wrong' }, body)).status, 403);
  assert.equal((await app.post('/api/ai-intent', { ...headers, Origin: 'https://evil.test' }, body)).status, 403);
  assert.equal((await app.post('/api/ai-intent', { ...headers, 'Content-Type': 'text/plain' }, body)).status, 415);
  assert.equal((await app.post('/api/ai-intent?userId=worker_alex', headers, body)).status, 400);
  assert.equal((await fetch(`${app.base}/api/ai-intent`, { headers })).status, 405);

  const ok = await app.post('/api/ai-intent', headers, body);
  assert.equal(ok.status, 200);
  const data = await ok.json();
  assert.equal(data.intent, 'search');
  assert.match(data.pass, /^[A-Za-z0-9_-]{32}$/);
  assert.deepEqual(Object.keys(data).sort(), ['intent', 'pass']);
});

test('/api/ai-intent is unavailable without configuration and hides provider failures', async t => {
  const unconfigured = await startServer(t, { withIntent: false });
  const response = await unconfigured.post('/api/ai-intent', await unconfigured.signIn('worker_jamie'), { description: 'hello there' });
  assert.equal(response.status, 503);
  assert.match((await response.json()).message, /not configured/);

  const failing = await startServer(t, {
    aiOptions: { fetchImpl: async () => Response.json({ error: { message: 'provider-private detail' } }, { status: 500 }) },
  });
  const failed = await failing.post('/api/ai-intent', await failing.signIn('worker_jamie'), { description: 'hello there' });
  assert.equal(failed.status, 503);
  const text = await failed.text();
  assert.doesNotMatch(text, /provider-private|test-secret/);
});

test('a manager never receives an employee-only intent or a pass for it', async t => {
  const app = await startServer(t, { intent: 'search' });
  const response = await app.post('/api/ai-intent', await app.signIn('manager_morgan'), { description: 'what is going on' });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { intent: 'clarification' });
});

test('/api/ai-intent is rate limited per user', async t => {
  const app = await startServer(t, { intent: 'clarification', aiOptions: { allowance: { reserve: async () => ({}) } } });
  const headers = await app.signIn('worker_jamie');
  for (let attempt = 0; attempt < 20; attempt++) {
    assert.equal((await app.post('/api/ai-intent', headers, { description: `message ${attempt}` })).status, 200);
  }
  const limited = await app.post('/api/ai-intent', headers, { description: 'one more' });
  assert.equal(limited.status, 429);
  assert.match((await limited.json()).message, /Too many AI requests/);
  // Another user keeps their own budget.
  assert.equal((await app.post('/api/ai-intent', await app.signIn('worker_alex'), { description: 'hi' })).status, 200);
});

test('a classified message uses the daily allowance once, and a pass cannot be reused', async t => {
  const app = await startServer(t, { intent: 'search' });
  const jamie = await app.signIn('worker_jamie');
  const description = 'anything going for me on the weekend';

  const { pass } = await (await app.post('/api/ai-intent', jamie, { description })).json();
  assert.equal(await app.usage(), 1);
  const answered = await app.post('/api/worker/ai-shift-search', jamie, { description, intentPass: pass });
  assert.equal(answered.status, 200);
  assert.equal((await answered.json()).kind, 'clarification');
  assert.equal(await app.usage(), 1, 'the follow-up request must not reserve allowance again');

  // Replaying the same pass is charged normally.
  assert.equal((await app.post('/api/worker/ai-shift-search', jamie, { description, intentPass: pass })).status, 200);
  assert.equal(await app.usage(), 2);

  // A pass is bound to the exact message text.
  const second = (await (await app.post('/api/ai-intent', jamie, { description })).json()).pass;
  assert.equal(await app.usage(), 3);
  await app.post('/api/worker/ai-shift-search', jamie, { description: 'a different message', intentPass: second });
  assert.equal(await app.usage(), 4);

  // A pass is bound to the user who classified the message.
  const third = (await (await app.post('/api/ai-intent', jamie, { description })).json()).pass;
  await app.post('/api/worker/ai-shift-search', await app.signIn('worker_alex'), { description, intentPass: third });
  assert.equal(await app.usage(), 6);

  // A pass is bound to the classified feature.
  const fourth = (await (await app.post('/api/ai-intent', jamie, { description })).json()).pass;
  assert.equal((await app.post('/api/ai-schedule-question', jamie, { description, intentPass: fourth })).status, 200);
  assert.equal(await app.usage(), 8);

  // Garbage passes are ignored rather than rejected.
  assert.equal((await app.post('/api/worker/ai-shift-search', jamie, { description, intentPass: 42 })).status, 200);
  assert.equal(await app.usage(), 9);
});

test('intent passes are single-use, expire and only cover paid intents', () => {
  const passes = createIntentPasses({ lifetimeMs: 1000, maxPasses: 2 });
  assert.equal(passes.issue('u1', 'summary', 'show my week', 0), null);
  assert.equal(passes.issue('u1', 'clarification', 'hmm', 0), null);

  const token = passes.issue('u1', 'search', '  open shifts?  '.trim(), 0);
  assert.equal(passes.redeem(token, 'u1', 'search', 'open shifts?', 999), true);
  assert.equal(passes.redeem(token, 'u1', 'search', 'open shifts?', 999), false);

  const expired = passes.issue('u1', 'search', 'open shifts?', 0);
  assert.equal(passes.redeem(expired, 'u1', 'search', 'open shifts?', 1000), false);

  const replaced = passes.issue('u1', 'draft', 'a', 0);
  const latest = passes.issue('u1', 'draft', 'b', 0);
  assert.equal(passes.redeem(replaced, 'u1', 'draft', 'a', 1), false, 'a newer pass replaces the older one');
  assert.equal(passes.redeem(latest, 'u1', 'draft', 'b', 1), true);

  passes.issue('u2', 'search', 'x', 0);
  passes.issue('u3', 'search', 'x', 0);
  assert.equal(passes.issue('u4', 'search', 'x', 0), null, 'the store is bounded');

  assert.deepEqual(takeIntentPass({ description: 'x', intentPass: 't' }), { input: { description: 'x' }, token: 't' });
  assert.deepEqual(takeIntentPass({ description: 'x' }), { input: { description: 'x' }, token: null });
  assert.deepEqual(takeIntentPass(null), { input: null, token: null });
});
