// Intentionally does not load .env or import the configured real storage.
import {fileURLToPath} from 'node:url';
import {mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {runScenario,summarize} from './ai-acceptance/harness.js';
import {scenarios} from './ai-acceptance/scenarios.js';
import {reportHtml} from './ai-acceptance/report.js';
const args=process.argv.slice(2);
try {
  if(args.length && (args.length!==2||args[0]!=='--case'||!scenarios.some(s=>s.id===args[1]))) throw new Error('Use npm run ai:acceptance, or npm run ai:acceptance -- --case CS029-C01.');
  const selected=args.length?scenarios.filter(s=>s.id===args[1]):scenarios;
  const results=[];
  console.log('CS-029 offline acceptance: fictional data, recorded replies, no paid provider calls.');
  for(const scenario of selected){const result=await runScenario(scenario);results.push(result);console.log(`${result.status.toUpperCase()} ${result.id}: ${result.title}${result.error?' — '+result.error:''}`);}
  const report=summarize(results),root=fileURLToPath(new URL('../.covershift-ai-acceptance/',import.meta.url));
  await mkdir(root,{recursive:true,mode:0o700});const dir=await mkdtemp(join(root,'run-'));
  await writeFile(join(dir,'results.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx',mode:0o600});
  await writeFile(join(dir,'index.html'),reportHtml(report),{flag:'wx',mode:0o600});
  console.log(`\n${report.passed}/${report.total} passed; ${report.failed} failed; ${report.checks} checks.\nReport: ${join(dir,'index.html')}\nJSON: ${join(dir,'results.json')}\n${report.limitation}`);
  if(report.failed) process.exitCode=1;
} catch(error) {console.error(error.message.startsWith('Use npm run')?error.message:'Acceptance runner could not write its local report. Check test-server permissions and local report storage.');process.exitCode=1;}
