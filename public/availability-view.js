import {requestJSON} from './request.js';
import {element} from './shift-card.js';
export function availabilityRange(r,timezone){return new Intl.DateTimeFormat('en-US',{timeZone:timezone,dateStyle:'medium',timeStyle:'short'}).formatRange(new Date(r.startsAt),new Date(r.endsAt));}

export const initials=name=>name.trim().split(/\s+/u).filter(Boolean).slice(0,2).map(part=>Array.from(part)[0]).join('').toUpperCase();
export const filterAvailability=(workers,status)=>status==='all'?[...workers]:workers.filter(worker=>worker.status===status);
export function availabilityFormWindow(day,from,until,nextDay,timezone){
  const date=new Date(day+'T12:00:00Z');
  if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==day||!/^([01]\d|2[0-3]):[0-5]\d$/.test(from)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(until))throw new Error('Choose a valid date and times.');
  if(nextDay)date.setUTCDate(date.getUTCDate()+1);
  const window={startLocal:day+'T'+from,endLocal:date.toISOString().slice(0,10)+'T'+until,timezone};
  const hours=(Date.parse(window.endLocal+'Z')-Date.parse(window.startLocal+'Z'))/3600000;
  if(hours<=0||hours>24)throw new Error('Choose a period of up to 24 hours. Select Ends next day for an overnight window.');
  return window;
}


export function ownWindowGroups(windows,horizon){
  const current=windows.filter(r=>r.status==='confirmed');
  return {
    upcoming:current.filter(r=>r.startsAt<horizon.endsAt&&r.endsAt>horizon.startsAt).sort((a,b)=>a.startsAt.localeCompare(b.startsAt)||a.id.localeCompare(b.id)).map(r=>({...r,startsAt:r.startsAt<horizon.startsAt?horizon.startsAt:r.startsAt,endsAt:r.endsAt>horizon.endsAt?horizon.endsAt:r.endsAt,clipped:r.startsAt<horizon.startsAt||r.endsAt>horizon.endsAt})),
    later:current.filter(r=>r.startsAt>=horizon.endsAt).sort((a,b)=>a.startsAt.localeCompare(b.startsAt)||a.id.localeCompare(b.id)),
    history:windows.filter(r=>r.status!=='confirmed')
  };
}
export function horizonLabel(horizon){const format=new Intl.DateTimeFormat('en-US',{timeZone:'UTC',dateStyle:'medium'});return format.formatRange(new Date(horizon.startDate+'T12:00Z'),new Date(horizon.endDate+'T12:00Z'));}

export async function mountAvailability(main,account,csrf,{coworkers=globalThis.location?.hash==='#coworkers',ownDraft=null}={}){
  coworkers=account.user.role==='worker'&&coworkers;
  const manager=account.user.role==='manager',teamView=manager||coworkers,timezone=account.business.timezone,base=coworkers?'/api/worker/coworker-availability':`/api/${account.user.role}/availability-windows`;
  main.classList.add('availability-page');
  const form=`<form id="av-form"><div class="availability-fields"><label for="av-date">Date<input id="av-date" type="date" required></label><label for="av-from">From<input id="av-from" type="time" value="09:00" required></label><label for="av-until">Until<input id="av-until" type="time" value="17:00" required></label>${teamView?'<button id="av-review" class="solid-link" type="submit">Check availability</button>':''}</div><label class="availability-overnight"><input id="av-overnight" type="checkbox"> Ends next day</label>${teamView?'':'<button id="av-review" class="solid-link" type="submit">Review availability <span aria-hidden="true">→</span></button>'}</form>`;
  const rules=`<div class="availability-meta"><span>Times in <strong id="av-zone"></strong></span><details><summary>How availability works</summary><p>Choose a future period of up to 24 local hours, starting within 90 days. Select “Ends next day” for overnight periods. Available requires confirmed windows covering the entire period with no known conflicts. Missing evidence is Unknown. Availability does not reserve a worker or activate automatic requests.</p></details></div>`;
  const confirmation=`<section id="av-confirmation" class="coverage-confirm" aria-label="Review availability" tabindex="-1" hidden><h3>Confirm your availability</h3><p id="av-summary"></p><p>Your managers can see these times. Coworkers can see your free availability windows in the next 14 days and check your status for a selected period, subject to current conflicts. This does not request or assign any shift.</p><div class="create-actions"><button id="av-edit" class="logout-button" type="button">Edit times</button><button id="av-save" class="solid-link" type="button">Confirm availability</button></div></section>`;
  const results=`<section class="availability-results" aria-label="${teamView?'Team availability':'Saved availability'}"><div class="availability-list-heading"><h2>${teamView?(coworkers?'Your coworkers':'Your team'):'Upcoming windows · next 14 days'}</h2><span id="av-count" class="section-note" role="status"></span></div><div id="av-filters" class="availability-filters" role="group" aria-label="Filter availability" hidden>${['all','available','unavailable','unknown'].map(v=>`<button type="button" class="logout-button" data-status="${v}" aria-pressed="${v==='all'}">${v==='all'?'All':v[0].toUpperCase()+v.slice(1)}</button>`).join('')}</div><p id="av-period" class="section-note" hidden></p><p id="av-own-range" class="section-note" hidden></p><div id="av-results"></div><p id="av-freshness" class="section-note" role="status"></p></section>`;
  main.innerHTML=`<p class="eyebrow">${teamView?(coworkers?'Find shift cover':'Team planning'):'Your working week'}</p><div class="page-heading"><div><h1>${teamView?(coworkers?'Who could cover your shift?':'Who can work?'):'Make time for what works.'}</h1><p class="subtitle">${teamView?(coworkers?'Check your coworkers’ availability, then ask before requesting a change.':'The right people, at the right time.'):'Share when you can work with your team.'}</p></div><button id="av-refresh" class="logout-button" type="button">Refresh</button></div>${manager?'':`<div class="availability-view-switch" role="group" aria-label="Availability view"><button type="button" id="av-own-view" class="logout-button" aria-pressed="${!coworkers}">My availability</button><button type="button" id="av-coworker-view" class="logout-button" aria-pressed="${coworkers}">Coworkers</button></div>`}<p id="av-message" role="status" tabindex="-1" hidden></p><p id="av-error" role="alert" tabindex="-1" hidden></p>${coworkers?`<section class="availability-peer-upcoming" aria-label="Coworker upcoming windows"><div class="availability-list-heading"><h2>Upcoming windows · next 14 days</h2><span id="av-peer-count" class="section-note" role="status"></span></div><p id="av-peer-range" class="section-note"></p><p class="section-note">Confirmed free time after current commitments. Missing windows do not prove someone is unavailable.</p><div id="av-peer-windows"></div><p id="av-peer-freshness" class="section-note" role="status"></p></section><details class="availability-shift-check"><summary>Check availability for a specific shift</summary><section class="panel availability-form availability-manager-form" aria-label="Choose a period">${form}</section>${rules}<div id="av-stats" class="availability-stats" aria-label="Availability summary" hidden></div>${results}</details><p class="availability-disclaimer">Ask your coworker before arranging cover. Available time does not reserve them or change a shift. Manager approval is still required for a coverage transfer.</p>`:teamView?`<section class="panel availability-form availability-manager-form" aria-label="Choose a period">${form}</section>${rules}<div id="av-stats" class="availability-stats" aria-label="Availability summary" hidden></div>${results}${coworkers?'<p class="availability-disclaimer">Ask your coworker before arranging cover. Availability does not reserve them or change a shift. Manager approval is still required for a coverage transfer.</p>':''}`:`${rules}<div class="availability-employee-layout"><section class="panel availability-form"><h2>Add availability</h2>${form}${confirmation}</section>${results}</div><p class="availability-disclaimer">Coworkers can see your free availability in the next 14 days. This does not turn on automatic shift requests; manage those rules separately in AI chat.</p>`}`;
  const q=id=>main.querySelector('#'+id);q('av-zone').textContent=timezone;
  if(!teamView&&ownDraft){for(const id of ['av-date','av-from','av-until'])q(id).value=ownDraft[id];q('av-overnight').checked=ownDraft.overnight;}
  let busy=false,review=null,uncertain=null,query=null,team=null,statusFilter='all';
  const message=(id,text)=>{q(id).textContent=text;q(id).hidden=false;q(id).focus();};
  const clear=()=>{q('av-error').hidden=true;q('av-message').hidden=true;};
  function controls(){q('av-refresh').disabled=busy;q('av-review').disabled=busy||Boolean(uncertain)||Boolean(review);for(const id of ['av-date','av-from','av-until','av-overnight'])q(id).disabled=busy||Boolean(review)||Boolean(uncertain);if(!teamView){q('av-edit').disabled=busy||Boolean(uncertain);q('av-save').disabled=busy||Boolean(uncertain);}if(!manager)for(const id of ['av-own-view','av-coworker-view'])q(id).disabled=busy||Boolean(review)||Boolean(uncertain);for(const b of main.querySelectorAll('[data-status]'))b.disabled=busy;for(const b of main.querySelectorAll('[data-withdraw],[data-withdraw-confirm]'))b.disabled=busy||Boolean(uncertain);}
  async function api(path,input){
    const r=await requestJSON(path,input===undefined?{cache:'no-store'}:{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify(input)});
    if(r.status===401){location.replace('/login?expired=1');throw new Error('Please sign in again.');}
    if(!r.ok)throw new Error(r.data.message||'Unable to load availability. Please refresh.');return r.data;
  }
  function reset(){review=null;q('av-confirmation').hidden=true;q('av-form').reset();}
  function renderTeam(){
    const root=q('av-results');root.replaceChildren();if(!team)return;
    const shown=filterAvailability(team.workers,statusFilter);
    const noun=coworkers?'coworker':'employee';q('av-count').textContent=statusFilter==='all'?`${team.workers.length} ${noun}${team.workers.length===1?'':'s'}`:`${shown.length} of ${team.workers.length} ${noun}s`;
    q('av-filters').hidden=false;
    for(const b of main.querySelectorAll('[data-status]'))b.setAttribute('aria-pressed',String(b.dataset.status===statusFilter));
    if(!shown.length){root.append(element('p','empty-state',team.workers.length?(coworkers?'No coworkers match this status. Choose another filter.':'No employees match this status. Choose another filter.'):coworkers?'No active coworkers yet.':'No active employees yet. Add employees in Team.'));return;}
    const table=element('div','availability-table');
    const head=element('div','availability-table-head');for(const label of [coworkers?'Coworker':'Employee','Availability','Reason'])head.append(element('span','',label));table.append(head);
    for(const r of shown){const row=element('article','availability-team-row'),name=element('div','availability-person'),avatar=element('span','availability-avatar',initials(r.name));avatar.setAttribute('aria-hidden','true');name.append(avatar,element('h3','',r.name));row.append(name,element('span','availability-status '+r.status,r.status[0].toUpperCase()+r.status.slice(1)),element('p','availability-reason',r.reasons.join(' · ')));table.append(row);}root.append(table);
  }
  function windowCard(r){
    const card=element('article','panel availability-window'),date=element('div','availability-dateblock'),details=element('div','availability-window-details');
    date.setAttribute('aria-hidden','true');date.append(element('span','',new Intl.DateTimeFormat('en-US',{timeZone:r.timezone,month:'short'}).format(new Date(r.startsAt))),element('strong','',new Intl.DateTimeFormat('en-US',{timeZone:r.timezone,day:'numeric'}).format(new Date(r.startsAt))));
    details.append(element(r.status==='available'?'h4':'h3','',new Intl.DateTimeFormat('en-US',{timeZone:r.timezone,weekday:'long'}).format(new Date(r.startsAt))),element('p','',availabilityRange(r,r.timezone)),element('span','availability-status '+r.status,r.status[0].toUpperCase()+r.status.slice(1)));
    if(r.clipped)details.append(element('p','availability-reason','Shown within this 14-day range. Withdrawing removes the entire saved window.'));
    if(r.timezone!==timezone)details.append(element('p','availability-reason','Saved in '+r.timezone+'. Business timezone changed; withdraw and save new times.'));
    card.append(date,details);
    if(r.status==='confirmed'){const button=element('button','logout-button availability-withdraw','Withdraw');button.type='button';button.setAttribute('aria-label','Withdraw availability: '+availabilityRange(r,r.timezone));button.dataset.withdraw=r.id;button.addEventListener('click',()=>{
      const confirm=element('div','coverage-confirm availability-withdraw-review'),text=element('p','',r.clipped?'Withdraw the entire saved window, including time outside this view? Existing shifts and automatic request rules will remain unchanged.':'Withdraw this window? Existing shifts and automatic request rules will remain unchanged.'),yes=element('button','logout-button','Confirm withdrawal'),no=element('button','logout-button','Keep availability');yes.type=no.type='button';yes.dataset.withdrawConfirm='';no.dataset.withdrawConfirm='';
      yes.addEventListener('click',()=>mutate('withdraw',r));no.addEventListener('click',()=>{confirm.remove();button.hidden=false;button.focus();});confirm.append(text,yes,no);card.append(confirm);button.hidden=true;yes.focus();
    });card.append(button);}return card;
  }
  function render(data){
    const root=q('av-results');root.replaceChildren();
    q('av-freshness').textContent=`Checked ${new Intl.DateTimeFormat('en-US',{timeZone:timezone,dateStyle:'medium',timeStyle:'medium'}).format(new Date(data.checkedAt))}. ${teamView?'Snapshot only: refresh before planning.':'Full windows are visible to you and your managers. Coworkers can see your free windows in the next 14 days.'}`;
    if(teamView){
      team=data;q('av-period').textContent=availabilityRange(data,timezone);q('av-period').hidden=false;
      const counts={available:0,unavailable:0,unknown:0};for(const r of data.workers)counts[r.status]++;
      q('av-stats').replaceChildren();q('av-stats').hidden=false;
      for(const [status,count]of Object.entries(counts)){const stat=element('article','panel availability-stat');stat.append(element('span','availability-stat-label '+status,status[0].toUpperCase()+status.slice(1)),element('strong','',String(count)));q('av-stats').append(stat);}renderTeam();
    }else{
      const {upcoming,later,history}=ownWindowGroups(data.windows,data.horizon);
      q('av-own-range').textContent=horizonLabel(data.horizon)+' · '+timezone;q('av-own-range').hidden=false;
      q('av-count').textContent=`${upcoming.length} confirmed`;
      if(!upcoming.length)root.append(element('p','empty-state','No confirmed windows in the next 14 days. Add availability to share new times.'));
      for(const r of upcoming)root.append(windowCard(r));
      for(const [label,records]of [['Later availability',later],['Past & withdrawn windows',history]])if(records.length){const archive=element('details','availability-history'),summary=element('summary','',`${label} (${records.length})`);archive.append(summary);for(const r of records)archive.append(windowCard(r));root.append(archive);}

    }
  }
  async function loadUpcoming(){
    if(!coworkers||busy)return;busy=true;controls();
    const root=q('av-peer-windows');root.replaceChildren(element('p','section-note','Loading upcoming windows…'));q('av-peer-count').textContent='';q('av-peer-range').textContent='';q('av-peer-freshness').textContent='';
    try{
      const data=await api('/api/worker/coworker-windows');root.replaceChildren();
      q('av-peer-range').textContent=horizonLabel(data.horizon)+' · '+data.timezone;
      const count=data.workers.reduce((sum,u)=>sum+u.windows.length,0);q('av-peer-count').textContent=`${count} free window${count===1?'':'s'}`;
      if(!data.workers.length)root.append(element('p','empty-state','No active coworkers yet.'));
      for(const worker of data.workers){const group=element('section','availability-peer-group'),heading=element('div','availability-person'),avatar=element('span','availability-avatar',initials(worker.name));avatar.setAttribute('aria-hidden','true');heading.append(avatar,element('h3','',worker.name));group.append(heading);
        if(!worker.windows.length)group.append(element('p','section-note','No confirmed free windows in the next 14 days.'));
        for(const r of worker.windows)group.append(windowCard({...r,timezone:data.timezone,status:'available'}));root.append(group);
      }
      q('av-peer-freshness').textContent='Checked '+new Intl.DateTimeFormat('en-US',{timeZone:timezone,dateStyle:'medium',timeStyle:'medium'}).format(new Date(data.checkedAt))+'. Ask your coworker before arranging cover.';
    }catch(error){root.replaceChildren();const alert=element('p','availability-upcoming-error','Upcoming windows could not be loaded. Use Refresh to retry. '+error.message);alert.setAttribute('role','alert');root.append(alert);}finally{busy=false;controls();}
  }
  async function refresh(){if(busy)return;if(coworkers)await loadUpcoming();await load();}
  async function load(){
    if(busy)return;clear();busy=true;controls();q('av-results').replaceChildren(element('p','','Loading availability…'));q('av-freshness').textContent='';q('av-count').textContent='';q('av-own-range').hidden=true;if(teamView){team=null;q('av-stats').hidden=true;q('av-filters').hidden=true;q('av-period').hidden=true;}
    try{
      if(teamView&&!query){q('av-results').replaceChildren(element('p','empty-state','Choose a period above to see availability.'));return;}
      const data=await api(base+(teamView?'?'+new URLSearchParams(query):''));render(data);
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
  if(teamView)for(const id of ['av-date','av-from','av-until','av-overnight'])q(id).addEventListener('input',()=>{query=null;team=null;q('av-freshness').textContent='Filters changed. Check availability again.';q('av-count').textContent='';q('av-stats').hidden=true;q('av-filters').hidden=true;q('av-period').hidden=true;q('av-results').replaceChildren();});
  for(const b of main.querySelectorAll('[data-status]'))b.addEventListener('click',()=>{if(busy||!team)return;statusFilter=b.dataset.status;renderTeam();});
  if(!manager)for(const [id,next] of [['av-own-view',false],['av-coworker-view',true]])q(id).addEventListener('click',async()=>{if(busy||review||uncertain||next===coworkers)return;if(!coworkers)ownDraft={...Object.fromEntries(['av-date','av-from','av-until'].map(id=>[id,q(id).value])),overnight:q('av-overnight').checked};history.replaceState(null,'',location.pathname+location.search+(next?'#coworkers':''));await mountAvailability(main,account,csrf,{coworkers:next,ownDraft});main.querySelector('#'+id)?.focus();});
  q('av-refresh').addEventListener('click',refresh);
  q('av-form').addEventListener('submit',async e=>{
    e.preventDefault();if(busy||uncertain)return;clear();let window;try{window=availabilityFormWindow(q('av-date').value,q('av-from').value,q('av-until').value,q('av-overnight').checked,timezone);}catch(error){message('av-error',error.message);return;}
    if(teamView){query=window;await load();return;}
    review={window,submissionId:crypto.randomUUID()};q('av-summary').textContent=`${window.startLocal.replace('T',' ')} – ${window.endLocal.replace('T',' ')} · ${timezone}`;q('av-confirmation').hidden=false;controls();q('av-confirmation').focus();
  });
  if(!teamView){q('av-edit').addEventListener('click',()=>{review=null;q('av-confirmation').hidden=true;controls();q('av-date').focus();});q('av-save').addEventListener('click',()=>mutate('save'));}
  await refresh();
}
