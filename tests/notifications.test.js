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
import {claimCoverage,claimRevision} from '../src/requests/claim.js';
import {reviewCoverage} from '../src/requests/review.js';
import {confirmAvailability} from '../src/availability/rules.js';
import {withAvailabilityMatching,reconcileAvailability} from '../src/availability/matching.js';
import {listNotifications,markNotificationsRead} from '../src/notifications/service.js';
import {createAppServer} from '../src/app.js';
import {SessionStore} from '../src/auth/sessions.js';
const now=Date.parse('2026-11-22T16:00:00Z'),clock=()=>now;
async function fixture(t){
 const dir=await mkdtemp(join(tmpdir(),'covershift-notifications-'));t.after(()=>rm(dir,{recursive:true,force:true}));const store=new JsonStore(join(dir,'covershift.json'));await seedDemo(store);await store.transaction(db=>{for(const u of db.users)u.passwordHash='fictional hash';});const active=withAvailabilityMatching(store,clock);
 async function opening(start='09:00',end='12:00'){
  const {shift}=await createShift(active,'manager_morgan',{assignedWorkerId:'worker_alex',title:'Thursday service',startLocal:'2026-11-26T'+start,endLocal:'2026-11-26T'+end},clock);
  const db=await store.read(),s=db.shifts.find(s=>s.id===shift.id);return (await requestCoverage(active,'worker_alex',s.id,{revision:coverageShiftRevision(db,s)},clock)).request.id;
 }
 async function revision(id){const db=await store.read(),r=db.coverageRequests.find(r=>r.id===id);return claimRevision(r,db.shifts.find(s=>s.id===r.shiftId));}
 async function claim(id){return claimCoverage(active,'worker_jamie',id,{revision:await revision(id)},clock);}
 return {store,active,opening,revision,claim};
}
test('upgrade does not backfill historical events or write on empty reconciliation',async t=>{
 const f=await fixture(t),before=await readFile(f.store.filename,'utf8');await f.active.transaction(()=>{});assert.equal((await f.store.read()).notifications,undefined);assert.equal(await reconcileAvailability(f.store,clock),0);assert.equal(await readFile(f.store.filename,'utf8'),before);
});
test('manual submission and approval notify only involved people with honest assignment state',async t=>{
 const f=await fixture(t),id=await f.opening();await f.claim(id);let db=await f.store.read();assert.equal(db.schemaVersion,8);assert.equal(db.notifications.length,2);assert.equal(db.shifts.find(s=>s.id===db.coverageRequests.find(r=>r.id===id).shiftId).assignedWorkerId,'worker_alex');
 let employee=await listNotifications(f.store,'worker_jamie',null,now);assert.match(employee.notifications[0].message,/not assigned until/);assert.equal(employee.notifications[0].currentStatus,'pending');assert.equal((await listNotifications(f.store,'worker_sam',null,now)).unreadCount,0);
 await reviewCoverage(f.active,'manager_morgan',id,'approve',{revision:await f.revision(id)},clock);db=await f.store.read();assert.equal(db.notifications.length,4);
 employee=await listNotifications(f.store,'worker_jamie',null,now);assert.match(employee.notifications[0].message,/approved.*assigned/);assert.equal(employee.notifications[0].currentStatus,'approved');assert.match((await listNotifications(f.store,'worker_alex',null,now)).notifications[0].message,/no longer assigned/);assert.equal((await listNotifications(f.store,'manager_morgan',null,now)).unreadCount,1);assert.match(employee.notifications[0].href,new RegExp('history\\?request='+id));
});
test('rejection preserves original assignment and notifies both employees',async t=>{
 const f=await fixture(t),id=await f.opening();await f.claim(id);await reviewCoverage(f.active,'manager_morgan',id,'reject',{revision:await f.revision(id)},clock);
 assert.match((await listNotifications(f.store,'worker_jamie',null,now)).notifications[0].message,/rejected/);assert.match((await listNotifications(f.store,'worker_alex',null,now)).notifications[0].message,/remain assigned/);assert.equal((await f.store.read()).notifications.length,4);
});
test('pending cancellation notifies claimant and manager; open cancellation does not imply a claim',async t=>{
 const f=await fixture(t),id=await f.opening();await f.claim(id);let db=await f.store.read();let r=db.coverageRequests.find(r=>r.id===id);
 await cancelCoverage(f.active,'worker_alex',id,{revision:requestRevision(r)},clock);assert.equal((await f.store.read()).notifications.length,4);assert.match((await listNotifications(f.store,'worker_jamie',null,now)).notifications[0].message,/cancelled.*not assigned/);
 const other=await f.opening('14:00','17:00');db=await f.store.read();r=db.coverageRequests.find(r=>r.id===other);await cancelCoverage(f.active,'worker_alex',other,{revision:requestRevision(r)},clock);assert.equal((await f.store.read()).notifications.length,4);
});
test('automatic matching and simultaneous reconcilers emit one notification per recipient',async t=>{
 const f=await fixture(t),id=await f.opening();await confirmAvailability(f.store,'worker_jamie',{confirmationId:randomUUID(),draft:{startLocal:'2026-11-26T08:00',endLocal:'2026-11-26T22:00',title:'',maxClaims:1,timezone:'America/Toronto'}},clock);
 await Promise.all([reconcileAvailability(f.store,clock),reconcileAvailability(new JsonStore(f.store.filename),clock)]);assert.equal((await f.store.read()).notifications.length,2);await f.active.transaction(()=>{});await reconcileAvailability(f.store,clock);assert.equal((await f.store.read()).notifications.length,2);assert.equal((await listNotifications(f.store,'manager_morgan',null,now)).notifications[0].currentStatus,'pending');assert.equal((await f.store.read()).coverageRequests.find(r=>r.id===id).claimantId,'worker_jamie');
});
test('workflow failure rolls back the change and notifications together',async t=>{
 const f=await fixture(t),id=await f.opening(),before=await readFile(f.store.filename,'utf8');await assert.rejects(f.active.transaction(db=>{db.coverageRequests.find(r=>r.id===id).status='pending';throw Error('rollback');}));assert.equal(await readFile(f.store.filename,'utf8'),before);
});
test('read selection is private, idempotent, persistent and cannot mark unseen arrivals',async t=>{
 const f=await fixture(t),id=await f.opening();await f.claim(id);const old=(await listNotifications(f.store,'worker_jamie',null,now)).notifications[0];await reviewCoverage(f.active,'manager_morgan',id,'approve',{revision:await f.revision(id)},clock);
 await assert.rejects(markNotificationsRead(f.active,'worker_sam',{ids:[old.id]},clock),{status:404});await assert.rejects(markNotificationsRead(f.active,'worker_jamie',{ids:[old.id,'a'.repeat(64)]},clock),{status:404});assert.equal((await listNotifications(f.store,'worker_jamie',null,now)).unreadCount,2);
 await markNotificationsRead(f.active,'worker_jamie',{ids:[old.id]},clock);const reopened=new JsonStore(f.store.filename);assert.equal((await listNotifications(reopened,'worker_jamie',null,now)).unreadCount,1);const before=await reopened.read();await markNotificationsRead(f.active,'worker_jamie',{ids:[old.id]},()=>now+1000);assert.deepEqual((await reopened.read()).notifications,before.notifications);
});
test('model rejects duplicate events, foreign recipients and invalid read dates',async t=>{
 const f=await fixture(t),id=await f.opening();await f.claim(id);const db=await f.store.read();
 for(const change of [d=>d.notifications.push({...d.notifications[0],id:'a'.repeat(64)}),d=>d.notifications[0].userId='worker_sam',d=>d.notifications[0].readAt='2020-01-01T00:00:00.000Z']){const copy=structuredClone(db);change(copy);assert.throws(()=>validateDatabase(copy),/notification/);}
});
test('inactive users cannot read or mark; fresh expired state is shown in old notifications',async t=>{
 const f=await fixture(t),id=await f.opening();await f.claim(id);assert.equal((await listNotifications(f.store,'worker_jamie',null,Date.parse('2026-11-27T12:00:00Z'))).notifications[0].currentStatus,'expired');
 const saved=(await listNotifications(f.store,'worker_jamie',null,now)).notifications[0];await f.store.transaction(db=>{db.users.find(u=>u.id==='worker_jamie').passwordHash=null;});await assert.rejects(listNotifications(f.store,'worker_jamie',null,now),{status:401});await assert.rejects(markNotificationsRead(f.active,'worker_jamie',{ids:[saved.id]},clock),{status:401});
});
test('HTTP notifications require auth, own scope, CSRF, origin and JSON; static inbox is served',async t=>{
 const f=await fixture(t),id=await f.opening();await f.claim(id);const sessions=new SessionStore();const server=createAppServer({store:f.store,sessions,shiftClock:clock});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));const base=`http://127.0.0.1:${server.address().port}`;
 const session=sessions.create('worker_jamie'),cookie=session.cookie.split(';')[0],headers={Cookie:cookie};const context=await (await fetch(base+'/api/session',{headers})).json();const n=(await listNotifications(f.store,'worker_jamie',null,now)).notifications[0];
 assert.equal((await fetch(base+'/api/notifications')).status,401);assert.equal((await fetch(base+'/api/notifications?userId=worker_sam',{headers})).status,400);assert.equal((await fetch(base+'/api/notifications',{headers})).headers.get('cache-control'),'no-store');
 const body=JSON.stringify({ids:[n.id]});for(const [extra,status] of [[{'Content-Type':'application/json',Origin:base},403],[{'Content-Type':'text/plain',Origin:base,'X-CSRF-Token':context.csrfToken},415],[{'Content-Type':'application/json',Origin:'https://evil.test','X-CSRF-Token':context.csrfToken},403]])assert.equal((await fetch(base+'/api/notifications/read',{method:'POST',headers:{...headers,...extra},body})).status,status);
 assert.equal((await fetch(base+'/api/notifications/read',{method:'POST',headers:{...headers,Origin:base,'Content-Type':'application/json','X-CSRF-Token':context.csrfToken},body})).status,200);assert.equal((await fetch(base+'/notifications.js')).status,200);
});

test('pagination keeps an exact total and foreign cursors never expose another inbox',async t=>{
 const f=await fixture(t);
 // Separate nonoverlapping days to generate more than one page through real workflows.
 for(let day=23;day<=30;day++)for(const hour of [8,14]){
  const {shift}=await createShift(f.active,'manager_morgan',{assignedWorkerId:'worker_alex',title:'Service',startLocal:`2026-11-${day}T${String(hour).padStart(2,'0')}:00`,endLocal:`2026-11-${day}T${String(hour+2).padStart(2,'0')}:00`},clock);
  const db=await f.store.read(),s=db.shifts.find(s=>s.id===shift.id);const id=(await requestCoverage(f.active,'worker_alex',s.id,{revision:coverageShiftRevision(db,s)},clock)).request.id;await f.claim(id);await reviewCoverage(f.active,'manager_morgan',id,'approve',{revision:await f.revision(id)},clock);
 }
 const page=await listNotifications(f.store,'worker_jamie',null,now);assert.equal(page.unreadCount,32);assert.equal(page.notifications.length,20);const older=await listNotifications(f.store,'worker_jamie',page.next);assert.equal(older.notifications.length,12);assert.equal(older.next,null);assert.equal(new Set([...page.notifications,...older.notifications].map(n=>n.id)).size,32);
 await assert.rejects(listNotifications(f.store,'worker_sam',page.next),{status:400});
 await f.store.transaction(db=>{db.businesses.push({...db.businesses[0],id:'other_business'});db.users.push({...db.users[0],id:'other_manager',businessId:'other_business',email:'other@example.test'});});assert.equal((await listNotifications(f.store,'other_manager')).unreadCount,0);await assert.rejects(markNotificationsRead(f.active,'other_manager',{ids:[page.notifications[0].id]},clock),{status:404});
});

test('old claim receipts expose current approved summary and immutable historical event separately',async t=>{const f=await fixture(t),id=await f.opening();await f.claim(id);await reviewCoverage(f.active,'manager_morgan',id,'approve',{revision:await f.revision(id)},clock);const rows=(await listNotifications(f.store,'worker_jamie',null,now)).notifications;assert.equal(rows.length,2);for(const n of rows){assert.equal(n.groupKey,'coverage:'+id);assert.equal(n.headline,'Cover approved');assert.equal(n.summary,'You are assigned to this shift.');assert.equal(n.timezone,'America/Toronto');assert.ok(n.startsAt&&n.endsAt);}assert.ok(rows.some(n=>n.eventMessage==='Coverage claim submitted'));assert.equal((await listNotifications(f.store,'worker_sam',null,now)).notifications.length,0);});
