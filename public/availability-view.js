import {requestJSON} from './request.js';
import {element} from './shift-card.js';
export function availabilityRange(r,timezone){return new Intl.DateTimeFormat('en-US',{timeZone:timezone,dateStyle:'medium',timeStyle:'short'}).formatRange(new Date(r.startsAt),new Date(r.endsAt));}
export async function mountAvailability(main,account,csrf){
  const manager=account.user.role==='manager',timezone=account.business.timezone,base=`/api/${account.user.role}/availability-windows`;
  main.innerHTML=`<p class="eyebrow">Make room for a better working week</p><div class="page-heading"><div><h1>${manager?'Who can work?':'When can you work?'}</h1><p class="subtitle">${manager?'Check your team’s saved availability for a specific period.':'Share dated availability with your managers.'}</p></div><button id="av-refresh" class="logout-button" type="button">Refresh</button></div><p class="section-note">All times use <strong id="av-zone"></strong>. Availability is advisory, not a reservation. Existing shifts and coverage requests stay unchanged. Automatic request rules in chat are separate.</p><p id="av-message" role="status" tabindex="-1" hidden></p><p id="av-error" role="alert" tabindex="-1" hidden></p><section class="panel availability-form"><h2>${manager?'Choose a period':'Add availability'}</h2><p>Choose a future period of up to 24 local hours, starting within 90 days. For overnight availability, use the next date for the end.</p><form id="av-form"><div class="availability-dates"><div><label for="av-start">Start date and time</label><input id="av-start" type="datetime-local" required></div><div><label for="av-end">End date and time</label><input id="av-end" type="datetime-local" required></div></div><button id="av-review" class="solid-link" type="submit">${manager?'Check availability':'Review availability'}</button></form>${manager?'':`<section id="av-confirmation" class="coverage-confirm" aria-label="Review availability" tabindex="-1" hidden><h3>Confirm your availability</h3><p id="av-summary"></p><p>Your managers will see that you can work during these times, subject to current conflicts. This does not request or assign any shift.</p><div class="create-actions"><button id="av-edit" class="logout-button" type="button">Edit times</button><button id="av-save" class="solid-link" type="button">Confirm availability</button></div></section>`}</section><section class="availability-results" aria-label="${manager?'Team availability':'Saved availability'}"><h2>${manager?'Team availability':'Your saved windows'}</h2><p id="av-freshness" role="status"></p><div id="av-results"></div></section>`;
  const q=id=>main.querySelector('#'+id);q('av-zone').textContent=timezone;
  let busy=false,review=null,uncertain=null,query=null;
  const message=(id,text)=>{q(id).textContent=text;q(id).hidden=false;q(id).focus();};
  const clear=()=>{q('av-error').hidden=true;q('av-message').hidden=true;};
  function controls(){q('av-refresh').disabled=busy;q('av-review').disabled=busy||Boolean(uncertain)||Boolean(review);for(const id of ['av-start','av-end'])q(id).disabled=busy||Boolean(review)||Boolean(uncertain);if(!manager){q('av-edit').disabled=busy||Boolean(uncertain);q('av-save').disabled=busy||Boolean(uncertain);}for(const b of main.querySelectorAll('[data-withdraw]'))b.disabled=busy||Boolean(uncertain);}
  async function api(path,input){
    const r=await requestJSON(path,input===undefined?{cache:'no-store'}:{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify(input)});
    if(r.status===401){location.replace('/login?expired=1');throw new Error('Please sign in again.');}
    if(!r.ok)throw new Error(r.data.message||'Unable to load availability. Please refresh.');return r.data;
  }
  function reset(){review=null;q('av-confirmation').hidden=true;q('av-form').reset();}
  function render(data){
    const root=q('av-results');root.replaceChildren();
    q('av-freshness').textContent=`Checked ${new Intl.DateTimeFormat('en-US',{timeZone:timezone,dateStyle:'medium',timeStyle:'medium'}).format(new Date(data.checkedAt))}. ${manager?'Snapshot only: refresh before planning.':''}`;
    if(manager){
      root.append(element('p','section-note',availabilityRange(data,timezone)));
      const counts={available:0,unavailable:0,unknown:0};for(const r of data.workers)counts[r.status]++;
      root.append(element('p','section-note',`${counts.available} Available · ${counts.unavailable} Unavailable · ${counts.unknown} Unknown`));
      if(!data.workers.length)root.append(element('p','empty-state','No active employees yet. Add employees in Team.'));
      for(const r of data.workers){const card=element('article','panel availability-row');card.append(element('h3','',r.name),element('span','availability-status '+r.status,r.status[0].toUpperCase()+r.status.slice(1)));for(const reason of r.reasons)card.append(element('p','',reason));root.append(card);}
    }else{
      if(!data.windows.length)root.append(element('p','empty-state','No availability saved yet. Add a window above. Your managers will see Unknown until you share availability.'));
      for(const r of data.windows){const card=element('article','panel availability-row');card.append(element('h3','',availabilityRange(r,r.timezone)),element('span','availability-status '+r.status,r.status[0].toUpperCase()+r.status.slice(1)));
        if(r.timezone!==timezone)card.append(element('p','','Saved in '+r.timezone+'. Business timezone changed; withdraw and save new times.'));
        if(r.status==='confirmed'){const button=element('button','logout-button','Withdraw availability');button.type='button';button.dataset.withdraw=r.id;button.addEventListener('click',()=>{
          const confirm=element('div','coverage-confirm'),text=element('p','','Withdraw this window? Existing shifts and automatic request rules will remain unchanged.'),yes=element('button','logout-button','Confirm withdrawal'),no=element('button','logout-button','Keep availability');yes.type=no.type='button';
          yes.addEventListener('click',()=>mutate('withdraw',r));no.addEventListener('click',()=>{confirm.remove();button.hidden=false;button.focus();});confirm.append(text,yes,no);card.append(confirm);button.hidden=true;yes.focus();
        });card.append(button);}root.append(card);
      }
    }
  }
  async function load(){
    if(busy)return;clear();busy=true;controls();q('av-results').replaceChildren(element('p','','Loading availability…'));q('av-freshness').textContent='';
    try{
      if(manager&&!query){q('av-results').replaceChildren(element('p','empty-state','Choose a period above to see availability.'));return;}
      const data=await api(base+(manager?'?'+new URLSearchParams(query):''));render(data);
      if(uncertain){const saved=data.windows.find(r=>uncertain.kind==='save'?r.submissionId===uncertain.input.submissionId:r.id===uncertain.record.id);
        if(saved&&(uncertain.kind==='save'||saved.status==='withdrawn')){const kind=uncertain.kind;uncertain=null;if(kind==='save')reset();message('av-message',kind==='save'?`Save recovered. This window is ${saved.status}. No shift was requested.`:'Withdrawal confirmed.');}
        else {const pending=uncertain;uncertain=null;message('av-message','No completed change was found. You can explicitly retry; the same submission is safe to reuse.');if(pending.kind==='save')review=pending.input;}
      }
    }catch(e){q('av-results').replaceChildren(element('p','empty-state','Availability is unavailable. Use Refresh to retry.'));message('av-error',e.message);}finally{busy=false;controls();}
  }
  async function mutate(kind,record){
    if(busy||uncertain)return;clear();busy=true;controls();const input=kind==='save'?review:{revision:record.revision};
    try{const data=await api(kind==='save'?base:`${base}/${record.id}/withdraw`,input);if(kind==='save')reset();busy=false;await load();message('av-message',data.message);}
    catch(e){if(e.uncertain){uncertain={kind,input,record};message('av-error','The result is uncertain. Do not submit another change. Use Refresh to check the saved result.');}else message('av-error',e.message);}
    finally{busy=false;controls();}
  }
  if(manager)for(const id of ['av-start','av-end'])q(id).addEventListener('input',()=>{query=null;q('av-freshness').textContent='Filters changed. Check availability again.';q('av-results').replaceChildren();});
  q('av-refresh').addEventListener('click',load);
  q('av-form').addEventListener('submit',async e=>{
    e.preventDefault();if(busy||uncertain)return;clear();const window={startLocal:q('av-start').value,endLocal:q('av-end').value,timezone};
    if(manager){query=window;await load();return;}
    review={window,submissionId:crypto.randomUUID()};q('av-summary').textContent=`${window.startLocal.replace('T',' ')} – ${window.endLocal.replace('T',' ')} · ${timezone}`;q('av-confirmation').hidden=false;controls();q('av-confirmation').focus();
  });
  if(!manager){q('av-edit').addEventListener('click',()=>{review=null;q('av-confirmation').hidden=true;controls();q('av-start').focus();});q('av-save').addEventListener('click',()=>mutate('save'));}
  await load();
}
