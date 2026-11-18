import { requestJSON } from './request.js';
import { element } from './shift-card.js';
export function reviewActions(claim, csrfToken, onSuccess) {
  const root = element('div', 'coverage-action');
  const actions = element('div', 'claim-actions');
  const confirmation = element('section', 'coverage-confirm'); confirmation.hidden = true;
  confirmation.setAttribute('role', 'group'); confirmation.setAttribute('aria-label', `Review claim for ${claim.shift.title}`);
  const heading = element('h3'); const description = element('p');
  const error = element('p', 'team-message'); error.setAttribute('role', 'alert'); error.tabIndex = -1; error.hidden = true;
  const back = element('button', 'logout-button', 'Keep pending'); back.type = 'button';
  const submit = element('button', 'solid-link'); submit.type = 'button';
  const buttons = element('div', 'create-actions'); buttons.append(back, submit);
  confirmation.append(heading, description, error, buttons);
  let decision; let busy = false; let uncertain = false;
  root.addEventListener('keydown', event => { if (event.key === 'Escape' && !confirmation.hidden && !busy) { event.preventDefault(); back.click(); } });

  for (const kind of ['approve', 'reject']) {
    const label = kind === 'approve' ? 'Approve' : 'Reject'; const trigger = element('button', 'logout-button', label); trigger.type = 'button'; trigger.disabled = kind === 'approve' ? !claim.canApprove : !claim.canReject;
    trigger.setAttribute('aria-label', `${label} claim for ${claim.shift.title}`);
    trigger.addEventListener('click', () => {
      decision = kind; actions.hidden = true; confirmation.hidden = false; error.hidden = true;
      heading.textContent = `${label} this claim?`; submit.textContent = `Confirm ${kind === 'approve' ? 'approval' : 'rejection'}`;
      description.textContent = kind === 'approve' ? `Transfer “${claim.shift.title}” from ${claim.originalWorker.name} to ${claim.claimant.name}? Conflicts will be checked again before saving.` : `Reject ${claim.claimant.name}’s claim for “${claim.shift.title}”? ${claim.originalWorker.name} remains assigned. Coverage will reopen for teammates, and this rejected claim will be kept.`;
      back.focus(); back.onclick = () => { if (busy) return; confirmation.hidden = true; actions.hidden = false; trigger.focus(); };
    }); actions.append(trigger);
  }
  root.append(actions);
  if (claim.approvalReason) root.append(element('p', 'stale-claim', `Approval unavailable: ${claim.approvalReason}`));
  for (const conflict of claim.conflicts) root.append(element('p', 'section-note', `Overlaps ${conflict.kind === 'assigned' ? 'assigned shift' : 'pending claim'}: ${conflict.title}`));
  root.append(confirmation);
  submit.addEventListener('click', async () => {
    if (busy || uncertain) return; busy = true; submit.disabled = back.disabled = true; error.hidden = true;
     const label = submit.textContent; submit.textContent = 'Saving decision…';
    try {
      const response = await requestJSON(`/api/manager/requests/${encodeURIComponent(claim.id)}/${decision}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken }, body: JSON.stringify({ revision: claim.revision }) });
      if (response.status === 401) { location.replace('/login?expired=1'); return; }
      const result = response.data;
      if (!response.ok) { error.textContent = result.message || 'Could not save this decision. Refresh approvals.'; error.hidden = false; error.focus(); return; }
      await onSuccess(result.message);
    } catch { uncertain = true; error.textContent = 'We couldn’t confirm the result. Refresh approvals before retrying.'; error.hidden = false; error.focus(); }
    finally { busy = false; submit.disabled = uncertain; back.disabled = false; submit.textContent = label; }
  }); return root;
}
