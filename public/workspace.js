import {mountTimeOff} from './time-off.js';
import { mountSelectedScheduleShift } from './ai-schedule.js';
import { mountNotifications } from './notifications.js';
import { mountAiChat } from './ai-shift-draft.js';
import { requestJSON } from './request.js';
import { mountCoverageHistory } from './coverage-history.js';
import { mountOpenShifts } from './open-shifts.js';
import { mountWorkerRequests } from './worker-requests.js';
import { mountTeam } from './team.js';
import { mountWorkerShifts } from './worker-shifts.js';
import { mountManagerDashboard } from './manager-dashboard.js';
const main = document.querySelector('main');
const logout = document.querySelector('#logout');
const errorBox = document.querySelector('#workspace-error');
let csrfToken;
let aiChat;
let notifications;
const routes = {
  manager: [['overview', 'Overview', '◫'], ['schedule', 'Schedule', '▦'], ['approvals', 'Approvals', '✓'], ['team', 'Team', '♧'], ['time-off', 'Time off', '◷'], ['availability', 'Availability', '◷'], ['cover', 'Cover requests', '⇄'], ['history', 'History', '◷']],
  worker: [['shifts', 'My shifts', '▦'], ['open', 'Open shifts', '↗'], ['requests', 'My requests', '⇄'], ['time-off', 'Time off', '◷'], ['availability', 'Availability', '◷'], ['cover', 'Cover requests', '⇄'], ['history', 'History', '◷']],
};
const navPaths={overview:'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',schedule:'M4 5h16v16H4z M8 2v6 M16 2v6 M4 11h16',shifts:'M4 5h16v16H4z M8 2v6 M16 2v6 M4 11h16',open:'M7 17 17 7 M7 7h10v10',requests:'M4 7h16 M16 3l4 4-4 4 M20 17H4 M8 13l-4 4 4 4',cover:'M4 7h16 M16 3l4 4-4 4 M20 17H4 M8 13l-4 4 4 4',availability:'M4 5h16v16H4z M8 2v6 M16 2v6 M8 15l3 3 5-5',approvals:'M5 12l4 4L19 6',team:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M17 4a4 4 0 0 1 0 8 M22 21v-2a4 4 0 0 0-3-4',history:'M3 11a9 9 0 1 1 2 7 M3 4v7h7 M12 7v5l3 2','time-off':'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M12 2v2 M12 20v2 M2 12h2 M20 12h2 M5 5l1 1 M18 18l1 1 M5 19l1-1 M18 6l1-1'};
function navigationIcon(key){return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${navPaths[key]}"/></svg>`;}
function showError(message) { errorBox.textContent = message; errorBox.hidden = false; errorBox.focus(); }
async function load() {
  try {
    const response = await requestJSON('/api/session', { cache: 'no-store' });
    if (response.status === 401) { location.replace('/login?expired=1'); return; }
    if (!response.ok) throw new Error();
    const account = response.data;
    const { user, business } = account;
    csrfToken = account.csrfToken;
    const roleRoutes = routes[user.role];
    const page = location.pathname.split('/')[3];
    if (!roleRoutes || !roleRoutes.some(([key]) => key === page) || location.pathname.split('/')[2] !== user.role) { location.replace('/'); return; }
    const title = roleRoutes.find(([key]) => key === page)[1];
    document.title = `${title} · CoverShift`;
    document.querySelector('#breadcrumb').textContent = title;
    document.querySelector('#business-name').textContent = business.name;
    document.querySelector('#business-timezone').textContent = business.timezone;
    document.querySelector('#business-icon').textContent = business.name.slice(0, 1).toUpperCase();
    document.querySelector('#profile-name').textContent = user.name;
    document.querySelector('#avatar').textContent = user.name.split(/\s+/).slice(0, 2).map(part => part.slice(0, 1)).join('').toUpperCase();
    document.querySelector('#account-role').textContent = `Signed in as ${user.role}`;
    document.querySelector('#navigation').innerHTML = roleRoutes.map(([key, name, icon]) => `<a class="nav-link" href="/workspace/${user.role}/${key}" ${key === page ? 'aria-current="page"' : ''}><span class="nav-icon" aria-hidden="true">${navigationIcon(key)}</span>${name}</a>`).join('');
    logout.disabled = false;
    aiChat = mountAiChat(account, csrfToken);
    notifications = mountNotifications(account, csrfToken);
    if(page==='cover'){const {mountCoverInbox}=await import('./cover-ui.js');await mountCoverInbox(main,account,csrfToken);return;}
    if (page === 'availability') { const {mountAvailability}=await import('./availability-view.js');await mountAvailability(main,account,csrfToken);return; }
    if (page === 'time-off') { await mountTimeOff(main,account,csrfToken); return; }
    if (page === 'history') { await mountCoverageHistory(main, user.role); return; }
    if (user.role === 'manager' && ['overview', 'schedule', 'approvals'].includes(page)) {
      await mountManagerDashboard(main, page, account, csrfToken);
      if(page==='schedule')await mountSelectedScheduleShift(main);
      return;
    }
    if (user.role === 'manager' && page === 'team') { await mountTeam(main, account, csrfToken); return; }
    if (user.role === 'worker' && page === 'shifts') {
      await mountWorkerShifts(main, csrfToken);
      await mountSelectedScheduleShift(main);
      return;
    }
    if (user.role === 'worker' && page === 'requests') { await mountWorkerRequests(main, csrfToken); return; }
    if (user.role === 'worker' && page === 'open') { await mountOpenShifts(main, csrfToken); return; }
  } catch { main.setAttribute('aria-busy', 'false'); showError('We couldn’t load your workspace. Refresh the page to try again.'); }
}
logout.addEventListener('click', async () => {
  logout.disabled = true; errorBox.hidden = true;
  try {
    const response = await requestJSON('/api/logout', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken }, body: '{}' });
    if (!response.ok && response.status !== 401) throw new Error();
    aiChat?.clear(); notifications?.clear(); csrfToken = undefined; location.replace('/login');
  } catch { showError('We couldn’t confirm sign-out. Refresh the page to check your session before trying again.'); logout.disabled = false; }
});
window.addEventListener('pageshow', event => { if (event.persisted) location.reload(); });
load();
