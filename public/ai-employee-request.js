import {responseHeader,responseFields,responseNote,responseMeta,savedShiftFields,localDate} from './ai-response-card.js';
import { requestJSON } from './request.js';
import { element } from './shift-card.js';
import { formatShiftTime } from './shift-time.js';

export function employeeSearchMessage(data) {
  const hours = [data.criteria.startLocal && `from ${data.criteria.startLocal}`, data.criteria.endLocal && `until ${data.criteria.endLocal}`].filter(Boolean).join(' ');
  return `Searched shifts starting on ${data.criteria.date}${hours ? ' ' + hours : ''}${data.criteria.title ? `, title containing “${data.criteria.title}”` : ''} (${data.timezone}). ${data.total} eligible opening${data.total === 1 ? '' : 's'} found. ${data.total > data.requests.length ? `Showing the first ${data.requests.length}; use Open shifts to browse all results.` : ''} Nothing has been requested. Choose a shift to review, then confirm your request. Manager approval is required.`;
}
export function createEmployeeRequests({ chat, card, notice, csrfToken, setBusy, onOutcome, request = requestJSON }) {
  let generation = 0; let busy = false;
  const link = (text, href) => { const node = element('a', 'ai-chat-review', text); node.href = href; return node; };
  const button = (text, fn) => { const node = element('button', 'ai-chat-review', text); node.type = 'button'; if(/^(Cancel|Keep|Refresh)/.test(text))node.classList.add('ai-response-secondary'); node.addEventListener('click', fn); return node; };
  function reset() { generation++; card.replaceChildren(); card.hidden = true; }
  function outcome() {
    reset(); card.hidden = false;
    const value = chat.value.outcome;
    const pending=value.kind==='pending';responseHeader(card,pending?'Pending manager approval':'Request not confirmed',pending?'Your request was submitted.':'Check My requests.',pending?'pending':'uncertain');
    card.append(responseFields([['Shift',value.title]]),responseNote(pending?'You are not assigned yet. The original worker remains assigned until approval.':'This request may have been submitted. Check My requests and Open shifts before trying again.',pending?'pending':'uncertain'),link('View My requests','/workspace/worker/requests'));

  }
  async function post(url, body, readOnly = true) {
    const response = await request(url, { method: 'POST', readOnly, headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken }, body: JSON.stringify(body) });
    if (response.status === 401) { chat.clear(); location.replace('/login?expired=1'); throw new Error('Please sign in again.'); }
    if (!response.ok) { const error = new Error(response.data.message || 'Unable to check availability. Refresh matches.'); error.definite = response.status < 500; throw error; }
    return response.data;
  }
  function setWorking(value) { busy = value; setBusy(value); card.querySelectorAll('button').forEach(node => { node.disabled = value; }); }
  function show(data) {
    reset(); chat.value.criteria = data.criteria; chat.value.outcome = null; chat.save(); card.hidden = false;
    responseHeader(card,'Openings · Not requested',data.total===1?'Here’s one matching opening.':data.total?`${data.total} matching openings.`:'No matching openings.');
    card.append(responseFields([
      ['Date', localDate(data.criteria.date)],
      ['From', data.criteria.startLocal.replace('T', ' ') || 'Any time'],
      ['Until', data.criteria.endLocal.replace('T', ' ') || 'Any time'],
      ['Shift title', data.criteria.title || 'Any title'],
      ['Timezone', data.timezone],
    ]));
    if(data.total>data.requests.length)card.append(responseMeta(`Showing ${data.requests.length} of ${data.total}. Browse Open shifts for all results.`));
    if (!data.requests.length) card.append(element('p', '', 'No matching openings you can request right now. Try another date or check Open shifts.'));
    const version = generation;
    for (const opening of data.requests) {
      const section = element('section', 'ai-chat-opening'); section.setAttribute('aria-label', opening.shift.title);
      const time = formatShiftTime(opening.shift, data.timezone);
      section.append(element('h4','',opening.shift.title),savedShiftFields(opening.shift,data.timezone),responseFields([['Current worker',opening.originalWorkerName]]));
      const feedback = element('p', ''); feedback.setAttribute('role', 'status');
      const review = button('Review request', async () => {
        if (busy || version !== generation) return;
        setWorking(true); confirm.hidden = true; feedback.textContent = 'Checking current availability…';
        try {
          const checked = await post(`/api/worker/requests/${encodeURIComponent(opening.id)}/claim-check`, { revision: opening.revision });
          if (version !== generation) return;
          if (!checked.canClaim || checked.timezone !== data.timezone) { feedback.textContent = 'Your schedule or timezone changed. Refresh matches before requesting.'; return; }
          feedback.textContent = 'Available now. Eligibility will be checked again when you confirm.'; confirm.hidden = false;
        } catch (error) { if (version === generation) feedback.textContent = error.message || 'Could not check availability. Refresh matches.'; }
        finally { setWorking(false); if (!confirm.hidden && version === generation) cancel.focus(); }
      });
      review.setAttribute('aria-label', `Review request for ${opening.shift.title}`);
      const confirm = element('div', 'coverage-confirm'); confirm.hidden = true;
      confirm.setAttribute('role','group');confirm.setAttribute('aria-label',`Confirm request for ${opening.shift.title}`);
      confirm.append(element('p','ai-response-status ai-response-pending','Awaiting your confirmation'),element('strong','',opening.shift.title),responseNote('Your time is reserved after submission. You are assigned only if your manager approves.'));
      const cancel = button('Cancel', () => { if (!busy) { confirm.hidden = true; feedback.textContent = 'Cancelled. Nothing requested.'; review.focus(); } });
      const submit = button('Confirm request', async () => {
        if (busy || version !== generation || confirm.hidden) return;
        setWorking(true); feedback.textContent = 'Submitting your request…';
        // Persist uncertainty BEFORE sending. Reload/navigation can never restore a live Confirm button.
        chat.value.outcome = { kind: 'uncertain', title: opening.shift.title };
        onOutcome('Request submission started; confirmation is still pending. If interrupted, check My requests before retrying.'); chat.save();
        try {
          const result = await post(`/api/worker/requests/${encodeURIComponent(opening.id)}/claim`, { revision: opening.revision }, false);
          if (version !== generation) return;
          if (result.request?.id !== opening.id || result.request?.status !== 'pending') throw new Error('Request not confirmed. Check My requests.');
          chat.value.outcome = { kind: 'pending', title: opening.shift.title }; chat.save();
          onOutcome('Request submitted for manager approval. The original worker remains assigned until approval.'); outcome(); notice('Request submitted.');
        } catch (error) {
          if (version !== generation) return;
          if (error.definite) { chat.value.outcome = null; onOutcome('Request was not submitted. Refresh matches to review current availability.'); chat.save(); confirm.hidden = true; review.hidden = true; feedback.textContent = error.message; notice('Request was not submitted. Refresh matches to check current openings.'); }
          else { onOutcome('Request not confirmed. Check My requests before retrying.'); outcome(); notice('Request not confirmed. Check My requests before trying again.'); }
        } finally { setWorking(false); }
      });
      const actions=element('div','ai-response-actions');actions.append(cancel,submit);confirm.append(actions); section.append(review, feedback, confirm); card.append(section);
    }
    const browse=link('Browse Open shifts','/workspace/worker/open');browse.classList.add('ai-response-secondary');card.append(button('Refresh matches',refresh),browse);
  }
  async function refresh() {
    if (busy || !chat.value.criteria) return;
    const version = generation; setWorking(true); notice('Refreshing saved openings…');
    try { const result = await post('/api/worker/shift-search', chat.value.criteria); if (version === generation) { show(result); notice('Matches refreshed. Nothing requested.'); } }
    catch (error) { if (version === generation) notice(error.message || 'Could not refresh. Use Open shifts or try again.'); }
    finally { setWorking(false); }
  }
  function restore() {
    if (chat.value.outcome) { outcome(); return; }
    if (!chat.value.criteria) return;
    reset(); card.hidden = false; card.append(element('p', '', 'Your last search is saved. Refresh to see current openings; nothing is reserved.'), button('Refresh matches', refresh), link('Browse Open shifts', '/workspace/worker/open'));
  }
  return { show, restore, reset };
}
