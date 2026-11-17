import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { JsonStore } from '../src/storage/json-store.js';
import { seedDemo } from '../src/storage/seed.js';
import { validateDatabase } from '../src/storage/model.js';
import { removeWorker, workerRemovalState } from '../src/manager/offboarding.js';
import { listWorkers, addWorker, reissueSetup, setupDetails, completeSetup } from '../src/manager/workers.js';
import { createShift } from '../src/shifts/create.js';
import { coverageShiftRevision, requestCoverage } from '../src/requests/coverage.js';
import { claimRevision, claimCoverage } from '../src/requests/claim.js';
import { coverageHistory } from '../src/requests/history.js';
import { SessionStore, requireAccount } from '../src/auth/sessions.js';
import { createAppServer } from '../src/app.js';
import { enableDemoAccounts } from '../src/auth/demo-accounts.js';
import { authenticate } from '../src/auth/login.js';
const now=Date.parse('2026-11-17T15:00:00.000Z');const clock=()=>now;const status=n=>e=>e.status===n;
async function fixture(t){const dir=await mkdtemp(join(tmpdir(),'covershift-offboarding-'));t.after(()=>rm(dir,{recursive:true,force:true}));const store=new JsonStore(join(dir,'covershift.json'));await seedDemo(store);await store.transaction(db=>{for(const u of db.users)u.passwordHash='test hash';db.businesses.push({...db.businesses[0],id:'other'});db.users.push({...db.users[0],id:'other_manager',businessId:'other',email:'other@example.test'});});return store;}
async function revision(store,id){const db=await store.read();return {revision:workerRemovalState(db,db.users.find(u=>u.id===id),now).revision};}
async function add(store){return addWorker(store,'manager_morgan',{name:'Unused Employee',email:'unused@example.test'},now);}
test('delete unused employee persists and invalidates setup while referenced employees cannot be deleted',async t=>{
 const store=await fixture(t);const fresh=await add(store);await removeWorker(store,'manager_morgan',fresh.worker.id,'delete',await revision(store,fresh.worker.id),clock);assert.ok(!(await new JsonStore(store.filename).read()).users.some(u=>u.id===fresh.worker.id));await assert.rejects(setupDetails(store,{token:fresh.setupToken},now),status(400));
 const raw=await readFile(store.filename,'utf8');for(const id of ['worker_jamie','worker_taylor'])await assert.rejects(removeWorker(store,'manager_morgan',id,'delete',await revision(store,id),clock),status(409));assert.equal(await readFile(store.filename,'utf8'),raw);
});
test('deactivate retains past work/history, blocks login/session/setup and new assignment, and survives worker setup schema writes',async t=>{
 const store=await fixture(t);const sessions=new SessionStore();const cookie=sessions.create('worker_jamie').cookie.split(';')[0];const before=await store.read();await removeWorker(store,'manager_morgan','worker_jamie','deactivate',await revision(store,'worker_jamie'),clock);const db=await new JsonStore(store.filename).read();const user=db.users.find(u=>u.id==='worker_jamie');assert.equal(db.schemaVersion,5);assert.equal(user.passwordHash,null);assert.deepEqual(user.deactivation,{at:new Date(now).toISOString(),managerId:'manager_morgan'});assert.deepEqual(db.shifts,before.shifts);assert.deepEqual(db.coverageRequests,before.coverageRequests);
 await assert.rejects(requireAccount(store,sessions,cookie,'worker'),status(401));await assert.rejects(authenticate(store,{email:user.email,password:'unused'},{verify:async(p,h)=>h==='test hash'}),status(401));await assert.rejects(reissueSetup(store,'manager_morgan',user.id,{},now),status(409));await assert.rejects(createShift(store,'manager_morgan',{title:'Blocked assignment',assignedWorkerId:user.id,startLocal:'2026-11-20T09:00',endLocal:'2026-11-20T14:00'},clock),status(422));
 await enableDemoAccounts(store,'Fictional demo verification passphrase!');assert.equal((await store.read()).users.find(u=>u.id==='worker_jamie').passwordHash,null);
 const fresh=await add(store);const old=await revision(store,fresh.worker.id);await reissueSetup(store,'manager_morgan',fresh.worker.id,{},now);await assert.rejects(removeWorker(store,'manager_morgan',fresh.worker.id,'delete',old,clock),status(409));assert.equal((await store.read()).schemaVersion,5);assert.equal((await listWorkers(store,'manager_morgan',now)).workers.find(w=>w.id===user.id).status,'inactive');assert.ok((await coverageHistory(store,'manager_morgan','manager',now)).records.length);
});
test('deactivation removes pending setup token, including completion racing password derivation',async t=>{
 const store=await fixture(t);const fresh=await add(store);const result=completeSetup(store,{token:fresh.setupToken,password:'Fictional pending setup passphrase!'},{clock,hash:async()=>{await removeWorker(store,'manager_morgan',fresh.worker.id,'deactivate',await revision(store,fresh.worker.id),clock);return 'test hash';}});await assert.rejects(result,status(400));await assert.rejects(setupDetails(store,{token:fresh.setupToken},now),status(400));assert.ok(!(await store.read()).users.find(u=>u.id===fresh.worker.id).setup);
});
test('current/future assignment and future pending claim block deactivation with concrete items',async t=>{
 const store=await fixture(t);const {shift}=await createShift(store,'manager_morgan',{title:'Future coverage',assignedWorkerId:'worker_alex',startLocal:'2026-11-20T09:00',endLocal:'2026-11-20T14:00'},clock);let db=await store.read();const s=db.shifts.find(s=>s.id===shift.id);const {request}=await requestCoverage(store,'worker_alex',s.id,{revision:coverageShiftRevision(db,s)},clock);db=await store.read();await claimCoverage(store,'worker_jamie',request.id,{revision:claimRevision(db.coverageRequests.find(r=>r.id===request.id),s)},clock);
 for(const [id,kind] of [['worker_alex','assignment'],['worker_jamie','pending_claim']]){const state=(await listWorkers(store,'manager_morgan',now)).workers.find(w=>w.id===id);assert.equal(state.canDeactivate,false);assert.equal(state.blockers[0].kind,kind);assert.equal(state.blockers[0].title,'Future coverage');await assert.rejects(removeWorker(store,'manager_morgan',id,'deactivate',{revision:state.revision},clock),status(409));}
});
test('stale revisions and concurrent assignment/removal cannot leave orphaned shifts or repeated deactivation',async t=>{
 const store=await fixture(t);const fresh=await add(store);const input=await revision(store,fresh.worker.id);const results=await Promise.allSettled([removeWorker(store,'manager_morgan',fresh.worker.id,'delete',input,clock),createShift(store,'manager_morgan',{title:'Race',assignedWorkerId:fresh.worker.id,startLocal:'2026-11-20T09:00',endLocal:'2026-11-20T14:00'},clock)]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);validateDatabase(await store.read());
 const input2=await revision(store,'worker_taylor');const races=await Promise.allSettled([removeWorker(store,'manager_morgan','worker_taylor','deactivate',input2,clock),removeWorker(store,'manager_morgan','worker_taylor','deactivate',input2,clock)]);assert.equal(races.filter(r=>r.status==='fulfilled').length,1);
});
test('scope, roles, strict input and schema deactivation metadata refuse tampering without writes',async t=>{
 const store=await fixture(t);const fresh=await add(store);const input=await revision(store,fresh.worker.id);const raw=await readFile(store.filename,'utf8');for(const [user,code]of[['other_manager',404],['worker_jamie',403],['missing',401]])await assert.rejects(removeWorker(store,user,fresh.worker.id,'delete',input,clock),status(code));for(const extra of [{businessId:'other'},{managerId:'other_manager'},{revision:null}])await assert.rejects(removeWorker(store,'manager_morgan',fresh.worker.id,'deactivate',{...input,...extra},clock),status(422));await assert.rejects(removeWorker(store,'manager_morgan',fresh.worker.id,'delete',{revision:'0'.repeat(64)},clock),status(409));await assert.rejects(removeWorker(store,'manager_morgan','manager_morgan','delete',input,clock),status(404));assert.equal(await readFile(store.filename,'utf8'),raw);
 await removeWorker(store,'manager_morgan',fresh.worker.id,'deactivate',input,clock);const db=await store.read();for(const mutate of [u=>u.passwordHash='test hash',u=>u.deactivation.managerId='other_manager',u=>u.deactivation.at='invalid',u=>u.setup={tokenHash:'a'.repeat(64),expiresAt:new Date(now).toISOString()}]){const draft=structuredClone(db);mutate(draft.users.find(u=>u.id===fresh.worker.id));assert.throws(()=>validateDatabase(draft));}
});
test('HTTP removal protects session/role/Origin/JSON/CSRF/query/method, and existing worker session is revoked',async t=>{
 const store=await fixture(t);const sessions=new SessionStore();const server=createAppServer({store,sessions,setupClock:clock});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));const origin=`http://127.0.0.1:${server.address().port}`;const cookie=sessions.create('manager_morgan').cookie.split(';')[0];const worker=sessions.create('worker_jamie').cookie.split(';')[0];const account=await(await fetch(origin+'/api/session',{headers:{Cookie:cookie}})).json();const input=await revision(store,'worker_jamie');
 const post=(action,headers={},query='')=>fetch(origin+`/api/manager/workers/worker_jamie/${action}`+query,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',Cookie:cookie,'X-CSRF-Token':account.csrfToken,...headers},body:JSON.stringify(input)});
 for(const action of ['delete','deactivate']){for(const [headers,code]of[[{Cookie:''},401],[{Cookie:worker},403],[{Origin:'https://foreign.test'},403],[{'Content-Type':'text/plain'},415],[{'X-CSRF-Token':''},403]])assert.equal((await post(action,headers)).status,code);assert.equal((await post(action,{},'?businessId=other')).status,400);assert.equal((await fetch(origin+`/api/manager/workers/worker_jamie/${action}`)).status,405);}
 assert.equal((await post('deactivate')).status,200);assert.equal((await fetch(origin+'/api/worker/shifts',{headers:{Cookie:worker}})).status,401);
});
