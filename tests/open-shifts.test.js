import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { JsonStore } from '../src/storage/json-store.js';
import { seedDemo } from '../src/storage/seed.js';
import { openShiftBoard } from '../src/requests/open.js';
import { requestRevision, cancelCoverage } from '../src/requests/coverage.js';
import { SessionStore } from '../src/auth/sessions.js';
import { createAppServer } from '../src/app.js';
const now=Date.parse('2026-11-16T12:00:00.000Z'); const status=n=>e=>e.status===n;
async function fixture(t) {
 const dir=await mkdtemp(join(tmpdir(),'covershift-board-'));t.after(()=>rm(dir,{recursive:true,force:true}));const store=new JsonStore(join(dir,'covershift.json'));await seedDemo(store);
 await store.transaction(db=>{
  for(const user of db.users) user.passwordHash='test hash';
  db.businesses.push({...db.businesses[0],id:'other',name:'Other private business'});
  db.users.push({...db.users[1],id:'other_worker',businessId:'other',email:'other@example.test',name:'Other private worker'}, {...db.users[1],id:'viewer',email:'viewer@example.test',name:'Board viewer'});
  const at='2026-11-16T11:00:00.000Z';const record=v=>({...v,createdAt:at,updatedAt:at});
  const add=(id,worker,start,end,state='open',businessId='business_demo_cafe')=>{
   db.shifts.push(record({id:'shift_'+id,businessId,assignedWorkerId:state==='approved'?'worker_taylor':worker,title:id==='foreign'?'Other private shift':'Coverage '+id,startsAt:start,endsAt:end}));
   db.coverageRequests.push(record({id:'request_'+id,businessId,shiftId:'shift_'+id,originalWorkerId:worker,claimantId:['pending','approved'].includes(state)?'worker_taylor':null,reviewerId:state==='approved'?'manager_morgan':null,status:state}));
  };
  add('b','worker_sam','2026-11-17T14:00:00.000Z','2026-11-17T18:00:00.000Z');
  add('a','worker_alex','2026-11-17T14:00:00.000Z','2026-11-17T22:00:00.000Z');
  add('overnight','worker_alex','2026-11-18T03:00:00.000Z','2026-11-18T11:00:00.000Z');
  add('own','worker_jamie','2026-11-19T14:00:00.000Z','2026-11-19T18:00:00.000Z');
  add('pending','worker_sam','2026-11-20T14:00:00.000Z','2026-11-20T18:00:00.000Z','pending');
  add('cancelled','worker_alex','2026-11-21T14:00:00.000Z','2026-11-21T18:00:00.000Z','cancelled');
  add('approved','worker_sam','2026-11-22T14:00:00.000Z','2026-11-22T18:00:00.000Z','approved');
  add('started','worker_alex','2026-11-16T12:00:00.000Z','2026-11-16T18:00:00.000Z');
  add('ended','worker_sam','2026-11-15T12:00:00.000Z','2026-11-15T18:00:00.000Z');
  add('foreign','other_worker','2026-11-17T14:00:00.000Z','2026-11-17T18:00:00.000Z','open','other');
 });return store;
}
test('board filters own, foreign, started, ended and all unavailable states; sorts dates and ties consistently',async t=>{
 const store=await fixture(t);const before=await readFile(store.filename,'utf8');const result=await openShiftBoard(store,'worker_jamie',now);
 assert.deepEqual(result.requests.map(r=>r.id),['request_a','request_b','request_overnight']);assert.equal(result.timezone,'America/Toronto');assert.equal(result.asOf,new Date(now).toISOString());
 assert.equal(result.requests[0].originalWorkerName,'Alex Morgan');assert.equal(result.requests[1].originalWorkerName,'Sam Rivera');assert.equal(result.requests[2].shift.endsAt,'2026-11-18T11:00:00.000Z');
 assert.doesNotMatch(JSON.stringify(result),/password|email|businessId|claimantId|reviewerId|Other private|request_own|request_pending|request_cancelled|request_approved|request_started|request_ended/);
 assert.equal(await readFile(store.filename,'utf8'),before);
});
test('expiry is exact to the millisecond and honest empty results do not modify saved requests',async t=>{
 const store=await fixture(t);const start=Date.parse('2026-11-17T14:00:00.000Z');
 assert.equal((await openShiftBoard(store,'worker_jamie',start-1)).requests.length,3);
 assert.deepEqual((await openShiftBoard(store,'worker_jamie',start)).requests.map(r=>r.id),['request_overnight']);
 assert.deepEqual((await openShiftBoard(store,'worker_jamie',Date.parse('2026-11-18T03:00:00.000Z'))).requests,[]);
 assert.deepEqual((await openShiftBoard(store,'other_worker',now)).requests,[]);
 assert.equal((await store.read()).coverageRequests.find(r=>r.id==='request_a').status,'open');
});
test('refresh reads cancellation and pending changes from disk without transferring assignments',async t=>{
 const store=await fixture(t);const shifts=(await store.read()).shifts;
 const request=(await store.read()).coverageRequests.find(r=>r.id==='request_a');
 await cancelCoverage(store,'worker_alex',request.id,{revision:requestRevision(request)},()=>now);
 assert.deepEqual((await openShiftBoard(new JsonStore(store.filename),'worker_jamie',now)).requests.map(r=>r.id),['request_b','request_overnight']);
 await store.transaction(db=>{const r=db.coverageRequests.find(r=>r.id==='request_b');r.status='pending';r.claimantId='worker_taylor';});
 assert.deepEqual((await openShiftBoard(store,'worker_jamie',now)).requests.map(r=>r.id),['request_overnight']);assert.deepEqual((await store.read()).shifts,shifts);
});
test('authentication and current business membership are rechecked on each board read',async t=>{
 const store=await fixture(t);
 await assert.rejects(openShiftBoard(store,'manager_morgan',now),status(403));await assert.rejects(openShiftBoard(store,'missing',now),status(401));
 assert.ok((await openShiftBoard(store,'viewer',now)).requests.some(r=>r.id==='request_a'));
 await store.transaction(db=>{db.users.find(u=>u.id==='viewer').businessId='other';});
 assert.deepEqual((await openShiftBoard(store,'viewer',now)).requests.map(r=>r.id),['request_foreign']);
 await store.transaction(db=>{db.users.find(u=>u.id==='viewer').passwordHash=null;});
 await assert.rejects(openShiftBoard(store,'viewer',now),status(401));
});
test('HTTP board rejects anonymous/managers, query tampering and mutations; allows scoped GET/HEAD only',async t=>{
 const store=await fixture(t);const sessions=new SessionStore();const server=createAppServer({store,sessions,shiftClock:()=>now});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));
 const origin=`http://127.0.0.1:${server.address().port}`;const worker=sessions.create('worker_jamie').cookie.split(';')[0];const manager=sessions.create('manager_morgan').cookie.split(';')[0];const get=(query='',cookie=worker)=>fetch(origin+'/api/worker/open-shifts'+query,{headers:{Cookie:cookie}});
 assert.equal((await get('','')).status,401);assert.equal((await get('',manager)).status,403);
 for(const query of ['?businessId=other','?workerId=worker_alex','?status=pending','?']) {if(query==='?') continue;assert.equal((await get(query)).status,400);}
 const before=await readFile(store.filename,'utf8');const response=await get();assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');assert.deepEqual((await response.json()).requests.map(r=>r.id),['request_a','request_b','request_overnight']);
 const head=await fetch(origin+'/api/worker/open-shifts',{method:'HEAD',headers:{Cookie:worker}});assert.equal(head.status,200);assert.equal(await head.text(),'');
 for(const method of ['POST','PUT','PATCH','DELETE']) assert.equal((await fetch(origin+'/api/worker/open-shifts',{method,headers:{Cookie:worker}})).status,405);
 assert.equal(await readFile(store.filename,'utf8'),before);
});
