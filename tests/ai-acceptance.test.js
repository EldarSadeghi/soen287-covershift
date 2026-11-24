import test from 'node:test';
import assert from 'node:assert/strict';
import {runScenario,summarize,MODE} from '../scripts/ai-acceptance/harness.js';
import {scenarios} from '../scripts/ai-acceptance/scenarios.js';
import {reportHtml} from '../scripts/ai-acceptance/report.js';
for(const scenario of scenarios) test(scenario.id+': '+scenario.title,async()=>{
  const r=await runScenario(scenario);assert.equal(r.status,'pass',JSON.stringify(r));
});
test('acceptance scoring fails on broken/swallowed assertions, empty scenarios and unused provider turns',async()=>{
  const cases=[{id:'BROKEN',title:'Fictional failure',run:c=>c.check('expected','Known false expectation',false)},
    {id:'SWALLOWED',title:'Caught failure',run:async c=>{try{c.check('failure','Cannot hide failure',false);}catch{}c.check('later','Later successful check',true);}},
    {id:'EMPTY',title:'No checks',run:async()=>{}},
    {id:'UNUSED',title:'Unused replay',run:async c=>{c.expect({task:'unused'});c.check('setup','Fixture has real records',true);}}];
  const results=[];for(const s of cases)results.push(await runScenario(s));
  const report=summarize(results);assert.equal(report.failed,4);assert.equal(report.passed,0);assert.equal(report.mode,MODE);assert.equal(report.results[0].checks[0].status,'fail');
  assert.doesNotMatch(JSON.stringify(report),/fictional-offline-key-never-sent|passwordHash|covershift_session/);
});
test('local report escapes text and distinguishes recorded fixtures from language evaluation',()=>{
  const report=summarize([{id:'<script>',title:'<img src=x onerror=alert(1)>',status:'fail',checks:[],providerCalls:0,error:'<unsafe>'}]);
  const html=reportHtml(report);assert.doesNotMatch(html,/<script>|<img|<unsafe>/);assert.match(html,/&lt;script&gt;/);assert.match(html,/not real-model language understanding/);assert.match(html,/0\/1 scenarios passed/);
});
