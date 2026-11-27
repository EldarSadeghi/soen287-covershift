// Acceptance infrastructure defaults to recorded replies and an ephemeral loopback server.
import assert from 'node:assert/strict';
import {mkdtemp, readFile, readdir, rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {JsonStore} from '../../src/storage/json-store.js';
import {buildDemoFixtures} from '../../src/demo/fixtures.js';
import {createAppServer} from '../../src/app.js';
import {SessionStore} from '../../src/auth/sessions.js';
import {AiAllowance} from '../../src/ai/allowance.js';
import {createAiShiftEditor} from '../../src/ai/shift-edit.js';
import {createAiShiftDrafter} from '../../src/ai/shift-draft.js';
import {createAiShiftSearcher} from '../../src/ai/shift-search.js';
import {createAiAvailabilityDrafter} from '../../src/ai/availability-draft.js';
import {createAiScheduleAnswerer} from '../../src/ai/schedule-questions.js';
import {createAiIntentClassifier} from '../../src/ai/intent.js';

export const FIXED_NOW = Date.parse('2030-01-07T16:00:00.000Z');
export const MODE = 'offline-recorded-provider-replies';
export const LIMITATION = 'Recorded provider replies test workflow handling, not real-model language understanding or browser interaction. No live provider calls were made.';
const envelope = value => new Response(JSON.stringify({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(value)}]}]}));

async function previewReply(_url, init) {
  const { text } = JSON.parse(init.body);
  await new Promise(resolve => setTimeout(resolve, 600));
  if (text.format.name !== 'schedule_question') return new Response(null, { status: 503 });
  return envelope({ kind: 'next', question: '', startDate: '', endDate: '', workerName: '' });
}

export async function createAcceptanceContext(checks, options = {}) {
  const dir = await mkdtemp(join(tmpdir(),'covershift-ai-acceptance-'));
  let server;
  const cleanup = async () => {
    try { if(server?.listening) await new Promise((resolve,reject)=>{server.close(error=>error?reject(error):resolve());server.closeIdleConnections();}); }
    finally { await rm(dir,{recursive:true,force:true}); }
  };
  try {
    const store = new JsonStore(join(dir,'fictional.json'));
    const manifest = await buildDemoFixtures(store,{now:FIXED_NOW});
    await store.transaction(db=>{
      const business={...db.businesses[0],id:'business_foreign',name:'Fictional other business'};
      const manager={...db.users[0],id:'manager_foreign',businessId:business.id,email:'foreign@example.test',name:'Foreign Manager'};
      db.businesses.push(business);db.users.push(manager);
    });
    const queue=[],calls=[],requests=[];let contractFailed=false;
    function check(id, description, actual, expected=true) {
      try { assert.deepEqual(actual,expected);checks.push({id,description,status:'pass'}); }
      catch { checks.push({id,description,status:'fail'});throw new Error('Acceptance assertion failed: '+id); }
    }
    const fetchImpl = async (url,init) => {
      let turn,payload,input;
      try {
        assert.equal(url,'https://api.openai.com/v1/responses');
        turn=queue.shift();assert.ok(turn,'Unexpected provider call');
        payload=JSON.parse(init.body);
        // The intent classifier sends only the request and up to two earlier turns.
        input=JSON.parse(payload.input);
        check('provider-'+(calls.length+1),'Recorded task, latest message, conversation and strict private response contract match.',[payload.text.format.name,input.request,input.conversation,payload.store,payload.text.format.strict],[turn.task,turn.message,turn.history||[],false,true]);
        calls.push({task:turn.task,payload,input});
        if(turn.beforeReply) await turn.beforeReply(store);
      } catch(error) { contractFailed=true;throw error; }
      if(turn.failure==='transport') throw new Error('FICTIONAL_PRIVATE_PROVIDER_CANARY');
      if(turn.failure==='timeout') return new Promise((resolve,reject)=>{init.signal.addEventListener('abort',()=>reject(new Error('Aborted fictional provider')),{once:true});});
      if(turn.failure==='refusal') return new Response(JSON.stringify({status:'completed',output:[{type:'message',content:[{type:'refusal',refusal:'Fictional refusal'}]}]}));
      if(turn.failure==='http') return new Response('FICTIONAL_PRIVATE_PROVIDER_CANARY',{status:500});
      return envelope(turn.reply);
    };
    const aiOptions = {
      apiKey: options.liveKey || 'fictional-offline-key-never-sent',
      allowance: new AiAllowance(join(dir, 'usage')),
      fetchImpl: options.liveKey ? fetch : options.preview ? previewReply : fetchImpl,
      timeoutMs: options.liveKey ? 11000 : options.preview ? 3000 : 200,
    };
    const sessions=new SessionStore();
    server=createAppServer({store,sessions,shiftClock:()=>FIXED_NOW,...(options.disabled?{}:{aiDraft:createAiShiftDrafter(aiOptions),aiEdit:createAiShiftEditor(aiOptions),aiSearch:createAiShiftSearcher(aiOptions),aiAvailability:createAiAvailabilityDrafter(aiOptions),aiSchedule:createAiScheduleAnswerer(aiOptions),aiIntent:createAiIntentClassifier(aiOptions)})});
    await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(options.port ?? 0,'127.0.0.1',resolve);});
    const base=`http://127.0.0.1:${server.address().port}`,identities=new Map();
    async function identity(user) {
      if(!identities.has(user)){
        const cookie=sessions.create(user).cookie.split(';')[0];
        const response=await fetch(base+'/api/session',{headers:{Cookie:cookie}});
        assert.equal(response.status,200);const data=await response.json();identities.set(user,{cookie,csrf:data.csrfToken});
      }
      return identities.get(user);
    }
    async function http(user,path,input,options={}) {
      assert.ok(path.startsWith('/api/')&&!path.includes('://'),'Only application API paths allowed');
      const account=user?await identity(user):null;
      const headers={...(account?{Cookie:account.cookie}:{}),...(input!==undefined?{Origin:base,'Content-Type':'application/json','X-CSRF-Token':account?.csrf||''}:{}),...options.headers};
      requests.push({user,path,method:input===undefined?'GET':'POST'});
      const started = performance.now();
      const response=await fetch(base+path,{method:input===undefined?'GET':'POST',headers,...(input!==undefined?{body:JSON.stringify(input)}:{}),signal:AbortSignal.timeout(options.liveKey ? 15000 : 5000)});
      const data=await response.json();
      if(options.discardAcknowledgement) return {uncertain:true}; // Client-side lost-ack simulation, never an automatic retry.
      return {status:response.status,data,headers:response.headers,elapsedMs:Math.round(performance.now()-started)};
    }
    return {base,check,store,manifest,dates:manifest.dates,ids:manifest.scenarios,calls,requests,queue,
      expect:turn=>queue.push(turn),
      // calls = provider-call reservations (lifetime cap); turns = user turns (daily limit).
      usage:async()=>{const names=(await readdir(join(dir,'usage')).catch(()=>[])).filter(name=>name.endsWith('.json'));
        const rows=await Promise.all(names.map(async name=>JSON.parse(await readFile(join(dir,'usage',name),'utf8'))));
        return {calls:rows.length,turns:rows.filter(row=>row.turn!==false).length};},providerContractValid:()=>!contractFailed,http,bytes:()=>readFile(store.filename,'utf8'),cleanup,
      async revision(requestId){const {claimRevision}=await import('../../src/requests/claim.js');const db=await store.read(),r=db.coverageRequests.find(x=>x.id===requestId);return claimRevision(r,db.shifts.find(s=>s.id===r.shiftId));},
      async rule(){const r=await http('worker_jamie','/api/worker/availability-rules');return r.data.rules.find(x=>x.id===manifest.scenarios.availabilityRule);},
    };
  } catch(error) {await cleanup();throw error;}
}

export async function runScenario(scenario) {
  const checks=[];let ctx,error=null;
  try {
    ctx=await createAcceptanceContext(checks,scenario);
    await scenario.run(ctx);
    assert.equal(ctx.queue.length,0,'Every recorded provider turn must be exercised');
    assert.ok(checks.length>0,'A scenario must contain assertions');
    assert.ok(checks.every(c=>c.status==='pass'),'An assertion must fail the scenario even if a service caught its error');
    assert.ok(ctx.providerContractValid(),'A service error response must not hide a broken provider replay contract');
  } catch(e) {error=e.code==='EPERM'?'Local test-server permission denied.':checks.some(c=>c.status==='fail')?'An acceptance assertion failed.':'Scenario setup, provider contract or execution failed; inspect this fictional scenario locally.';}
  finally {try{await ctx?.cleanup();}catch{error='Temporary test server/storage cleanup failed.';}}
  return {id:scenario.id,title:scenario.title,status:error?'fail':'pass',checks,...(error?{error}:{}),providerCalls:ctx?.calls.length||0};
}
export function summarize(results) {
  return {version:1,mode:MODE,generatedAt:new Date().toISOString(),fixtureClock:new Date(FIXED_NOW).toISOString(),limitation:LIMITATION,
    total:results.length,passed:results.filter(r=>r.status==='pass').length,failed:results.filter(r=>r.status!=='pass').length,
    checks:results.reduce((n,r)=>n+r.checks.length,0),results};
}
