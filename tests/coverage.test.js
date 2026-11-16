import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { JsonStore } from '../src/storage/json-store.js';
import { seedDemo } from '../src/storage/seed.js';
import { createShift } from '../src/shifts/create.js';
import { manageShift, shiftRevision } from '../src/shifts/manage.js';
import { requestCoverage, cancelCoverage, ownRequests, requestRevision, coverageShiftRevision } from '../src/requests/coverage.js';
import { upcomingWorkerShifts } from '../src/shifts/upcoming.js';
import { SessionStore } from '../src/auth/sessions.js';
import { createAppServer } from '../src/app.js';
const now = Date.parse('2026-11-16T12:00:00.000Z'); const clock = () => now;
const values = { title: 'Opening service', assignedWorkerId: 'worker_jamie', startLocal: '2026-11-20T09:00', endLocal: '2026-11-20T17:00' };
const status = code => error => error.status === code;
async function fixture(t) {
 const dir = await mkdtemp(join(tmpdir(), 'covershift-coverage-')); t.after(() => rm(dir, { recursive: true, force: true }));
 const store = new JsonStore(join(dir, 'covershift.json')); await seedDemo(store);
 await store.transaction(db => { for (const u of db.users) u.passwordHash = 'test hash'; db.businesses.push({ ...db.businesses[0], id: 'other', name: 'Other café' }); db.users.push({ ...db.users[1], id: 'other_worker', businessId: 'other', email: 'other_worker@example.test' }); });
 const created = await createShift(store, 'manager_morgan', values, clock);
 const id = created.shift.id;
 const revision = async () => { const db = await store.read(); return coverageShiftRevision(db, db.shifts.find(s => s.id === id)); };
 const open = async () => requestCoverage(store, 'worker_jamie', id, { revision: await revision() }, clock);
 const current = async requestId => (await store.read()).coverageRequests.find(r => r.id === requestId);
 return { store, id, revision, open, current };
}
test('request persists open status without changing assignment and appears only in owner’s requests and shifts', async t => {
 const f = await fixture(t); const before = await f.store.read(); const created = await f.open();
 const reopened = new JsonStore(f.store.filename); const after = await reopened.read(); const request = await f.current(created.request.id);
 assert.equal(request.status, 'open'); assert.equal(request.originalWorkerId, 'worker_jamie'); assert.equal(request.claimantId, null); assert.equal(request.reviewerId, null);
 assert.deepEqual(after.shifts, before.shifts); assert.deepEqual(after.users, before.users);
 const own = await ownRequests(reopened, 'worker_jamie', now); assert.equal(own.requests.length, 1); assert.equal(own.requests[0].canCancel, true); assert.equal(own.requests[0].stillAssigned, true);
 assert.ok(!(await ownRequests(reopened, 'worker_alex', now)).requests.some(r => r.id === created.request.id)); assert.deepEqual((await ownRequests(reopened, 'other_worker', now)).requests, []);
 assert.doesNotMatch(JSON.stringify(own), /businessId|originalWorkerId|password|email|tokenHash/);
 const shift = (await upcomingWorkerShifts(reopened, 'worker_jamie', now)).shifts.find(s => s.id === f.id); assert.equal(shift.coverage.canRequest, false); assert.equal(shift.coverage.request.id, created.request.id);
});
test('concurrent duplicates produce one active request and reject even with a fresh active-request revision', async t => {
 const f = await fixture(t); const input = { revision: await f.revision() };
 const results = await Promise.allSettled([requestCoverage(f.store, 'worker_jamie', f.id, input, clock), requestCoverage(f.store, 'worker_jamie', f.id, input, clock)]);
 assert.equal(results.filter(r => r.status === 'fulfilled').length, 1); assert.equal(results.find(r => r.status === 'rejected').reason.status, 409);
 await assert.rejects(f.open(), status(409)); assert.equal((await f.store.read()).coverageRequests.filter(r => r.shiftId === f.id).length, 1);
});
test('cancel preserves request/claimant history and assignment, supports open/pending, and allows fresh re-request', async t => {
 for (const pending of [false,true]) {
  const f = await fixture(t); const oldShiftRevision = await f.revision(); const created = await f.open();
  if (pending) await f.store.transaction(db => { const r = db.coverageRequests.find(r => r.id === created.request.id); r.status = 'pending'; r.claimantId = 'worker_alex'; });
  const request = await f.current(created.request.id); const shifts = (await f.store.read()).shifts;
  await cancelCoverage(f.store, 'worker_jamie', request.id, { revision: requestRevision(request) }, clock);
  const cancelled = await f.current(request.id); assert.equal(cancelled.status, 'cancelled'); assert.equal(cancelled.claimantId, pending ? 'worker_alex' : null); assert.equal(cancelled.createdAt, request.createdAt); assert.ok(cancelled.updatedAt > request.updatedAt); assert.deepEqual((await f.store.read()).shifts, shifts);
  assert.equal((await ownRequests(f.store, 'worker_jamie', now)).requests[0].canCancel, false);
  await assert.rejects(requestCoverage(f.store, 'worker_jamie', f.id, { revision: oldShiftRevision }, clock), status(409));
  const again = await f.open(); assert.notEqual(again.request.id, request.id); assert.equal((await ownRequests(f.store, 'worker_jamie', now)).requests.length, 2);
 }
});
test('request/cancel ownership, role, strict fields and exact-start boundary are enforced without writes', async t => {
 const f = await fixture(t); const input = { revision: await f.revision() }; let before = await readFile(f.store.filename, 'utf8');
 for (const [user, code] of [['worker_alex',404],['other_worker',404],['manager_morgan',403],['missing',401]]) await assert.rejects(requestCoverage(f.store, user, f.id, input, clock), status(code));
 for (const extra of [{ userId:'worker_alex' },{ businessId:'other' },{ status:'approved' },{ revision:null },{ revision:'' }]) await assert.rejects(requestCoverage(f.store, 'worker_jamie', f.id, { ...input, ...extra }, clock), status(422));
 const start = Date.parse('2026-11-20T14:00:00.000Z');
 await assert.rejects(requestCoverage(f.store, 'worker_jamie', f.id, input, () => start), status(409)); assert.equal(await readFile(f.store.filename,'utf8'), before);
 const created = await f.open(); const request = await f.current(created.request.id); const body = { revision: requestRevision(request) }; before = await readFile(f.store.filename,'utf8');
 for (const [user, code] of [['worker_alex',404],['other_worker',404],['manager_morgan',403]]) await assert.rejects(cancelCoverage(f.store, user, request.id, body, clock), status(code));
 await assert.rejects(cancelCoverage(f.store, 'worker_jamie', request.id, { ...body, claimantId:null }, clock), status(422));
 await assert.rejects(cancelCoverage(f.store, 'worker_jamie', request.id, body, () => start), status(409)); assert.equal(await readFile(f.store.filename,'utf8'), before);
});
test('closed/approved requests and stale claim status cannot be cancelled, concurrent cancellation wins once', async t => {
 const f = await fixture(t); const created = await f.open(); let request = await f.current(created.request.id); const stale = requestRevision(request);
 await f.store.transaction(db => { const r = db.coverageRequests.find(r => r.id === request.id); r.status = 'pending'; r.claimantId = 'worker_alex'; });
 await assert.rejects(cancelCoverage(f.store, 'worker_jamie', request.id, { revision: stale }, clock), status(409));
 request = await f.current(request.id); const body = { revision: requestRevision(request) };
 const results = await Promise.allSettled([cancelCoverage(f.store, 'worker_jamie', request.id, body, clock),cancelCoverage(f.store, 'worker_jamie', request.id, body, clock)]);
 assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
 request = await f.current(request.id); await assert.rejects(cancelCoverage(f.store, 'worker_jamie', request.id, { revision: requestRevision(request) }, clock), status(409));
 const next = await f.open();
 await f.store.transaction(db => { const r = db.coverageRequests.find(r => r.id === next.request.id); r.status='approved'; r.claimantId='worker_alex'; r.reviewerId='manager_morgan'; db.shifts.find(s => s.id===f.id).assignedWorkerId='worker_alex'; });
 request = await f.current(next.request.id); await assert.rejects(cancelCoverage(f.store,'worker_jamie',request.id,{revision:requestRevision(request)},clock),status(409));
 const list = await ownRequests(f.store,'worker_jamie',now); assert.equal(list.requests.find(r=>r.id===request.id).stillAssigned,false);
});
test('coverage and manager mutations recheck current data atomically; stale edited/deleted shifts cannot be requested', async t => {
 const f = await fixture(t); const stale = await f.revision(); const before = await f.store.read(); const shift = before.shifts.find(s=>s.id===f.id);
 const results = await Promise.allSettled([f.open(), manageShift(f.store,'manager_morgan',f.id,'delete',{revision:shiftRevision(shift)},clock)]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 // Whichever transaction gets the lock first, a dangling coverage request is impossible.
 const db = await f.store.read(); for(const r of db.coverageRequests) assert.ok(db.shifts.some(s=>s.id===r.shiftId));
 const g = await fixture(t); const old = await g.revision(); const s = (await g.store.read()).shifts.find(s=>s.id===g.id);
 await manageShift(g.store,'manager_morgan',g.id,'edit',{...values,title:'Changed',revision:shiftRevision(s)},clock);
 await assert.rejects(requestCoverage(g.store,'worker_jamie',g.id,{revision:old},clock),status(409));
 const latest = (await g.store.read()).shifts.find(s=>s.id===g.id); await manageShift(g.store,'manager_morgan',g.id,'delete',{revision:shiftRevision(latest)},clock);
 await assert.rejects(requestCoverage(g.store,'worker_jamie',g.id,{revision:old},clock),status(404));
 assert.ok(stale);
});
test('HTTP endpoints protect both mutations, scope reads and persist request/cancel without changing assignment', async t => {
 const f = await fixture(t); const sessions = new SessionStore(); const server = createAppServer({store:f.store,sessions,shiftClock:clock});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve)); t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));
 const origin=`http://127.0.0.1:${server.address().port}`; const cookie=sessions.create('worker_jamie').cookie.split(';')[0]; const manager=sessions.create('manager_morgan').cookie.split(';')[0];
 const get = (path,c=cookie)=>fetch(origin+path,{headers:{Cookie:c}}); const session=await (await get('/api/session')).json();
 const post=(path,body,headers={})=>fetch(origin+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',Cookie:cookie,'X-CSRF-Token':session.csrfToken,...headers},body:JSON.stringify(body)});
 const requestPath=`/api/worker/shifts/${f.id}/coverage`;const revision=(await (await get('/api/worker/shifts')).json()).shifts.find(s=>s.id===f.id).coverage.revision;
 const created=await post(requestPath,{revision});assert.equal(created.status,201);const r=await created.json();
 const list=await (await get('/api/worker/requests')).json();const item=list.requests.find(q=>q.id===r.request.id);const cancelPath=`/api/worker/requests/${item.id}/cancel`;
 for(const [path,body] of [[requestPath,{revision}],[cancelPath,{revision:item.revision}]]) {
  for(const [headers,code] of [[{Cookie:''},401],[{Cookie:manager},403],[{Origin:'https://foreign.test'},403],[{'X-CSRF-Token':''},403],[{'Content-Type':'text/plain'},415],[{'Sec-Fetch-Site':'cross-site'},403]]) assert.equal((await post(path,body,headers)).status,code);
  assert.equal((await get(path)).status,405);assert.equal((await post(path+'?owner=other',body)).status,400);
 }
 assert.equal((await get('/api/worker/requests',manager)).status,403); assert.equal((await get('/api/worker/requests?workerId=other')).status,400);
 assert.equal((await post(cancelPath,{revision:item.revision})).status,200); assert.equal((await post(cancelPath,{revision:item.revision})).status,409);
 assert.equal((await f.store.read()).shifts.find(s=>s.id===f.id).assignedWorkerId,'worker_jamie');
 assert.equal((await (await get('/api/worker/requests')).json()).requests[0].status,'cancelled');
});
