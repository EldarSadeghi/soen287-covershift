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

export async function mountAvailability(main,account,csrf){
  const manager=account.user.role==='manager',timezone=account.business.timezone,base=`/api/${account.user.role}/availability-windows`;
  main.classList.add('availability-page');
  const form=`<form id="av-form"><div class="availability-fields"><label for="av-date">Date<input id="av-date" type="date" required></label><label for="av-from">From<input id="av-from" type="time" value="09:00" required></label><label for="av-until">Until<input id="av-until" type="time" value="17:00" required></label>${manager?'<button id="av-review" class="solid-link" type="submit">Check availability</button>':''}</div><label class="availability-overnight"><input id="av-overnight" type="checkbox"> Ends next day</label>${manager?'':'<button id="av-review" class="solid-link" type="submit">Review availability <span aria-hidden="true">→</span></button>'}</form>`;
  const rules=`<div class="availability-meta"><span>Times in <strong id="av-zone"></strong></span><details><summary>How availability works</summary><p>Choose a future period of up to 24 local hours, starting within 90 days. Select “Ends next day” for overnight periods. Available requires confirmed windows covering the entire period with no known conflicts. Missing evidence is Unknown. Availability does not reserve a worker or activate automatic requests.</p></details></div>`;
  const confirmation=`<section id="av-confirmation" class="coverage-confirm" aria-label="Review availability" tabindex="-1" hidden><h3>Confirm your availability</h3><p id="av-summary"></p><p>Your managers will see that you can work during these times, subject to current conflicts. This does not request or assign any shift.</p><div class="create-actions"><button id="av-edit" class="logout-button" type="button">Edit times</button><button id="av-save" class="solid-link" type="button">Confirm availability</button></div></section>`;
  const results=`<section class="availability-results" aria-label="${manager?'Team availability':'Saved availability'}"><div class="availability-list-heading"><h2>${manager?'Your team':'Upcoming windows'}</h2><span id="av-count" class="section-note" role="status"></span></div><div id="av-filters" class="availability-filters" role="group" aria-label="Filter availability" hidden>${['all','available','unavailable','unknown'].map(v=>`<button type="button" class="logout-button" data-status="${v}" aria-pressed="${v==='all'}">${v==='all'?'All':v[0].toUpperCase()+v.slice(1)}</button>`).join('')}</div><p id="av-period" class="section-note" hidden></p><div id="av-results"></div><p id="av-freshness" class="section-note" role="status"></p></section>`;
  main.innerHTML=`<p class="eyebrow">${manager?'Team planning':'Your working week'}</p><div class="page-heading"><div><h1>${manager?'Who can work?':'Make time for what works.'}</h1><p class="subtitle">${manager?'The right people, at the right time.':'Let your manager know when you can work.'}</p></div><button id="av-refresh" class="logout-button" type="button">Refresh</button></div><p id="av-message" role="status" tabindex="-1" hidden></p><p id="av-error" role="alert" tabindex="-1" hidden></p>${manager?`<section class="panel availability-form availability-manager-form" aria-label="Choose a period">${form}</section>${rules}<div id="av-stats" class="availability-stats" aria-label="Availability summary" hidden></div>${results}`:`${rules}<div class="availability-employee-layout"><section class="panel availability-form"><h2>Add availability</h2>${form}${confirmation}</section>${results}</div><p class="availability-disclaimer">Sharing availability does not turn on automatic shift requests. Manage those rules separately in AI chat.</p>`}`;
  const q=id=>main.querySelector('#'+id);q('av-zone').textContent=timezone;
  let busy=false,review=null,uncertain=null,query=null,team=null,statusFilter='all';
  const message=(id,text)=>{q(id).textContent=text;q(id).hidden=false;q(id).focus();};
  const clear=()=>{q('av-error').hidden=true;q('av-message').hidden=true;};
  function controls(){q('av-refresh').disabled=busy;q('av-review').disabled=busy||Boolean(uncertain)||Boolean(review);for(const id of ['av-date','av-from','av-until','av-overnight'])q(id).disabled=busy||Boolean(review)||Boolean(uncertain);if(!manager){q('av-edit').disabled=busy||Boolean(uncertain);q('av-save').disabled=busy||Boolean(uncertain);}for(const b of main.querySelectorAll('[data-status]'))b.disabled=busy;for(const b of main.querySelectorAll('[data-withdraw],[data-withdraw-confirm]'))b.disabled=busy||Boolean(uncertain);}
  async function api(path,input){
    const r=await requestJSON(path,input===undefined?{cache:'no-store'}:{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify(input)});
    if(r.status===401){location.replace('/login?expired=1');throw new Error('Please sign in again.');}
    if(!r.ok)throw new Error(r.data.message||'Unable to load availability. Please refresh.');return r.data;
  }
  function reset(){review=null;q('av-confirmation').hidden=true;q('av-form').reset();}
  function renderTeam(){
    const root=q('av-results');root.replaceChildren();if(!team)return;
    const shown=filterAvailability(team.workers,statusFilter);
    q('av-count').textContent=statusFilter==='all'?`${team.workers.length} employee${team.workers.length===1?'':'s'}`:`${shown.length} of ${team.workers.length} employees`;
    q('av-filters').hidden=false;
    for(const b of main.querySelectorAll('[data-status]'))b.setAttribute('aria-pressed',String(b.dataset.status===statusFilter));
    if(!shown.length){root.append(element('p','empty-state',team.workers.length?'No employees match this status. Choose another filter.':'No active employees yet. Add employees in Team.'));return;}
    const table=element('div','availability-table');
    const head=element('div','availability-table-head');for(const label of ['Employee','Availability','Reason'])head.append(element('span','',label));table.append(head);
    for(const r of shown){const row=element('article','availability-team-row'),name=element('div','availability-person'),avatar=element('span','availability-avatar',initials(r.name));avatar.setAttribute('aria-hidden','true');name.append(avatar,element('h3','',r.name));row.append(name,element('span','availability-status '+r.status,r.status[0].toUpperCase()+r.status.slice(1)),element('p','availability-reason',r.reasons.join(' · ')));table.append(row);}root.append(table);
  }
  function windowCard(r){
    const card=element('article','panel availability-window'),date=element('div','availability-dateblock'),details=element('div','availability-window-details');
    date.setAttribute('aria-hidden','true');date.append(element('span','',new Intl.DateTimeFormat('en-US',{timeZone:r.timezone,month:'short'}).format(new Date(r.startsAt))),element('strong','',new Intl.DateTimeFormat('en-US',{timeZone:r.timezone,day:'numeric'}).format(new Date(r.startsAt))));
    details.append(element('h3','',new Intl.DateTimeFormat('en-US',{timeZone:r.timezone,weekday:'long'}).format(new Date(r.startsAt))),element('p','',availabilityRange(r,r.timezone)),element('span','availability-status '+r.status,r.status[0].toUpperCase()+r.status.slice(1)));
    if(r.timezone!==timezone)details.append(element('p','availability-reason','Saved in '+r.timezone+'. Business timezone changed; withdraw and save new times.'));
    card.append(date,details);
    if(r.status==='confirmed'){const button=element('button','logout-button availability-withdraw','Withdraw');button.type='button';button.setAttribute('aria-label','Withdraw availability: '+availabilityRange(r,r.timezone));button.dataset.withdraw=r.id;button.addEventListener('click',()=>{
      const confirm=element('div','coverage-confirm availability-withdraw-review'),text=element('p','','Withdraw this window? Existing shifts and automatic request rules will remain unchanged.'),yes=element('button','logout-button','Confirm withdrawal'),no=element('button','logout-button','Keep availability');yes.type=no.type='button';yes.dataset.withdrawConfirm='';no.dataset.withdrawConfirm='';
      yes.addEventListener('click',()=>mutate('withdraw',r));no.addEventListener('click',()=>{confirm.remove();button.hidden=false;button.focus();});confirm.append(text,yes,no);card.append(confirm);button.hidden=true;yes.focus();
    });card.append(button);}return card;
  }
  function render(data){
    const root=q('av-results');root.replaceChildren();
    q('av-freshness').textContent=`Checked ${new Intl.DateTimeFormat('en-US',{timeZone:timezone,dateStyle:'medium',timeStyle:'medium'}).format(new Date(data.checkedAt))}. ${manager?'Snapshot only: refresh before planning.':'Visible to you and your managers.'}`;
    if(manager){
      team=data;q('av-period').textContent=availabilityRange(data,timezone);q('av-period').hidden=false;
      const counts={available:0,unavailable:0,unknown:0};for(const r of data.workers)counts[r.status]++;
      q('av-stats').replaceChildren();q('av-stats').hidden=false;
      for(const [status,count]of Object.entries(counts)){const stat=element('article','panel availability-stat');stat.append(element('span','availability-stat-label '+status,status[0].toUpperCase()+status.slice(1)),element('strong','',String(count)));q('av-stats').append(stat);}renderTeam();
    }else{
      const upcoming=data.windows.filter(r=>r.status==='confirmed').sort((a,b)=>a.startsAt.localeCompare(b.startsAt)||a.id.localeCompare(b.id)),history=data.windows.filter(r=>r.status!=='confirmed');
      q('av-count').textContent=`${upcoming.length} confirmed`;
      if(!upcoming.length)root.append(element('p','empty-state',data.windows.length?'No upcoming availability. Add a window to share new times.':'No availability saved yet. Add a window to share your times. Your managers will see Unknown until you do.'));
      for(const r of upcoming)root.append(windowCard(r));
      if(history.length){const archive=element('details','availability-history'),summary=element('summary','',`Past & withdrawn windows (${history.length})`);archive.append(summary);for(const r of history)archive.append(windowCard(r));root.append(archive);}
    }
  }
  async function load(){
    if(busy)return;clear();busy=true;controls();q('av-results').replaceChildren(element('p','','Loading availability…'));q('av-freshness').textContent='';q('av-count').textContent='';if(manager){team=null;q('av-stats').hidden=true;q('av-filters').hidden=true;q('av-period').hidden=true;}
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
  if(manager)for(const id of ['av-date','av-from','av-until','av-overnight'])q(id).addEventListener('input',()=>{query=null;team=null;q('av-freshness').textContent='Filters changed. Check availability again.';q('av-count').textContent='';q('av-stats').hidden=true;q('av-filters').hidden=true;q('av-period').hidden=true;q('av-results').replaceChildren();});
  for(const b of main.querySelectorAll('[data-status]'))b.addEventListener('click',()=>{if(busy||!team)return;statusFilter=b.dataset.status;renderTeam();});
  q('av-refresh').addEventListener('click',load);
  q('av-form').addEventListener('submit',async e=>{
    e.preventDefault();if(busy||uncertain)return;clear();let window;try{window=availabilityFormWindow(q('av-date').value,q('av-from').value,q('av-until').value,q('av-overnight').checked,timezone);}catch(error){message('av-error',error.message);return;}
    if(manager){query=window;await load();return;}
    review={window,submissionId:crypto.randomUUID()};q('av-summary').textContent=`${window.startLocal.replace('T',' ')} – ${window.endLocal.replace('T',' ')} · ${timezone}`;q('av-confirmation').hidden=false;controls();q('av-confirmation').focus();
  });
  if(!manager){q('av-edit').addEventListener('click',()=>{review=null;q('av-confirmation').hidden=true;controls();q('av-date').focus();});q('av-save').addEventListener('click',()=>mutate('save'));}
  await load();
}
