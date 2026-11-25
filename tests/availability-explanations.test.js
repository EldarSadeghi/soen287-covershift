import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { JsonStore } from '../src/storage/json-store.js';
import { buildDemoFixtures } from '../src/demo/fixtures.js';
import { explainAvailability } from '../src/availability/explanations.js';
import { changeAvailability, listAvailability } from '../src/availability/rules.js';
import { reconcileAvailability } from '../src/availability/matching.js';
import { createShift } from '../src/shifts/create.js';
import { routeChat } from '../public/ai-chat-routing.js';

const clock = () => Date.parse('2026-11-24T20:00:00Z');
const employee = 'worker_jamie';

async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), 'covershift-explanation-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const store = new JsonStore(join(directory, 'test.json'));
  const { dates, scenarios } = await buildDemoFixtures(store, { now: clock(), hash: async () => 'fictional test hash' });
  return { store, dates, scenarios, explain: input => explainAvailability(store, employee, input, clock) };
}

test('explanations distinguish recorded automatic and manual claims, expiry, and current checks', async t => {
  const { store, scenarios, explain } = await fixture(t);
  const generic = await explain({ description: 'Why was my request pending?' });
  assert.equal(generic.kind, 'explanation_choices');
  assert.ok(generic.choices.some(choice => choice.id === scenarios.pendingRequest));
  const manual = await explain({ requestId: scenarios.pendingRequest });
  assert.equal(manual.status, 'pending');
  assert.deepEqual(manual.recorded, ['Your request is awaiting manager approval. The original worker remains assigned until approval.']);
  const before = await explain({ requestId: scenarios.automaticRequest });
  assert.equal(before.status, 'open');
  assert.deepEqual(before.recorded, []);
  assert.match(before.rules[0].reasons.join(' '), /paused/);

  const rule = (await listAvailability(store, employee, clock)).rules[0];
  // Operation timestamps follow the fixture's approval and setup events.
  const later = () => clock() + 60_000;
  await changeAvailability(store, employee, rule.id, 'resume', { revision: rule.revision }, later);
  await reconcileAvailability(store, later);
  const auto = await explainAvailability(store, employee, { requestId: scenarios.automaticRequest }, later);
  assert.equal(auto.status, 'pending');
  assert.match(auto.recorded[0], /saved availability rule.*automatically/);
  assert.deepEqual(auto.current, []);
  const expired = await explainAvailability(store, employee, { requestId: scenarios.automaticRequest }, () => Date.parse(auto.shift.startsAt));
  assert.equal(expired.status, 'expired');
  assert.match(expired.recorded[1], /started before the request/);
  await assert.rejects(explainAvailability(store, 'worker_taylor', { requestId: scenarios.automaticRequest }, later), { status: 404 });
  await assert.rejects(explainAvailability(store, 'manager_morgan', { requestId: scenarios.automaticRequest }, later), { status: 403 });
});

test('open shift explanations reuse current overlap, capacity, title and window checks without mutating data', async t => {
  const { store, dates, scenarios } = await fixture(t);
  const later = () => clock() + 60_000;
  const rule = (await listAvailability(store, employee, clock)).rules[0];
  await changeAvailability(store, employee, rule.id, 'resume', { revision: rule.revision }, later);
  await reconcileAvailability(store, later);
  await createShift(store, 'manager_morgan', {
    assignedWorkerId: employee, title: 'Private assignment', startLocal: dates.thursday + 'T15:00', endLocal: dates.thursday + 'T16:00',
  }, later);
  const before = await readFile(store.filename, 'utf8');
  const answer = await explainAvailability(store, employee, { description: 'Why did “Afternoon coverage” not match?' }, later);
  assert.equal(answer.requestId, scenarios.manualRequest);
  assert.deepEqual(answer.recorded, []);
  assert.match(answer.current.join(' '), /overlaps one of your assigned shifts/);
  assert.match(answer.rules[0].reasons.join(' '), /outside.*title.*used all/);
  assert.match(answer.priority, /confirmation order/);
  assert.doesNotMatch(JSON.stringify(answer), /Private assignment|worker_alex|manager_morgan/);
  assert.equal(await readFile(store.filename, 'utf8'), before);
  const unknown = await explainAvailability(store, employee, { description: 'Why did "Private assignment" not match?' }, later);
  assert.equal(unknown.total, 0);
  assert.equal(routeChat('Why did “Afternoon coverage” not match?', false, 'search'), 'explanation');
});

test('the chat explanation endpoint requires an authenticated employee and CSRF', async t => {
  const { store, scenarios } = await fixture(t);
  const [{ createAppServer }, { SessionStore }] = await Promise.all([import('../src/app.js'), import('../src/auth/sessions.js')]);
  const sessions = new SessionStore();
  const server = createAppServer({ store, sessions, shiftClock: clock });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  t.after(() => new Promise(resolve => server.close(resolve)));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const send = (credentials = {}, requestId = scenarios.pendingRequest) => fetch(origin + '/api/worker/availability-explanation', {
    method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', ...credentials },
    body: JSON.stringify({ requestId }),
  });
  const headersFor = async user => {
    const cookie = sessions.create(user).cookie.split(';')[0];
    const response = await fetch(origin + '/api/session', { headers: { Cookie: cookie } });
    return { Cookie: cookie, 'X-CSRF-Token': (await response.json()).csrfToken };
  };
  assert.equal((await send()).status, 401);
  const own = await headersFor(employee);
  assert.equal((await send({ Cookie: own.Cookie })).status, 403);
  assert.equal((await send(await headersFor('manager_morgan'))).status, 403);
  const other = await send(await headersFor('worker_taylor'));
  assert.equal(other.status, 404);
  assert.doesNotMatch(await other.text(), /Morning coverage|Jamie/);
  const allowed = await send(own);
  assert.equal(allowed.status, 200);
  assert.equal((await allowed.json()).status, 'pending');
});
