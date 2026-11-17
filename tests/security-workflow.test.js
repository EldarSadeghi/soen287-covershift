import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { JsonStore } from '../src/storage/json-store.js';
import { seedDemo } from '../src/storage/seed.js';
import { createAppServer } from '../src/app.js';
import { authenticate } from '../src/auth/login.js';
import { SessionStore } from '../src/auth/sessions.js';
const now = Date.parse('2026-11-17T15:00:00.000Z');
const passphrase = 'Fictional verification passphrase!';
async function fixture(t, options = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'covershift-security-')); t.after(() => rm(dir, { recursive: true, force: true }));
  const store = new JsonStore(join(dir, 'covershift.json')); await seedDemo(store);
  await store.transaction(db => {
    for (const user of db.users) user.passwordHash = 'test hash';
    db.businesses.push({ ...db.businesses[0], id: 'other_business', name: 'Other private business' });
    db.users.push(...[db.users[0], db.users[1]].map((u,i) => ({ ...u, id: i ? 'other_worker' : 'other_manager', businessId: 'other_business', email: i ? 'other_worker@example.test' : 'other_manager@example.test' })));
  });
  const sessions = options.sessions || new SessionStore();
  // Password derivation is tested in auth.test.js; this suite exercises HTTP
  // login/session rotation and the real application services using cheap hashes.
  const server = createAppServer({ store, sessions, shiftClock: () => now, setupClock: () => now,
    login: (store,input) => authenticate(store,input,{ verify: async (password,hash) => password === passphrase && hash === 'test hash' }),
    setupHash: async () => 'test hash', ...options });
  await new Promise((resolve,reject) => { server.once('error',reject); server.listen(0,'127.0.0.1',resolve); });
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const origin = `http://127.0.0.1:${server.address().port}`;
  async function request(path, { actor, method = 'GET', body, raw, headers = {} } = {}) {
    return fetch(origin + path, { method, redirect: 'manual', headers: { ...(actor ? { Cookie: actor.cookie } : {}), ...(method === 'POST' ? { Origin: origin, 'Content-Type': 'application/json', ...(actor ? { 'X-CSRF-Token': actor.csrf } : {}) } : {}), ...headers }, ...(raw !== undefined ? { body: raw } : body !== undefined ? { body: JSON.stringify(body) } : {}) });
  }
  async function login(id, old = null) {
    const response = await request('/api/login', { method: 'POST', actor: old, body: { email: `${id}@example.test`, password: passphrase } }); assert.equal(response.status,200);
    const cookie = response.headers.get('set-cookie').split(';')[0]; const context = await (await request('/api/session',{actor:{cookie}})).json(); return { cookie, csrf: context.csrfToken };
  }
  async function post(path,actor,body,expected=200) { const response = await request(path,{method:'POST',actor,body}); assert.equal(response.status,expected,`${path}: ${await response.clone().text()}`); return response.status === 204 ? null : response.json(); }
  async function create(manager,worker='worker_alex',day=20,title='Verified coverage',start='09:00',end='14:00') {
    return (await post('/api/manager/shifts',manager,{title,assignedWorkerId:worker,startLocal:`2026-11-${day}T${start}`,endLocal:`2026-11-${day}T${end}`},201)).shift;
  }
  async function open(owner,shiftId) { const view=await(await request('/api/worker/shifts',{actor:owner})).json();const shift=view.shifts.find(s=>s.id===shiftId);return (await post(`/api/worker/shifts/${shiftId}/coverage`,owner,{revision:shift.coverage.revision},201)).request; }
  async function board(actor) { return (await(await request('/api/worker/open-shifts',{actor})).json()).requests; }
  async function pending(manager,id) { return (await(await request('/api/manager/dashboard',{actor:manager})).json()).pendingClaims.find(r=>r.id===id); }
  return { store, sessions, server, origin, request, login, post, create, open, board, pending };
}

test('HTTP lifecycle: onboard employee, request, reject, reopen, reclaim, approve, re-request and cancel with durable history',async t=>{
  const f=await fixture(t);const manager=await f.login('manager_morgan');const owner=await f.login('worker_alex');
  const added=await f.post('/api/manager/workers',manager,{name:'Casey Example',email:'casey@example.test'},201);
  await f.post('/api/worker-setup/complete',null,{token:added.setupToken,password:passphrase});const casey=await f.login('casey');
  await f.post('/api/worker-setup/complete',null,{token:added.setupToken,password:passphrase},400);
  const shift=await f.create(manager);const opened=await f.open(owner,shift.id);let record=(await f.board(casey)).find(r=>r.id===opened.id);
  await f.post(`/api/worker/requests/${record.id}/claim`,casey,{revision:record.revision});let claim=await f.pending(manager,record.id);
  await f.post(`/api/manager/requests/${claim.id}/reject`,manager,{revision:claim.revision});
  const jamie=await f.login('worker_jamie');record=(await f.board(jamie)).find(r=>r.shift.id===shift.id);assert.notEqual(record.id,opened.id);
  await f.post(`/api/worker/requests/${record.id}/claim`,jamie,{revision:record.revision});claim=await f.pending(manager,record.id);
  await f.post(`/api/manager/requests/${claim.id}/approve`,manager,{revision:claim.revision});
  await f.post(`/api/manager/requests/${claim.id}/approve`,manager,{revision:claim.revision},409);
  const fresh=await f.open(jamie,shift.id);const own=await(await f.request('/api/worker/requests',{actor:jamie})).json();const cancellable=own.requests.find(r=>r.id===fresh.id);
  await f.post(`/api/worker/requests/${fresh.id}/cancel`,jamie,{revision:cancellable.revision});
  const db=await new JsonStore(f.store.filename).read();assert.equal(db.shifts.find(s=>s.id===shift.id).assignedWorkerId,'worker_jamie');
  const records=db.coverageRequests.filter(r=>r.shiftId===shift.id);assert.deepEqual(records.map(r=>r.status),['rejected','approved','cancelled']);assert.deepEqual(records.map(r=>r.history.map(e=>e.action)),[['requested','claimed','rejected'],['reopened','claimed','approved'],['requested','cancelled']]);
  const history=await(await f.request('/api/worker/coverage-history',{actor:casey})).json();assert.equal(history.records.length,1);assert.equal(history.records[0].status,'rejected');assert.doesNotMatch(JSON.stringify(history),/passwordHash|setupToken|tokenHash|example.test/);
});

test('HTTP foreign IDs cannot edit/delete/request/cancel/claim/review or reveal another business records',async t=>{
  const f=await fixture(t);const manager=await f.login('manager_morgan');const owner=await f.login('worker_alex');const claimant=await f.login('worker_jamie');const foreignManager=await f.login('other_manager');const foreignWorker=await f.login('other_worker');
  const shift=await f.create(manager);const opened=await f.open(owner,shift.id);const record=(await f.board(claimant)).find(r=>r.id===opened.id);
  const raw=await readFile(f.store.filename,'utf8');
  for(const action of ['edit','delete'])await f.post(`/api/manager/shifts/${shift.id}/${action}`,foreignManager,action==='delete'?{revision:'0'.repeat(64)}:{revision:'0'.repeat(64),title:'Foreign edit',assignedWorkerId:'other_worker',startLocal:'2026-11-20T10:00',endLocal:'2026-11-20T11:00'},404);
  await f.post(`/api/worker/shifts/${shift.id}/coverage`,foreignWorker,{revision:'0'.repeat(64)},404);
  for(const action of ['claim-check','claim','cancel'])await f.post(`/api/worker/requests/${opened.id}/${action}`,foreignWorker,{revision:record.revision},404);
  for(const action of ['approve','reject'])await f.post(`/api/manager/requests/${opened.id}/${action}`,foreignManager,{revision:record.revision},404);
  for(const [path,actor] of [['/api/manager/dashboard',foreignManager],['/api/manager/coverage-history',foreignManager],['/api/worker/open-shifts',foreignWorker],['/api/worker/requests',foreignWorker]]){const text=await(await f.request(path,{actor})).text();assert.ok(!text.includes(shift.id));assert.ok(!text.includes(opened.id));assert.ok(!text.includes('Verified coverage'));}
  assert.equal(await readFile(f.store.filename,'utf8'),raw);
});

test('HTTP race: competing claimants and approval/cancellation serialize with no partial assignment or extra history',async t=>{
  const f=await fixture(t);const manager=await f.login('manager_morgan');const owner=await f.login('worker_alex');const jamie=await f.login('worker_jamie');const sam=await f.login('worker_sam');const shift=await f.create(manager);const opened=await f.open(owner,shift.id);const record=(await f.board(jamie)).find(r=>r.id===opened.id);
  const races=await Promise.all([jamie,sam].map(actor=>f.request(`/api/worker/requests/${opened.id}/claim`,{method:'POST',actor,body:{revision:record.revision}})));assert.deepEqual(races.map(r=>r.status).sort(),[200,409]);
  const pending=await f.pending(manager,opened.id);const own=await(await f.request('/api/worker/requests',{actor:owner})).json();const q=own.requests.find(r=>r.id===opened.id);
  const decisions=await Promise.all([f.request(`/api/manager/requests/${q.id}/approve`,{method:'POST',actor:manager,body:{revision:pending.revision}}),f.request(`/api/worker/requests/${q.id}/cancel`,{method:'POST',actor:owner,body:{revision:q.revision}})]);assert.deepEqual(decisions.map(r=>r.status).sort(),[200,409]);
  const db=await f.store.read();const saved=db.coverageRequests.find(r=>r.id===q.id);assert.equal(saved.history.length,3);assert.equal(db.shifts.find(s=>s.id===shift.id).assignedWorkerId,saved.status==='approved'?saved.claimantId:'worker_alex');
});

test('HTTP approval rechecks assignments added since claim and rejects stale approval after rejection/reclaim',async t=>{
  const f=await fixture(t);const manager=await f.login('manager_morgan');const owner=await f.login('worker_alex');const jamie=await f.login('worker_jamie');const sam=await f.login('worker_sam');const shift=await f.create(manager);const opened=await f.open(owner,shift.id);const record=(await f.board(jamie)).find(r=>r.id===opened.id);await f.post(`/api/worker/requests/${record.id}/claim`,jamie,{revision:record.revision});const claim=await f.pending(manager,record.id);
  await f.create(manager,'worker_jamie',20,'New overlapping assignment','13:00','15:00');const raw=await readFile(f.store.filename,'utf8');await f.post(`/api/manager/requests/${claim.id}/approve`,manager,{revision:claim.revision},409);assert.equal(await readFile(f.store.filename,'utf8'),raw);
  await f.post(`/api/manager/requests/${claim.id}/reject`,manager,{revision:claim.revision});const reopened=(await f.board(sam)).find(r=>r.shift.id===shift.id);await f.post(`/api/worker/requests/${reopened.id}/claim`,sam,{revision:reopened.revision});
  await f.post(`/api/manager/requests/${claim.id}/approve`,manager,{revision:claim.revision},409);const current=await f.pending(manager,reopened.id);await f.post(`/api/manager/requests/${current.id}/approve`,manager,{revision:current.revision});assert.equal((await f.store.read()).shifts.find(s=>s.id===shift.id).assignedWorkerId,'worker_sam');
});

test('HTTP mutation guard matrix rejects wrong roles, cross-site requests, foreign CSRF and forged fields without disk changes',async t=>{
  const f=await fixture(t);const manager=await f.login('manager_morgan');const worker=await f.login('worker_jamie');
  const routes=[
    ['/api/manager/workers',manager,{name:'New worker',email:'new@example.test'}],
    ['/api/manager/workers/worker_sam/setup',manager,{}],
    ['/api/manager/shifts',manager,{title:'Shift',assignedWorkerId:'worker_jamie',startLocal:'2026-11-20T09:00',endLocal:'2026-11-20T14:00'}],
    ['/api/manager/shifts/missing/edit',manager,{revision:'0'.repeat(64)}],
    ['/api/manager/shifts/missing/delete',manager,{revision:'0'.repeat(64)}],
    ['/api/manager/requests/missing/approve',manager,{revision:'0'.repeat(64)}],
    ['/api/manager/requests/missing/reject',manager,{revision:'0'.repeat(64)}],
    ['/api/worker/shifts/missing/coverage',worker,{revision:'0'.repeat(64)}],
    ['/api/worker/requests/missing/cancel',worker,{revision:'0'.repeat(64)}],
    ['/api/worker/requests/missing/claim-check',worker,{revision:'0'.repeat(64)}],
    ['/api/worker/requests/missing/claim',worker,{revision:'0'.repeat(64)}],
  ];
  const raw=await readFile(f.store.filename,'utf8');
  for(const [path,actor,body] of routes){
    const other=actor===manager?worker:manager;
    for(const headers of [{Origin:'https://foreign.example'},{Origin:'null'},{Origin:''},{'Sec-Fetch-Site':'cross-site'},{'X-CSRF-Token':other.csrf},{'X-CSRF-Token':''}])assert.equal((await f.request(path,{method:'POST',actor,body,headers})).status,403,path);
    assert.equal((await f.request(path,{method:'POST',actor:other,body})).status,403,path);
    assert.equal((await f.request(path,{method:'POST',actor,body,headers:{'Content-Type':'text/plain'}})).status,415,path);
    assert.equal((await f.request(path+'?businessId=other_business',{method:'POST',actor,body})).status,400,path);
  }
  await f.post('/api/manager/shifts',manager,{title:'Forged',assignedWorkerId:'other_worker',startLocal:'2026-11-20T09:00',endLocal:'2026-11-20T14:00'},422);
  await f.post('/api/manager/workers',manager,{name:'Admin',email:'admin@example.test',role:'manager'},422);
  assert.equal(await readFile(f.store.filename,'utf8'),raw);
});

test('HTTP malformed/oversized bodies, private paths and generic errors do not mutate or expose storage/secrets',async t=>{
  const f=await fixture(t);const manager=await f.login('manager_morgan');const raw=await readFile(f.store.filename,'utf8');
  for(const [body,code] of [['{',400],['null',422],['[]',422],['{"__proto__":{"role":"manager"}}',422],['x'.repeat(8193),413]])assert.equal((await f.request('/api/manager/shifts',{method:'POST',actor:manager,raw:body})).status,code);
  assert.equal(await readFile(f.store.filename,'utf8'),raw);
  for(const path of ['/data/covershift.json','/data/covershift.json.lock','/.env','/.git/config','/src/server.js','/../src/server.js','/%2e%2e/src/server.js','/public/../../data/covershift.json']){const response=await f.request(path);assert.equal(response.status,404,path);assert.doesNotMatch(await response.text(),/test hash|passwordHash|schemaVersion|PUBLIC_ORIGIN/);}
  await writeFile(f.store.filename,'private corrupt marker: do not disclose');const response=await f.request('/api/manager/dashboard',{actor:manager});assert.equal(response.status,503);const body=await response.text();assert.doesNotMatch(body,/private corrupt marker|SyntaxError|\.js:|passwordHash/);assert.equal(await readFile(f.store.filename,'utf8'),'private corrupt marker: do not disclose');
});

test('HTTP sessions rotate CSRF, reject duplicate/forged cookies, expire and revoke disabled accounts',async t=>{
  let time=0;const sessions=new SessionStore({now:()=>time,idleMs:100,absoluteMs:250});const f=await fixture(t,{sessions});const worker=await f.login('worker_jamie');
  const duplicate={...worker,cookie:`${worker.cookie}; ${worker.cookie}`};assert.equal((await f.request('/api/session',{actor:duplicate})).status,401);assert.equal((await f.request('/api/session',{actor:worker})).status,200);
  assert.equal((await f.request('/api/session',{actor:{cookie:'covershift_session='+'f'.repeat(64)}})).status,401);
  const rotated=await f.login('worker_jamie',worker);assert.notEqual(rotated.cookie,worker.cookie);assert.notEqual(rotated.csrf,worker.csrf);assert.equal((await f.request('/api/worker/shifts',{actor:worker})).status,401);
  assert.equal((await f.request('/api/worker/requests/missing/claim',{method:'POST',actor:rotated,body:{revision:'0'.repeat(64)},headers:{'X-CSRF-Token':worker.csrf}})).status,403);
  time=99;assert.equal((await f.request('/api/session',{actor:rotated})).status,200);time=198;assert.equal((await f.request('/api/session',{actor:rotated})).status,200);time=250;assert.equal((await f.request('/api/session',{actor:rotated})).status,401);
  time=300;const idle=await f.login('worker_jamie');time=400;assert.equal((await f.request('/api/session',{actor:idle})).status,401);
  const disabled=await f.login('worker_jamie');await f.store.transaction(db=>{db.users.find(u=>u.id==='worker_jamie').passwordHash=null;});assert.equal((await f.request('/api/worker/requests/missing/claim',{method:'POST',actor:disabled,body:{revision:'0'.repeat(64)}})).status,401);await f.store.transaction(db=>{db.users.find(u=>u.id==='worker_jamie').passwordHash='test hash';});assert.equal((await f.request('/api/session',{actor:disabled})).status,401);
});

test('HTTP production origin and security headers ignore spoofed forwarding headers and bind secure sessions',async t=>{
  const canonical='https://covershift.example.test';const sessions=new SessionStore({secure:true});const f=await fixture(t,{sessions,publicOrigin:canonical});
  const login=await f.request('/api/login',{method:'POST',body:{email:'manager_morgan@example.test',password:passphrase},headers:{Origin:canonical}});assert.equal(login.status,200);const setCookie=login.headers.get('set-cookie');assert.match(setCookie,/^__Host-covershift=/);for(const value of ['HttpOnly','SameSite=Lax','Secure','Path=/'])assert.ok(setCookie.includes(value));assert.ok(!setCookie.includes('Domain='));
  const actor={cookie:setCookie.split(';')[0]};const response=await f.request('/api/session',{actor});actor.csrf=(await response.json()).csrfToken;
  assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(response.headers.get('x-content-type-options'),'nosniff');assert.match(response.headers.get('strict-transport-security'),/max-age=31536000/);const csp=response.headers.get('content-security-policy');for(const directive of ["script-src 'self'","frame-ancestors 'none'","base-uri 'none'","form-action 'self'"])assert.ok(csp.includes(directive));assert.ok(!csp.includes('unsafe-inline'));assert.equal(response.headers.get('access-control-allow-origin'),null);
  const raw=await readFile(f.store.filename,'utf8');for(const Origin of [f.origin,'https://foreign.example','null'])assert.equal((await f.request('/api/manager/workers',{method:'POST',actor,body:{name:'Blocked',email:'blocked@example.test'},headers:{Origin,'X-Forwarded-Host':'covershift.example.test','X-Forwarded-Proto':'https'}})).status,403);assert.equal(await readFile(f.store.filename,'utf8'),raw);
  assert.equal((await f.request('/api/logout',{method:'POST',actor,body:{},headers:{Origin:canonical}})).status,204);assert.equal((await f.request('/api/session',{actor})).status,401);
});

test('HTTP coverage throttling bounds repeated mutations and leaves storage unchanged',async t=>{
  const f=await fixture(t);const worker=await f.login('worker_jamie');const raw=await readFile(f.store.filename,'utf8');
  for(let i=0;i<30;i++)assert.equal((await f.request('/api/worker/requests/missing/claim-check',{method:'POST',actor:worker,body:{revision:'0'.repeat(64)}})).status,404);
  const blocked=await f.request('/api/worker/requests/missing/claim',{method:'POST',actor:worker,body:{revision:'0'.repeat(64)}});assert.equal(blocked.status,429);assert.equal(blocked.headers.get('retry-after'),'600');assert.equal(await readFile(f.store.filename,'utf8'),raw);
});
