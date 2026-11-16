import { element, shiftCard } from './shift-card.js';
import { coverageAction } from './coverage.js';
export async function mountWorkerRequests(main, csrfToken) {
  main.innerHTML = '<p class="eyebrow">Coverage, with confidence</p><div class="page-heading"><div><h1>Your coverage requests.</h1><p class="subtitle">You remain assigned until coverage is approved. Open or pending requests can be cancelled before the shift starts.</p></div><button id="refresh-requests" class="logout-button" type="button">Refresh</button></div><p><a class="text-link" href="/workspace/worker/shifts">Request coverage from My shifts →</a></p><p id="request-result" class="shift-created" role="status" tabindex="-1" hidden></p><section id="requests-content" aria-live="polite"></section><p class="section-note" id="requests-updated" role="status"></p>';
  const content = main.querySelector('#requests-content'); const refresh = main.querySelector('#refresh-requests'); const updated = main.querySelector('#requests-updated'); let loading = false;
  async function load() {
    if (loading) return; loading = true; refresh.disabled = true; main.setAttribute('aria-busy', 'true'); updated.textContent = '';
    content.replaceChildren(element('p', 'shift-loading', 'Loading your requests…'));
    const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch('/api/worker/requests', { cache: 'no-store', signal: controller.signal });
      if (response.status === 401) { location.replace('/login?expired=1'); return; }
      if (!response.ok) throw new Error();
      const result = await response.json(); content.replaceChildren();
      if (!result.requests.length) { const empty = element('section', 'panel empty'); empty.append(element('h2', '', 'No requests yet.'), element('p', '', 'Open My shifts to request coverage for a future shift assigned to you.')); content.append(empty); }
      for (const request of result.requests) {
        const article = element('article', 'panel coverage-request');
        const head = element('div', 'panel-head'); const labels = { open: 'Open · waiting for a teammate', pending: 'Pending manager approval', approved: 'Approved', cancelled: 'Cancelled' };
        head.append(element('h2', '', labels[request.status])); article.append(head, shiftCard(request.shift, result.timezone));
        const details = element('div', 'coverage-details');
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
      updated.textContent = `${result.requests.length} request${result.requests.length === 1 ? '' : 's'} · Times shown in ${result.timezone}. Refresh to check for changes.`;
    } catch {
      const panel = element('div', 'panel shift-load-error'); const error = element('p', '', 'We couldn’t load your requests. Please try again.'); error.setAttribute('role', 'alert');
      const retry = element('button', 'logout-button', 'Try again'); retry.type = 'button'; retry.addEventListener('click', load); panel.append(error, retry); content.replaceChildren(panel);
    } finally { clearTimeout(timeout); loading = false; refresh.disabled = false; main.setAttribute('aria-busy', 'false'); }
  }
  refresh.addEventListener('click', load); await load();
}
