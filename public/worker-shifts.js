import { formatShiftTime } from './shift-time.js';
import { element, shiftCard } from './shift-card.js';

export async function mountWorkerShifts(main) {
  main.innerHTML = '<p class="eyebrow">Your working week</p><div class="page-heading"><div><h1>Your shifts, all in one place.</h1><p class="subtitle">The shifts assigned to you, from now onward.</p></div></div><section id="shift-summary" class="stats shifts-summary" aria-label="Your shift summary" hidden></section><section class="panel" aria-labelledby="saved-shifts-heading"><div class="panel-head"><h2 id="saved-shifts-heading">Upcoming & current shifts</h2><button id="refresh-shifts" class="logout-button" type="button">Refresh</button></div><p class="shift-timezone" id="shift-timezone"></p><div id="shift-content"></div></section><p class="section-note" id="shifts-updated" role="status"></p>';
  const refresh = document.querySelector('#refresh-shifts');
  const content = document.querySelector('#shift-content');
  const summary = document.querySelector('#shift-summary');
  const timezone = document.querySelector('#shift-timezone');
  const updated = document.querySelector('#shifts-updated');
  let loading = false;
  async function load() {
    if (loading) return;
    loading = true;
    main.setAttribute('aria-busy', 'true'); refresh.disabled = true;
    summary.hidden = true; summary.replaceChildren(); timezone.textContent = ''; updated.textContent = '';
    const status = element('p', 'shift-loading', 'Loading your shifts…'); status.setAttribute('role', 'status');
    content.replaceChildren(status);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch('/api/worker/shifts', { cache: 'no-store', signal: controller.signal });
      if (response.status === 401) { location.replace('/login?expired=1'); return; }
      if (!response.ok) throw new Error('Unable to load shifts');
      const result = await response.json();
      timezone.textContent = `All times shown in your business timezone: ${result.timezone}.`;
      if (result.shifts.length) {
        const total = result.shifts.reduce((sum, shift) => sum + formatShiftTime(shift, result.timezone).hours, 0);
        for (const [label, value, detail] of [
          ['Upcoming & current', String(result.shifts.length), result.shifts.length === 1 ? 'assigned shift' : 'assigned shifts'],
          ['Scheduled hours', new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(total), 'across listed shifts'],
          ['Times shown in', result.timezone.split('/').at(-1).replaceAll('_', ' '), 'business timezone'],
        ]) {
          const card = element('article', 'stat');
          card.append(element('p', 'stat-title', label), element('strong', label === 'Times shown in' ? 'timezone-value' : '', value), element('small', '', detail));
          summary.append(card);
        }
        summary.hidden = false;
        content.replaceChildren(...result.shifts.map(shift => shiftCard(shift, result.timezone)));
      } else {
        const empty = element('div', 'empty saved-shifts-empty');
        empty.append(element('span', 'empty-calendar', '▦'), element('h3', '', 'A little breathing room.'), element('p', '', 'You have no upcoming or current shifts assigned. Check back after your manager updates the schedule.'));
        empty.querySelector('.empty-calendar').setAttribute('aria-hidden', 'true');
        content.replaceChildren(empty);
      }
      updated.textContent = `Updated ${new Intl.DateTimeFormat('en-US', { timeZone: result.timezone, hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(new Date(result.asOf))}. Refresh to check for schedule changes.`;
    } catch {
      const error = element('div', 'shift-load-error');
      const message = element('p', '', 'We couldn’t load your shifts. Please try again.'); message.setAttribute('role', 'alert');
      const retry = element('button', 'solid-link', 'Try again'); retry.type = 'button'; retry.addEventListener('click', load);
      error.append(message, retry); content.replaceChildren(error);
    } finally {
      clearTimeout(timeout); main.setAttribute('aria-busy', 'false'); refresh.disabled = false; loading = false;
    }
  }
  refresh.addEventListener('click', load);
  await load();
}
