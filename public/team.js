import { requestJSON } from './request.js';
import { removalActions } from './remove-worker.js';
import { element } from './shift-card.js';
import { takeNewEmployee } from './ai-manager-drafts.js';
export async function mountTeam(main, account, csrf) {
  main.innerHTML = '<p class="eyebrow">Your people, all in one place</p><div class="page-heading"><div><h1>Your team.</h1><p class="subtitle">Add your workers. Give everyone a place to start.</p></div><button id="refresh-team" class="logout-button" type="button">Refresh</button></div><p id="team-result" class="shift-created" role="status" tabindex="-1" hidden></p><label class="history-filter">Show employees <select id="team-filter"><option value="active">Active employees</option><option value="inactive">Inactive employees</option><option value="all">All employees</option></select></label><div id="team-error" class="team-message" role="alert" tabindex="-1" hidden></div><section id="setup-link-panel" class="panel team-panel" tabindex="-1" hidden><p class="eyebrow">Next step · share privately</p><h2>Help your worker get started.</h2><p id="setup-person"></p><label for="setup-link">One-time setup link</label><input id="setup-link" readonly><p id="setup-expiry" class="section-note"></p><div class="team-actions"><button id="copy-setup" class="logout-button" type="button">Copy link</button><a id="open-setup" class="text-link" target="_blank" rel="noopener noreferrer">Open setup page ↗</a><button id="dismiss-setup" class="logout-button" type="button">Done</button></div><p class="section-note" id="copy-status" role="status">Share this link with this worker only. No email is sent. For local testing, open it on this computer.</p></section><div class="team-grid"><section class="panel team-panel"><h2>Add a worker</h2><p>They’ll choose their own password using a setup link.</p><form id="add-worker"><div class="team-field"><label for="worker-name">Worker name</label><input id="worker-name" name="name" required minlength="2" maxlength="80" autocomplete="off" placeholder="e.g. Jamie Lee"></div><div class="team-field"><label for="worker-email">Email address</label><input id="worker-email" name="email" type="email" required maxlength="254" autocomplete="off" placeholder="worker@example.com"></div><button class="signup-submit" type="submit">Add worker →</button></form></section><section class="panel team-panel"><div class="panel-header"><h2>Team roster</h2><span id="worker-count" class="badge" role="status" aria-atomic="true"></span></div><p class="section-note">Ready workers can sign in. Others still need to set up a password.</p><div id="worker-list"></div></section></div>';
  const find = id => main.querySelector(`#${id}`);
  const error = message => { find('team-error').textContent = message; find('team-error').hidden = false; find('team-error').focus(); };
  const clear = () => { find('team-error').hidden = true; };
  let loading = false; let saving = false; let uncertain = false;
  const addButton = find('add-worker').querySelector('button');
  async function api(url, body) {
    const response = await requestJSON(url, body === undefined ? { cache: 'no-store' } : { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf }, body: JSON.stringify(body) });
    if (response.status === 401) { location.replace('/login?expired=1'); throw new Error('Please sign in again.'); }
    const data = response.data;
    if (!response.ok) throw new Error(data.message || 'We couldn’t complete this request. Try again.');
    return data;
  }
  function showLink(data) {
    const url = `${location.origin}/setup#token=${data.setupToken}`;
    find('setup-link').value = url; find('open-setup').href = url;
    find('setup-person').textContent = `${data.worker.name} · ${data.worker.email}`;
    find('setup-expiry').textContent = `Expires ${new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short', timeZone: account.business.timezone }).format(new Date(data.expiresAt))} (${account.business.timezone}). Replacing the link invalidates the previous one.`;
    find('copy-status').textContent = 'Share this link with this worker only. No email is sent. For local testing, open it on this computer.';
    find('setup-link-panel').hidden = false; find('setup-link-panel').focus();
  }
  async function refresh(event) {
    const restoreFocus = event?.currentTarget?.id;
    if (loading) return; loading = true; find('refresh-team').disabled = true; find('worker-list').setAttribute('aria-busy', 'true');
    find('worker-count').textContent = ''; find('worker-list').replaceChildren(element('p', 'section-note', 'Loading your team…'));
    try {
      const { workers } = await api('/api/manager/workers');
      // Only a successful fresh roster read unlocks an uncertain add attempt.
      uncertain = false; addButton.disabled = saving;
      const active=workers.filter(w=>w.status!=='inactive').length; find('worker-count').textContent = `${active} active · ${workers.length-active} inactive`;
      const filter=find('team-filter').value; const visible=workers.filter(w=>filter==='all'||(filter==='inactive'?w.status==='inactive':w.status!=='inactive'));
      find('worker-list').replaceChildren();
      if (!visible.length) find('worker-list').append(element('p', 'team-empty', 'No employees match this view. Add a worker or choose another employee filter.'));
      const labels = { ready: 'Ready to sign in', pending: 'Setup pending', expired: 'Link expired', needed: 'Setup needed', inactive: 'Inactive' };
      for (const worker of visible) {
        const row = element('article', 'team-worker'); const details = element('div');
        details.append(element('h3', '', worker.name), element('p', 'worker-email', worker.email), element('span', `badge worker-${worker.status}`, labels[worker.status]));
        row.append(details);
        if (!['ready','inactive'].includes(worker.status)) {
          const button = element('button', 'logout-button', worker.status === 'pending' ? 'Replace setup link' : 'Generate setup link'); button.type = 'button'; button.setAttribute('aria-label', `${button.textContent} for ${worker.name}`);
          button.addEventListener('click', async () => {
            clear(); button.disabled = true;
            try { showLink(await api(`/api/manager/workers/${encodeURIComponent(worker.id)}/setup`, {})); await refresh(); }
            catch (e) { error(e.uncertain ? 'We couldn’t confirm the setup link. Refresh Team before generating another link.' : e.message); button.disabled = Boolean(e.uncertain); }
          }); row.append(button);
        }
        row.append(removalActions(worker,account.business.timezone,csrf,async message=>{ find('setup-link').value='';find('open-setup').removeAttribute('href');find('setup-link-panel').hidden=true;await refresh();const result=find('team-result');result.textContent=message;result.hidden=false;result.focus(); }));
        find('worker-list').append(row);
      }
    } catch (e) { find('worker-list').replaceChildren(element('p', 'section-note', 'Your roster could not be loaded. Use Refresh to retry.')); error(e.message); }
    finally { loading = false; find('refresh-team').disabled = false; find('worker-list').setAttribute('aria-busy', 'false'); main.setAttribute('aria-busy', 'false'); if (restoreFocus) (restoreFocus==='team-filter'?find('team-filter'):find('refresh-team')).focus(); }
  }
  find('add-worker').addEventListener('submit', async event => {
    event.preventDefault(); if (saving || uncertain) return; saving = true; clear(); const button = event.currentTarget.querySelector('button'); button.disabled = true;
    try { const data = await api('/api/manager/workers', { name: find('worker-name').value, email: find('worker-email').value }); find('add-worker').reset(); showLink(data); await refresh(); }
    catch (e) { uncertain = Boolean(e.uncertain); error(e.uncertain ? 'We couldn’t confirm whether the worker was added. Your entries are kept. Refresh Team and check the roster before trying again.' : e.message); }
    finally { saving = false; button.disabled = uncertain; }
  });
  find('copy-setup').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(find('setup-link').value); find('copy-status').textContent = 'Link copied. Share it privately with this worker.'; }
    catch { find('setup-link').focus(); find('setup-link').select(); find('copy-status').textContent = 'Select and copy the link above.'; }
  });
  find('dismiss-setup').addEventListener('click', () => { find('setup-link').value = ''; find('open-setup').removeAttribute('href'); find('setup-link-panel').hidden = true; find('worker-name').focus(); });
  find('refresh-team').addEventListener('click', event => { clear(); refresh(event); });
  find('team-filter').addEventListener('change',refresh);
  await refresh();
  // An employee prepared in chat (CS-068): fill in the form for review. The
  // manager still chooses Add worker; nothing is saved here.
  if (new URLSearchParams(location.search).get('review') === 'add-employee') {
    history.replaceState(null, '', location.pathname);
    const draft = takeNewEmployee(account);
    if (draft) {
      find('worker-name').value = draft.name; find('worker-email').value = draft.email;
      const result = find('team-result'); result.textContent = 'Prepared in chat. Check the name and email, then choose Add worker.'; result.hidden = false;
      (draft.name ? (draft.email ? addButton : find('worker-email')) : find('worker-name')).focus();
    }
  }
}
