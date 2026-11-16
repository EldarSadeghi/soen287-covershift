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
test('shared client/server overlap comparison handles containment, adjacency, overnight and repeated DST clock times',()=>{
 const range=(start,end)=>({startsAt:start,endsAt:end});const a=range('2026-11-20T14:00:00.000Z','2026-11-20T22:00:00.000Z');
 for(const b of [range('2026-11-20T13:00:00.000Z','2026-11-20T15:00:00.000Z'),range('2026-11-20T15:00:00.000Z','2026-11-20T16:00:00.000Z'),range('2026-11-20T13:00:00.000Z','2026-11-20T23:00:00.000Z')])assert.equal(intervalsOverlap(a,b),true);
 assert.equal(intervalsOverlap(a,range(a.endsAt,'2026-11-20T23:00:00.000Z')),false);
 assert.equal(intervalsOverlap(range('2027-11-07T05:30:00.000Z','2027-11-07T06:00:00.000Z'),range('2027-11-07T06:30:00.000Z','2027-11-07T07:00:00.000Z')),false);
 assert.equal(intervalsOverlap(range('2026-11-20T23:00:00.000Z','2026-11-21T07:00:00.000Z'),range('2026-11-21T06:00:00.000Z','2026-11-21T08:00:00.000Z')),true);
 assert.equal(findClaimConflicts({...a,id:'same'},[{...a,id:'same'},{...a,id:'other'}]).length,1);
});
test('fresh preflight is read-only, returns only own commitments, and atomic claim persists pending without assigning shift',async t=>{
 const f=await fixture(t);const r=await f.request();const before=await f.store.read();const raw=await readFile(f.store.filename,'utf8');const check=await checkClaim(f.store,'worker_jamie',r.id,r.input,clock);
 assert.equal(check.canClaim,true);assert.deepEqual(check.conflicts,[]);assert.equal(await readFile(f.store.filename,'utf8'),raw);
 const result=await claimCoverage(f.store,'worker_jamie',r.id,r.input,clock);assert.equal(result.request.status,'pending');const db=await new JsonStore(f.store.filename).read();const saved=db.coverageRequests.find(q=>q.id===r.id);
 assert.equal(saved.claimantId,'worker_jamie');assert.equal(saved.originalWorkerId,'worker_alex');assert.equal(saved.reviewerId,null);assert.deepEqual(db.shifts,before.shifts);assert.deepEqual(db.users,before.users);
 assert.ok(!(await openShiftBoard(f.store,'worker_sam',now)).requests.some(q=>q.id===r.id));
 assert.equal((await ownRequests(f.store,'worker_alex',now)).requests.find(q=>q.id===r.id).status,'pending');
 const claim=(await ownRequests(f.store,'worker_jamie',now)).claims.find(q=>q.id===r.id);assert.equal(claim.status,'pending');assert.equal(claim.assignedToYou,false);
 assert.ok((await managerDashboard(f.store,'manager_morgan',now)).pendingClaims.some(q=>q.id===r.id));assert.ok(!(await upcomingWorkerShifts(f.store,'worker_jamie',now)).shifts.some(s=>s.id===r.shiftId));
});
test('assigned overlap blocks check and final claim, including a new assignment after successful preflight',async t=>{
 const f=await fixture(t);const r=await f.request();assert.equal((await checkClaim(f.store,'worker_jamie',r.id,r.input,clock)).canClaim,true);
 await createShift(f.store,'manager_morgan',{title:'My assigned work',assignedWorkerId:'worker_jamie',startLocal:'2026-11-20T16:00',endLocal:'2026-11-20T18:00'},clock);
 const preview=await checkClaim(f.store,'worker_jamie',r.id,r.input,clock);assert.equal(preview.canClaim,false);assert.equal(preview.conflicts[0].kind,'assigned');assert.equal(preview.conflicts[0].title,'My assigned work');
 const raw=await readFile(f.store.filename,'utf8');await assert.rejects(claimCoverage(f.store,'worker_jamie',r.id,r.input,clock),e=>e.status===409&&e.fields.conflicts[0].title==='My assigned work');assert.equal(await readFile(f.store.filename,'utf8'),raw);
});
test('concurrent claims by different workers choose one claimant and reject repeated claims',async t=>{
 const f=await fixture(t);const r=await f.request();const outcomes=await Promise.allSettled([claimCoverage(f.store,'worker_jamie',r.id,r.input,clock),claimCoverage(f.store,'worker_sam',r.id,r.input,clock)]);
 assert.equal(outcomes.filter(x=>x.status==='fulfilled').length,1);assert.equal(outcomes.find(x=>x.status==='rejected').reason.status,409);const saved=(await f.store.read()).coverageRequests.find(q=>q.id===r.id);assert.ok(['worker_jamie','worker_sam'].includes(saved.claimantId));
 await assert.rejects(claimCoverage(f.store,saved.claimantId,r.id,r.input,clock),status(409));
});
test('pending claims reserve time so concurrent overlapping claims cannot both succeed; adjacent claims remain allowed',async t=>{
 const f=await fixture(t);const a=await f.request();const b=await f.request('worker_sam','2026-11-20T16:00','2026-11-20T19:00');
 const results=await Promise.allSettled([claimCoverage(f.store,'worker_jamie',a.id,a.input,clock),claimCoverage(f.store,'worker_jamie',b.id,b.input,clock)]);assert.equal(results.filter(x=>x.status==='fulfilled').length,1);assert.equal(results.find(x=>x.status==='rejected').reason.status,409);
 const pending=(await f.store.read()).coverageRequests.find(q=>q.id===a.id);assert.equal(pending.status,'pending');
 const check=await checkClaim(f.store,'worker_jamie',b.id,b.input,clock);assert.equal(check.canClaim,false);assert.equal(check.conflicts[0].kind,'pending_claim');
 const adjacent=await f.request('worker_alex','2026-11-20T17:00','2026-11-20T19:00');await claimCoverage(f.store,'worker_jamie',adjacent.id,adjacent.input,clock);
});
test('cancelling a pending original request releases the claimant reservation while retaining claim history',async t=>{
 const f=await fixture(t);const a=await f.request();const b=await f.request('worker_sam','2026-11-20T16:00','2026-11-20T19:00');await claimCoverage(f.store,'worker_jamie',a.id,a.input,clock);
 const r=(await f.store.read()).coverageRequests.find(q=>q.id===a.id);await cancelCoverage(f.store,'worker_alex',a.id,{revision:requestRevision(r)},clock);
 assert.equal((await checkClaim(f.store,'worker_jamie',b.id,b.input,clock)).canClaim,true);assert.equal((await ownRequests(f.store,'worker_jamie',now)).claims.find(q=>q.id===a.id).status,'cancelled');await claimCoverage(f.store,'worker_jamie',b.id,b.input,clock);
});
test('own, foreign, inactive users, tampered fields and exact-start expiry are rejected without writes',async t=>{
 const f=await fixture(t);const r=await f.request();const raw=await readFile(f.store.filename,'utf8');
 for(const operation of [checkClaim,claimCoverage]){
  for(const [user,code] of [['worker_alex',409],['other_worker',404],['manager_morgan',403],['missing',401]])await assert.rejects(operation(f.store,user,r.id,r.input,clock),status(code));
  for(const extra of [{claimantId:'worker_sam'},{businessId:'other'},{status:'approved'},{conflicts:[]},{revision:null}])await assert.rejects(operation(f.store,'worker_jamie',r.id,{...r.input,...extra},clock),status(422));
  await assert.rejects(operation(f.store,'worker_jamie',r.id,r.input,()=>Date.parse('2026-11-20T14:00:00.000Z')),status(409));
  await assert.rejects(operation(f.store,'worker_jamie',r.id,{revision:'0'.repeat(64)},clock),status(409));
 }
 assert.equal(await readFile(f.store.filename,'utf8'),raw);
 await f.store.transaction(db=>{db.users.find(u=>u.id==='worker_jamie').passwordHash=null;});await assert.rejects(claimCoverage(f.store,'worker_jamie',r.id,r.input,clock),status(401));
});
test('request cancellation or approval between check and confirmation blocks stale claims',async t=>{
 for(const state of ['cancelled','approved']){
  const f=await fixture(t);const r=await f.request();assert.equal((await checkClaim(f.store,'worker_jamie',r.id,r.input,clock)).canClaim,true);
  await f.store.transaction(db=>{const q=db.coverageRequests.find(q=>q.id===r.id);q.status=state;if(state==='approved'){q.claimantId='worker_sam';q.reviewerId='manager_morgan';db.shifts.find(s=>s.id===r.shiftId).assignedWorkerId='worker_sam';}});
  await assert.rejects(claimCoverage(f.store,'worker_jamie',r.id,r.input,clock),status(409));
 }
});
test('HTTP check/claim protect session, role, origin, JSON, CSRF, strict input and query scope',async t=>{
 const f=await fixture(t);const r=await f.request();const sessions=new SessionStore();const server=createAppServer({store:f.store,sessions,shiftClock:clock});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));
 const origin=`http://127.0.0.1:${server.address().port}`;const cookie=sessions.create('worker_jamie').cookie.split(';')[0];const manager=sessions.create('manager_morgan').cookie.split(';')[0];const account=await(await fetch(origin+'/api/session',{headers:{Cookie:cookie}})).json();
 const post=(action,body=r.input,headers={},query='')=>fetch(`${origin}/api/worker/requests/${r.id}/${action}${query}`,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',Cookie:cookie,'X-CSRF-Token':account.csrfToken,...headers},body:JSON.stringify(body)});
 for(const action of ['claim-check','claim']){
  for(const [headers,code] of [[{Cookie:''},401],[{Cookie:manager},403],[{Origin:'https://foreign.test'},403],[{'Content-Type':'text/plain'},415],[{'X-CSRF-Token':''},403],[{'Sec-Fetch-Site':'cross-site'},403]])assert.equal((await post(action,r.input,headers)).status,code);
  assert.equal((await post(action,r.input,{},'?businessId=other')).status,400);assert.equal((await post(action,{...r.input,claimantId:'worker_sam'})).status,422);
 }
 const check=await post('claim-check');assert.equal(check.status,200);assert.equal((await check.json()).canClaim,true);assert.equal((await f.store.read()).coverageRequests.find(q=>q.id===r.id).status,'open');
 const claim=await post('claim');assert.equal(claim.status,200);assert.equal((await claim.json()).request.status,'pending');assert.equal((await post('claim')).status,409);
 const list=await(await fetch(origin+'/api/worker/requests',{headers:{Cookie:cookie}})).json();assert.equal(list.claims.find(q=>q.id===r.id).status,'pending');assert.doesNotMatch(JSON.stringify(list),/password|email|businessId|claimantId/);
});
