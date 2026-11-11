const routes = {
  worker: [['shifts', 'My shifts', '▦'], ['open', 'Open shifts', '↗'], ['requests', 'My requests', '⇄']],
  manager: [['overview', 'Overview', '◫'], ['schedule', 'Schedule', '▦'], ['approvals', 'Approvals', '✓'], ['team', 'Team', '♧']],
};
const main = document.querySelector('main');
const shifts = [
  { day: '12', weekday: 'Thu', title: 'Morning shift', time: '7:00 AM – 1:00 PM', detail: 'Barista · 6 hours', status: 'Assigned' },
  { day: '14', weekday: 'Sat', title: 'Afternoon shift', time: '12:00 PM – 6:00 PM', detail: 'Barista · 6 hours', status: 'Assigned' },
  { day: '16', weekday: 'Mon', title: 'Opening shift', time: '6:30 AM – 12:30 PM', detail: 'Barista · 6 hours', status: 'Assigned' },
];
const openShifts = [
  { day: '13', weekday: 'Fri', title: 'Afternoon coverage', time: '1:00 PM – 6:00 PM', detail: 'Alex Morgan · Barista · 5 hours', status: 'Open' },
  { day: '15', weekday: 'Sun', title: 'Morning coverage', time: '8:00 AM – 2:00 PM', detail: 'Sam Rivera · Floor staff · 6 hours', status: 'Open' },
];
const stat = (label, value, detail) => `<article class="stat"><p class="stat-title">${label}</p><strong>${value}</strong><small>${detail}</small></article>`;
const stats = (...items) => `<section class="stats" aria-label="Demo summary">${items.join('')}</section>`;
const row = (shift, action, detail = shift.detail) => `<article class="shift"><div class="calendar" aria-label="${shift.weekday}, November ${shift.day}, 2026"><small>${shift.weekday}</small><strong>${shift.day}</strong></div><div class="shift-info"><h3>${shift.title}</h3><p>${shift.time}</p><p>${detail}</p></div><div class="shift-meta"><span class="badge ${shift.status === 'Pending approval' ? 'amber' : ''}">${shift.status}</span>${action ? `<button class="future-action" disabled title="Available in a later increment">${action} · Coming soon</button>` : ''}</div></article>`;
const panel = (title, content, link = '') => `<section class="panel"><div class="panel-head"><h2>${title}</h2>${link}</div>${content}</section>`;
const heading = (eyebrow, title, subtitle) => `<p class="eyebrow">${eyebrow}</p><div class="page-heading"><div><h1>${title}</h1><p class="subtitle">${subtitle}</p></div><span class="date-chip">November 2026 · Sample week</span></div>`;
const workerAside = `<aside class="aside-stack"><section class="note"><div class="note-icon" aria-hidden="true">↗</div><h2>A little flexibility.<br>A stronger team.</h2><p>Have some room in your week? See where your teammates could use a hand.</p><a class="solid-link" href="#/worker/open">Explore open shifts <span aria-hidden="true">↗</span></a></section><section class="panel small-note"><h2>How coverage works</h2><p>Request coverage, let a teammate claim it, and wait for manager approval. Your shift stays yours until the swap is approved.</p></section></aside>`;
const demoNote = '<p class="section-note">Sample records for layout review. Changes are not saved in this preview.</p>';

function render() {
  let [, role, page] = location.hash.split('/');
  if (!routes[role] || !routes[role].some(([key]) => key === page)) {
    history.replaceState(null, '', '#/worker/shifts');
    role = 'worker'; page = 'shifts';
  }
  const title = routes[role].find(([key]) => key === page)[1];
  document.title = `${title} · CoverShift`;
  document.querySelector('.brand').href = role === 'worker' ? '#/worker/shifts' : '#/manager/overview';
  document.querySelector('#breadcrumb').textContent = title;
  document.querySelector('#profile-name').textContent = role === 'worker' ? 'Jamie Lee' : 'Morgan Chen';
  document.querySelector('#avatar').textContent = role === 'worker' ? 'JL' : 'MC';
  document.querySelector('#navigation').innerHTML = routes[role].map(([key, name, icon]) => `<a class="nav-link" href="#/${role}/${key}" ${key === page ? 'aria-current="page"' : ''}><span class="nav-icon" aria-hidden="true">${icon}</span>${name}${key === 'approvals' ? '<span class="nav-count" aria-label="1 sample approval">1</span>' : ''}</a>`).join('');
  document.querySelectorAll('[data-role]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.role === role)));
  if (role === 'worker' && page === 'shifts') {
    main.innerHTML = heading('Your working week', 'A good week starts here.', 'Hi Jamie, here’s what’s coming up at Neighbourhood Café.') + stats(stat('Upcoming shifts', '3', 'this sample week'), stat('Scheduled hours', '18', 'hours this week'), stat('Open shifts', '2', 'team opportunities')) + `<div class="content-grid"><div>${panel('Your upcoming shifts', shifts.map(s => row(s, 'Request coverage')).join(''), '<span class="badge neutral">3 shifts</span>')}${demoNote}</div>${workerAside}</div>`;
  } else if (role === 'worker' && page === 'open') {
    main.innerHTML = heading('Lend a hand', 'Room for one more?', 'Browse coverage opportunities from your team.') + `<div class="content-grid"><div>${panel('Open shifts', openShifts.map(s => row(s, 'Claim shift')).join(''), '<span class="badge neutral">2 opportunities</span>')}${demoNote}</div>${workerAside}</div>`;
  } else if (role === 'worker') {
    main.innerHTML = heading('Keep track', 'Your coverage requests.', 'One place to follow the shifts you’ve asked your team to cover.') + panel('My requests', '<div class="empty"><h3>A clear slate.</h3><p>You have no coverage requests in this sample account.</p><a class="solid-link" href="#/worker/shifts">View my shifts</a></div>') + demoNote;
  } else if (page === 'overview') {
    main.innerHTML = heading('Your team at a glance', 'Good teams show up together.', 'Hi Morgan, here’s a snapshot of your café’s sample week.') + stats(stat('Team members', '4', 'workers'), stat('Scheduled shifts', '3', 'assigned to Jamie'), stat('Awaiting approval', '1', 'coverage claim')) + `<div class="content-grid"><div>${panel('Upcoming shifts', shifts.map(s => row(s, '', 'Jamie Lee · Barista · 6 hours')).join(''), '<a class="text-link" href="#/manager/schedule">View schedule →</a>')}${demoNote}</div><aside class="aside-stack"><section class="note"><div class="note-icon" aria-hidden="true">⇄</div><h2>One swap.<br>Your final say.</h2><p>A sample coverage claim is waiting for review. Assignments only change after manager approval.</p><a class="solid-link" href="#/manager/approvals">View approvals →</a></section><section class="panel small-note"><h2>Your people, all in one place</h2><p>Find your team in the roster.</p><p><a class="text-link" href="#/manager/team">View team →</a></p></section></aside></div>`;
  } else if (page === 'schedule') {
    main.innerHTML = heading('Plan the week', 'The team schedule.', 'A simple view of assigned shifts. Shift editing comes in a later increment.') + panel('November · Sample assignments', shifts.map(s => row(s, 'Edit shift', 'Jamie Lee · Barista · 6 hours')).join(''), '<button class="future-action" disabled>Create shift · Coming soon</button>') + demoNote;
  } else if (page === 'approvals') {
    const claim = { ...openShifts[0], status: 'Pending approval' };
    main.innerHTML = heading('Coverage with confidence', 'The final say is yours.', 'Review who’s covering before a shift changes hands.') + panel('Pending coverage claims', row(claim, 'Review claim', 'Alex Morgan → Taylor Brooks · Sample claim'), '<span class="badge amber">1 pending</span>') + demoNote;
  } else {
    const people = [['JL', 'Jamie Lee', 'Barista'], ['AM', 'Alex Morgan', 'Barista'], ['SR', 'Sam Rivera', 'Floor staff'], ['TB', 'Taylor Brooks', 'Barista']];
    main.innerHTML = heading('Small team, big difference', 'Meet your team.', 'The people who keep Neighbourhood Café moving.') + `<section class="roster" aria-label="Demo worker roster">${people.map(([initials, name, job]) => `<article class="panel person"><span class="avatar" aria-hidden="true">${initials}</span><div><h3>${name}</h3><p>${job} · Worker</p></div></article>`).join('')}</section>` + demoNote;
  }
}
document.querySelector('.skip').addEventListener('click', event => {
  event.preventDefault();
  main.focus();
  main.scrollIntoView();
});
document.querySelectorAll('[data-role]').forEach(button => button.addEventListener('click', () => {
  location.hash = button.dataset.role === 'worker' ? '/worker/shifts' : '/manager/overview';
}));
window.addEventListener('hashchange', () => { render(); main.focus(); });
render();
