import {responseHeader,responseFields,responseNote,responseMeta,savedShiftFields,localDate,localClock} from './ai-response-card.js';
import { requestJSON } from './request.js';
import { element } from './shift-card.js';

export function employeeSearchMessage({ criteria, timezone, total, requests }) {
  const hours = [
    criteria.startLocal && `from ${localClock(criteria.startLocal)}`,
    criteria.endLocal && `until ${criteria.endLocal.startsWith(criteria.date)
      ? localClock(criteria.endLocal) : `${localDate(criteria.endLocal)} ${localClock(criteria.endLocal)}`}`,
  ].filter(Boolean).join(' ');
  const scope = `${localDate(criteria.date)}${hours ? ' ' + hours : ''}${criteria.title ? `, title containing “${criteria.title}”` : ''} (${timezone})`;
  if (!total) return `No eligible openings matched ${scope}.`;
  const shown = total > requests.length ? ` Showing ${requests.length}.` : '';
  return `Found ${total} eligible opening${total === 1 ? '' : 's'} for ${scope}.${shown} Choose an opening to review.`;
}

export function claimOutcomeMessage(pending) {
  return pending
    ? 'Your request was submitted. Your manager must approve it before you’re assigned.'
    : 'We couldn’t confirm submission. Check My requests before trying again.';
}

function conflictMessage(conflicts) {
  const reasons = {
    assigned: 'an assigned shift',
    pending_claim: 'a pending coverage request',
    time_off: 'approved time off',
  };
  const overlaps = [...new Set(conflicts.map(conflict => reasons[conflict.kind]).filter(Boolean))];
  return overlaps.length ? `This opening overlaps ${new Intl.ListFormat().format(overlaps)}.` : 'This opening is unavailable.';
}

export function createEmployeeRequests({ chat, card, notice, csrfToken, setBusy, onOutcome, request = requestJSON }) {
  let generation = 0; let busy = false;
  let visibleIds = [];
  const link = (text, href) => { const node = element('a', 'ai-chat-review', text); node.href = href; return node; };
  const button = (text, fn) => { const node = element('button', 'ai-chat-review', text); node.type = 'button'; if(/^(Cancel|Keep|Refresh)/.test(text))node.classList.add('ai-response-secondary'); node.addEventListener('click', fn); return node; };
  function reset({ keepSearch = false } = {}) {
    generation++;
    if (!keepSearch) {
      visibleIds = [];
      chat.value.selectedOpeningId = null;
    }
    card.replaceChildren();
    card.hidden = true;
  }
  function outcome() {
    reset();
    card.hidden = false;
    const { kind, title } = chat.value.outcome;
    const pending = kind === 'pending';
    const tone = pending ? 'pending' : 'uncertain';
    const heading = pending ? 'Request sent to your manager' : 'Submission not confirmed';
    responseHeader(card, pending ? 'Pending approval' : 'Check request status', heading, tone);
    card.append(responseFields([['Shift', title]]), responseNote(claimOutcomeMessage(pending), tone),
      link(pending ? 'View My requests' : 'Check My requests', '/workspace/worker/requests'));
  }
  async function post(url, body, readOnly = true) {
    const response = await request(url, { method: 'POST', readOnly, headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken }, body: JSON.stringify(body) });
    if (response.status === 401) { chat.clear(); location.replace('/login?expired=1'); throw new Error('Please sign in again.'); }
    if (!response.ok) { const error = new Error(response.data.message || 'Unable to check availability. Refresh matches.'); error.definite = response.status < 500; throw error; }
    return response.data;
  }
  function setWorking(value) { busy = value; setBusy(value); card.querySelectorAll('button').forEach(node => { node.disabled = value; }); }
  function show(data) {
    reset(); chat.value.criteria = data.criteria; chat.value.alternateTo = data.alternateTo || null; chat.value.outcome = null; chat.save(); card.hidden = false;
    visibleIds = data.requests.map(opening => opening.id);
    responseHeader(card, data.alternateTo ? 'Alternatives · Not requested' : 'Openings · Not requested',
      data.total === 1 ? 'Here’s one matching opening.' : data.total ? `${data.total} matching openings.` :
        data.alternateTo ? 'No eligible alternatives within these limits.' : 'No matching openings.');
    card.append(responseFields([
      ['Date', localDate(data.criteria.date)],
      ['From', data.criteria.startLocal.replace('T', ' ') || 'Any time'],
      ['Until', data.criteria.endLocal.replace('T', ' ') || 'Any time'],
      ['Shift title', data.criteria.title || 'Any title'],
      ['Timezone', data.timezone],
    ]));
    if(data.total>data.requests.length)card.append(responseMeta(`Showing ${data.requests.length} of ${data.total}. Browse Open shifts for all results.`));
    const hasHours = Boolean(data.criteria.startLocal || data.criteria.endLocal);
    const canWiden = !data.total && data.alternateTo && (hasHours || data.criteria.title);
    if (canWiden) {
      const hours = hasHours ? button('Search any hours on this date', () =>
        alternatives(data.alternateTo, { ...data.criteria, startLocal: '', endLocal: '' })) : null;
      const title = data.criteria.title ? button('Search all shift titles', () =>
        alternatives(data.alternateTo, { ...data.criteria, title: '' })) : null;
      if (title && hours) title.classList.add('ai-response-secondary');
      card.append(...[hours, title].filter(Boolean));
    }
    const version = generation;
    for (const opening of data.requests) {
      const section = element('section', 'ai-chat-opening'); section.setAttribute('aria-label', opening.shift.title);
      section.append(element('h4','',opening.shift.title),savedShiftFields(opening.shift,data.timezone),responseFields([['Current worker',opening.originalWorkerName]]));
      const feedback = element('p', '');
      feedback.setAttribute('role', 'status');
      feedback.setAttribute('aria-atomic', 'true');
      const offer = button('Find eligible alternatives', () => {
        if (version === generation) void alternatives(opening.shift.id, data.criteria);
      });
      offer.hidden = true;
      offer.setAttribute('aria-label', `Find alternatives to ${opening.shift.title}`);
      function showUnavailable(reason) {
        feedback.textContent = reason.replace(/ Refresh the board(?: and review it again)?\.$/, '');
        confirm.hidden = true;
        review.hidden = true;
        offer.hidden = false;
      }
      const review = button('Review request', async () => {
        if (busy || version !== generation) return;
        card.querySelectorAll('.coverage-confirm').forEach(group => { group.hidden = true; });
        chat.value.selectedOpeningId = opening.id;
        chat.save();
        setWorking(true);
        feedback.textContent = 'Checking current availability…';
        try {
          const checked = await post(`/api/worker/requests/${encodeURIComponent(opening.id)}/claim-check`, { revision: opening.revision });
          if (version !== generation) return;
          if (checked.timezone !== data.timezone) {
            showUnavailable('The workspace timezone changed. Check current openings.');
          } else if (!checked.canClaim) {
            showUnavailable(conflictMessage(checked.conflicts));
          } else {
            feedback.textContent = 'Available now. We’ll check again when you confirm.';
            confirm.hidden = false;
          }
        } catch (error) {
          if (version !== generation) return;
          if (error.definite) showUnavailable(error.message);
          else feedback.textContent = 'Couldn’t check availability. Select Review request to try again.';
        } finally {
          setWorking(false);
          if (version === generation && card.closest('dialog')?.open) {
            const next = !confirm.hidden ? cancel : !offer.hidden ? offer : review;
            next.focus();
          }
        }
      });
      review.setAttribute('aria-label', `Review request for ${opening.shift.title}`);
      const confirm = element('div', 'coverage-confirm'); confirm.hidden = true;
      confirm.setAttribute('role', 'group');
      confirm.setAttribute('aria-label', `Confirm request for ${opening.shift.title}`);
      const confirmDetails = `ai-claim-details-${opening.id}`;
      confirm.append(element('p','ai-response-status ai-response-pending','Awaiting your confirmation'),element('strong','',opening.shift.title),responseNote('Your time is reserved after submission. You are assigned only if your manager approves.'));
      const cancel = button('Cancel', () => { if (!busy) { confirm.hidden = true; feedback.textContent = 'Cancelled. Nothing requested.'; review.focus(); } });
      confirm.lastElementChild.id = confirmDetails;
      const submit = button('Confirm request', async () => {
        if (busy || version !== generation || confirm.hidden) return;
        setWorking(true); feedback.textContent = 'Submitting your request…';
        // Persist uncertainty BEFORE sending. Reload/navigation can never restore a live Confirm button.
        chat.value.outcome = { kind: 'uncertain', title: opening.shift.title };
        chat.save();
        try {
          const result = await post(`/api/worker/requests/${encodeURIComponent(opening.id)}/claim`, { revision: opening.revision }, false);
          if (version !== generation) return;
          if (result.request?.id !== opening.id || result.request?.status !== 'pending') throw new Error('Request not confirmed. Check My requests.');
          chat.value.outcome = { kind: 'pending', title: opening.shift.title }; chat.save();
          onOutcome(claimOutcomeMessage(true)); outcome(); notice(claimOutcomeMessage(true), true);
        } catch (error) {
          if (version !== generation) return;
          if (error.definite) {
            chat.value.outcome = null;
            onOutcome('Your request wasn’t submitted. You can check for eligible alternatives.');
            showUnavailable(error.message);
          } else {
            onOutcome(claimOutcomeMessage(false));
            outcome();
            notice(claimOutcomeMessage(false), true);
          }
        } finally {
          setWorking(false);
          if (card.closest('dialog')?.open) (version === generation ? offer : card.querySelector('a'))?.focus();
        }
      });
      submit.setAttribute('aria-describedby', confirmDetails);
      const actions = element('div', 'ai-response-actions');
      actions.append(cancel, submit);
      confirm.append(actions);
      section.append(review, feedback, offer, confirm);
      card.append(section);
    }
    const browse = link('Browse Open shifts', '/workspace/worker/open');
    if (data.total || canWiden) browse.classList.add('ai-response-secondary');
    card.append(browse, button('Refresh matches', refresh));
  }
  async function alternatives(shiftId, criteria) {
    if (busy) return;
    const version = generation;
    setWorking(true); notice('Checking eligible alternatives…');
    try {
      const result = await post('/api/worker/shift-alternatives', { criteria, excludeShiftId: shiftId });
      if (version !== generation) return;
      chat.value.refinementPending = false;
      show(result);
      const message = employeeSearchMessage(result);
      onOutcome(message);
      notice(message, true);
      return true;
    } catch (error) {
      if (version === generation) notice(error.message || 'Could not check alternatives. Try again.');
    } finally { setWorking(false); }
  }
  async function refresh() {
    if (busy || !chat.value.criteria) return;
    if (chat.value.alternateTo) return alternatives(chat.value.alternateTo, chat.value.criteria);
    const version = generation; setWorking(true); notice('Refreshing saved openings…');
    try {
      const result = await post('/api/worker/shift-search', chat.value.criteria);
      if (version === generation) {
        show(result);
        const message = employeeSearchMessage(result);
        onOutcome(message);
        notice(message, true);
      }
    }
    catch (error) { if (version === generation) notice(error.message || 'Could not refresh. Use Open shifts or try again.'); }
    finally { setWorking(false); }
  }
  function restore() {
    if (chat.value.outcome) { outcome(); return; }
    if (!chat.value.criteria) return;
    reset({ keepSearch: true }); card.hidden = false; card.append(element('p', '', 'Your last search is saved. Refresh to see current openings; nothing is reserved.'), button('Refresh matches', refresh), link('Browse Open shifts', '/workspace/worker/open'));
  }
  return { show, restore, reset, alternatives, openingContext: () => ({ visibleIds, selectedId: chat.value.selectedOpeningId }) };
}
