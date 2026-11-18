import { requestJSON } from './request.js';
import { element } from './shift-card.js';
import { formatShiftTime } from './shift-time.js';
export function removalActions(worker,timezone,csrf,onSuccess) {
  const root=element('div','employee-removal');const actions=element('div','team-actions');const confirm=element('section','coverage-confirm');confirm.hidden=true;confirm.setAttribute('role','group');confirm.setAttribute('aria-label',`Remove ${worker.name}`);
  const heading=element('h3');const description=element('p');const error=element('p','team-message');error.hidden=true;error.tabIndex=-1;error.setAttribute('role','alert');const back=element('button','logout-button','Keep employee');back.type='button';const submit=element('button','solid-link');submit.type='button';const buttons=element('div','create-actions');buttons.append(back,submit);confirm.append(heading,description,error,buttons);let action;let busy=false; let uncertain=false;let trigger;
  for (const kind of ['deactivate','delete']) {
    if(kind==='deactivate'&&worker.status==='inactive')continue;
    if(kind==='delete'&&!worker.canDelete)continue;
    const button=element('button','logout-button delete-action',kind==='delete'?'Delete employee':'Deactivate employee');button.type='button';button.setAttribute('aria-label',`${kind==='delete'?'Delete':'Deactivate'} ${worker.name}`);
    if(kind==='deactivate')button.disabled=!worker.canDeactivate;
    button.addEventListener('click',()=>{action=kind;trigger=button;actions.hidden=true;confirm.hidden=false;error.hidden=true;heading.textContent=kind==='delete'?'Delete this employee?':'Deactivate this employee?';description.textContent=kind==='delete'?`Permanently delete ${worker.name} (${worker.email})? They have no shift or coverage records. Their account and setup links will stop working. This cannot be undone.`:`Deactivate ${worker.name} (${worker.email})? Sign-in, current sessions and setup links will stop working. Their past shifts and coverage history stay available. There is no reactivation option yet.`;submit.textContent=kind==='delete'?'Confirm deletion':'Confirm deactivation';back.focus();});actions.append(button);
  }
  root.append(actions);
  if(!worker.canDelete)root.append(element('p','section-note',worker.status==='inactive'?'Shift or coverage history is retained. This employee cannot be deleted.':'Shift or coverage history is retained. This employee can be deactivated, not deleted.'));
  if(worker.status==='inactive')root.append(element('p','section-note',`Inactive since ${new Intl.DateTimeFormat(undefined,{timeZone:timezone,dateStyle:'medium',timeStyle:'short'}).format(new Date(worker.deactivatedAt))}. Sign-in and setup access are blocked.`));
  if(worker.blockers.length){root.append(element('p','section-note','Resolve these items before deactivation. Reassign unlinked future shifts in Schedule; resolve pending claims in Approvals. Coverage-linked assignments need a coverage transfer or must finish first.'));const list=element('ul','removal-blockers');for(const b of worker.blockers){const time=formatShiftTime(b,timezone);list.append(element('li','',`${b.kind==='assignment'?'Assigned shift':'Pending claim'}: ${b.title} · ${time.date} · ${time.startTime} – ${time.endDate?time.endDate+' · ':''}${time.endTime}`));}root.append(list);}
  function close(){if(busy)return;confirm.hidden=true;actions.hidden=false;trigger?.focus();}
  back.addEventListener('click',close);root.addEventListener('keydown',event=>{if(event.key==='Escape'&&!confirm.hidden&&!busy){event.preventDefault();close();}});
  submit.addEventListener('click',async()=>{if(busy||uncertain)return;busy=true;submit.disabled=back.disabled=true;error.hidden=true;
    try{const response=await requestJSON(`/api/manager/workers/${encodeURIComponent(worker.id)}/${action}`,{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify({revision:worker.revision})});if(response.status===401){location.replace('/login?expired=1');return;}const result=response.data;if(!response.ok){error.textContent=result.message||'Unable to remove this employee. Refresh Team.';error.hidden=false;error.focus();return;}await onSuccess(result.message);}
    catch{uncertain=true;error.textContent='We couldn’t confirm the result. Refresh Team before retrying.';error.hidden=false;error.focus();}
    finally{busy=false;submit.disabled=uncertain;back.disabled=false;}
  });root.append(confirm);return root;
}
