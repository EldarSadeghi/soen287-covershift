import { mountWorkerShifts } from './worker-shifts.js';
import { mountManagerDashboard } from './manager-dashboard.js';
const main = document.querySelector('main');
const logout = document.querySelector('#logout');
const errorBox = document.querySelector('#workspace-error');
let csrfToken;
const routes = {
  manager: [['overview', 'Overview', '◫'], ['schedule', 'Schedule', '▦'], ['approvals', 'Approvals', '✓'], ['team', 'Team', '♧']],
  worker: [['shifts', 'My shifts', '▦'], ['open', 'Open shifts', '↗'], ['requests', 'My requests', '⇄']],
};
const copy = {
  team: ['Your people, all in one place.', 'Small team. Big difference.', 'Adding and managing workers is coming soon.'],
  open: ['Lend your team a hand.', 'A little flexibility goes a long way.', 'Open coverage opportunities are coming soon.'],
  requests: ['Your coverage requests.', 'Keep track with confidence.', 'Requesting and tracking coverage is coming soon.'],
};
function showError(message) { errorBox.textContent = message; errorBox.hidden = false; errorBox.focus(); }
async function load() {
  try {
    const response = await fetch('/api/session', { cache: 'no-store' });
    if (response.status === 401) { location.replace('/login?expired=1'); return; }
    if (!response.ok) throw new Error();
    const account = await response.json();
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
    document.querySelector('#navigation').innerHTML = roleRoutes.map(([key, name, icon]) => `<a class="nav-link" href="/workspace/${user.role}/${key}" ${key === page ? 'aria-current="page"' : ''}><span class="nav-icon" aria-hidden="true">${icon}</span>${name}</a>`).join('');
    logout.disabled = false;
    if (user.role === 'manager' && ['overview', 'schedule', 'approvals'].includes(page)) {
      await mountManagerDashboard(main, page, account);
      return;
    }
    if (user.role === 'worker' && page === 'shifts') {
      await mountWorkerShifts(main);
      return;
    }
    const [heading, tagline, description] = copy[page];
    main.innerHTML = '<p class="eyebrow">Welcome to your workspace</p><div class="page-heading"><div><h1 id="workspace-heading"></h1><p class="subtitle" id="workspace-subtitle"></p></div></div><section class="identity-grid" aria-label="Account details"><article class="panel identity-card"><p>Your business</p><strong id="identity-business"></strong></article><article class="panel identity-card"><p>Your role</p><strong id="identity-role"></strong></article><article class="panel identity-card"><p>Business timezone</p><strong id="identity-timezone"></strong></article></section><section class="panel workspace-empty"><h2 id="workspace-tagline"></h2><p id="workspace-description"></p></section>';
    document.querySelector('#workspace-heading').textContent = heading;
    document.querySelector('#workspace-subtitle').textContent = `Good to see you, ${user.name}.`;
    document.querySelector('#identity-business').textContent = business.name;
    document.querySelector('#identity-role').textContent = user.role === 'manager' ? 'Manager' : 'Worker';
    document.querySelector('#identity-timezone').textContent = business.timezone;
    document.querySelector('#workspace-tagline').textContent = tagline;
    document.querySelector('#workspace-description').textContent = description;
    main.setAttribute('aria-busy', 'false'); logout.disabled = false;
  } catch { main.setAttribute('aria-busy', 'false'); showError('We couldn’t load your workspace. Refresh the page to try again.'); }
}
logout.addEventListener('click', async () => {
  logout.disabled = true; errorBox.hidden = true;
  try {
    const response = await fetch('/api/logout', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken }, body: '{}' });
    if (!response.ok && response.status !== 401) throw new Error();
    csrfToken = undefined; location.replace('/login');
  } catch { showError('We couldn’t sign you out. Refresh the page and try again.'); logout.disabled = false; }
});
window.addEventListener('pageshow', event => { if (event.persisted) location.reload(); });
load();
