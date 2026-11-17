import { element } from './shift-card.js';
export async function mountCreateShift(container, account, csrfToken, onCreated) {
  container.innerHTML = '<section class="panel shift-creator"><div class="panel-head"><h2>Create a shift</h2><span class="badge">Manager access</span></div><p id="create-timezone" class="section-note"></p><p class="section-note">For overnight shifts, set the end date to the following day. Workers can be assigned while their login setup is pending.</p><div id="create-feedback" tabindex="-1" hidden></div><div id="roster-state" role="status">Loading your workers…</div><button id="retry-roster" class="logout-button" type="button" hidden>Retry loading workers</button><form id="create-shift-form" hidden novalidate><div class="create-fields"><div class="team-field"><label for="shift-title">Shift title</label><input id="shift-title" name="title" required maxlength="100" placeholder="e.g. Opening service" aria-describedby="title-error"><p id="title-error" class="field-error" hidden></p></div><div class="team-field"><label for="shift-worker">Assign to worker</label><select id="shift-worker" name="assignedWorkerId" required aria-describedby="assignedWorkerId-error"><option value="">Choose a worker</option></select><p id="assignedWorkerId-error" class="field-error" hidden></p></div><div class="team-field"><label for="shift-start">Start date and time</label><input id="shift-start" name="startLocal" type="datetime-local" required min="2000-01-01T00:00" max="2099-12-31T23:59" aria-describedby="create-timezone startLocal-error"><p id="startLocal-error" class="field-error" hidden></p></div><div class="team-field"><label for="shift-end">End date and time</label><input id="shift-end" name="endLocal" type="datetime-local" required min="2000-01-01T00:00" max="2099-12-31T23:59" aria-describedby="create-timezone endLocal-error"><p id="endLocal-error" class="field-error" hidden></p></div></div><div class="create-actions"><button id="save-shift" class="solid-link" type="submit">Create and assign shift →</button><a class="text-link" href="/workspace/manager/team">Manage team →</a></div></form></section>';
  const find = id => container.querySelector(`#${id}`);
  const form = find('create-shift-form');
  find('create-timezone').textContent = `Enter all dates and times in ${account.business.timezone}, your business timezone.`;
  const fieldIds = { title: 'shift-title', assignedWorkerId: 'shift-worker', startLocal: 'shift-start', endLocal: 'shift-end' };
  function feedback(message, success = false) {
    const node = find('create-feedback'); node.className = success ? 'shift-created' : 'team-message'; node.setAttribute('role', success ? 'status' : 'alert'); node.textContent = message; node.hidden = false; node.focus();
  }
  async function loadWorkers() {
    find('retry-roster').hidden = true; find('roster-state').hidden = false; find('roster-state').textContent = 'Loading your workers…'; form.hidden = true;
    try {
      const response = await fetch('/api/manager/workers', { cache: 'no-store' });
      if (response.status === 401) { location.replace('/login?expired=1'); return; }
      if (!response.ok) throw new Error();
      const { workers } = await response.json();
      find('shift-worker').replaceChildren(new Option('Choose a worker', ''));
      for (const worker of workers.filter(worker=>worker.status !== 'inactive')) find('shift-worker').append(new Option(`${worker.name}${worker.status === 'ready' ? '' : ' · login setup pending'}`, worker.id));
      if (!workers.some(worker=>worker.status !== 'inactive')) {
        find('roster-state').replaceChildren(element('p', 'section-note', 'Add your first worker before creating a shift.'));
        const team = element('a', 'text-link', 'Add workers →'); team.href = '/workspace/manager/team'; find('roster-state').append(team);
        find('retry-roster').hidden = false;
      } else { find('roster-state').hidden = true; form.hidden = false; }
    } catch { find('roster-state').textContent = 'We couldn’t load your workers. Try again.'; find('retry-roster').hidden = false; }
  }
  form.addEventListener('submit', async event => {
    event.preventDefault(); find('create-feedback').hidden = true;
    for (const [field, id] of Object.entries(fieldIds)) { find(id).removeAttribute('aria-invalid'); find(`${field}-error`).hidden = true; }
    const values = Object.fromEntries(new FormData(form));
    const invalid = {};
    for (const [field, id] of Object.entries(fieldIds)) {
      const input = find(id);
      if (!input.validity.valid) invalid[field] = input.validationMessage;
    }
    if (!values.title.trim()) invalid.title = 'Enter a shift title.';
    if (Object.keys(invalid).length) {
      for (const [field, message] of Object.entries(invalid)) { find(fieldIds[field]).setAttribute('aria-invalid', 'true'); find(`${field}-error`).textContent = message; find(`${field}-error`).hidden = false; }
      feedback('Please check the highlighted fields before saving.'); return;
    }
    const submit = find('save-shift'); submit.disabled = true; submit.textContent = 'Saving shift…';
    try {
      const response = await fetch('/api/manager/shifts', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken }, body: JSON.stringify(values) });
      if (response.status === 401) { location.replace('/login?expired=1'); return; }
      const result = await response.json();
      if (!response.ok) {
        for (const [field, message] of Object.entries(result.fields || {})) if (fieldIds[field]) { find(fieldIds[field]).setAttribute('aria-invalid', 'true'); find(`${field}-error`).textContent = message; find(`${field}-error`).hidden = false; }
        feedback(result.message || 'The shift could not be saved. Please try again.'); return;
      }
      form.reset();
      feedback(`“${result.shift.title}” is saved and assigned to ${result.shift.assignedWorker.name}. It is now available in their My shifts page.`, true);
      await onCreated();
    } catch { feedback('We couldn’t confirm whether the shift was saved. Refresh the schedule before retrying; your entries are kept.'); }
    finally { submit.disabled = false; submit.textContent = 'Create and assign shift →'; }
  });
  find('retry-roster').addEventListener('click', loadWorkers);
  await loadWorkers();
}
