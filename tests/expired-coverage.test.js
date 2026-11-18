import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {JsonStore} from '../src/storage/json-store.js';
import {seedDemo} from '../src/storage/seed.js';
import {coverageDisplayState} from '../src/requests/status.js';
import {coverageHistory} from '../src/requests/history.js';
import {managerDashboard} from '../src/manager/dashboard.js';
import {ownRequests,cancelCoverage,requestRevision} from '../src/requests/coverage.js';
import {claimCoverage,claimRevision} from '../src/requests/claim.js';
import {reviewCoverage} from '../src/requests/review.js';
import {openShiftBoard} from '../src/requests/open.js';
import {createAppServer} from '../src/app.js';
import {SessionStore} from '../src/auth/sessions.js';
async function fixture(t){
 const dir=await mkdtemp(join(tmpdir(),'covershift-expired-'));t.after(()=>rm(dir,{recursive:true,force:true}));const store=new JsonStore(join(dir,'covershift.json'));await seedDemo(store);
 await store.transaction(db=>{for(const u of db.users)u.passwordHash='test hash';});return store;
}
const start=Date.parse('2026-11-13T18:00:00.000Z');
test('unresolved coverage expires at the exact UTC start, including overnight and repeated DST clock instants; terminal outcomes never expire',()=>{
 for(const startsAt of ['2026-11-13T18:00:00.000Z','2026-11-14T03:00:00.000Z','2026-11-01T05:30:00.000Z','2026-11-01T06:30:00.000Z']){
  const shift={startsAt};const at=Date.parse(startsAt);
  for(const status of ['open','pending']){
   assert.deepEqual(coverageDisplayState({status},shift,at-1),{displayStatus:status,expiredAt:null});
   for(const now of [at,at+1,at+86400000])assert.deepEqual(coverageDisplayState({status},shift,now),{displayStatus:'expired',expiredAt:startsAt});
  }
  for(const status of ['approved','rejected','cancelled'])for(const now of [at-1,at,at+86400000])assert.deepEqual(coverageDisplayState({status},shift,now),{displayStatus:status,expiredAt:null});
 }
});
test('dashboard removes started/ended pending claims from approval count while expired open/pending records remain in scoped history without writes',async t=>{
 const store=await fixture(t);const raw=await readFile(store.filename,'utf8');
 const before=await managerDashboard(store,'manager_morgan',start-1);assert.equal(before.summary.pendingClaims,1);assert.equal(before.summary.expiredCoverage,0);
 for(const now of [start,start+3600000,Date.parse('2026-11-18T12:00:00Z')]){
  const view=await managerDashboard(store,'manager_morgan',now);assert.equal(view.summary.pendingClaims,0);assert.equal(view.pendingClaims.length,0);
  assert.equal(view.summary.expiredCoverage,now>Date.parse('2026-11-15T13:00:00Z')?2:1);
  const h=await coverageHistory(store,'manager_morgan','manager',now);const r=h.records.find(r=>r.id==='request_friday');assert.equal(r.displayStatus,'expired');assert.equal(r.status,'pending');assert.equal(r.assignedWorkerName,'Alex Morgan');assert.equal(r.events[0].action,'legacy');assert.equal(r.events[0].status,'pending');
 }
 assert.equal(await readFile(store.filename,'utf8'),raw);assert.deepEqual(await new JsonStore(store.filename).read(),JSON.parse(raw));
});
test('request owner and claimant get consistent expired labels, no cancellation or reassignment, and participant-only history',async t=>{
 const store=await fixture(t);const raw=await readFile(store.filename,'utf8');
 const owner=await ownRequests(store,'worker_alex',start);assert.equal(owner.requests[0].displayStatus,'expired');assert.equal(owner.requests[0].canCancel,false);assert.equal(owner.requests[0].stillAssigned,true);
 const claimant=await ownRequests(store,'worker_taylor',start);assert.equal(claimant.claims[0].displayStatus,'expired');assert.equal(claimant.claims[0].assignedToYou,false);
 for(const user of ['worker_alex','worker_taylor']){const h=await coverageHistory(store,user,'worker',start);assert.deepEqual(h.records.map(r=>r.id),['request_friday']);assert.equal(h.records[0].displayStatus,'expired');}
 assert.equal((await coverageHistory(store,'worker_jamie','worker',start)).records.length,0);assert.equal((await openShiftBoard(store,'worker_jamie',start)).requests.some(r=>r.id==='request_friday'),false);assert.equal(await readFile(store.filename,'utf8'),raw);
});
test('started coverage still refuses approval, rejection, cancellation and claims with fresh revisions and leaves bytes/assignment untouched',async t=>{
 const store=await fixture(t);const db=await store.read();const pending=db.coverageRequests.find(r=>r.id==='request_friday');const shift=db.shifts.find(s=>s.id===pending.shiftId);const raw=await readFile(store.filename,'utf8');
 for(const decision of ['approve','reject'])await assert.rejects(reviewCoverage(store,'manager_morgan',pending.id,decision,{revision:claimRevision(pending,shift)},()=>start),e=>e.status===409);
 await assert.rejects(cancelCoverage(store,'worker_alex',pending.id,{revision:requestRevision(pending)},()=>start),e=>e.status===409);
 const open=db.coverageRequests.find(r=>r.id==='request_sunday');const s=db.shifts.find(s=>s.id===open.shiftId);
 await assert.rejects(claimCoverage(store,'worker_jamie',open.id,{revision:claimRevision(open,s)},()=>Date.parse(s.startsAt)),e=>e.status===409);assert.equal(await readFile(store.filename,'utf8'),raw);
});
test('closed outcomes retain saved timeline and assignment after start instead of being relabeled Expired',async t=>{
 const store=await fixture(t);const db=await store.read();const r=db.coverageRequests.find(r=>r.id==='request_friday');const s=db.shifts.find(s=>s.id===r.shiftId);
 await reviewCoverage(store,'manager_morgan',r.id,'approve',{revision:claimRevision(r,s)},()=>start-1);const raw=await readFile(store.filename,'utf8');
 const h=await coverageHistory(store,'manager_morgan','manager',start+86400000);const approved=h.records.find(q=>q.id===r.id);assert.equal(approved.displayStatus,'approved');assert.equal(approved.expiredAt,null);assert.equal(approved.assignedWorkerName,'Taylor Brooks');assert.equal(approved.events.at(-1).action,'approved');assert.equal((await managerDashboard(store,'manager_morgan',start+86400000)).summary.expiredCoverage,0);assert.equal(await readFile(store.filename,'utf8'),raw);
});
test('HTTP refresh derives expiry with current server clock, protects business/role/participant scope, and supports expired History deep links',async t=>{
 const store=await fixture(t);await store.transaction(db=>{db.businesses.push({...db.businesses[0],id:'other',name:'Private other business'});db.users.push({...db.users[0],id:'other_manager',businessId:'other',email:'other-manager@example.test'});});
 let now=start-1;const sessions=new SessionStore();const server=createAppServer({store,sessions,shiftClock:()=>now});await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));const origin=`http://127.0.0.1:${server.address().port}`;
 const cookie=id=>sessions.create(id).cookie.split(';')[0];const manager=cookie('manager_morgan'),worker=cookie('worker_taylor'),other=cookie('other_manager');
 const get=(path,auth)=>fetch(origin+path,{redirect:'manual',headers:auth?{Cookie:auth}:{}});const raw=await readFile(store.filename,'utf8');
 assert.equal((await(await get('/api/manager/dashboard',manager)).json()).summary.pendingClaims,1);now=start;
 const view=await(await get('/api/manager/dashboard',manager)).json();assert.equal(view.summary.pendingClaims,0);assert.equal(view.summary.expiredCoverage,1);
 const h=await get('/api/worker/coverage-history',worker);assert.equal(h.headers.get('cache-control'),'no-store');assert.equal((await h.json()).records[0].displayStatus,'expired');
 assert.equal((await(await get('/api/manager/dashboard',other)).json()).summary.expiredCoverage,0);assert.equal((await(await get('/api/manager/coverage-history',other)).json()).records.length,0);
 assert.equal((await get('/api/manager/dashboard',worker)).status,403);assert.equal((await get('/api/manager/coverage-history')).status,401);assert.equal((await get('/api/worker/coverage-history?businessId=other',worker)).status,400);
 assert.equal((await get('/workspace/manager/history?status=expired',manager)).status,200);assert.equal((await get('/workspace/manager/history?status=expired',worker)).status,403);assert.equal(await readFile(store.filename,'utf8'),raw);
});

test('recorded request and claim events keep their actors, times and original statuses after expiry with no invented expiry event',async t=>{
 const store=await fixture(t);await store.transaction(db=>{db.schemaVersion=4;const r=db.coverageRequests.find(r=>r.id==='request_friday');r.updatedAt='2026-11-11T15:00:00.001Z';r.history=[{action:'requested',actorId:r.originalWorkerId,at:r.createdAt,status:'open'},{action:'claimed',actorId:r.claimantId,at:r.updatedAt,status:'pending'}];});
 const raw=await readFile(store.filename,'utf8');const h=await coverageHistory(store,'worker_taylor','worker',start);const r=h.records[0];assert.equal(r.displayStatus,'expired');assert.deepEqual(r.events,[{action:'requested',status:'open',at:'2026-11-11T15:00:00.000Z',actorName:'Alex Morgan'},{action:'claimed',status:'pending',at:'2026-11-11T15:00:00.001Z',actorName:'Taylor Brooks'}]);assert.equal(await readFile(store.filename,'utf8'),raw);
});
