import {takeEmployeeDraft} from './ai-employee-drafts.js';
import {requestJSON} from './request.js';
import {element} from './shift-card.js';
import {openRequestedAction} from './requested-action.js';
const labels={pending:'Pending',approved:'Approved',rejected:'Rejected',cancelled:'Cancelled'};
export function fullDayEnd(date){const value=new Date(date+'T12:00:00Z');if(!Number.isFinite(value.getTime())||value.toISOString().slice(0,10)!==date)throw new Error('Choose a valid end date.');value.setUTCDate(value.getUTCDate()+1);return value.toISOString().slice(0,10)+'T00:00';}
export function timeOffRange(r){
  const date=new Intl.DateTimeFormat('en-US',{timeZone:r.timezone,dateStyle:'medium'});
  if(r.allDay)return date.formatRange(new Date(r.startsAt),new Date(Date.parse(r.endsAt)-1))+' · Full day'+(Date.parse(r.endsAt)-Date.parse(r.startsAt)>25*3600000?'s':'');
  const time=new Intl.DateTimeFormat('en-US',{timeZone:r.timezone,dateStyle:'medium',timeStyle:'short'});return time.format(new Date(r.startsAt))+' – '+time.format(new Date(r.endsAt));
}
export async function mountTimeOff(main,account,csrf){
  const manager=account.user.role==='manager',role=account.user.role,base=`/api/${role}/time-off`,timezone=account.business.timezone;
  main.innerHTML=`<p class="eyebrow">Plan a little breathing room</p><div class="page-heading"><div><h1>${manager?'Your team’s time off.':'Your time off.'}</h1><p class="subtitle">${manager?'Review requests before changing who can work.':'Request a break and track your manager’s decision.'}</p></div><button id="leave-refresh" class="logout-button" type="button">Refresh</button></div><p id="leave-message" class="shift-created" role="status" tabindex="-1" hidden></p><p id="leave-error" class="team-message" role="alert" tabindex="-1" hidden></p><p class="section-note">Times shown in <strong id="leave-zone"></strong>. Notes are private to the employee and their business managers. Approved time off blocks new overlapping assignments and coverage claims.</p>${manager?'':`<section class="panel time-off-form"><h2>Request time off</h2><p>Your schedule stays unchanged while a request is pending. Your manager must resolve overlapping shifts or pending coverage claims before approval.</p><form id="leave-form"><label for="leave-type">Time-off type</label><select id="leave-type"><option value="full">Full day(s)</option><option value="hours">Specific hours</option></select><div class="time-off-dates"><div><label for="leave-start-date">Start date</label><input id="leave-start-date" type="date" required></div><div><label id="leave-end-date-label" for="leave-end-date">End date (included)</label><input id="leave-end-date" type="date" required></div></div><div id="leave-hours" class="time-off-dates" hidden><div><label for="leave-start-time">Start time</label><input id="leave-start-time" type="time" value="09:00" disabled></div><div><label for="leave-end-time">End time</label><input id="leave-end-time" type="time" value="17:00" disabled></div></div><p id="leave-date-help" class="section-note">Full-day leave includes every selected date. Requests must start in the future, within one year, and last no more than 366 calendar days.</p><label for="leave-note">Private note (optional)</label><textarea id="leave-note" rows="3" maxlength="500" autocomplete="off" placeholder="Only you and your managers can see this note."></textarea><button id="leave-review-button" class="solid-link" type="submit" data-timeoff-mutation>Review request</button></form><section id="leave-review" class="coverage-confirm" aria-label="Review time-off request" hidden tabindex="-1"><h3>Review your request</h3><p id="leave-review-text"></p><p id="leave-review-note"></p><p>This submits a request, not an approved absence. Your manager must decide.</p><div class="create-actions"><button id="leave-back" class="logout-button" type="button">Edit request</button><button id="leave-submit" class="solid-link" type="button" data-timeoff-mutation>Confirm time-off request</button></div></section></section>`}<section class="time-off-list"><div class="page-heading"><h2>${manager?'Team requests':'Your requests'}</h2><label class="history-filter">Show <select id="leave-filter"><option value="all">All requests</option><option value="pending" ${manager?'selected':''}>Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="cancelled">Cancelled</option></select></label></div><p id="leave-count" role="status"></p><div id="leave-list"></div></section>`;
  const find=id=>main.querySelector('#'+id);find('leave-zone').textContent=timezone;
  let loading=false,saving=false,uncertain=null,reviewed=null,requests=[],reconciling=false;
  const say=message=>{find('leave-message').textContent=message;find('leave-message').hidden=false;find('leave-message').focus();};
  const error=message=>{find('leave-error').textContent=message;find('leave-error').hidden=false;find('leave-error').focus();};
  const clear=()=>{find('leave-error').hidden=true;find('leave-message').hidden=true;};
  function resetForm(){find('leave-form').reset();find('leave-hours').hidden=true;find('leave-end-date-label').textContent='End date (included)';find('leave-end-date').min='';for(const id of ['leave-start-time','leave-end-time'])find(id).required=false;}
  function controls(){
    for(const button of main.querySelectorAll('[data-timeoff-mutation]'))button.disabled=saving||loading||Boolean(uncertain)||reconciling;
    find('leave-refresh').disabled=loading||saving;find('leave-filter').disabled=loading||saving||reconciling;
    if(!manager){for(const field of find('leave-form').querySelectorAll('input,select,textarea'))field.disabled=saving||Boolean(reviewed)||Boolean(uncertain)||field.type==='time'&&find('leave-type').value==='full';find('leave-back').disabled=saving||Boolean(uncertain);}
  }
  async function api(path,input){
    const response=await requestJSON(path,input===undefined?{cache:'no-store'}:{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify(input)});
    if(response.status===401){location.replace('/login?expired=1');throw new Error('Please sign in again.');}
    if(!response.ok)throw new Error(response.data.message||'We couldn’t complete this request. Refresh and try again.');return response.data;
  }
  function render(){
    const list=find('leave-list');list.replaceChildren();const filter=find('leave-filter').value,visible=requests.filter(r=>filter==='all'||r.status===filter);
    find('leave-count').textContent=`${visible.length} shown · ${requests.filter(r=>r.status==='pending').length} pending`;
    if(!visible.length){const empty=element('section','panel empty');empty.append(element('h3','','No requests in this view.'),element('p','',manager?'Choose another filter or refresh to check for new employee requests.':'Submit a request above, or choose another status.'));list.append(empty);}
    for(const r of visible){
      const card=element('article','panel time-off-card');card.id='time-off-'+r.id;card.tabIndex=-1;const head=element('div','panel-head');head.append(element('h3','',manager?r.workerName:'Time-off request'),element('span','badge',labels[r.status]));card.append(head,element('p','time-off-range',timeOffRange(r)),element('p','section-note',r.timezone+(r.periodState==='past'?' · Past period':r.periodState==='in_progress'?' · Period has started':'')));
      if(r.note){card.append(element('strong','','Private note'),element('p','time-off-note',r.note));}
      if(r.status==='pending'&&r.blockers.length){
        card.append(element('p','time-off-blocked','Approval blocked: resolve these commitments first.'));const list=element('ul','time-off-blockers');
        for(const b of r.blockers){const item=element('li'),link=element('a','text-link',b.title+' · '+(b.kind==='assignment'?'Assigned shift':'Pending coverage claim'));link.href=b.kind==='assignment'?`/workspace/${role}/${manager?'schedule':'shifts'}?shift=${encodeURIComponent(b.id)}`:`/workspace/${role}/${manager?'approvals':'requests'}`;item.append(link,element('p','section-note',timeOffRange({...b,timezone,allDay:false})));list.append(item);}card.append(list);
      }else if(manager&&r.status==='pending'&&!r.canApprove)card.append(element('p','time-off-blocked',r.approvalReason));
      const details=element('details'),summary=element('summary','','Request history'),events=element('ol');
      const actions={requested:'Requested',approve:'Approved',reject:'Rejected',cancel:'Cancelled',cancel_inactive:'Cancelled when employee was deactivated'};
      for(const e of r.history)events.append(element('li','',`${actions[e.action]} by ${e.actorName} · ${new Intl.DateTimeFormat('en-US',{timeZone:timezone,dateStyle:'medium',timeStyle:'short'}).format(new Date(e.at))}`));details.append(summary,events);card.append(details);
      const buttons=element('div','create-actions');
      for(const action of manager?['approve','reject']:['cancel']){
        if(!r['can'+action[0].toUpperCase()+action.slice(1)])continue;
        const button=element('button',action==='approve'?'solid-link':'logout-button',{approve:'Approve',reject:'Reject',cancel:'Cancel request'}[action]);button.type='button';button.dataset.timeoffMutation='';button.dataset.timeoffAction=action;button.setAttribute('aria-label',`${button.textContent} for ${r.workerName}: ${timeOffRange(r)}`);
        button.addEventListener('click',()=>{
          clear();for(const old of main.querySelectorAll('.time-off-decision'))old.remove();
          const box=element('section','coverage-confirm time-off-decision');box.setAttribute('role','group');box.setAttribute('aria-label',action==='cancel'?'Cancel time-off request':'Review time-off decision');
          box.append(element('h4','',action==='approve'?'Approve this time off?':action==='reject'?'Reject this request?':'Cancel this time off?'),element('p','',`${r.workerName} · ${timeOffRange(r)}. ${action==='approve'?'Existing assignments must be resolved; new overlapping work will be blocked.':action==='cancel'?'Existing shifts and submitted coverage claims stay unchanged. Active availability rules may request openings again.':'The employee’s schedule stays unchanged.'}`));
          const back=element('button','logout-button','Keep current status');back.type='button';back.dataset.timeoffMutation='';back.addEventListener('click',()=>{box.remove();button.focus();});
          const confirm=element('button','solid-link',{approve:'Confirm approval',reject:'Confirm rejection',cancel:'Confirm cancellation'}[action]);confirm.type='button';confirm.dataset.timeoffMutation='';
          confirm.addEventListener('click',async()=>{if(saving||uncertain||loading)return;saving=true;controls();clear();try{const result=await api(`${base}/${encodeURIComponent(r.id)}/${action}`,{revision:r.revision});await load();say(result.message);}catch(e){if(e.uncertain)uncertain={kind:'decision',id:r.id};error(e.uncertain?'We couldn’t confirm this decision. Refresh and check the saved status before trying again.':e.message);}finally{saving=false;controls();}});
          const row=element('div','create-actions');row.append(back,confirm);box.append(row);card.append(box);back.focus();
        });buttons.append(button);
      }
      card.append(buttons);list.append(card);
    }controls();
  }
  async function load(event){
    if(loading)return;loading=true;controls();find('leave-list').setAttribute('aria-busy','true');find('leave-list').replaceChildren(element('p','shift-loading',uncertain?'Checking latest saved requests…':'Loading time-off requests…'));
    try{
      const result=await api(base);requests=result.requests;reconciling=false;find('leave-error').hidden=true;
      if(uncertain){
        if(uncertain.kind==='create'){
          const saved=requests.find(r=>r.submissionId===uncertain.submissionId);
          if(saved){reviewed=null;find('leave-review').hidden=true;resetForm();say(`Saved request found: ${labels[saved.status]}. Check its latest status below.`);}
          else say('No matching saved submission found. You may explicitly retry the same reviewed request; it will not create a duplicate.');
        }else {const saved=requests.find(r=>r.id===uncertain.id);say(saved?`Latest saved status: ${labels[saved.status]}. Review the current request before another action.`:'The request is not in the latest list. Check your account and refresh again.');}
        uncertain=null;find('leave-error').hidden=true;
      }
      render();
      if(event?.currentTarget)find('leave-refresh').focus();
      else if(!manager){const selected=new URLSearchParams(location.search).get('request');if(selected)find('time-off-'+selected)?.focus();}
    }catch(e){reconciling=true;const retry=element('button','logout-button','Try again');retry.type='button';retry.addEventListener('click',load);find('leave-list').replaceChildren(element('p','','Requests could not be loaded.'),retry);error(e.message);}finally{loading=false;main.setAttribute('aria-busy','false');find('leave-list').setAttribute('aria-busy','false');controls();}
  }
  find('leave-refresh').addEventListener('click',event=>{if(!uncertain)clear();load(event);});
  find('leave-filter').addEventListener('change',()=>{if(!loading&&!saving)render();});
  if(!manager){
    find('leave-type').addEventListener('change',()=>{find('leave-hours').hidden=find('leave-type').value==='full';find('leave-end-date-label').textContent=find('leave-type').value==='full'?'End date (included)':'End date';for(const id of ['leave-start-time','leave-end-time'])find(id).required=find('leave-type').value==='hours';controls();});
    find('leave-start-date').addEventListener('change',()=>{find('leave-end-date').min=find('leave-start-date').value;if(!find('leave-end-date').value||find('leave-end-date').value<find('leave-start-date').value)find('leave-end-date').value=find('leave-start-date').value;});
    const draft=takeEmployeeDraft(account,'timeOffDraft');
    if(draft){
      const {startLocal,endLocal,allDay}=draft.selection;
      find('leave-type').value=allDay?'full':'hours';
      find('leave-type').dispatchEvent(new Event('change'));
      find('leave-start-date').value=startLocal.slice(0,10);
      find('leave-end-date').value=allDay?new Date(Date.parse(endLocal+'Z')-1).toISOString().slice(0,10):endLocal.slice(0,10);
      if(!allDay){find('leave-start-time').value=startLocal.slice(11);find('leave-end-time').value=endLocal.slice(11);}
      find('leave-start-date').focus();
    }
    find('leave-form').addEventListener('submit',event=>{
      event.preventDefault();if(saving||uncertain||loading||reconciling)return;clear();
      try{const full=find('leave-type').value==='full';reviewed={startLocal:find('leave-start-date').value+'T'+(full?'00:00':find('leave-start-time').value),endLocal:full?fullDayEnd(find('leave-end-date').value):find('leave-end-date').value+'T'+find('leave-end-time').value,allDay:full,note:find('leave-note').value.trim(),submissionId:crypto.randomUUID(),timezone};
        find('leave-review-text').textContent=full?`${find('leave-start-date').value} through ${find('leave-end-date').value}, inclusive · Full day(s) · ${timezone}`:`${reviewed.startLocal.replace('T',' ')} – ${reviewed.endLocal.replace('T',' ')} · ${timezone}`;
        find('leave-review-note').textContent=reviewed.note?'Private note: '+reviewed.note:'No private note.';find('leave-review').hidden=false;controls();find('leave-back').focus();
      }catch(e){reviewed=null;error(e.message);}
    });
    find('leave-back').addEventListener('click',()=>{if(uncertain||saving)return;reviewed=null;find('leave-review').hidden=true;controls();find('leave-type').focus();});
    find('leave-submit').addEventListener('click',async()=>{
      if(!reviewed||saving||uncertain||loading)return;saving=true;controls();clear();
      try{const result=await api(base,reviewed);reviewed=null;find('leave-review').hidden=true;resetForm();await load();say(result.message);}
      catch(e){if(e.uncertain){uncertain={kind:'create',submissionId:reviewed.submissionId};error('We couldn’t confirm whether your request was saved. Your entries are kept. Refresh to reconcile before retrying.');}else{reviewed=null;find('leave-review').hidden=true;error(e.message);}}
      finally{saving=false;controls();}
    });
  }
  await load();
  if(!manager)openRequestedAction(main,'request','time-off-',['cancel'],find('leave-message'));
}
