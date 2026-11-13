import { element, shiftCard } from './shift-card.js';
import { formatShiftTime } from './shift-time.js';

function link(label, href) { const node = element('a', 'text-link', label); node.href = href; return node; }
function empty(title, description) {
  const node = element('div', 'empty'); node.append(element('h3', '', title), element('p', '', description)); return node;
}
function panel(title, content, navigation = null) {
  const node = element('section', 'panel'); const head = element('div', 'panel-head');
  head.append(element('h2', '', title)); if (navigation) head.append(navigation);
  node.append(head, ...content); return node;
}
function claimCard(claim, timezone, showActions) {
  const node = element('article', 'pending-claim');
  const heading = element('div', 'claim-heading');
  heading.append(element('h3', '', claim.shift.title), element('span', 'badge amber', 'Pending approval'));
  node.append(heading);
  const formatted = formatShiftTime(claim.shift, timezone);
  node.append(element('p', 'claim-date', formatted.date));
  node.append(element('p', 'claim-time', `${formatted.startTime} – ${formatted.endDate ? `${formatted.endDate} · ` : ''}${formatted.endTime}`));
  const people = element('div', 'claim-people');
  const original = element('div'); original.append(element('small', '', 'Original worker'), element('strong', '', claim.originalWorker.name));
  const claimant = element('div'); claimant.append(element('small', '', 'Claimed by'), element('strong', '', claim.claimant.name));
  people.append(original, element('span', 'claim-arrow', '→'), claimant); node.append(people);
  if (claim.shift.status === 'completed') node.append(element('p', 'stale-claim', 'This shift has ended. The saved claim is still pending.'));
  else if (claim.shift.status === 'in_progress') node.append(element('p', 'stale-claim', 'This shift is already in progress.'));
  if (showActions) {
    const actions = element('div', 'claim-actions');
    for (const label of ['Approve · Coming soon', 'Reject · Coming soon']) {
      const button = element('button', 'future-action', label); button.disabled = true; button.type = 'button'; actions.append(button);
    }
    node.append(actions);
  }
  node.append(element('p', 'claim-footnote', 'The original worker remains assigned until approval.'));
  return node;
}

export async function mountManagerDashboard(main, page, account) {
  const titles = { overview: 'Good teams show up together.', schedule: 'The team schedule.', approvals: 'The final say is yours.' };
  main.innerHTML = '<p class="eyebrow">Your team at a glance</p><div class="page-heading"><div><h1 id="manager-heading"></h1><p class="subtitle" id="manager-subtitle"></p></div><button class="logout-button" id="refresh-dashboard" type="button">Refresh</button></div><section id="manager-summary" class="stats" aria-label="Business summary" hidden></section><p class="manager-timezone" id="manager-timezone"></p><div id="manager-content"></div><p class="section-note" id="dashboard-updated" role="status"></p>';
  document.querySelector('#manager-heading').textContent = titles[page];
  document.querySelector('#manager-subtitle').textContent = page === 'overview' ? `Hi ${account.user.name}, here’s what’s coming up for your team.` : page === 'schedule' ? 'Your business’s assigned upcoming and current shifts.' : 'Saved coverage claims waiting for manager approval.';
  const refresh = document.querySelector('#refresh-dashboard');
  const content = document.querySelector('#manager-content');
  const summary = document.querySelector('#manager-summary');
  const timezone = document.querySelector('#manager-timezone');
  const updated = document.querySelector('#dashboard-updated');
  let loading = false;
  async function load() {
    if (loading) return;
    loading = true; main.setAttribute('aria-busy', 'true'); refresh.disabled = true;
    summary.hidden = true; summary.replaceChildren(); timezone.textContent = ''; updated.textContent = '';
    const status = element('p', 'shift-loading', 'Loading your business dashboard…'); status.setAttribute('role', 'status'); content.replaceChildren(status);
    const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch('/api/manager/dashboard', { cache: 'no-store', signal: controller.signal });
      if (response.status === 401) { location.replace('/login?expired=1'); return; }
      if (!response.ok) throw new Error();
      const result = await response.json();
      timezone.textContent = `All times shown in your business timezone: ${result.timezone}.`;
      for (const [label, value, detail] of [['Team members', result.summary.workers, 'workers in your business'], ['Upcoming & current', result.summary.shifts, 'assigned shifts'], ['Awaiting approval', result.summary.pendingClaims, 'pending coverage claims']]) {
        const card = element('article', 'stat'); card.append(element('p', 'stat-title', label), element('strong', '', String(value)), element('small', '', detail)); summary.append(card);
      }
      summary.hidden = false;
      const shifts = page === 'overview' ? result.shifts.slice(0, 3) : result.shifts;
      const claims = page === 'overview' ? result.pendingClaims.slice(0, 3) : result.pendingClaims;
      const shiftPanel = () => panel('Upcoming & current shifts', shifts.length ? shifts.map(shift => shiftCard(shift, result.timezone, { workerName: shift.assignedWorker.name })) : [empty('A clear schedule.', 'There are no upcoming or current shifts saved for your business.')], page === 'overview' ? link('View schedule →', '/workspace/manager/schedule') : null);
      const claimPanel = () => panel('Pending coverage claims', claims.length ? claims.map(claim => claimCard(claim, result.timezone, page === 'approvals')) : [empty('Nothing waiting on you.', 'There are no pending coverage claims in your business.')], page === 'overview' ? link('View approvals →', '/workspace/manager/approvals') : null);
      if (page === 'overview') {
        const grid = element('div', 'manager-grid');
        const schedule = shiftPanel(); const pending = claimPanel();
        if (result.shifts.length > 3) schedule.append(element('p', 'panel-preview-note', `Showing the next 3 of ${result.shifts.length} assigned shifts.`));
        if (result.pendingClaims.length > 3) pending.append(element('p', 'panel-preview-note', `Showing 3 of ${result.pendingClaims.length} pending claims.`));
        grid.append(schedule, pending); content.replaceChildren(grid);
        const note = element('section', 'manager-next-note');
        note.append(element('h2', '', 'Your people, all in one place.'), element('p', '', 'Worker management is coming soon.'), link('View team page →', '/workspace/manager/team')); content.append(note);
      } else if (page === 'schedule') {
        content.replaceChildren(shiftPanel()); content.append(element('p', 'section-note', 'Shift creation and editing are coming soon.'));
      } else {
        content.replaceChildren(claimPanel()); content.append(element('p', 'section-note', 'Approval and rejection actions are coming soon. This view does not change assignments.'));
      }
      updated.textContent = `Updated ${new Intl.DateTimeFormat('en-US', { timeZone: result.timezone, hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(new Date(result.asOf))}. Refresh to check for changes.`;
    } catch {
      const error = element('div', 'panel shift-load-error');
      const message = element('p', '', 'We couldn’t load your business dashboard. Please try again.'); message.setAttribute('role', 'alert');
      const retry = element('button', 'solid-link', 'Try again'); retry.type = 'button'; retry.addEventListener('click', load); error.append(message, retry); content.replaceChildren(error);
    } finally { clearTimeout(timeout); loading = false; refresh.disabled = false; main.setAttribute('aria-busy', 'false'); }
  }
  refresh.addEventListener('click', load); await load();
}
