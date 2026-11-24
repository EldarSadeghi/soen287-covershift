import { requestJSON } from './request.js';
import { claimAction } from './claim.js';
import { element, shiftCard } from './shift-card.js';
export async function mountOpenShifts(main, csrfToken) {
  main.innerHTML = '<p class="eyebrow">A little teamwork goes a long way</p><div class="page-heading"><div><h1>Lend your team a hand.</h1><p class="subtitle">Future shifts your teammates have requested coverage for.</p></div><button id="refresh-open" class="logout-button" type="button">Refresh</button></div><section class="panel open-board-note"><h2>Your team’s open requests</h2><p>Only open requests from other workers in your business appear here. The original worker stays assigned until coverage is approved.</p><p>Check your schedule before claiming. Assigned shifts, pending claims and approved time off are checked for overlaps; your manager gives final approval.</p></section><p id="claim-result" class="shift-created" role="status" tabindex="-1" hidden></p><p><a class="text-link" href="/workspace/worker/requests">View My requests & claims →</a></p><div id="open-summary" class="section-note" role="status" aria-atomic="true"></div><section id="open-content"></section><p id="open-updated" class="section-note" role="status"></p>';
  const content = main.querySelector('#open-content'); const refresh = main.querySelector('#refresh-open'); const summary = main.querySelector('#open-summary'); const updated = main.querySelector('#open-updated'); let loading = false;
  async function load(event) {
    const restoreFocus = Boolean(event?.currentTarget);
    if (loading) return; loading = true; refresh.disabled = true; main.setAttribute('aria-busy', 'true'); summary.textContent = ''; updated.textContent = '';
    const status = element('p', 'shift-loading', 'Loading open coverage requests…'); status.setAttribute('role','status'); content.replaceChildren(status);

    try {
      const response = await requestJSON('/api/worker/open-shifts', { cache: 'no-store' });
      if (response.status === 401) { location.replace('/login?expired=1'); return; }
      if (!response.ok) throw new Error();
      const result = response.data; content.replaceChildren();
      summary.textContent = `${result.requests.length} open request${result.requests.length === 1 ? '' : 's'} · Times shown in ${result.timezone}.`;
      if (!result.requests.length) {
        const empty = element('section','panel empty'); empty.append(element('h2','','All covered for now.'),element('p','','There are no eligible open coverage requests from your teammates. Your own, started and unavailable requests don’t appear here. Refresh to check again.'));
        const own = element('a','text-link','View My requests →'); own.href = '/workspace/worker/requests'; empty.append(own); content.append(empty);
      } else {
        const context = { commitments: result.commitments, timezone: result.timezone };
        for (const request of result.requests) {
          const card = element('article','panel open-request'); const head = element('div','panel-head'); head.append(element('h2','','Open coverage request'),element('span','badge','Open'));
          card.append(head,shiftCard(request.shift,result.timezone)); const details = element('div','coverage-details'); details.append(element('p','',`Requested by ${request.originalWorkerName}`),element('p','section-note','This shift remains assigned to the original worker until manager approval.')); details.append(claimAction(request, context, csrfToken, async message => { await load(); const result = main.querySelector('#claim-result'); result.textContent = message; result.hidden = false; result.focus(); })); card.append(details); content.append(card);
        }
      }
      updated.textContent = `Updated ${new Intl.DateTimeFormat('en-US',{timeZone:result.timezone,hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(new Date(result.asOf))}. Refresh to check availability; requests may change or expire.`;
    } catch {
      const panel = element('div','panel shift-load-error'); const message = element('p','','We couldn’t load open shifts. Please try again.'); message.setAttribute('role','alert'); const retry = element('button','logout-button','Try again'); retry.type = 'button'; retry.addEventListener('click',load); panel.append(message,retry); content.replaceChildren(panel);
    } finally { loading = false; refresh.disabled = false; main.setAttribute('aria-busy','false'); if (restoreFocus) refresh.focus(); }
  }
  refresh.addEventListener('click',load); await load();
}
