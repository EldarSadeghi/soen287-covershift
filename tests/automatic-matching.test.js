import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {randomUUID} from 'node:crypto';
import {JsonStore} from '../src/storage/json-store.js';
import {seedDemo} from '../src/storage/seed.js';
import {validateDatabase} from '../src/storage/model.js';
import {createShift} from '../src/shifts/create.js';
import {requestCoverage,coverageShiftRevision,cancelCoverage,requestRevision} from '../src/requests/coverage.js';
import {confirmAvailability,changeAvailability,listAvailability} from '../src/availability/rules.js';
import {claimCoverage,claimRevision} from '../src/requests/claim.js';
import {reviewCoverage} from '../src/requests/review.js';
import {matchAvailability,reconcileAvailability,withAvailabilityMatching,startAvailabilityMatching} from '../src/availability/matching.js';
import {createAppServer} from '../src/app.js';
import {SessionStore} from '../src/auth/sessions.js';
const now=Date.parse('2026-11-22T16:00:00Z'),clock=()=>now;
const draft={startLocal:'2026-11-26T08:00',endLocal:'2026-11-26T22:00',title:'',maxClaims:1,timezone:'America/Toronto'};
async function fixture(t){
 const dir=await mkdtemp(join(tmpdir(),'covershift-matching-'));t.after(()=>rm(dir,{recursive:true,force:true}));const store=new JsonStore(join(dir,'covershift.json'));await seedDemo(store);await store.transaction(db=>{for(const user of db.users)user.passwordHash='fictional test hash';});
 const active=withAvailabilityMatching(store,clock);
 async function rule(user='worker_jamie',changes={},target=store){return (await confirmAvailability(target,user,{confirmationId:randomUUID(),draft:{...draft,...changes}},clock)).rule;}
 async function opening(worker='worker_alex',start='09:00',end='12:00',title='Opening service',target=store){
  const {shift}=await createShift(target,'manager_morgan',{assignedWorkerId:worker,title,startLocal:'2026-11-26T'+start,endLocal:'2026-11-26T'+end},clock);
  const db=await store.read(),saved=db.shifts.find(s=>s.id===shift.id);const result=await requestCoverage(target,worker,shift.id,{revision:coverageShiftRevision(db,saved)},clock);return result.request.id;
 }
 return {store,active,rule,opening};
}

test('earliest confirmed eligible rule wins existing opening; pending claim and ledger commit together without assignment',async t=>{
 const f=await fixture(t),requestId=await f.opening();const first=await f.rule('worker_sam'),second=await f.rule('worker_jamie');
 const before=await f.store.read();assert.equal(await reconcileAvailability(f.store,clock),1);const db=await f.store.read();
 assert.equal(db.schemaVersion,8);assert.equal(db.availabilityMatches.length,1);assert.equal(db.availabilityMatches[0].ruleId,first.id);assert.equal(db.coverageRequests.find(r=>r.id===requestId).claimantId,'worker_sam');assert.equal(db.coverageRequests.find(r=>r.id===requestId).status,'pending');assert.deepEqual(db.shifts,before.shifts);
 const saved=(await listAvailability(f.store,'worker_sam',clock)).rules[0];assert.equal(saved.usedClaims,1);assert.equal(saved.remainingClaims,0);assert.equal(saved.matches[0].status,'pending');assert.equal((await listAvailability(f.store,'worker_jamie',clock)).rules[0].usedClaims,0);assert.notEqual(saved.revision,first.revision);assert.equal(second.maxClaims,1);
});
test('new opening and newly confirmed/resumed rule trigger matching as part of saved mutation',async t=>{
 const f=await fixture(t);await f.rule('worker_jamie',{},f.active);const id=await f.opening('worker_alex','09:00','12:00','Opening service',f.active);assert.equal((await f.store.read()).coverageRequests.find(r=>r.id===id).status,'pending');
 const other=await f.opening('worker_sam','14:00','17:00','Later service',f.active);const paused=await f.rule('worker_taylor',{startLocal:'2026-11-26T14:00',endLocal:'2026-11-26T17:00'});await changeAvailability(f.store,'worker_taylor',paused.id,'pause',{revision:paused.revision},clock);await reconcileAvailability(f.store,clock);assert.equal((await f.store.read()).coverageRequests.find(r=>r.id===other).status,'open');
 const current=(await listAvailability(f.store,'worker_taylor',clock)).rules[0];await changeAvailability(f.active,'worker_taylor',current.id,'resume',{revision:current.revision},clock);assert.equal((await f.store.read()).coverageRequests.find(r=>r.id===other).claimantId,'worker_taylor');
});
test('paused/cancelled/expired/wrong timezone/own/foreign/inactive rules never win',async t=>{
 const f=await fixture(t);const id=await f.opening();
 const paused=await f.rule();await changeAvailability(f.store,'worker_jamie',paused.id,'pause',{revision:paused.revision},clock);
 const cancelled=await f.rule('worker_sam');await changeAvailability(f.store,'worker_sam',cancelled.id,'cancel',{revision:cancelled.revision},clock);
 await f.rule('worker_alex');await f.rule('worker_taylor',{timezone:'America/Toronto'});
 await f.store.transaction(db=>{db.users.find(u=>u.id==='worker_taylor').passwordHash=null;});assert.equal(await reconcileAvailability(f.store,clock),0);
 await f.store.transaction(db=>{db.businesses[0].timezone='America/Vancouver';});assert.equal(await reconcileAvailability(f.store,clock),0);
 const ended=()=>Date.parse('2026-11-27T12:00:00Z');assert.equal(await reconcileAvailability(f.store,ended),0);assert.equal((await f.store.read()).coverageRequests.find(r=>r.id===id).status,'open');
 await f.store.transaction(db=>{db.businesses.push({...db.businesses[0],id:'foreign',timezone:'America/Toronto'});db.users.push({...db.users[1],id:'foreign_worker',businessId:'foreign',email:'foreign@example.test'});});await f.rule('foreign_worker');assert.equal(await reconcileAvailability(f.store,clock),0);
});
test('exact full window/title and assigned conflicts are enforced; next eligible worker can win',async t=>{
 const f=await fixture(t),id=await f.opening();await f.rule('worker_jamie',{startLocal:'2026-11-26T10:00'});await f.rule('worker_sam',{title:'Night'});
 await f.rule('worker_taylor');await createShift(f.store,'manager_morgan',{assignedWorkerId:'worker_taylor',title:'My work',startLocal:'2026-11-26T11:00',endLocal:'2026-11-26T13:00'},clock);
 assert.equal(await reconcileAvailability(f.store,clock),0);const valid=await f.rule('worker_jamie',{title:'OPENING',startLocal:'2026-11-26T09:00',endLocal:'2026-11-26T12:00'});assert.equal(await reconcileAvailability(f.store,clock),1);assert.equal((await f.store.read()).availabilityMatches[0].ruleId,valid.id);assert.equal((await f.store.read()).coverageRequests.find(r=>r.id===id).claimantId,'worker_jamie');
});
test('overlapping automatic claims cannot both succeed; adjacent shifts can fill bounded capacity',async t=>{
 const f=await fixture(t);await f.opening();await f.opening('worker_sam','11:00','13:00');await f.opening('worker_alex','12:00','15:00');await f.rule('worker_jamie',{maxClaims:2});
 assert.equal(await reconcileAvailability(f.store,clock),2);const db=await f.store.read();assert.equal(db.availabilityMatches.length,2);assert.equal(db.coverageRequests.filter(r=>r.claimantId==='worker_jamie').length,2);assert.equal((await listAvailability(f.store,'worker_jamie',clock)).rules[0].remainingClaims,0);
});
test('concurrent reconciliation, manual claim and process reopening never duplicate or overspend',async t=>{
 const f=await fixture(t);const id=await f.opening();await f.opening('worker_alex','14:00','17:00');await f.rule('worker_jamie');const before=await f.store.read();const request=before.coverageRequests.find(r=>r.id===id),shift=before.shifts.find(s=>s.id===request.shiftId);
 await Promise.allSettled([reconcileAvailability(f.store,clock),reconcileAvailability(new JsonStore(f.store.filename),clock),claimCoverage(f.active,'worker_sam',id,{revision:claimRevision(request,shift)},clock)]);
 const db=await f.store.read();assert.equal(db.availabilityMatches.length,1);assert.equal(new Set(db.availabilityMatches.map(m=>m.requestId)).size,1);assert.ok(db.coverageRequests.filter(r=>r.id===id&&r.status==='pending').length===1);assert.equal(await reconcileAvailability(new JsonStore(f.store.filename),clock),0);
});
test('manager rejection tries next worker without repeating the rejected employee, even through overlapping rules',async t=>{
 const f=await fixture(t),id=await f.opening();await f.rule('worker_jamie',{maxClaims:2});await f.rule('worker_jamie',{maxClaims:2});await f.rule('worker_taylor');await reconcileAvailability(f.store,clock);
 const db=await f.store.read(),request=db.coverageRequests.find(r=>r.id===id),shift=db.shifts.find(s=>s.id===request.shiftId);
 await reviewCoverage(f.active,'manager_morgan',id,'reject',{revision:claimRevision(request,shift)},clock);
 const after=await f.store.read();assert.equal(after.coverageRequests.find(r=>r.id===id).status,'rejected');const reopened=after.coverageRequests.find(r=>r.shiftId===shift.id&&r.status==='pending');assert.equal(reopened.claimantId,'worker_taylor');assert.equal(after.availabilityMatches.length,2);assert.equal(after.shifts.find(s=>s.id===shift.id).assignedWorkerId,'worker_alex');
 await reconcileAvailability(f.store,clock);assert.equal((await f.store.read()).availabilityMatches.length,2);
});
test('approval alone transfers assignment; cancel/pause do not withdraw an already submitted request',async t=>{
 const f=await fixture(t),id=await f.opening();await f.rule('worker_jamie');await reconcileAvailability(f.store,clock);const rule=(await listAvailability(f.store,'worker_jamie',clock)).rules[0];await changeAvailability(f.active,'worker_jamie',rule.id,'cancel',{revision:rule.revision},clock);
 const db=await f.store.read(),request=db.coverageRequests.find(r=>r.id===id),shift=db.shifts.find(s=>s.id===request.shiftId);assert.equal(request.status,'pending');await reviewCoverage(f.active,'manager_morgan',id,'approve',{revision:claimRevision(request,shift)},clock);const after=await f.store.read();assert.equal(after.shifts.find(s=>s.id===shift.id).assignedWorkerId,'worker_jamie');assert.equal((await listAvailability(f.store,'worker_jamie',clock)).rules[0].matches[0].status,'approved');
});
test('original-worker cancellation consumes successful attempt and reopening same shift cannot re-request that worker',async t=>{
 const f=await fixture(t),id=await f.opening();await f.rule('worker_jamie',{maxClaims:2});await reconcileAvailability(f.store,clock);let db=await f.store.read();let request=db.coverageRequests.find(r=>r.id===id);await cancelCoverage(f.active,'worker_alex',id,{revision:requestRevision(request)},clock);
 db=await f.store.read();const shift=db.shifts.find(s=>s.id===request.shiftId);await requestCoverage(f.active,'worker_alex',shift.id,{revision:coverageShiftRevision(db,shift)},clock);db=await f.store.read();assert.equal(db.availabilityMatches.length,1);assert.ok(db.coverageRequests.some(r=>r.shiftId===shift.id&&r.status==='open'));assert.equal((await listAvailability(f.store,'worker_jamie',clock)).rules[0].usedClaims,1);
});
test('exact-start expiry prevents matching and invalid ledger changes fail closed without partial writes',async t=>{
 const f=await fixture(t),id=await f.opening();await f.rule();const boundary=()=>Date.parse('2026-11-26T14:00:00Z');assert.equal(await reconcileAvailability(f.store,boundary),0);await reconcileAvailability(f.store,clock);const before=await readFile(f.store.filename,'utf8');
 await assert.rejects(f.store.transaction(db=>{db.availabilityMatches.push({...db.availabilityMatches[0],id:randomUUID()});}));assert.equal(await readFile(f.store.filename,'utf8'),before);
 const db=await f.store.read();for(const field of ['workerId','ruleId','requestId','shiftId']){const bad=structuredClone(db);bad.availabilityMatches[0][field]='foreign';assert.throws(()=>validateDatabase(bad));}
 assert.equal(db.coverageRequests.find(r=>r.id===id).status,'pending');
});
test('failed mutations roll back matching and no-match reconciliation does not rewrite storage',async t=>{
 const f=await fixture(t);await f.rule();const before=await readFile(f.store.filename,'utf8');assert.equal(await reconcileAvailability(f.store,clock),0);assert.equal(await readFile(f.store.filename,'utf8'),before);
 await assert.rejects(f.active.transaction(db=>{db.coverageRequests=[];throw Error('abort');}));assert.equal(await readFile(f.store.filename,'utf8'),before);
});
test('reconciliation worker prevents overlap, reports sanitized failure and can be stopped',async()=>{
 let release;let reads=0,errors=0;const store={read:async()=>{reads++;await new Promise(r=>release=r);throw Error('private details');}};
 const worker=startAvailabilityMatching(store,{intervalMs:60000,onError:()=>errors++});const first=worker.run();await worker.run();assert.equal(reads,1);release();await first;assert.equal(errors,1);worker.stop();await worker.run();assert.equal(reads,1);
});
test('HTTP confirmation matches existing openings atomically and exposes only the signed-in employee ledger',async t=>{
 const f=await fixture(t);await f.opening();const sessions=new SessionStore(),server=createAppServer({store:f.store,sessions,shiftClock:clock});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>{server.close(r);server.closeAllConnections();}));const origin=`http://127.0.0.1:${server.address().port}`;
 const cookie=sessions.create('worker_jamie').cookie.split(';')[0],other=sessions.create('worker_sam').cookie.split(';')[0];const session=await(await fetch(origin+'/api/session',{headers:{Cookie:cookie}})).json();
 const response=await fetch(origin+'/api/worker/availability-rules',{method:'POST',headers:{Cookie:cookie,Origin:origin,'Content-Type':'application/json','X-CSRF-Token':session.csrfToken},body:JSON.stringify({confirmationId:randomUUID(),draft})});assert.equal(response.status,200);
 const list=await(await fetch(origin+'/api/worker/availability-rules',{headers:{Cookie:cookie}})).json();assert.equal(list.matchingEnabled,true);assert.equal(list.rules[0].usedClaims,1);assert.equal(list.rules[0].matches[0].status,'pending');
 const otherList=await(await fetch(origin+'/api/worker/availability-rules',{headers:{Cookie:other}})).json();assert.equal(otherList.rules.length,0);assert.doesNotMatch(JSON.stringify(otherList),/Opening service|requestId/);
});

test('pending manual commitment blocks automatic matching until manager rejection releases the time',async t=>{
 const f=await fixture(t);const manual=await f.opening('worker_sam','10:00','13:00','Manual'),candidate=await f.opening('worker_alex','09:00','12:00','Candidate');
 let db=await f.store.read();let request=db.coverageRequests.find(r=>r.id===manual),shift=db.shifts.find(s=>s.id===request.shiftId);await claimCoverage(f.store,'worker_jamie',manual,{revision:claimRevision(request,shift)},clock);await f.rule('worker_jamie');assert.equal(await reconcileAvailability(f.store,clock),0);
 db=await f.store.read();request=db.coverageRequests.find(r=>r.id===manual);shift=db.shifts.find(s=>s.id===request.shiftId);await reviewCoverage(f.active,'manager_morgan',manual,'reject',{revision:claimRevision(request,shift)},clock);db=await f.store.read();assert.equal(db.coverageRequests.find(r=>r.id===candidate).claimantId,'worker_jamie');assert.equal(db.availabilityMatches.length,1);
});
test('periodic reconciliation matches a persisted opening without another browser action',async t=>{
 const f=await fixture(t);await f.opening();await f.rule();const worker=startAvailabilityMatching(f.store,{clock,intervalMs:10});t.after(()=>worker.stop());
 const deadline=Date.now()+2000;let db;
 do {await new Promise(r=>setTimeout(r,10));db=await f.store.read();}while(!db.availabilityMatches?.length&&Date.now()<deadline);
 worker.stop();assert.equal(db.availabilityMatches.length,1);
});
