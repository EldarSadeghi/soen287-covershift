import { requestJSON } from './request.js';
import { element, shiftCard } from './shift-card.js';
const labels = { open: 'Open', pending: 'Pending approval', approved: 'Approved', rejected: 'Rejected', cancelled: 'Cancelled', expired: 'Expired' };
const actions = { requested: 'Coverage requested', claimed: 'Coverage claimed', approved: 'Claim approved · assignment transferred', rejected: 'Claim rejected · original assignment retained', reopened: 'Coverage reopened after rejection', cancelled: 'Coverage cancelled · assignment unchanged', legacy: 'Saved status · earlier event details were not recorded' };
export async function mountCoverageHistory(main, role) {
  main.innerHTML = '<p class="eyebrow">Every step, in one place</p><div class="page-heading"><div><h1>Coverage history.</h1><p class="subtitle" id="history-subtitle"></p></div><button class="logout-button" id="refresh-history" type="button">Refresh</button></div><label class="history-filter">Show status <select id="history-status"><option value="all">All statuses</option><option value="open">Open</option><option value="pending">Pending approval</option><option value="expired">Expired</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="cancelled">Cancelled</option></select></label><p class="section-note" id="history-count" role="status" aria-atomic="true"></p><section id="history-records"></section><p class="section-note" id="history-updated"></p>';
  main.querySelector('#history-subtitle').textContent = role === 'manager' ? 'Coverage requests and decisions within your business.' : 'Requests you created and claims you made. Each record keeps its own outcome.';
  const filter = main.querySelector('#history-status'); const refresh = main.querySelector('#refresh-history'); const content = main.querySelector('#history-records'); const count = main.querySelector('#history-count'); const updated = main.querySelector('#history-updated');
  const allowed = ['all', 'open', 'pending', 'expired', 'approved', 'rejected', 'cancelled'];
  const initial = new URLSearchParams(location.search).get('status'); if (allowed.includes(initial)) filter.value = initial;
  let data; let loading = false;
  function render() {
    const records = data.records.filter(r => filter.value === 'all' || r.displayStatus === filter.value); content.replaceChildren();
    count.textContent = `${records.length} of ${data.records.length} coverage records · Times shown in ${data.timezone}.`;
    const time = new Intl.DateTimeFormat(undefined, { timeZone: data.timezone, dateStyle: 'medium', timeStyle: 'medium' });
    if (!records.length) { const empty = element('section', 'panel empty'); empty.append(element('h2', '', 'No matching coverage records.'), element('p', '', data.records.length ? 'Choose another status to see more history.' : 'History will appear after coverage is requested or claimed.')); content.append(empty); }
    for (const r of records) {
      const card = element('article', 'panel history-record'); const header = element('div', 'panel-head'); header.append(element('h2', '', r.shift.title), element('span', `badge ${r.displayStatus === 'pending' ? 'amber' : ''}`, labels[r.displayStatus]));
      card.append(header, shiftCard(r.shift, data.timezone));
      const people = element('div', 'coverage-details'); people.append(element('p', '', `Requested by: ${r.originalWorkerName}`));
      if (r.claimantName) people.append(element('p', '', `Claimant: ${r.claimantName}`));
      if (r.reviewerName) people.append(element('p', '', `Reviewed by: ${r.reviewerName}`));
      people.append(element('p', 'history-assignment', `Currently assigned: ${r.assignedWorkerName}`));
      if (r.status === 'rejected') people.append(element('p', 'section-note', 'This claim was rejected. Coverage reopened as a separate request; its current outcome appears in its own record.'));
      if (r.displayStatus === 'expired') people.append(element('p', 'stale-claim', `Expired when the shift started: ${time.format(new Date(r.expiredAt))}. Saved status: ${labels[r.status]}. No coverage decision was made; this record did not transfer assignment.`));
      const timeline = element('ol', 'coverage-timeline'); timeline.setAttribute('aria-label', `Timeline for ${r.shift.title}`);
      for (const e of r.events) { const item = element('li'); item.append(element('strong', '', actions[e.action]), element('p', '', `${e.actorName ? `${e.actorName} · ` : ''}${time.format(new Date(e.at))} · ${labels[e.status]}`)); timeline.append(item); }
      people.append(timeline); card.append(people); content.append(card);
    }
    updated.textContent = `Updated ${time.format(new Date(data.asOf))}. Refresh to check for changes.`;
  }
  async function load(event) {
    const restoreFocus = Boolean(event?.currentTarget);
    if (loading) return; loading = true; refresh.disabled = filter.disabled = true; main.setAttribute('aria-busy', 'true'); count.textContent = ''; updated.textContent = ''; content.replaceChildren(element('p', 'shift-loading', 'Loading coverage history…'));

    try {
      const response = await requestJSON(`/api/${role}/coverage-history`, { cache: 'no-store' });
      if (response.status === 401) { location.replace('/login?expired=1'); return; }
      if (!response.ok) throw new Error(); data = response.data; render();
    } catch { const box = element('section', 'panel shift-load-error'); const error = element('p', '', 'We couldn’t load coverage history. Please try again.'); error.setAttribute('role', 'alert'); const retry = element('button', 'logout-button', 'Try again'); retry.type = 'button'; retry.addEventListener('click', load); box.append(error, retry); content.replaceChildren(box); }
    finally { loading = false; refresh.disabled = filter.disabled = false; main.setAttribute('aria-busy', 'false'); if (restoreFocus) refresh.focus(); }
  }
  filter.addEventListener('change', () => { const url = new URL(location.href); if (filter.value === 'all') url.searchParams.delete('status'); else url.searchParams.set('status', filter.value); history.replaceState(null, '', url.pathname + url.search); if (data) render(); }); refresh.addEventListener('click', load); await load();
}
