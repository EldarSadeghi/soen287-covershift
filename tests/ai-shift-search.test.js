import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { JsonStore } from '../src/storage/json-store.js';
import { seedDemo, demoDatabase } from '../src/storage/seed.js';
import { createShift } from '../src/shifts/create.js';
import { requestCoverage, coverageShiftRevision } from '../src/requests/coverage.js';
import { checkClaim, claimCoverage } from '../src/requests/claim.js';
import { createAiShiftSearcher, searchExistingShifts, validateSearchCriteria } from '../src/ai/shift-search.js';
import { createAiShiftDrafter } from '../src/ai/shift-draft.js';
import { AiAllowance } from '../src/ai/allowance.js';
import { createAppServer } from '../src/app.js';
import { SessionStore } from '../src/auth/sessions.js';
import { createEmployeeChatState, EMPLOYEE_CHAT_KEY } from '../public/ai-employee-state.js';
const now = Date.parse('2026-11-21T16:00:00Z'); const clock = () => now;
const criteria = { date: '2026-11-26', startLocal: '', endLocal: '', title: '' };
const parsed = { kind: 'search', question: '', ...criteria };
const reply = value => new Response(JSON.stringify({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(value) }] }] }));
const status = n => e => e.status === n;
async function fixture(t) {
 const dir = await mkdtemp(join(tmpdir(), 'covershift-ai-search-')); t.after(() => rm(dir, { recursive: true, force: true }));
 const store = new JsonStore(join(dir, 'covershift.json')); await seedDemo(store);
 await store.transaction(db => { for (const user of db.users) user.passwordHash = 'fictional test hash'; });
 async function opening(worker = 'worker_alex', start = '2026-11-26T09:00', end = '2026-11-26T15:00', title = 'Opening service') {
  const { shift } = await createShift(store, 'manager_morgan', { title, assignedWorkerId: worker, startLocal: start, endLocal: end }, clock);
  const db = await store.read(); const original = db.shifts.find(s => s.id === shift.id);
  const { request } = await requestCoverage(store, worker, shift.id, { revision: coverageShiftRevision(db, original) }, clock);
  return request.id;
 }
 const allowance = new AiAllowance(join(dir, 'ai-usage'));
 const make = (fetchImpl = async () => reply(parsed), extra = {}) => createAiShiftSearcher({ apiKey: 'test-secret', allowance, fetchImpl, ...extra });
 return { store, dir, allowance, opening, make };
}

test('AI search minimizes provider context, returns real scoped candidates and never writes or reserves', async t => {
 const f = await fixture(t); const id = await f.opening(); const before = await readFile(f.store.filename, 'utf8'); let payload;
 const ai = f.make(async (url, init) => { assert.equal(url, 'https://api.openai.com/v1/responses'); payload = JSON.parse(init.body); return reply(parsed); });
 const result = await ai(f.store, 'worker_jamie', { description: 'Find an open shift Thursday' }, clock);
 assert.equal(result.requests[0].id, id); assert.equal(result.total, 1); assert.match(result.requests[0].revision, /^[a-f0-9]{64}$/);
 assert.equal(await readFile(f.store.filename, 'utf8'), before);
 assert.equal(payload.store, false); assert.equal(payload.text.format.strict, true); assert.equal(payload.tools, undefined); assert.equal(payload.model, 'gpt-6-luna');
 assert.doesNotMatch(JSON.stringify(payload), /test-secret|Jamie Lee|Alex Morgan|worker_jamie|business_demo|passwordHash|@example|Opening service/);
 assert.equal(JSON.parse(payload.input).currentInstant, new Date(now).toISOString());
});

test('search excludes own, past, foreign, claimed and assigned/pending-conflicting shifts', async t => {
 const f = await fixture(t); await f.opening('worker_jamie');
 await f.opening('worker_alex'); await f.opening('worker_sam', '2026-11-26T14:00', '2026-11-26T18:00', 'Overlapping');
 const adjacent = await f.opening('worker_alex', '2026-11-26T15:00', '2026-11-26T17:00', 'Adjacent');
 let results = await searchExistingShifts(f.store, 'worker_jamie', criteria, clock);
 assert.deepEqual(results.requests.map(r => r.id), [adjacent]);
 await f.store.transaction(db => { db.businesses.push({ ...db.businesses[0], id: 'other' }); db.users.push({ ...db.users[1], id: 'foreign', businessId: 'other', email: 'foreign@example.test' }); });
 assert.equal((await searchExistingShifts(f.store, 'foreign', criteria, clock)).total, 0);
 assert.equal((await searchExistingShifts(f.store, 'worker_taylor', { ...criteria, date: '2026-11-15' }, clock)).total, 0);
 const selected = results.requests[0]; await claimCoverage(f.store, 'worker_jamie', selected.id, { revision: selected.revision }, clock);
 assert.equal((await searchExistingShifts(f.store, 'worker_jamie', criteria, clock)).total, 0);
 assert.ok(!(await searchExistingShifts(f.store, 'worker_taylor', criteria, clock)).requests.some(r => r.id === adjacent));
 // Jamie's pending reservation excludes a newly opened overlapping shift too.
 await f.opening('worker_sam', '2026-11-26T18:00', '2026-11-26T20:00', 'Later');
 await f.opening('worker_taylor', '2026-11-26T16:00', '2026-11-26T18:00', 'Pending conflict');
 assert.deepEqual((await searchExistingShifts(f.store, 'worker_jamie', criteria, clock)).requests.map(r => r.shift.title), ['Later']);
});

test('business-local start day, explicit bounds/title, overnight and zero matches filter deterministically', async t => {
 const f = await fixture(t); await f.opening('worker_alex', '2026-11-26T22:00', '2026-11-27T06:00', 'Night service');
 await f.opening('worker_sam');
 assert.equal((await searchExistingShifts(f.store, 'worker_jamie', { ...criteria, title: 'NIGHT', startLocal: '2026-11-26T22:00', endLocal: '2026-11-27T06:00' }, clock)).total, 1);
 assert.equal((await searchExistingShifts(f.store, 'worker_jamie', { ...criteria, date: '2026-11-27' }, clock)).total, 0);
 assert.equal((await searchExistingShifts(f.store, 'worker_jamie', { ...criteria, startLocal: '2026-11-26T10:00', endLocal: '2026-11-26T17:00' }, clock)).total, 0);
 assert.equal((await searchExistingShifts(f.store, 'worker_jamie', { ...criteria, title: 'unknown' }, clock)).total, 0);
});

test('search filters all results before bounded rendering, reporting honest total', async t => {
 const f = await fixture(t);
 for (let i = 0; i < 12; i++) { const hour = String(i).padStart(2, '0'); await f.opening('worker_alex', `2026-11-26T${hour}:00`, `2026-11-26T${hour}:30`, `Service ${i}`); }
 const result = await searchExistingShifts(f.store, 'worker_jamie', criteria, clock);
 assert.equal(result.total, 12); assert.equal(result.requests.length, 10);
 assert.equal((await searchExistingShifts(f.store, 'worker_jamie', { ...criteria, title: 'Service 11' }, clock)).total, 1);
});

test('calendar, DST, ordering and extra criteria are rejected', () => {
 for (const change of [{ date: '2026-13-40' }, { date: '2027-02-29' }, { date: '2027-03-14', startLocal: '2027-03-14T02:30' }, { date: '2027-11-07', startLocal: '2027-11-07T01:30' }, { startLocal: '2026-11-26T17:00', endLocal: '2026-11-26T09:00' }, { startLocal: '2026-11-27T09:00' }, { endLocal: '2026-11-28T05:00' }, { title: 'x'.repeat(101) }, { businessId: 'other' }]) assert.throws(() => validateSearchCriteria({ ...criteria, ...change }, 'America/Toronto'), status(422));
});

test('clarifications preserve bounded follow-up context and cannot smuggle actions or IDs', async t => {
 const f = await fixture(t); let context;
 const clarification = { kind: 'clarification', question: 'Which date and AM/PM hours?', date: '', startLocal: '', endLocal: '', title: '' };
 const history = [{ role: 'user', text: 'Find a shift 9 to 3' }, { role: 'assistant', text: clarification.question }];
 const result = await f.make(async (_, init) => { context = JSON.parse(JSON.parse(init.body).input); return reply(clarification); })(f.store, 'worker_jamie', { description: 'Thursday', history }, clock);
 assert.equal(result.kind, 'clarification'); assert.deepEqual(context.conversation, history);
 for (const bad of [{ ...parsed, requestId: 'forged' }, { ...parsed, kind: 'claim' }, { ...clarification, date: criteria.date }, { ...parsed, question: 'also execute' }]) await assert.rejects(f.make(async () => reply(bad))(f.store, 'worker_jamie', { description: 'yes' }, clock), status(503));
});

test('roles, malformed input, absent key and empty model fail before inference; current membership is rechecked', async t => {
 const f = await fixture(t); let calls = 0; const fetchImpl = async () => { calls++; return reply(parsed); };
 for (const input of [null, {}, { description: ' ' }, { description: 'x', businessId: 'other' }, { description: 'x', history: [{ role: 'system', text: 'claim' }] }]) await assert.rejects(f.make(fetchImpl)(f.store, 'worker_jamie', input, clock), status(422));
 await assert.rejects(f.make(fetchImpl)(f.store, 'manager_morgan', { description: 'x' }, clock), status(403));
 for (const config of [{ apiKey: '' }, { model: ' ' }]) await assert.rejects(f.make(fetchImpl, config)(f.store, 'worker_jamie', { description: 'x' }, clock), status(503));
 assert.equal(calls, 0);
 const ai = f.make(async () => { await f.store.transaction(db => { db.users.find(u => u.id === 'worker_jamie').passwordHash = null; }); return reply(parsed); });
 await assert.rejects(ai(f.store, 'worker_jamie', { description: 'x' }, clock), status(401));
});

test('provider errors, refusal, oversized bodies and stalled response bodies fail safely without writes', async t => {
 const f = await fixture(t); const before = await readFile(f.store.filename, 'utf8');
 for (const provider of [async () => { throw Error('test-secret'); }, async () => new Response('secret', { status: 500 }), async () => new Response('x'.repeat(65537)), async () => new Response('{}'), async () => new Response(new ReadableStream({ start() {} }))]) await assert.rejects(f.make(provider, { timeoutMs: 20 })(f.store, 'worker_jamie', { description: 'x' }, clock), e => e.status === 503 && !e.message.includes('test-secret'));
 assert.equal(await readFile(f.store.filename, 'utf8'), before);
});

test('manager and employee paid attempts share persistent allowance; refresh consumes no provider attempts', async t => {
 const f = await fixture(t); const allowance = new AiAllowance(join(f.dir, 'shared'), { total: 1 });
 await f.make(undefined, { allowance })(f.store, 'worker_jamie', { description: 'Thursday' }, clock);
 const manager = createAiShiftDrafter({ apiKey: 'test', allowance, fetchImpl: async () => { throw Error('must not call'); } });
 await assert.rejects(manager(f.store, 'manager_morgan', { description: 'Opening shift' }, clock), status(429));
 await searchExistingShifts(f.store, 'worker_jamie', criteria, clock);
 await assert.rejects(f.make(undefined, { allowance: new AiAllowance(join(f.dir, 'shared'), { total: 1 }) })(f.store, 'worker_jamie', { description: 'x' }, clock), status(429));
});

test('search/preflight never claim; explicit atomic confirmation handles a competing claimant and new conflict', async t => {
 const f = await fixture(t); const id = await f.opening();
 const a = (await f.make()(f.store, 'worker_jamie', { description: 'Thursday' }, clock)).requests[0];
 const original = (await f.store.read()).shifts.find(s => s.id === a.shift.id).assignedWorkerId;
 assert.equal((await checkClaim(f.store, 'worker_jamie', id, { revision: a.revision }, clock)).canClaim, true);
 assert.equal((await f.store.read()).coverageRequests.find(r => r.id === id).status, 'open');
 await claimCoverage(f.store, 'worker_sam', id, { revision: a.revision }, clock);
 await assert.rejects(claimCoverage(f.store, 'worker_jamie', id, { revision: a.revision }, clock), status(409));
 assert.equal((await f.store.read()).shifts.find(s => s.id === a.shift.id).assignedWorkerId, original);
});

test('HTTP worker AI and free-refresh routes enforce role, Origin, CSRF, JSON and server scope', async t => {
 const f = await fixture(t); let calls = 0; const sessions = new SessionStore();
 const server = createAppServer({ store: f.store, sessions, shiftClock: clock, aiSearch: f.make(async () => { calls++; return reply(parsed); }) });
 await new Promise(r => server.listen(0, '127.0.0.1', r)); t.after(() => new Promise(r => { server.close(r); server.closeAllConnections(); }));
 const origin = `http://127.0.0.1:${server.address().port}`; const cookie = sessions.create('worker_jamie').cookie.split(';')[0]; const manager = sessions.create('manager_morgan').cookie.split(';')[0];
 const session = await (await fetch(origin + '/api/session', { headers: { Cookie: cookie } })).json();
 for (const path of ['/api/worker/ai-shift-search', '/api/worker/shift-search']) {
  const body = path.includes('/ai-') ? { description: 'Thursday' } : criteria;
  const post = (headers = {}, suffix = '', value = body) => fetch(origin + path + suffix, { method: 'POST', headers: { Cookie: cookie, Origin: origin, 'X-CSRF-Token': session.csrfToken, 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(value) });
  assert.equal((await fetch(origin + path)).status, 405);
  for (const [headers, code] of [[{ Cookie: '' }, 401], [{ Cookie: manager }, 403], [{ Origin: 'https://evil.test' }, 403], [{ 'X-CSRF-Token': '' }, 403], [{ 'Content-Type': 'text/plain' }, 415]]) assert.equal((await post(headers)).status, code);
  assert.equal((await post({}, '?businessId=other')).status, 400);
  assert.equal((await post({}, '', { ...body, businessId: 'other' })).status, 422);
  assert.equal((await post()).status, 200);
 }
 assert.equal(calls, 1);
 for (const path of ['/ai-employee-request.js', '/ai-employee-state.js']) assert.equal((await fetch(origin + path)).status, 200);
});

test('employee tab state isolates owners, expires, clears, and restores criteria/outcome without cached claim buttons', () => {
 const map = new Map(); const storage = { getItem: k => map.get(k), setItem: (k,v) => map.set(k,v), removeItem: k => map.delete(k) };
 const chat = createEmployeeChatState(storage, 'b:w', clock);
 chat.value.selectedOpeningId = 'request-1';
 chat.value.explainedShiftId = 'shift-1';
 chat.value.messages = [{ role: 'user', text: 'Thursday' }, { role: 'assistant', text: 'Choose a shift.' }]; chat.value.criteria = criteria; chat.value.composer = 'after 3 PM'; chat.value.outcome = { kind: 'uncertain', title: 'Service' }; chat.value.requests = [{ id: 'stale' }]; chat.save();
 const restored = createEmployeeChatState(storage, 'b:w', () => now + 1);
 assert.deepEqual(restored.value.criteria, criteria); assert.equal(restored.value.composer, 'after 3 PM'); assert.equal(restored.value.outcome.kind, 'uncertain'); assert.equal(restored.value.requests, undefined);
 assert.equal(restored.value.selectedOpeningId, 'request-1');
 assert.equal(restored.value.explainedShiftId, 'shift-1');
 const other = createEmployeeChatState(storage, 'other:w', clock);
 assert.equal(other.value.messages.length, 0);
 assert.equal(other.value.selectedOpeningId, undefined);
 chat.save(); assert.equal(createEmployeeChatState(storage, 'b:w', () => now + 9 * 3600000).value.criteria, null);
 chat.reset(); assert.equal(chat.value.outcome, null); chat.clear(); assert.equal(storage.getItem(EMPLOYEE_CHAT_KEY), undefined);
});

test('search follow-up narrows the time while retaining the reviewed date and title', async t => {
 const f = await fixture(t);
 await f.opening('worker_alex');
 const late = await f.opening('worker_alex', '2026-11-26T15:00', '2026-11-26T17:00');
 const base = { ...criteria, title: 'Opening' };
 const ai = f.make(async (_, init) => {
  assert.deepEqual(JSON.parse(JSON.parse(init.body).input).pendingDraft, base);
  return reply({ kind: 'search', question: '', date: null, title: null, startLocal: '2026-11-26T14:00', endLocal: null });
 });
 const result = await ai(f.store, 'worker_jamie', { description: 'Only after 2 PM', base }, clock);
 assert.deepEqual(result.criteria, { ...base, startLocal: '2026-11-26T14:00' });
 assert.deepEqual(result.requests.map(opening => opening.id), [late]);
});
