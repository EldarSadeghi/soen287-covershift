import { requestJSON } from './request.js';
import { element } from './shift-card.js';
import { formatShiftTime } from './shift-time.js';
import { findClaimConflicts } from './claim-conflicts.js';
export function claimAction(request, context, csrfToken, onClaimed) {
  const root = element('div', 'claim-control'); const check = element('button', 'logout-button', 'Check & claim'); check.type = 'button'; check.setAttribute('aria-label', `Check and claim ${request.shift.title}`);
  const feedback = element('div', 'claim-feedback'); feedback.setAttribute('aria-live','polite'); feedback.tabIndex = -1;
  const confirm = element('section', 'coverage-confirm'); confirm.hidden = true;
  confirm.setAttribute('role', 'group'); confirm.setAttribute('aria-label', `Claim coverage for ${request.shift.title}`);
  confirm.append(element('h3','','Claim this coverage?'), element('p','',`Claim “${request.shift.title}” from ${request.originalWorkerName}? This reserves your time while awaiting manager approval. The original worker remains assigned until approval.`));
  const buttons = element('div','create-actions'); const back = element('button','logout-button','Keep browsing'); back.type = 'button'; const submit = element('button','solid-link','Confirm claim'); submit.type = 'button'; buttons.append(back,submit); confirm.append(buttons);
  root.append(check,feedback,confirm); let busy = false;
  root.addEventListener('keydown', event => { if (event.key === 'Escape' && !confirm.hidden && !busy) { event.preventDefault(); back.click(); } });
  function conflicts(items, fresh = false) {
    feedback.replaceChildren();
    if (!items.length) return;
    const message = element('p','', fresh ? 'Schedule conflict: this shift overlaps your current commitments.' : 'Schedule conflict in your last loaded schedule. Check again to verify current availability.'); feedback.append(message);
    const list = element('ul');
    for (const item of items) { const time = formatShiftTime(item, context.timezone); list.append(element('li','',`${item.title} · ${time.date} · ${time.startTime} – ${time.endDate ? time.endDate + ' · ' : ''}${time.endTime} (${item.kind === 'pending_claim' ? 'pending claim' : 'assigned shift'})`)); }
    feedback.append(list); feedback.className = 'claim-feedback claim-warning';
  }
  function message(text, warning = false) { feedback.replaceChildren(element('p','',text)); feedback.className = `claim-feedback ${warning ? 'claim-warning' : ''}`; }
  async function post(action) {

    try {
      const response = await requestJSON(`/api/worker/requests/${encodeURIComponent(request.id)}/${action}`,{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':csrfToken},readOnly:action==='claim-check',body:JSON.stringify({revision:request.revision})});
      if(response.status===401){location.replace('/login?expired=1');throw new Error('Please sign in again.');}
      const data = response.data; if(!response.ok){const error = new Error(data.message || 'Unable to check this request. Refresh the board.');error.conflicts = data.fields?.conflicts;error.responseError = true;throw error;}return data;
    } catch(error) { if(error.responseError || error.uncertain !== undefined)throw error;throw new Error(action === 'claim' ? 'We couldn’t confirm whether your claim was saved. Refresh the board and My requests before retrying.' : 'We couldn’t check availability. Please try again or refresh the board.'); }
  }
  conflicts(findClaimConflicts(request.shift,context.commitments));
  check.addEventListener('click',async()=>{
    if(busy)return;busy=true;check.disabled=true;confirm.hidden=true;
    // Show overlap feedback synchronously from the loaded snapshot, then ask
    // the server for a fresh check without any page navigation/reload.
    const local = findClaimConflicts(request.shift,context.commitments);
    if(local.length)conflicts(local);else message('Checking your current schedule…');
    try {
      const data = await post('claim-check');context.commitments=data.commitments;
      if(!data.canClaim){conflicts(data.conflicts,true);feedback.focus();}
      else {message('No conflicts found in your current assigned shifts or pending claims. Final eligibility is checked again when you confirm.');confirm.hidden=false;back.focus();}
    }catch(error){message(error.message || 'Couldn’t check availability. Refresh and try again.',true);feedback.focus();}
    finally {busy=false;check.disabled=false;check.textContent='Check again';}
  });
  back.addEventListener('click',()=>{if(!busy){confirm.hidden=true;check.focus();}});
  submit.addEventListener('click',async()=>{
    if(busy)return;busy=true;check.disabled=true;submit.disabled=true;back.disabled=true;
    try {const data=await post('claim');confirm.hidden=true;await onClaimed(data.message);}
    catch(error){confirm.hidden=true;if(Array.isArray(error.conflicts)&&error.conflicts.length)conflicts(error.conflicts,true);else message(error.message || 'Couldn’t confirm the result. Refresh before retrying.',true);feedback.focus();}
    finally {busy=false;check.disabled=false;submit.disabled=false;back.disabled=false;}
  });
  return root;
}
