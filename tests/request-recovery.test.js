import test from 'node:test';
import assert from 'node:assert/strict';
import { createJSONRequester, RequestFailure } from '../public/request.js';
function deferred() { let resolve, reject; const promise = new Promise((a,b)=>{resolve=a;reject=b;}); return {promise,resolve,reject}; }
function fixture(fetchImpl) {
  const timers = new Set(); let delay;
  const request = createJSONRequester({ fetchImpl, setTimer(fn,ms){delay=ms;timers.add(fn);return fn;},clearTimer(fn){timers.delete(fn);} });
  return {request, timers, expire(){for(const fn of [...timers])fn();},get delay(){return delay;}};
}
const response=(data,status=200)=>({ok:status>=200&&status<300,status,json:async()=>data});
test('successful JSON response preserves status/data and request security options, then clears deadline',async()=>{
  let observed;const f=fixture(async(url,options)=>{observed={url,options};return response({saved:true},201);});
  assert.deepEqual(await f.request('/save',{method:'POST',headers:{'X-CSRF-Token':'fixture'},body:'{}'}),{ok:true,status:201,data:{saved:true}});
  assert.equal(observed.options.headers['X-CSRF-Token'],'fixture');assert.equal(observed.options.body,'{}');assert.ok(observed.options.signal instanceof AbortSignal);assert.equal(f.delay,15000);assert.equal(f.timers.size,0);
});
test('never-ending read rejects at deadline even if transport ignores abort; a retry is independent of late old success',async()=>{
  const old=deferred();let calls=0;let signal;const f=fixture((url,options)=>{calls++;signal=options.signal;return calls===1?old.promise:Promise.resolve(response({version:'fresh'}));});
  const first=f.request('/roster');const rejected=assert.rejects(first,e=>e instanceof RequestFailure&&e.timedOut&&!e.uncertain);f.expire();await rejected;assert.equal(signal.aborted,true);
  assert.equal(calls,1);assert.deepEqual((await f.request('/roster')).data,{version:'fresh'});old.resolve(response({version:'stale'}));await Promise.resolve();assert.equal(calls,2);assert.equal(f.timers.size,0);
});
test('deadline includes stalled JSON body, not only response headers',async()=>{
  const body=deferred();const headers=deferred();const f=fixture(()=>headers.promise);const pending=f.request('/roster');headers.resolve({status:200,ok:true,json:()=>body.promise});await Promise.resolve();
  const rejected=assert.rejects(pending,e=>e.timedOut&&!e.uncertain);f.expire();await rejected;body.resolve({late:true});await Promise.resolve();assert.equal(f.timers.size,0);
});
test('save committed before response loss remains uncertain and is never automatically submitted again',async()=>{
  let writes=0;const f=fixture(async()=>{writes++;throw new Error('connection lost after commit');});
  await assert.rejects(f.request('/create',{method:'POST',body:'{}'}),e=>e.uncertain&&!e.timedOut&&/confirm whether/.test(e.message));assert.equal(writes,1);assert.equal(f.timers.size,0);
});
test('mutation deadline rejects once, late saved response cannot resolve old request, and no automatic retry occurs',async()=>{
  const result=deferred();let calls=0;const f=fixture(()=>{calls++;return result.promise;});let applied=0;
  const pending=f.request('/create',{method:'POST'}).then(()=>applied++);const rejected=assert.rejects(pending,e=>e.uncertain&&e.timedOut);f.expire();await rejected;result.resolve(response({saved:true}));await Promise.resolve();assert.equal(applied,0);assert.equal(calls,1);
});
test('4xx validation/auth responses remain actionable; server errors are conservative about mutation outcomes',async()=>{
  for(const status of [400,401,403,409,422,429]){const f=fixture(async()=>response({message:'Rejected'},status));assert.deepEqual(await f.request('/save',{method:'POST'}),{ok:false,status,data:{message:'Rejected'}});assert.equal(f.timers.size,0);}
  const f=fixture(async()=>response({message:'Server failure'},503));await assert.rejects(f.request('/save',{method:'POST'}),e=>e.uncertain);assert.equal(f.timers.size,0);
});
test('malformed response body is recoverable and uncertain for writes; no private transport error leaks',async()=>{
  const f=fixture(async()=>({status:200,ok:true,json:async()=>{throw new Error('private response details');}}));
  await assert.rejects(f.request('/save',{method:'POST'}),e=>e.uncertain&&!e.message.includes('private'));await assert.rejects(f.request('/read'),e=>!e.uncertain);assert.equal(f.timers.size,0);
});
test('read-only POST preflight/setup-details timeouts are retryable reads, never transmitted as a readOnly option',async()=>{
  let options;const f=fixture((url,init)=>{options=init;return new Promise(()=>{});});const pending=f.request('/check',{method:'POST',readOnly:true});const rejected=assert.rejects(pending,e=>e.timedOut&&!e.uncertain);f.expire();await rejected;assert.equal('readOnly' in options,false);
});

test('served authentication pages load the shared request helper as modules, with no inaccessible import',async t=>{
  const {mkdtemp,rm}=await import('node:fs/promises');const {tmpdir}=await import('node:os');const {join}=await import('node:path');
  const {JsonStore}=await import('../src/storage/json-store.js');const {createAppServer}=await import('../src/app.js');
  const dir=await mkdtemp(join(tmpdir(),'covershift-request-assets-'));t.after(()=>rm(dir,{recursive:true,force:true}));const store=new JsonStore(join(dir,'covershift.json'));await store.initialize();const server=createAppServer({store});
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));const origin=`http://127.0.0.1:${server.address().port}`;
  for(const page of ['login','signup','setup']){const response=await fetch(`${origin}/${page}`);assert.equal(response.status,200);assert.match(await response.text(),new RegExp(`<script[^>]*type="module"[^>]*src="/${page}\\.js"`));const script=await fetch(`${origin}/${page}.js`);assert.equal(script.status,200);assert.match(await script.text(),/import \{ requestJSON \} from '\.\/request.js'/);}
  const helper=await fetch(`${origin}/request.js`);assert.equal(helper.status,200);assert.match(helper.headers.get('content-type'),/javascript/);assert.match(await helper.text(),/export const requestJSON/);
});

test('successful bodyless logout does not attempt JSON parsing or report an uncertain save',async()=>{
  let parsed=false;const f=fixture(async()=>({ok:true,status:204,json:async()=>{parsed=true;throw new Error('no body');}}));
  assert.deepEqual(await f.request('/api/logout',{method:'POST',body:'{}'}),{ok:true,status:204,data:null});assert.equal(parsed,false);assert.equal(f.timers.size,0);
});
