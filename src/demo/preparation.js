import { addPresentationScenarios } from './presentation.js';
import {mkdir,mkdtemp,lstat,readFile,writeFile,rename,unlink} from 'node:fs/promises';
import {join,resolve} from 'node:path';import {randomUUID} from 'node:crypto';
import {JsonStore} from '../storage/json-store.js';import {assertLocalDemo,buildDemoFixtures,DEMO_PASSWORD} from './fixtures.js';
const MAGIC='CoverShift local demonstration runs v1\n';const validRun=id=>typeof id==='string'&&/^run-[a-zA-Z0-9_-]{1,80}$/.test(id);
async function regular(path,directory=false){const s=await lstat(path);if(s.isSymbolicLink()||!(directory?s.isDirectory():s.isFile()))throw new Error('Unsafe demo path: expected a real '+(directory?'directory.':'file.'));return s;}
async function json(path){const s=await regular(path);if(s.size>65536)throw new Error('Demo metadata is too large.');return JSON.parse(await readFile(path,'utf8'));}
async function rootDirectory(root,create){root=resolve(root);let made=false;try{if(create){await mkdir(root,{mode:0o700});made=true;}}catch(e){if(e.code!=='EEXIST')throw e;}
 await regular(root,true);const marker=join(root,'.managed-by-covershift');if(made)await writeFile(marker,MAGIC,{flag:'wx',mode:0o600});await regular(marker);if(await readFile(marker,'utf8')!==MAGIC)throw new Error('This directory is not managed CoverShift demo storage.');
 if(create){try{await mkdir(join(root,'runs'),{mode:0o700});}catch(e){if(e.code!=='EEXIST')throw e;}}await regular(join(root,'runs'),true);return root;
}
async function pointer(root){const data=await json(join(root,'latest.json'));if(data.version!==1||!validRun(data.runId))throw new Error('Invalid demo selection. Prepare a new demo in managed storage.');return data;}
export async function prepareDemo(root,{now=Date.now(),timezone='America/Toronto',hash}={}){
 assertLocalDemo();root=await rootDirectory(root,true);
 try{await pointer(root);}catch(e){if(e.code!=='ENOENT')throw e;}
 const runDirectory=await mkdtemp(join(root,'runs',`run-${new Date(now).toISOString().slice(0,10)}-`)),runId=runDirectory.split(/[\\/]/).at(-1),store=new JsonStore(join(runDirectory,'covershift.json'));
 const fixtures=await buildDemoFixtures(store,{now,timezone,...(hash?{hash}:{})});const manifest=await addPresentationScenarios(store,fixtures,now);await writeFile(join(runDirectory,'manifest.json'),JSON.stringify({...manifest,runId},null,2)+'\n',{flag:'wx',mode:0o600});await writeFile(join(runDirectory,'WALKTHROUGH.md'),demoGuide({...manifest,runId}),{flag:'wx',mode:0o600});
 const latest=join(root,'latest.json'),temp=join(root,`.latest-${randomUUID()}.tmp`);try{await writeFile(temp,JSON.stringify({version:1,runId})+'\n',{flag:'wx',mode:0o600});await rename(temp,latest);}finally{await unlink(temp).catch(e=>{if(e.code!=='ENOENT')throw e;});}
 return {root,runDirectory,runId,store,manifest:{...manifest,runId}};
}
export async function loadDemo(root){assertLocalDemo();root=await rootDirectory(root,false);const {runId}=await pointer(root),runDirectory=join(root,'runs',runId);await regular(runDirectory,true);const manifest=await json(join(runDirectory,'manifest.json'));
 if(manifest.version!==1||manifest.runId!==runId||typeof manifest.businessId!=='string'||!manifest.businessId.startsWith('business_demo_')||!manifest.dates?.thursday||manifest.timezone!=='America/Toronto')throw new Error('Invalid demo manifest. Prepare a new demo.');
 await regular(join(runDirectory,'covershift.json'));const store=new JsonStore(join(runDirectory,'covershift.json')),db=await store.read();if(db.businesses.length!==1||db.businesses[0].id!==manifest.businessId||db.businesses[0].timezone!==manifest.timezone||!db.users.some(u=>u.id==='manager_morgan'&&u.role==='manager'&&u.businessId===manifest.businessId)||!db.users.some(u=>u.id==='worker_jamie'&&u.role==='worker'&&u.businessId===manifest.businessId))throw new Error('Selected database does not match this fictional demo run.');return {root,runDirectory,runId,manifest,store};
}
export function demoGuide(m) {
  const { thursday } = m.dates;
  const { startsOn, endsOn, summaryWeek, batchPrompt, searchPrompt } = m.presentation;
  return `# CoverShift presentation demo

Prepared ${m.createdAt}. Business timezone ${m.timezone}. Run ${m.runId}. All accounts and records are fictional.

## Sign in

Run \`npm run demo:start\` for the normal demo or \`DEMO_SCRIPTED_AI=1 npm run demo:start\` for the two recorded prompts below. Use the printed port if you set \`DEMO_PORT\`.

- Morgan Chen, manager: manager_morgan@example.test at http://localhost:3035/login
- Jamie Lee, employee: worker_jamie@example.test at http://127.0.0.1:3035/login
- Alex Morgan, employee: worker_alex@example.test at http://127.0.0.1:3035/login in a separate browser profile or private window

Demo passphrase for all three: ${DEMO_PASSWORD}

## Jamie: Search, follow up, and summarize

Send this exact search prompt in a new chat:

> ${searchPrompt}

The assistant should show Afternoon coverage, Evening coverage, and Closing coverage. Ask “Why can't I take the second one?” to check Evening coverage. Then ask “What else is available?” to see two alternatives using the same date, time and title filters. Reviewing an alternative keeps it unrequested until you confirm.

Ask “Show my working week for ${summaryWeek} week.” Jamie starts with two assignments and one pending coverage claim in the Thursday–Saturday scenario week. The working-week and other saved-record queries do not require a provider.

## Alex and Morgan: Shared availability and attention

Alex already has a confirmed availability window on ${thursday}, 5–8 PM. In a new chat as Jamie, ask “Who’s free on ${thursday}?” to see Alex's available hours. Alex can inspect the original window in Availability.

As Morgan, ask “What needs my attention ${summaryWeek} week?” before approving or claiming anything. The demo starts with one pending approval and four open requests for cover. These are requests on existing assigned shifts. Open Approvals and Schedule from the summary for the current saved records.

## Morgan: Batch review and publication

Send this exact prompt in a new chat:

> ${batchPrompt}

Review both proposals and edit any field before confirmation. The second shift ends the next day. **Confirm and save 2 shifts** stages both drafts together. As Jamie, refresh My shifts and check that Presentation opening is still private. Morgan can review the prepared ${startsOn}–${endsOn} schedule and manually publish it. Refresh Jamie’s schedule to see the assignment. The demo supports rehearsing the publish action outside the normal Monday due date.

## Rehearse again

Stop the demo server with Ctrl+C. Run \`npm run demo:prepare\` to select a new isolated run, then start it again. Preparing a new run preserves previous runs and normal accounts. Prepare shortly before the presentation because the schedule uses real calendar dates.

Scripted mode uses recorded replies for the two quoted prompts and exercises real schedule validation, search, save, and publication. The normal demo uses the configured provider. If the provider is unavailable, use scripted mode or the manual workspace controls. This local demo is separate from CS-043 deployment and final submission.
`;
}
