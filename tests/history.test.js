import { coverageHistory } from '../src/requests/history.js';
import { reviewCoverage } from '../src/requests/review.js';
import { validateDatabase } from '../src/storage/model.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { JsonStore } from '../src/storage/json-store.js';
import { seedDemo } from '../src/storage/seed.js';
import { createShift } from '../src/shifts/create.js';
import { requestCoverage, coverageShiftRevision, ownRequests, cancelCoverage, requestRevision } from '../src/requests/coverage.js';
import { checkClaim, claimCoverage, claimRevision } from '../src/requests/claim.js';
import { openShiftBoard } from '../src/requests/open.js';
import { managerDashboard } from '../src/manager/dashboard.js';
import { upcomingWorkerShifts } from '../src/shifts/upcoming.js';
import { intervalsOverlap, findClaimConflicts } from '../public/claim-conflicts.js';
import { SessionStore } from '../src/auth/sessions.js';
import { createAppServer } from '../src/app.js';
const now=Date.parse('2026-11-16T12:00:00.000Z');const clock=()=>now;const status=n=>e=>e.status===n;
async function fixture(t){
 const dir=await mkdtemp(join(tmpdir(),'covershift-claim-'));t.after(()=>rm(dir,{recursive:true,force:true}));const store=new JsonStore(join(dir,'covershift.json'));await seedDemo(store);
 await store.transaction(db=>{for(const u of db.users)u.passwordHash='test hash';db.businesses.push({...db.businesses[0],id:'other',name:'Other café'});db.users.push({...db.users[1],id:'other_worker',businessId:'other',email:'other@example.test'});});
 async function request(worker='worker_alex',startLocal='2026-11-20T09:00',endLocal='2026-11-20T17:00',title='Coverage shift'){
  const result=await createShift(store,'manager_morgan',{title,assignedWorkerId:worker,startLocal,endLocal},clock);const db=await store.read();const shift=db.shifts.find(s=>s.id===result.shift.id);const created=await requestCoverage(store,worker,shift.id,{revision:coverageShiftRevision(db,shift)},clock);const r=(await store.read()).coverageRequests.find(r=>r.id===created.request.id);return {id:r.id,shiftId:shift.id,input:{revision:claimRevision(r,shift)}};
 }
 return {store,request};
}
async function claim(f,r){await claimCoverage(f.store,'worker_jamie',r.id,r.input,clock);const db=await f.store.read();const q=db.coverageRequests.find(q=>q.id===r.id);return {revision:claimRevision(q,db.shifts.find(s=>s.id===r.shiftId))};}
test('request/claim/approval timeline persists actor/time in order and updates assignment',async t=>{
 const f=await fixture(t);const r=await f.request();const input=await claim(f,r);await reviewCoverage(f.store,'manager_morgan',r.id,'approve',input,clock);
 const h=await coverageHistory(new JsonStore(f.store.filename),'worker_jamie','worker',now);const q=h.records.find(q=>q.id===r.id);
 assert.deepEqual(q.events.map(e=>e.action),['requested','claimed','approved']);assert.deepEqual(q.events.map(e=>e.actorName),['Alex Morgan','Jamie Lee','Morgan Chen']);assert.equal(q.assignedWorkerName,'Jamie Lee');assert.equal(q.status,'approved');assert.ok(q.events.every((e,i)=>i===0||e.at>q.events[i-1].at));
 assert.equal((await coverageHistory(f.store,'worker_alex','worker',now)).records.find(q=>q.id===r.id).status,'approved');assert.doesNotMatch(JSON.stringify(h),/password|email|businessId|actorId|token/);
});
test('rejection, reopening, reclaim and cancellation retain distinct truthful outcomes',async t=>{
 const f=await fixture(t);const r=await f.request();const input=await claim(f,r);await reviewCoverage(f.store,'manager_morgan',r.id,'reject',input,clock);
 const db=await f.store.read();const reopened=db.coverageRequests.find(q=>q.shiftId===r.shiftId&&q.status==='open');const shift=db.shifts.find(s=>s.id===r.shiftId);await claimCoverage(f.store,'worker_sam',reopened.id,{revision:claimRevision(reopened,shift)},clock);
 const current=(await f.store.read()).coverageRequests.find(q=>q.id===reopened.id);await cancelCoverage(f.store,'worker_alex',reopened.id,{revision:requestRevision(current)},clock);
 const manager=await coverageHistory(f.store,'manager_morgan','manager',now);const old=manager.records.find(q=>q.id===r.id);const fresh=manager.records.find(q=>q.id===reopened.id);
 assert.deepEqual(old.events.map(e=>e.action),['requested','claimed','rejected']);assert.deepEqual(fresh.events.map(e=>e.action),['reopened','claimed','cancelled']);assert.equal(fresh.events[0].actorName,'Morgan Chen');assert.equal(fresh.events.at(-1).actorName,'Alex Morgan');assert.equal(fresh.assignedWorkerName,'Alex Morgan');
 const jamie=await coverageHistory(f.store,'worker_jamie','worker',now);assert.ok(jamie.records.some(q=>q.id===r.id));assert.ok(!jamie.records.some(q=>q.id===reopened.id));assert.ok(!(await coverageHistory(f.store,'worker_taylor','worker',now)).records.some(q=>q.shift.id===r.shiftId));
});
test('legacy reads do not rewrite data or invent event actors; first mutation retains baseline snapshot',async t=>{
 const f=await fixture(t);const raw=await readFile(f.store.filename,'utf8');const h=await coverageHistory(f.store,'manager_morgan','manager',now);const legacy=h.records.find(q=>q.id==='request_friday');assert.deepEqual(legacy.events,[{action:'legacy',actorName:null,at:'2026-11-11T15:00:00.000Z',status:'pending'}]);assert.equal(await readFile(f.store.filename,'utf8'),raw);
 const request=(await f.store.read()).coverageRequests.find(q=>q.id==='request_sunday');await cancelCoverage(f.store,'worker_sam',request.id,{revision:requestRevision(request)},()=>Date.parse('2026-11-12T12:00:00.000Z'));
 const record=(await coverageHistory(f.store,'worker_sam','worker',now)).records.find(q=>q.id===request.id);assert.deepEqual(record.events.map(e=>e.action),['legacy','cancelled']);assert.equal(record.events[1].actorName,'Sam Rivera');assert.equal((await f.store.read()).schemaVersion,4);
});
test('failed and concurrent decisions never add phantom or duplicate events',async t=>{
 const f=await fixture(t);const r=await f.request();const raw=await readFile(f.store.filename,'utf8');await assert.rejects(claimCoverage(f.store,'worker_alex',r.id,r.input,clock),status(409));assert.equal(await readFile(f.store.filename,'utf8'),raw);
 const input=await claim(f,r);const outcomes=await Promise.allSettled(['approve','reject'].map(d=>reviewCoverage(f.store,'manager_morgan',r.id,d,input,clock)));assert.equal(outcomes.filter(o=>o.status==='fulfilled').length,1);const q=(await f.store.read()).coverageRequests.find(q=>q.id===r.id);assert.equal(q.history.length,3);
});
test('model refuses forged event roles, foreign actors, unknown fields/actions and nonchronological timestamps',async t=>{
 const f=await fixture(t);const r=await f.request();const db=await f.store.read();
 for(const mutate of [e=>e.actorId='manager_morgan',e=>e.actorId='other_worker',e=>e.action='invented',e=>e.secret='x',e=>e.at='2020-01-01T00:00:00.000Z',e=>e.status='approved']){const draft=structuredClone(db);mutate(draft.coverageRequests.find(q=>q.id===r.id).history[0]);assert.throws(()=>validateDatabase(draft));}
 const draft=structuredClone(db);draft.schemaVersion=3;assert.throws(()=>validateDatabase(draft));
});
test('HTTP history protects roles, participants/business, GET/HEAD, query scope and workspace routes',async t=>{
 const f=await fixture(t);const r=await f.request();await claim(f,r);const sessions=new SessionStore();const server=createAppServer({store:f.store,sessions,shiftClock:clock});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));const origin=`http://127.0.0.1:${server.address().port}`;
 const cookies=Object.fromEntries(['manager_morgan','worker_jamie','worker_taylor','other_worker'].map(id=>[id,sessions.create(id).cookie.split(';')[0]]));
 const get=(role,user,query='',method='GET')=>fetch(`${origin}/api/${role}/coverage-history${query}`,{method,headers:{Cookie:cookies[user]||''}});
 assert.equal((await get('worker','missing')).status,401);assert.equal((await get('manager','worker_jamie')).status,403);assert.equal((await get('worker','manager_morgan')).status,403);assert.equal((await get('worker','worker_jamie','?workerId=worker_alex')).status,400);assert.equal((await get('manager','manager_morgan','','POST')).status,405);assert.equal((await get('manager','manager_morgan','','HEAD')).status,200);
 const other=await(await get('worker','other_worker')).json();assert.deepEqual(other.records,[]);const mine=await get('worker','worker_jamie');assert.match(mine.headers.get('cache-control'),/no-store/);assert.ok((await mine.json()).records.some(q=>q.id===r.id));
 for(const role of ['manager','worker']){const user=role==='manager'?'manager_morgan':'worker_jamie';assert.equal((await fetch(`${origin}/workspace/${role}/history`,{headers:{Cookie:cookies[user]}})).status,200);}
});
