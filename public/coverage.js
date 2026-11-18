import { requestJSON } from './request.js';
import { element } from './shift-card.js';
export function coverageAction({ kind, id, revision, title, description, csrfToken, onSuccess }) {
  const container = element('div', 'coverage-action');
  const trigger = element('button', 'logout-button', kind === 'request' ? 'Request coverage' : 'Cancel request'); trigger.type = 'button'; trigger.setAttribute('aria-label', `${kind === 'request' ? 'Request coverage for' : 'Cancel request for'} ${title}`);
  const confirmation = element('section', 'coverage-confirm'); confirmation.hidden = true;
  confirmation.setAttribute('role', 'group'); confirmation.setAttribute('aria-label', `${kind === 'request' ? 'Request coverage' : 'Cancel request'} for ${title}`);
  confirmation.append(element('h3', '', kind === 'request' ? 'Request coverage?' : 'Cancel this request?'), element('p', '', description));
  const error = element('p', 'team-message'); error.hidden = true; error.tabIndex = -1; error.setAttribute('role', 'alert'); confirmation.append(error);
  const buttons = element('div', 'create-actions');
  const back = element('button', 'logout-button', 'Keep as is'); back.type = 'button';
  const submit = element('button', 'solid-link', kind === 'request' ? 'Confirm request' : 'Confirm cancellation'); submit.type = 'button';
  let busy = false; let uncertain = false;
  container.addEventListener('keydown', event => { if (event.key === 'Escape' && !confirmation.hidden && !busy) { event.preventDefault(); back.click(); } });

  trigger.addEventListener('click', () => { trigger.hidden = true; confirmation.hidden = false; error.hidden = true; back.focus(); });
  back.addEventListener('click', () => { if (busy) return; confirmation.hidden = true; trigger.hidden = false; trigger.focus(); });
  submit.addEventListener('click', async () => {
    if (busy || uncertain) return; busy = true; submit.disabled = true; back.disabled = true; error.hidden = true;

    try {
      const path = kind === 'request' ? `/api/worker/shifts/${encodeURIComponent(id)}/coverage` : `/api/worker/requests/${encodeURIComponent(id)}/cancel`;
      const response = await requestJSON(path, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken }, body: JSON.stringify({ revision }) });
      if (response.status === 401) { location.replace('/login?expired=1'); return; }
      const result = response.data;
      if (!response.ok) { error.textContent = result.message || 'The coverage request could not be updated. Refresh and try again.'; error.hidden = false; error.focus(); return; }
      await onSuccess(result.message);
    } catch { uncertain = true; error.textContent = 'We couldn’t confirm the result. Refresh this page before retrying.'; error.hidden = false; error.focus(); }
    finally { busy = false; submit.disabled = uncertain; back.disabled = false; }
  });
  buttons.append(back, submit); confirmation.append(buttons); container.append(trigger, confirmation); return container;
}
export function requestLink() { const a = element('a', 'text-link', 'View My requests →'); a.href = '/workspace/worker/requests'; return a; }
