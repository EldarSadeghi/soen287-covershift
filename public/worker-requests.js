import { requestJSON } from './request.js';
import { element, shiftCard } from './shift-card.js';
import { coverageAction } from './coverage.js';
export async function mountWorkerRequests(main, csrfToken) {
  main.innerHTML = '<p class="eyebrow">Coverage, with confidence</p><div class="page-heading"><div><h1>Your requests & claims.</h1><p class="subtitle">Track requests you created and coverage you claimed. The original worker remains assigned until manager approval.</p></div><button id="refresh-requests" class="logout-button" type="button">Refresh</button></div><p><a class="text-link" href="/workspace/worker/shifts">Request coverage from My shifts →</a> · <a class="text-link" href="/workspace/worker/history">View coverage history →</a></p><p id="request-result" class="shift-created" role="status" tabindex="-1" hidden></p><section id="requests-content"></section><p class="section-note" id="requests-updated" role="status"></p>';
  const content = main.querySelector('#requests-content'); const refresh = main.querySelector('#refresh-requests'); const updated = main.querySelector('#requests-updated'); let loading = false;
  async function load(event) {
    const restoreFocus = Boolean(event?.currentTarget);
    if (loading) return; loading = true; refresh.disabled = true; main.setAttribute('aria-busy', 'true'); updated.textContent = '';
    content.replaceChildren(element('p', 'shift-loading', 'Loading your requests…'));

    try {
      const response = await requestJSON('/api/worker/requests', { cache: 'no-store' });
      if (response.status === 401) { location.replace('/login?expired=1'); return; }
      if (!response.ok) throw new Error();
      const result = response.data; content.replaceChildren();
      const ownHeading = element('h2','requests-group-title','Requests you created'); content.append(ownHeading);
      if (!result.requests.length) { const empty = element('section', 'panel empty'); empty.append(element('h2', '', 'No requests yet.'), element('p', '', 'Open My shifts to request coverage for a future shift assigned to you.')); content.append(empty); }
      for (const request of result.requests) {
        const article = element('article', 'panel coverage-request');
        const head = element('div', 'panel-head'); const labels = { open: 'Open · waiting for a teammate', pending: 'Pending manager approval', approved: 'Approved', rejected: 'Claim rejected · coverage reopened', cancelled: 'Cancelled' };
        head.append(element('h2', '', request.displayStatus === 'expired' ? 'Expired' : labels[request.status])); article.append(head, shiftCard(request.shift, result.timezone));
        const details = element('div', 'coverage-details');
        if (request.displayStatus === 'expired') details.append(element('p', 'stale-claim', `Coverage expired when the shift started. Saved status: ${request.status === 'pending' ? 'Pending approval' : 'Open'}. This request did not transfer the assignment. See History for the original events.`));
        if (request.claimantName) details.append(element('p', '', `${request.status === 'cancelled' ? 'Previous claimant' : 'Claimed by'}: ${request.claimantName}`));
        details.append(element('p', 'section-note', request.stillAssigned ? 'You are still assigned to this shift.' : 'You are no longer assigned to this shift.'));
        if (request.canCancel) {
          const description = request.status === 'pending' ? `Cancel coverage for “${request.shift.title}”? ${request.claimantName || 'Your teammate'} will not take over through this request. You remain assigned. The request record will be kept.` : `Cancel coverage for “${request.shift.title}”? You remain assigned. The request record will be kept.`;
          details.append(coverageAction({ kind: 'cancel', id: request.id, revision: request.revision, title: request.shift.title, description, csrfToken, onSuccess: async message => { await load(); const result = main.querySelector('#request-result'); result.textContent = message; result.hidden = false; result.focus(); } }));
        } else details.append(element('p', 'section-note', request.cancelReason));
        const time = new Intl.DateTimeFormat(undefined, { timeZone: result.timezone, dateStyle: 'medium', timeStyle: 'short' });
        details.append(element('p', 'section-note', `Requested ${time.format(new Date(request.createdAt))} · Updated ${time.format(new Date(request.updatedAt))} (${result.timezone})`));
        article.append(details); content.append(article);
      }
      content.append(element('h2','requests-group-title','Coverage you claimed'));
      if (!result.claims.length) { const empty = element('section','panel empty'); empty.append(element('p','','You haven’t claimed any coverage yet. Browse Open shifts to help a teammate.')); const link = element('a','text-link','Browse Open shifts →'); link.href='/workspace/worker/open';empty.append(link);content.append(empty); }
      for (const claim of result.claims) {
        const article = element('article','panel coverage-request'); const head=element('div','panel-head');const labels={pending:'Your claim · Pending manager approval',approved:'Your claim · Approved',rejected:'Your claim · Rejected',cancelled:'Your claim · Request cancelled',open:'Your claim · Open'};
        head.append(element('h2','',claim.displayStatus === 'expired' ? 'Your claim · Expired' : labels[claim.status]));article.append(head,shiftCard(claim.shift,result.timezone));const details=element('div','coverage-details');
        details.append(element('p','',`Original worker: ${claim.originalWorkerName}`),element('p','section-note',claim.displayStatus==='expired'?'This claim expired when the shift started. It did not transfer the assignment. The original events are kept in History.':claim.status==='pending'?'Your claim is awaiting manager approval. The original worker remains assigned. This time is reserved when checking your other claims.':claim.assignedToYou?'This shift is now assigned to you.':'This claim does not assign the shift to you.'));
        if (claim.displayStatus === 'expired') details.append(element('p', 'section-note', 'Saved status: Pending approval.'));
        article.append(details);content.append(article);
      }
      updated.textContent = `${result.requests.length} request${result.requests.length === 1 ? '' : 's'} · ${result.claims.length} claim${result.claims.length === 1 ? '' : 's'} · Times shown in ${result.timezone}. Refresh to check for changes.`;
    } catch {
      const panel = element('div', 'panel shift-load-error'); const error = element('p', '', 'We couldn’t load your requests. Please try again.'); error.setAttribute('role', 'alert');
      const retry = element('button', 'logout-button', 'Try again'); retry.type = 'button'; retry.addEventListener('click', load); panel.append(error, retry); content.replaceChildren(panel);
    } finally { loading = false; refresh.disabled = false; main.setAttribute('aria-busy', 'false'); if (restoreFocus) refresh.focus(); }
  }
  refresh.addEventListener('click', load); await load();
}
