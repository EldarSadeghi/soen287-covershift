import { element } from './shift-card.js';
export function coverageAction({ kind, id, revision, title, description, csrfToken, onSuccess }) {
  const container = element('div', 'coverage-action');
  const trigger = element('button', 'logout-button', kind === 'request' ? 'Request coverage' : 'Cancel request'); trigger.type = 'button'; trigger.setAttribute('aria-label', `${kind === 'request' ? 'Request coverage for' : 'Cancel request for'} ${title}`);
  const confirmation = element('section', 'coverage-confirm'); confirmation.hidden = true;
  confirmation.append(element('h3', '', kind === 'request' ? 'Request coverage?' : 'Cancel this request?'), element('p', '', description));
  const error = element('p', 'team-message'); error.hidden = true; error.tabIndex = -1; error.setAttribute('role', 'alert'); confirmation.append(error);
  const buttons = element('div', 'create-actions');
  const back = element('button', 'logout-button', 'Keep as is'); back.type = 'button';
  const submit = element('button', 'solid-link', kind === 'request' ? 'Confirm request' : 'Confirm cancellation'); submit.type = 'button';
  let busy = false;
  trigger.addEventListener('click', () => { trigger.hidden = true; confirmation.hidden = false; error.hidden = true; back.focus(); });
  back.addEventListener('click', () => { if (busy) return; confirmation.hidden = true; trigger.hidden = false; trigger.focus(); });
  submit.addEventListener('click', async () => {
    if (busy) return; busy = true; submit.disabled = true; back.disabled = true; error.hidden = true;
    const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const path = kind === 'request' ? `/api/worker/shifts/${encodeURIComponent(id)}/coverage` : `/api/worker/requests/${encodeURIComponent(id)}/cancel`;
      const response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken }, body: JSON.stringify({ revision }), signal: controller.signal });
      if (response.status === 401) { location.replace('/login?expired=1'); return; }
      const result = await response.json();
      if (!response.ok) { error.textContent = result.message || 'The coverage request could not be updated. Refresh and try again.'; error.hidden = false; error.focus(); return; }
      await onSuccess(result.message);
    } catch { error.textContent = 'We couldn’t confirm the result. Refresh this page before retrying.'; error.hidden = false; error.focus(); }
    finally { clearTimeout(timeout); busy = false; submit.disabled = false; back.disabled = false; }
  });
  buttons.append(back, submit); confirmation.append(buttons); container.append(trigger, confirmation); return container;
}
export function requestLink() { const a = element('a', 'text-link', 'View My requests →'); a.href = '/workspace/worker/requests'; return a; }
