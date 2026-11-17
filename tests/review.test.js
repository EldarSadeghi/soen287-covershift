import { addWorker, reissueSetup } from '../src/manager/workers.js';
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
async function pending(f, worker='worker_alex', start='2026-11-20T09:00', end='2026-11-20T17:00') {
 const r=await f.request(worker,start,end);await claimCoverage(f.store,'worker_jamie',r.id,r.input,clock);
 const claim=(await managerDashboard(f.store,'manager_morgan',now)).pendingClaims.find(q=>q.id===r.id);
 return {...r,input:{revision:claim.revision},claim};
}
test('approval persists exactly one transfer, reviewer, timestamps and both worker views',async t=>{
 const f=await fixture(t);const r=await pending(f);assert.equal(r.claim.canApprove,true);assert.equal(r.claim.canReject,true);
 const before=await f.store.read();await reviewCoverage(f.store,'manager_morgan',r.id,'approve',r.input,clock);
 const db=await new JsonStore(f.store.filename).read();const q=db.coverageRequests.find(q=>q.id===r.id);const s=db.shifts.find(s=>s.id===r.shiftId);
 assert.equal(q.status,'approved');assert.equal(q.reviewerId,'manager_morgan');assert.equal(s.assignedWorkerId,'worker_jamie');assert.equal(q.updatedAt,s.updatedAt);assert.deepEqual(db.users,before.users);
 assert.ok((await upcomingWorkerShifts(f.store,'worker_jamie',now)).shifts.some(s=>s.id===r.shiftId));assert.ok(!(await upcomingWorkerShifts(f.store,'worker_alex',now)).shifts.some(s=>s.id===r.shiftId));
 assert.equal((await ownRequests(f.store,'worker_jamie',now)).claims.find(q=>q.id===r.id).assignedToYou,true);assert.equal((await managerDashboard(f.store,'manager_morgan',now)).pendingClaims.some(q=>q.id===r.id),false);
 const raw=await readFile(f.store.filename,'utf8');await assert.rejects(reviewCoverage(f.store,'manager_morgan',r.id,'approve',r.input,clock),status(409));assert.equal(await readFile(f.store.filename,'utf8'),raw);
});
test('rejection retains claimant/reviewer history, reopens with new ID, releases reservation and supports reclaim',async t=>{
 const f=await fixture(t);const r=await pending(f);const before=await f.store.read();await reviewCoverage(f.store,'manager_morgan',r.id,'reject',r.input,clock);
 const db=await f.store.read();assert.equal(db.schemaVersion,3);assert.deepEqual(db.shifts,before.shifts);const rejected=db.coverageRequests.find(q=>q.id===r.id);assert.equal(rejected.status,'rejected');assert.equal(rejected.claimantId,'worker_jamie');assert.equal(rejected.reviewerId,'manager_morgan');
 const open=(await openShiftBoard(f.store,'worker_jamie',now)).requests.find(q=>q.shift.id===r.shiftId);assert.ok(open);assert.notEqual(open.id,r.id);assert.equal((await ownRequests(f.store,'worker_jamie',now)).claims.find(q=>q.id===r.id).status,'rejected');
 await claimCoverage(f.store,'worker_jamie',open.id,{revision:open.revision},clock);assert.equal((await f.store.read()).coverageRequests.filter(q=>q.shiftId===r.shiftId&&q.status==='pending').length,1);
 const invalid=structuredClone(db);invalid.schemaVersion=2;assert.throws(()=>validateDatabase(invalid));
 const added=await addWorker(f.store,'manager_morgan',{name:'New teammate',email:'new@example.test'},now);await reissueSetup(f.store,'manager_morgan',added.worker.id,{},now+1);assert.equal((await f.store.read()).schemaVersion,3);
});
test('fresh assigned and pending conflicts block approval without blocking rejection; adjacency works',async t=>{
 const f=await fixture(t);const r=await pending(f);
 await createShift(f.store,'manager_morgan',{title:'New conflict',assignedWorkerId:'worker_jamie',startLocal:'2026-11-20T16:00',endLocal:'2026-11-20T18:00'},clock);
 const claim=(await managerDashboard(f.store,'manager_morgan',now)).pendingClaims.find(q=>q.id===r.id);assert.equal(claim.canApprove,false);assert.equal(claim.canReject,true);assert.equal(claim.conflicts[0].kind,'assigned');
 const raw=await readFile(f.store.filename,'utf8');await assert.rejects(reviewCoverage(f.store,'manager_morgan',r.id,'approve',r.input,clock),status(409));assert.equal(await readFile(f.store.filename,'utf8'),raw);
 await reviewCoverage(f.store,'manager_morgan',r.id,'reject',r.input,clock);
 const g=await fixture(t);const a=await pending(g);const b=await pending(g,'worker_sam','2026-11-20T17:00','2026-11-20T19:00');await reviewCoverage(g.store,'manager_morgan',a.id,'approve',a.input,clock);await reviewCoverage(g.store,'manager_morgan',b.id,'approve',b.input,clock);
 const h=await fixture(t);const c=await pending(h);await h.store.transaction(db=>{const shift={...db.shifts.find(s=>s.id===c.shiftId),id:'overlap',assignedWorkerId:'worker_sam'};db.shifts.push(shift);db.coverageRequests.push({...db.coverageRequests.find(q=>q.id===c.id),id:'overlap_request',shiftId:'overlap',originalWorkerId:'worker_sam'});});
 await assert.rejects(reviewCoverage(h.store,'manager_morgan',c.id,'approve',c.input,clock),e=>e.status===409&&e.fields.conflicts[0].kind==='pending_claim');
});
test('concurrent approve/reject permits one decision and never duplicates reopening or transfer',async t=>{
 for(const decisions of [['approve','approve'],['reject','reject'],['approve','reject']]){
 const f=await fixture(t);const r=await pending(f);const results=await Promise.allSettled(decisions.map(d=>reviewCoverage(f.store,'manager_morgan',r.id,d,r.input,clock)));assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.find(r=>r.status==='rejected').reason.status,409);
 const db=await f.store.read();assert.equal(db.coverageRequests.filter(q=>q.shiftId===r.shiftId&&q.status==='open').length,decisions[0]==='reject'?1:0);
 }
});
test('scope, role, revision, expiry, cancellation, inactive claimant and input tampering are rechecked',async t=>{
 const f=await fixture(t);const r=await pending(f);await f.store.transaction(db=>db.users.push({...db.users[0],id:'other_manager',businessId:'other',email:'other_manager@example.test'}));const raw=await readFile(f.store.filename,'utf8');
 for(const decision of ['approve','reject']){
 for(const [user,code] of [['worker_jamie',403],['missing',401],['other_manager',404]])await assert.rejects(reviewCoverage(f.store,user,r.id,decision,r.input,clock),status(code));
 for(const extra of [{reviewerId:'worker_jamie'},{status:'approved'},{claimantId:'worker_sam'},{revision:null}])await assert.rejects(reviewCoverage(f.store,'manager_morgan',r.id,decision,{...r.input,...extra},clock),status(422));
 await assert.rejects(reviewCoverage(f.store,'manager_morgan',r.id,decision,{revision:'0'.repeat(64)},clock),status(409));await assert.rejects(reviewCoverage(f.store,'manager_morgan',r.id,decision,r.input,()=>Date.parse('2026-11-20T14:00:00.000Z')),status(409));
 }assert.equal(await readFile(f.store.filename,'utf8'),raw);
 await f.store.transaction(db=>{db.users.find(u=>u.id==='worker_jamie').passwordHash=null;});await assert.rejects(reviewCoverage(f.store,'manager_morgan',r.id,'approve',r.input,clock),status(409));
 const q=(await f.store.read()).coverageRequests.find(q=>q.id===r.id);await cancelCoverage(f.store,'worker_alex',r.id,{revision:requestRevision(q)},clock);await assert.rejects(reviewCoverage(f.store,'manager_morgan',r.id,'reject',r.input,clock),status(409));
});
test('HTTP manager decisions enforce method, session, role, Origin, JSON, CSRF, query and strict body',async t=>{
 const f=await fixture(t);const r=await pending(f);const sessions=new SessionStore();const server=createAppServer({store:f.store,sessions,shiftClock:clock});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));
 const origin=`http://127.0.0.1:${server.address().port}`;const cookie=sessions.create('manager_morgan').cookie.split(';')[0];const worker=sessions.create('worker_jamie').cookie.split(';')[0];const account=await(await fetch(origin+'/api/session',{headers:{Cookie:cookie}})).json();
 const post=(action,body=r.input,headers={},query='')=>fetch(`${origin}/api/manager/requests/${r.id}/${action}${query}`,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',Cookie:cookie,'X-CSRF-Token':account.csrfToken,...headers},body:JSON.stringify(body)});
 for(const action of ['approve','reject']){
 for(const [headers,code] of [[{Cookie:''},401],[{Cookie:worker},403],[{Origin:'https://foreign.test'},403],[{'Content-Type':'text/plain'},415],[{'X-CSRF-Token':''},403],[{'Sec-Fetch-Site':'cross-site'},403]])assert.equal((await post(action,r.input,headers)).status,code);
 assert.equal((await post(action,r.input,{},'?businessId=other')).status,400);assert.equal((await post(action,{...r.input,reviewerId:'other'})).status,422);assert.equal((await fetch(`${origin}/api/manager/requests/${r.id}/${action}`)).status,405);
 }assert.equal((await post('approve')).status,200);assert.equal((await post('reject')).status,409);
});
