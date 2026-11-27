import { createAiShiftEditor } from '../src/ai/shift-edit.js';
import { createAiIntentClassifier } from '../src/ai/intent.js';
import {presentationReplies} from '../src/demo/presentation.js';
import {fileURLToPath} from 'node:url';import {join} from 'node:path';
import {prepareDemo,loadDemo} from '../src/demo/preparation.js';import {assertLocalDemo,DEMO_PASSWORD} from '../src/demo/fixtures.js';
const root=fileURLToPath(new URL('../.covershift-demo/',import.meta.url));
function portNumber(value){const port=Number(value||3035);if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('DEMO_PORT must be an integer between 1024 and 65535.');return port;}
function show(run,port){console.log(`\nFictional demo run: ${run.runId}\nStorage: ${run.runDirectory}\nManager: http://localhost:${port}/login — manager_morgan@example.test\nEmployees: http://127.0.0.1:${port}/login — worker_jamie@example.test or worker_alex@example.test\nFictional demo passphrase: ${DEMO_PASSWORD}\nScenario dates: Thursday ${run.manifest.dates.thursday}, Friday ${run.manifest.dates.friday}, Saturday ${run.manifest.dates.saturday}\nWalkthrough: ${join(run.runDirectory,'WALKTHROUGH.md')}\n`);}
try{
 assertLocalDemo();const command=process.argv[2],port=portNumber(process.env.DEMO_PORT);if(process.argv.length!==3||!['prepare','start'].includes(command))throw new Error('Use npm run demo:prepare or npm run demo:start (no extra arguments).');
 if(command==='prepare'){const run=await prepareDemo(root);show(run,port);console.log('Ready. Run npm run demo:start. Existing runs and normal account data were preserved.');}
 else{
  const run=await loadDemo(root);const {businessInstant}=await import('../src/shifts/create.js');if(Date.now()>=Date.parse(businessInstant(run.manifest.dates.thursday+'T09:00',run.manifest.timezone,'date')))throw new Error('The prepared scenario has started or expired. Stop the demo, run npm run demo:prepare, then start again.');
  const {createAppServer}=await import('../src/app.js');const {SessionStore}=await import('../src/auth/sessions.js');const {AiAllowance}=await import('../src/ai/allowance.js');const {createAiShiftDrafter}=await import('../src/ai/shift-draft.js');const {createAiShiftSearcher}=await import('../src/ai/shift-search.js');const {createAiAvailabilityDrafter}=await import('../src/ai/availability-draft.js');const {createAiScheduleAnswerer}=await import('../src/ai/schedule-questions.js');const {reconcileAvailability,startAvailabilityMatching}=await import('../src/availability/matching.js');
  const sessions=new SessionStore();sessions.cookieName='covershift_demo_'+run.runId.replace(/[^a-zA-Z0-9_]/g,'_');
  // Usage survives fresh scenarios and is kept outside individual data runs.
  const scripted=process.env.DEMO_SCRIPTED_AI==='1';
  if(scripted&&!run.manifest.presentation)throw new Error('Prepare a fresh demo to use the scripted presentation prompts.');
  const options=scripted
   ? {apiKey:'fictional-presentation-key',allowance:{reserve(){}},fetchImpl:presentationReplies(run.manifest)}
   : {apiKey:process.env.OPENAI_API_KEY,model:process.env.OPENAI_MODEL||'gpt-6-luna',allowance:new AiAllowance(join(root,'ai-usage'))};await reconcileAvailability(run.store);
  const server=createAppServer({store:run.store,sessions,aiDraft:createAiShiftDrafter(options),aiEdit:createAiShiftEditor(options),aiSearch:createAiShiftSearcher(options),aiAvailability:createAiAvailabilityDrafter(options),aiSchedule:createAiScheduleAnswerer(options),aiIntent:scripted?null:createAiIntentClassifier(options)});
  let matching;server.on('close',()=>matching?.stop());server.on('error',error=>{console.error(error.code==='EADDRINUSE'?`Port ${port} is in use. Stop the other demo, or use DEMO_PORT=3036 npm run demo:start. Do not stop an unrelated server.`:'Demo server could not start. Check the local port and storage.');process.exitCode=1;});
  server.listen(port,'127.0.0.1',()=>{matching=startAvailabilityMatching(run.store);show(run,port);console.log(scripted?'Scripted demo replies enabled for the two walkthrough prompts.':process.env.OPENAI_API_KEY?'AI configured; existing provider usage/rate limits apply.':'AI is not configured. Manual schedules, claims, approvals, history and notifications still work.');console.log('Demo is running locally. Keep this terminal open; Ctrl+C stops it.');});
  for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>{server.close();server.closeIdleConnections();});
 }
}catch(error){console.error(error.code==='ENOENT'?'No prepared demo found. Run npm run demo:prepare first.':error.message);process.exitCode=1;}
