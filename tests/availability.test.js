import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,rm,readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { JsonStore } from '../src/storage/json-store.js';
import { seedDemo } from '../src/storage/seed.js';
import { validateDatabase } from '../src/storage/model.js';
import { confirmAvailability,listAvailability,changeAvailability,availabilityFields } from '../src/availability/rules.js';
import { createAiAvailabilityDrafter } from '../src/ai/availability-draft.js';
import { AiAllowance } from '../src/ai/allowance.js';
import { removeWorker,workerRemovalState } from '../src/manager/offboarding.js';
import { createAppServer } from '../src/app.js';
import { SessionStore } from '../src/auth/sessions.js';
const now=Date.parse('2026-11-22T16:00:00Z'),clock=()=>now;
const draft={startLocal:'2026-11-26T09:00',endLocal:'2026-11-26T17:00',title:'',maxClaims:1,timezone:'America/Toronto'};
const status=n=>e=>e.status===n;
const reply=value=>new Response(JSON.stringify({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(value)}]}]}));
async function fixture(t){const dir=await mkdtemp(join(tmpdir(),'covershift-availability-'));t.after(()=>rm(dir,{recursive:true,force:true}));const store=new JsonStore(join(dir,'covershift.json'));await seedDemo(store);await store.transaction(db=>{for(const user of db.users)user.passwordHash='fictional test hash';});return {store,dir};}
const confirm=(store,worker='worker_jamie',changes={},confirmationId=randomUUID())=>confirmAvailability(store,worker,{confirmationId,draft:{...draft,...changes}},clock);

test('confirmation upgrades legacy storage without touching business/users/shifts/coverage, scopes listing and survives reopen',async t=>{
 const {store}=await fixture(t);const before=await store.read();const result=await confirm(store);
 const db=await new JsonStore(store.filename).read();assert.equal(db.schemaVersion,6);for(const key of ['businesses','users','shifts','coverageRequests'])assert.deepEqual(db[key],before[key]);
 assert.equal(db.availabilityRules.length,1);assert.equal(result.rule.workerId,'worker_jamie');assert.equal(result.rule.status,'active');assert.equal(result.matchingEnabled,true);assert.equal(result.rule.startsAt,'2026-11-26T14:00:00.000Z');assert.equal(result.rule.confirmedAt,result.rule.createdAt);
 assert.equal((await listAvailability(store,'worker_jamie',clock)).rules.length,1);assert.equal((await listAvailability(store,'worker_alex',clock)).rules.length,0);
});
test('same confirmation is idempotent even concurrently and after cancellation; changed payload cannot reuse it',async t=>{
 const {store}=await fixture(t);const id=randomUUID();const [a,b]=await Promise.all([confirm(store,'worker_jamie',{},id),confirm(store,'worker_jamie',{},id)]);assert.equal(a.rule.id,b.rule.id);assert.equal((await store.read()).availabilityRules.length,1);
 const cancelled=await changeAvailability(store,'worker_jamie',a.rule.id,'cancel',{revision:a.rule.revision},clock);assert.equal(cancelled.rule.status,'cancelled');
 assert.equal((await confirm(store,'worker_jamie',{},id)).rule.status,'cancelled');await assert.rejects(confirm(store,'worker_jamie',{maxClaims:2},id),status(409));
});
test('separate concurrent confirmations have stable server order, bounded counts and scoped nonces',async t=>{
 const {store}=await fixture(t);const id=randomUUID();await Promise.all([confirm(store,'worker_jamie',{},id),confirm(store,'worker_alex',{},id),confirm(store)]);const db=await store.read();assert.equal(new Set(db.availabilityRules.map(r=>r.confirmedAt)).size,3);assert.ok(db.availabilityRules.every(r=>r.maxClaims===1));
});
test('pause/resume/cancel use current revisions; stale writes, foreign worker/manager and ended rules fail closed',async t=>{
 const {store}=await fixture(t);const {rule}=await confirm(store);const paused=await changeAvailability(store,'worker_jamie',rule.id,'pause',{revision:rule.revision},clock);assert.equal(paused.rule.status,'paused');
 await assert.rejects(changeAvailability(store,'worker_jamie',rule.id,'resume',{revision:rule.revision},clock),status(409));
 for(const [user,code] of [['worker_alex',404],['manager_morgan',403],['missing',401]])await assert.rejects(changeAvailability(store,user,rule.id,'cancel',{revision:paused.rule.revision},clock),status(code));
 const resumed=await changeAvailability(store,'worker_jamie',rule.id,'resume',{revision:paused.rule.revision},clock);assert.equal(resumed.rule.status,'active');
 const ended=()=>Date.parse(resumed.rule.endsAt);assert.equal((await listAvailability(store,'worker_jamie',ended)).rules[0].status,'expired');
 const raw=await readFile(store.filename,'utf8');await assert.rejects(changeAvailability(store,'worker_jamie',rule.id,'pause',{revision:resumed.rule.revision},ended),status(409));assert.equal(await readFile(store.filename,'utf8'),raw);
 const cancelled=await changeAvailability(store,'worker_jamie',rule.id,'cancel',{revision:resumed.rule.revision},clock);await assert.rejects(changeAvailability(store,'worker_jamie',rule.id,'resume',{revision:cancelled.rule.revision},clock),status(409));
});
test('strict dates, future horizon, DST, overnight, limits and ownership overrides are checked before writes',async t=>{
 const {store}=await fixture(t);const raw=await readFile(store.filename,'utf8');
 for(const changes of [{startLocal:'2026-11-21T09:00'},{startLocal:'2027-03-14T02:30',endLocal:'2027-03-14T04:00'},{startLocal:'2027-02-30T09:00'},{endLocal:'2026-11-26T08:00'},{endLocal:'2026-11-28T01:00'},{maxClaims:0},{maxClaims:6},{maxClaims:1.5},{timezone:'UTC'},{workerId:'worker_alex'},{title:'x'.repeat(101)}])await assert.rejects(confirm(store,'worker_jamie',changes),status(422));
 assert.equal(await readFile(store.filename,'utf8'),raw);
 const result=await confirm(store,'worker_jamie',{startLocal:'2026-11-26T22:00',endLocal:'2026-11-27T06:00',maxClaims:2});assert.equal(result.rule.endsAt,'2026-11-27T11:00:00.000Z');
 assert.throws(()=>availabilityFields({...draft,startLocal:'2027-11-07T01:30',endLocal:'2027-11-07T04:00'},draft.timezone,now),status(422));
});
test('rule history prevents hard deletion; deactivation cancels rules atomically and invalidates stale Team revision',async t=>{
 const {store}=await fixture(t);const before=await store.read();const taylor=before.users.find(u=>u.id==='worker_taylor');const old=workerRemovalState(before,taylor,now);await confirm(store,'worker_taylor');
 await assert.rejects(removeWorker(store,'manager_morgan',taylor.id,'deactivate',{revision:old.revision},clock),status(409));
 const db=await store.read();const state=workerRemovalState(db,db.users.find(u=>u.id===taylor.id),now);assert.equal(state.canDelete,false);assert.equal(state.canDeactivate,true);
 await removeWorker(store,'manager_morgan',taylor.id,'deactivate',{revision:state.revision},clock);assert.equal((await store.read()).availabilityRules[0].status,'cancelled');await assert.rejects(listAvailability(store,taylor.id,clock),status(401));
});
test('schema rejects corrupt rule fields, references, nonce/order duplicates and inactive actionable rules',async t=>{
 const {store}=await fixture(t);await confirm(store);const db=await store.read();
 for(const mutation of [r=>r.maxClaims=6,r=>r.workerId='manager_morgan',r=>r.businessId='foreign',r=>r.status='enabled',r=>r.title=' bad ',r=>r.timezone='Unknown/Zone',r=>r.extra=true,r=>r.updatedAt='bad']){const copy=structuredClone(db);mutation(copy.availabilityRules[0]);assert.throws(()=>validateDatabase(copy));}
 const duplicate=structuredClone(db);duplicate.availabilityRules.push({...duplicate.availabilityRules[0],id:randomUUID()});assert.throws(()=>validateDatabase(duplicate));
});
test('AI produces a read-only minimized strict draft, supports follow-up clarification and rechecks current membership',async t=>{
 const {store,dir}=await fixture(t);const allowance=new AiAllowance(join(dir,'usage'));let payload;
 const parsed={kind:'availability',question:'',startLocal:draft.startLocal,endLocal:draft.endLocal,title:'',maxClaims:1};
 const make=(fetchImpl,extra={})=>createAiAvailabilityDrafter({apiKey:'test-secret',allowance,fetchImpl,...extra});
 const before=await readFile(store.filename,'utf8');const result=await make(async(_,init)=>{payload=JSON.parse(init.body);return reply(parsed);})(store,'worker_jamie',{description:'I can take one shift Thursday, 9 AM to 5 PM'},clock);
 assert.equal(result.kind,'availability');assert.deepEqual(result.draft,draft);assert.equal(await readFile(store.filename,'utf8'),before);assert.equal(payload.store,false);assert.equal(payload.text.format.strict,true);assert.equal(payload.tools,undefined);assert.doesNotMatch(payload.input,/worker_jamie|business_demo|passwordHash|Jamie Lee|@example/);
 const clarification={kind:'clarification',question:'Which date?',startLocal:'',endLocal:'',title:'',maxClaims:0};const history=[{role:'user',text:'I am available'},{role:'assistant',text:'Which date?'}];
 const answer=await make(async(_,init)=>{assert.deepEqual(JSON.parse(JSON.parse(init.body).input).conversation,history);return reply(clarification);})(store,'worker_jamie',{description:'Thursday',history},clock);assert.equal(answer.kind,'clarification');
 for(const value of [{...parsed,kind:'save'},{...parsed,maxClaims:99},{...clarification,title:'injected'},{...parsed,workerId:'worker_alex'}])await assert.rejects(make(async()=>reply(value))(store,'worker_jamie',{description:'yes'},clock),e=>[422,503].includes(e.status));
 await assert.rejects(make(async()=>{await store.transaction(db=>db.users.find(u=>u.id==='worker_jamie').passwordHash=null);return reply(parsed);})(store,'worker_jamie',{description:'x'},clock),status(401));
});
test('AI errors and missing configuration never save rules; persistent allowance is enforced',async t=>{
 const {store,dir}=await fixture(t);let calls=0;const allowance=new AiAllowance(join(dir,'one'),{total:1});const make=extra=>createAiAvailabilityDrafter({apiKey:'test-secret',allowance,fetchImpl:async()=>{calls++;throw Error('test-secret');},...extra});
 await assert.rejects(make({apiKey:''})(store,'worker_jamie',{description:'x'},clock),status(503));assert.equal(calls,0);
 await assert.rejects(make({})(store,'worker_jamie',{description:'x'},clock),e=>e.status===503&&!e.message.includes('test-secret'));await assert.rejects(make({})(store,'worker_jamie',{description:'x'},clock),status(429));assert.equal(calls,1);assert.equal((await store.read()).availabilityRules,undefined);
});
test('HTTP list/draft/confirm/change protect roles, Origin, CSRF, content type and scope',async t=>{
 const {store}=await fixture(t);const sessions=new SessionStore();let calls=0;
 const server=createAppServer({store,sessions,shiftClock:clock,aiAvailability:async()=>{calls++;return {kind:'clarification',question:'Which date?'};}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>{server.close(r);server.closeAllConnections();}));const origin=`http://127.0.0.1:${server.address().port}`;
 const cookie=sessions.create('worker_jamie').cookie.split(';')[0],manager=sessions.create('manager_morgan').cookie.split(';')[0];const session=await(await fetch(origin+'/api/session',{headers:{Cookie:cookie}})).json();
 const post=(path,body,extra={})=>fetch(origin+path,{method:'POST',headers:{Cookie:cookie,Origin:origin,'Content-Type':'application/json','X-CSRF-Token':session.csrfToken,...extra},body:JSON.stringify(body)});
 for(const path of ['/api/worker/availability-rules','/api/worker/ai-availability-draft']){
  for(const [headers,code]of [[{Cookie:''},401],[{Cookie:manager},403],[{Origin:'https://evil.test'},403],[{'X-CSRF-Token':''},403],[{'Content-Type':'text/plain'},415]])assert.equal((await post(path,{},headers)).status,code);
  assert.equal((await post(path+'?workerId=worker_alex',{})).status,400);
 }
 assert.equal(calls,0);assert.equal((await post('/api/worker/ai-availability-draft',{description:'x'})).status,200);assert.equal(calls,1);
 const saved=await(await post('/api/worker/availability-rules',{confirmationId:randomUUID(),draft})).json();assert.equal(saved.rule.status,'active');
 assert.equal((await post(`/api/worker/availability-rules/${saved.rule.id}/pause`,{revision:saved.rule.revision})).status,200);
 assert.equal((await fetch(origin+'/api/worker/availability-rules',{headers:{Cookie:manager}})).status,403);
 const list=await(await fetch(origin+'/api/worker/availability-rules',{headers:{Cookie:cookie}})).json();assert.equal(list.rules[0].status,'paused');
});

test('current rule cap is enforced; cancellation releases capacity and changed timezone blocks resume',async t=>{
 const {store}=await fixture(t);for(let i=0;i<20;i++)await confirm(store);await assert.rejects(confirm(store),status(409));
 const first=(await listAvailability(store,'worker_jamie',clock)).rules[0];await changeAvailability(store,'worker_jamie',first.id,'cancel',{revision:first.revision},clock);await confirm(store);
 const rule=(await listAvailability(store,'worker_jamie',clock)).rules.find(r=>r.status==='active');const paused=await changeAvailability(store,'worker_jamie',rule.id,'pause',{revision:rule.revision},clock);
 await store.transaction(db=>{db.businesses[0].timezone='America/Vancouver';});await assert.rejects(changeAvailability(store,'worker_jamie',rule.id,'resume',{revision:paused.rule.revision},clock),status(409));
});

test('expired confirmation can be reconciled idempotently without reactivating it and cross-business lists remain private',async t=>{
 const {store}=await fixture(t);const confirmationId=randomUUID();const saved=await confirm(store,'worker_jamie',{},confirmationId);
 const expired=()=>Date.parse(saved.rule.endsAt);const repeated=await confirmAvailability(store,'worker_jamie',{confirmationId,draft},expired);assert.equal(repeated.rule.id,saved.rule.id);assert.equal(repeated.rule.status,'expired');
 await store.transaction(db=>{db.businesses.push({...db.businesses[0],id:'foreign'});db.users.push({...db.users[1],id:'foreign_worker',businessId:'foreign',email:'foreign@example.test'});});
 assert.equal((await listAvailability(store,'foreign_worker',clock)).rules.length,0);await assert.rejects(changeAvailability(store,'foreign_worker',saved.rule.id,'pause',{revision:saved.rule.revision},clock),status(404));
});

test('availability chat mode and uncertain receipt persist under owner/expiry boundaries without restoring drafts',async()=>{
 const {createEmployeeChatState}=await import('../public/ai-employee-state.js');const map=new Map();const storage={getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};
 const chat=createEmployeeChatState(storage,'b:w',clock);chat.value.mode='availability';chat.value.outcome={kind:'availability_uncertain',title:'Availability'};chat.value.draft=draft;chat.save();
 const restored=createEmployeeChatState(storage,'b:w',clock);assert.equal(restored.value.mode,'availability');assert.equal(restored.value.outcome.kind,'availability_uncertain');assert.equal(restored.value.draft,undefined);
 assert.equal(createEmployeeChatState(storage,'foreign:w',clock).value.outcome,null);chat.save();assert.equal(createEmployeeChatState(storage,'b:w',()=>now+9*3600000).value.outcome,null);chat.reset();assert.equal(chat.value.outcome,null);
});

test('availability follow-up changes the request limit without saving or losing window and title', async t => {
 const {store,dir}=await fixture(t);
 const base={...draft,title:'Opening',maxClaims:3};
 const ai=createAiAvailabilityDrafter({apiKey:'test',allowance:new AiAllowance(join(dir,'use')),fetchImpl:async()=>reply({
  kind:'availability',question:'',startLocal:null,endLocal:null,title:null,maxClaims:1,
 })});
 const result=await ai(store,'worker_jamie',{description:'Just one shift',base},clock);
 assert.deepEqual(result.draft,{...base,maxClaims:1});
 assert.equal((await listAvailability(store,'worker_jamie',clock)).rules.length,0);
});
