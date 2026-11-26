import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createAiShiftDrafter } from '../src/ai/shift-draft.js';
import { AiAllowance } from '../src/ai/allowance.js';
import { JsonStore } from '../src/storage/json-store.js';
import { seedDemo } from '../src/storage/seed.js';
import { createShift } from '../src/shifts/create.js';
import { createAppServer } from '../src/app.js';
import { SessionStore } from '../src/auth/sessions.js';

const now = Date.parse('2026-11-20T22:00:00Z');
const complete = { kind: 'draft', question: '', title: 'Opening service', worker: 'w1', startLocal: '2026-12-03T09:00', endLocal: '2026-12-03T15:00' };
const input = { description: 'Opening service for Jamie Lee on December 3, 2026 from 9 AM to 3 PM.' };
const envelope = result => ({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(result) }] }] });
const reply = result => new Response(JSON.stringify(envelope(result)), { headers: { 'Content-Type': 'application/json' } });
const status = code => error => error.status === code;
async function fixture(t) {
 const dir = await mkdtemp(join(tmpdir(), 'covershift-ai-')); t.after(() => rm(dir, { recursive: true, force: true }));
 const store = new JsonStore(join(dir, 'covershift.json')); await seedDemo(store);
 await store.transaction(db => {
  db.users[0].passwordHash = 'fictional hash'; db.users[1].passwordHash = 'fictional hash';
  db.businesses.push({ ...db.businesses[0], id: 'other', name: 'Other business secret' });
  db.users.push({ ...db.users[0], id: 'other_manager', businessId: 'other', email: 'other@example.test' }, { ...db.users[1], id: 'other_worker', name: 'Foreign secret', businessId: 'other', email: 'foreign@example.test' });
 });
 const allowance = new AiAllowance(join(dir, 'ai-usage'));
 const make = (fetchImpl = async () => reply(complete), extra = {}) => createAiShiftDrafter({ apiKey: 'test-private-key', allowance, fetchImpl, ...extra });
 return { dir, store, allowance, make };
}

test('AI receives minimized current context and strict schema; drafts never mutate schedule or expose secrets', async t => {
 const { store, make, allowance } = await fixture(t); const before = await readFile(store.filename, 'utf8'); let payload;
 const ai = make(async (url, init) => {
  assert.equal(url, 'https://api.openai.com/v1/responses'); assert.equal(init.headers.Authorization, 'Bearer test-private-key');
  payload = JSON.parse(init.body); return reply(complete);
 });
 const result = await ai(store, 'manager_morgan', input, () => now);
 assert.equal(result.kind, 'draft'); assert.equal(result.draft.assignedWorkerId, 'worker_jamie');
 assert.equal(result.draft.startLocal, complete.startLocal); assert.equal(result.workerName, 'Jamie Lee');
 assert.equal(await readFile(store.filename, 'utf8'), before);
 assert.equal(payload.store, false); assert.equal(payload.max_output_tokens, 1200); assert.equal(payload.reasoning.effort, 'none');
 assert.equal(payload.text.format.strict, true); assert.equal(payload.model, 'gpt-6-luna'); assert.equal(payload.tools, undefined);
 assert.doesNotMatch(JSON.stringify(payload), /passwordHash|fictional hash|@example|Foreign secret|Other business secret|worker_jamie|business_demo/);
 const context = JSON.parse(payload.input); assert.equal(context.timezone, 'America/Toronto'); assert.equal(context.currentInstant, new Date(now).toISOString()); assert.equal(context.workers[0].ref, 'w1');
 const reservations = await readdir(allowance.directory); assert.equal(reservations.length, 1);
 assert.doesNotMatch(await readFile(join(allowance.directory, reservations[0]), 'utf8'), /Jamie|description|Opening|private-key|manager_morgan/);
 // An ordinary explicit save still enforces the same rules, including overlap.
 await createShift(store, 'manager_morgan', result.draft, () => now);
 await assert.rejects(createShift(store, 'manager_morgan', result.draft, () => now), status(409));
});

test('clarification returns only question, and rejects malformed or mixed draft/clarification output', async t => {
 const { store, make } = await fixture(t);
 const question = { kind: 'clarification', question: 'Which date, title and AM/PM hours should I use?', title: '', worker: '', startLocal: '', endLocal: '' };
 const result = await make(async () => reply(question))(store, 'manager_morgan', { description: 'Jamie 9 to 3' }, () => now);
 assert.deepEqual(result, { kind: 'clarification', question: question.question, timezone: 'America/Toronto' });
 for (const value of [{ ...question, title: 'Invented' }, { ...question, question: '' }, { ...complete, question: 'also ask' }, { ...complete, extra: 'untrusted' }, { ...complete, kind: 'execute' }, { ...complete, worker: 'other_worker' }, { ...complete, title: 8 }]) {
  await assert.rejects(make(async () => reply(value))(store, 'manager_morgan', input, () => now), status(503));
 }
});

test('strict input, roles, missing configuration and oversized context reject before paid inference', async t => {
 const { store, make, dir } = await fixture(t); let calls = 0;
 const ai = make(async () => { calls++; return reply(complete); });
 for (const value of [null, [], {}, { description: '' }, { description: 'x'.repeat(1501) }, { ...input, businessId: 'other' }]) await assert.rejects(ai(store, 'manager_morgan', value, () => now), status(422));
 await assert.rejects(ai(store, 'worker_jamie', input, () => now), status(403));
 await assert.rejects(ai(store, 'missing', input, () => now), status(401));
 for (const config of [{ apiKey: '' }, { model: ' ' }]) await assert.rejects(make(undefined, config)(store, 'manager_morgan', input, () => now), status(503));
 assert.equal(calls, 0); assert.ok(!(await readdir(dir)).includes('ai-usage'));
 await store.transaction(db => { const example = db.users[1]; for (let i = 0; i < 50; i++) db.users.push({ ...example, id: `more_${i}`, email: `more_${i}@example.test` }); });
 await assert.rejects(ai(store, 'manager_morgan', input, () => now), status(422)); assert.equal(calls, 0);
});

test('model proposals must pass current membership, calendar/DST, future, order and overlap validation', async t => {
 const { store, make } = await fixture(t); const before = await readFile(store.filename, 'utf8');
 for (const changes of [{ title: '' }, { startLocal: '2027-02-29T09:00' }, { startLocal: '2026-11-19T09:00' }, { endLocal: complete.startLocal }, { startLocal: '2027-03-14T02:30' }, { startLocal: '2027-11-07T01:30' }]) {
  await assert.rejects(make(async () => reply({ ...complete, ...changes }))(store, 'manager_morgan', input, () => now), status(422));
 }
 assert.equal(await readFile(store.filename, 'utf8'), before);
 await createShift(store, 'manager_morgan', { title: complete.title, assignedWorkerId: 'worker_jamie', startLocal: complete.startLocal, endLocal: complete.endLocal }, () => now);
 await assert.rejects(make()(store, 'manager_morgan', input, () => now), status(409));
});

test('authorization and membership are checked again after inference; stale roster cannot produce a draft', async t => {
 const { store, make } = await fixture(t);
 const ai = make(async () => {
  await store.transaction(db => { db.users = db.users.filter(user => user.id !== 'worker_jamie'); db.shifts = db.shifts.filter(shift => shift.assignedWorkerId !== 'worker_jamie'); });
  return reply(complete);
 });
 await assert.rejects(ai(store, 'manager_morgan', input, () => now), status(422));
 const aiRevoked = make(async () => { await store.transaction(db => { db.users[0].passwordHash = null; }); return reply(complete); });
 await assert.rejects(aiRevoked(store, 'manager_morgan', input, () => now), status(401));
});

test('refusal, incomplete/invalid/oversized provider responses and billing failures are safe and never retried', async t => {
 const { store, make } = await fixture(t); let calls = 0;
 const responses = [new Response('secret error with test-private-key', { status: 401 }), new Response('quota secret', { status: 429 }), new Response('bad json'), new Response(JSON.stringify({ status: 'incomplete', output: [] })), new Response(JSON.stringify({ status: 'completed', output: [{ type: 'message', content: [{ type: 'refusal', refusal: 'no' }] }] })), new Response('x'.repeat(65537))];
 for (const response of responses) {
  await assert.rejects(make(async () => { calls++; return response; })(store, 'manager_morgan', input, () => now), error => [422, 503].includes(error.status) && !/secret|private-key|quota/.test(error.message));
 }
 assert.equal(calls, responses.length);
});

test('deadlines cover fetch and response body even if abort ignored; late completion never yields a draft', async t => {
 const { store, make } = await fixture(t); let finish;
 const delayed = make(() => new Promise(resolve => { finish = resolve; }), { timeoutMs: 15 });
 await assert.rejects(delayed(store, 'manager_morgan', input, () => now), status(503)); finish(reply(complete));
 let controller;
 const body = new ReadableStream({ start(value) { controller = value; } });
 await assert.rejects(make(async () => new Response(body), { timeoutMs: 15 })(store, 'manager_morgan', input, () => now), status(503));
 controller.enqueue(new TextEncoder().encode(JSON.stringify(envelope(complete)))); controller.close();
 assert.equal((await store.read()).shifts.length, 5);
});

test('concurrency excludes repeated manager requests without consuming extra allowance', async t => {
 const { store, make, allowance } = await fixture(t); let release;
 const ai = make(() => new Promise(resolve => { release = resolve; }));
 const first = ai(store, 'manager_morgan', input, () => now);
 // Wait on explicit provider entry, not a timing assumption.
 while (!release) await new Promise(resolve => setImmediate(resolve));
 await assert.rejects(ai(store, 'manager_morgan', input, () => now), status(429));
 release(reply(complete)); await first;
 assert.equal((await readdir(allowance.directory)).length, 1);
});

test('persistent allowance serializes concurrent reservations and survives restarts/day boundaries; corrupt state fails closed', async t => {
 const { dir } = await fixture(t); const folder = join(dir, 'limits');
 const limits = new AiAllowance(folder, { total: 3, daily: 1 });
 const outcomes = await Promise.allSettled([limits.reserve('m', now), new AiAllowance(folder, { total: 3, daily: 1 }).reserve('m', now)]);
 assert.equal(outcomes.filter(item => item.status === 'fulfilled').length, 1);
 assert.equal(outcomes.find(item => item.status === 'rejected').reason.status, 429);
 await limits.reserve('m', now + 86400000); await limits.reserve('other', now);
 await assert.rejects(new AiAllowance(folder, { total: 3 }).reserve('third', now), status(429));
 const corrupt = join(dir, 'corrupt'); await mkdir(corrupt); await writeFile(join(corrupt, '0001.json'), '{');
 await assert.rejects(new AiAllowance(corrupt).reserve('m', now), status(503));
 const locked = join(dir, 'locked'); await mkdir(locked); await mkdir(join(locked, '.lock'));
 await assert.rejects(new AiAllowance(locked).reserve('m', now), status(503));
});

test('HTTP AI endpoint enforces authentication, role, origin, CSRF, exact scope and rate limits before inference', async t => {
 const { store, make } = await fixture(t); let calls = 0;
 const sessions = new SessionStore(); const aiDraft = make(async () => { calls++; return reply(complete); });
 const server = createAppServer({ store, sessions, aiDraft, shiftClock: () => now });
 await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
 const origin = `http://127.0.0.1:${server.address().port}`; const cookie = sessions.create('manager_morgan').cookie.split(';')[0];
 const account = await (await fetch(origin + '/api/session', { headers: { Cookie: cookie } })).json();
 const workerCookie = sessions.create('worker_jamie').cookie.split(';')[0];
 const post = (body = input, headers = {}, path = '/api/manager/ai-shift-draft') => fetch(origin + path, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', Cookie: cookie, 'X-CSRF-Token': account.csrfToken, ...headers }, body: JSON.stringify(body) });
 assert.equal((await fetch(origin + '/api/manager/ai-shift-draft')).status, 405);
 for (const [headers, code] of [[{ Cookie: '' }, 401], [{ Cookie: workerCookie }, 403], [{ Origin: 'https://foreign.test' }, 403], [{ 'X-CSRF-Token': '' }, 403], [{ 'Content-Type': 'text/plain' }, 415], [{ 'Sec-Fetch-Site': 'cross-site' }, 403]]) assert.equal((await post(input, headers)).status, code);
 assert.equal((await post(input, {}, '/api/manager/ai-shift-draft?businessId=other')).status, 400);
 assert.equal(calls, 0);
 assert.equal((await post({ ...input, businessId: 'other' })).status, 422);
 for (let i = 0; i < 19; i++) { const response = await post(); assert.equal(response.status, 200); assert.doesNotMatch(await response.text(), /private-key|@example|passwordHash/); }
 assert.equal((await post()).status, 429); assert.equal(calls, 19);
 assert.equal((await store.read()).shifts.length, 5);
 for (const path of ['/.env', '/src/ai/shift-draft.js', '/data/ai-usage/0001.json']) assert.equal((await fetch(origin + path)).status, 404);
 assert.equal((await fetch(origin + '/ai-shift-draft.js')).status, 200);
});

test('overnight drafts work, inactive workers are excluded, and failed provider calls consume reserved allowance', async t => {
 const { store, make, dir } = await fixture(t);
 const overnight = await make(async () => reply({ ...complete, startLocal: '2026-12-04T22:00', endLocal: '2026-12-05T06:00' }))(store, 'manager_morgan', input, () => now);
 assert.equal(overnight.draft.endLocal, '2026-12-05T06:00');
 // A removed worker and an inactive worker must both be absent from AI context.
 await store.transaction(db => { db.users = db.users.filter(user => user.id !== 'worker_jamie'); db.shifts = db.shifts.filter(shift => shift.assignedWorkerId !== 'worker_jamie'); db.schemaVersion = 5; const sam = db.users.find(user => user.id === 'worker_sam'); sam.deactivation = { at: sam.updatedAt, managerId: 'manager_morgan' }; });
 let context;
 const question = { kind: 'clarification', question: 'Which worker?', title: '', worker: '', startLocal: '', endLocal: '' };
 await make(async (_, init) => { context = JSON.parse(JSON.parse(init.body).input); return reply(question); })(store, 'manager_morgan', input, () => now);
 assert.ok(!context.workers.some(worker => ['Jamie Lee', 'Sam Rivera'].includes(worker.name)));
 const allowance = new AiAllowance(join(dir, 'one-call'), { total: 1 });
 let calls = 0;
 const failing = make(async () => { calls++; throw new Error('private-key'); }, { allowance });
 await assert.rejects(failing(store, 'manager_morgan', input, () => now), status(503));
 await assert.rejects(failing(store, 'manager_morgan', input, () => now), status(429)); assert.equal(calls, 1);
});

test('manager revisions preserve untouched fields and clarify before applying an ambiguous change', async t => {
 const { store, make } = await fixture(t);
 const base = { title: complete.title, assignedWorkerId: 'worker_jamie', startLocal: complete.startLocal, endLocal: complete.endLocal };
 const emptyPatch = { title: null, worker: null, startLocal: null, endLocal: null };
 const before = await readFile(store.filename, 'utf8');
 const ai = make(async (_, init) => {
  const body = JSON.parse(init.body);
  const context = JSON.parse(body.input);
  assert.deepEqual(context.pendingDraft, { title: base.title, worker: 'w1', startLocal: base.startLocal, endLocal: base.endLocal });
  assert.equal(body.text.format.schema.properties.worker.anyOf[1].type, 'null');
  return reply(context.request === 'Move it to 2'
   ? { kind: 'clarification', question: '2 AM or 2 PM?', ...emptyPatch }
   : { kind: 'draft', question: '', ...emptyPatch, startLocal: '2026-12-03T14:00' });
 });
 assert.equal((await ai(store, 'manager_morgan', { description: 'Move it to 2', base }, () => now)).kind, 'clarification');
 assert.deepEqual((await ai(store, 'manager_morgan', { description: '2 PM', base }, () => now)).draft, { ...base, startLocal: '2026-12-03T14:00' });
 await assert.rejects(ai(store, 'manager_morgan', { description: '2 PM', base: { ...base, assignedWorkerId: 'other_worker' } }, () => now), status(422));
 assert.equal(await readFile(store.filename, 'utf8'), before);
});
