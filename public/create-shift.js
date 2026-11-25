import { requestJSON } from './request.js';
import { element } from './shift-card.js';
import { registerAiReviewer } from './ai-chat-state.js';
export async function mountCreateShift(container, account, csrfToken, onCreated) {
  container.innerHTML = '<section class="panel shift-creator"><div class="panel-head"><h2>Create a shift</h2><span class="badge">Manager access</span></div><p id="create-timezone" class="section-note"></p><p class="section-note">For overnight shifts, set the end date to the following day. Workers can be assigned while their login setup is pending.</p><div id="create-feedback" tabindex="-1" hidden></div><div id="roster-state" role="status">Loading your workers…</div><button id="retry-roster" class="logout-button" type="button" hidden>Retry loading workers</button><form id="create-shift-form" hidden novalidate><div class="create-fields"><div class="team-field"><label for="shift-title">Shift title</label><input id="shift-title" name="title" required maxlength="100" placeholder="e.g. Opening service" aria-describedby="title-error"><p id="title-error" class="field-error" hidden></p></div><div class="team-field"><label for="shift-worker">Assign to worker</label><select id="shift-worker" name="assignedWorkerId" required aria-describedby="assignedWorkerId-error"><option value="">Choose a worker</option></select><p id="assignedWorkerId-error" class="field-error" hidden></p></div><div class="team-field"><label for="shift-start">Start date and time</label><input id="shift-start" name="startLocal" type="datetime-local" required min="2000-01-01T00:00" max="2099-12-31T23:59" aria-describedby="create-timezone startLocal-error"><p id="startLocal-error" class="field-error" hidden></p></div><div class="team-field"><label for="shift-end">End date and time</label><input id="shift-end" name="endLocal" type="datetime-local" required min="2000-01-01T00:00" max="2099-12-31T23:59" aria-describedby="create-timezone endLocal-error"><p id="endLocal-error" class="field-error" hidden></p></div></div><div class="team-field duty-field"><label for="shift-duties">Shift duties (optional)</label><textarea id="shift-duties" rows="4" maxlength="1700" aria-describedby="duties-help duties-error" placeholder="Open the register&#10;Restock the counter&#10;Clean the work area"></textarea><p id="duties-help" class="section-note">One duty per line. Up to 10 duties, 160 characters each.</p><p id="duties-error" class="field-error" hidden></p></div><div class="create-actions"><button id="save-shift" class="solid-link" type="submit">Create and assign shift →</button><a class="text-link" href="/workspace/manager/team">Manage team →</a></div></form></section>';
  const find = id => container.querySelector(`#${id}`);
  const form = find('create-shift-form');
  find('create-timezone').textContent = `Enter all dates and times in ${account.business.timezone}, your business timezone.`;
  const fieldIds = { title: 'shift-title', assignedWorkerId: 'shift-worker', startLocal: 'shift-start', endLocal: 'shift-end' };
  let aiDraftId = null;
  document.addEventListener('ai:cancel-review', () => { aiDraftId = null; find('ai-replace-confirmation')?.remove(); });
  registerAiReviewer(suggestion => {
    if (saving || uncertain || form.hidden) return false;
    const draft = suggestion.draft;
    if (suggestion.timezone !== account.business.timezone || ![...find('shift-worker').options].some(option => option.value === draft.assignedWorkerId)) return false;
    // Explicit confirmation if fields already contain a manual draft.
    let confirmation = find('ai-replace-confirmation');
    if (confirmation) confirmation.remove();
    const apply = () => {
      aiDraftId = suggestion.id || null;
      for (const [field, id] of Object.entries(fieldIds)) {
        find(id).value = draft[field]; find(id).removeAttribute('aria-invalid'); find(`${field}-error`).hidden = true;
      }
      confirmation?.remove();
      feedback('AI draft ready to review. Check all fields, then create the shift when you are ready.', true);
      find('shift-title').focus();
    };
    if (find('shift-duties').value||Object.values(fieldIds).some(id => find(id).value)) {
      confirmation = element('div', 'coverage-confirm'); confirmation.id = 'ai-replace-confirmation'; confirmation.setAttribute('role', 'group'); confirmation.setAttribute('aria-label', 'Replace current shift draft');
      confirmation.append(element('p', '', 'You already have entries in this form. Replace them with the AI draft?'));
      const replace = element('button', 'logout-button', 'Replace with AI draft'); replace.type = 'button';
      const keep = element('button', 'logout-button', 'Keep my entries'); keep.type = 'button';
      replace.addEventListener('click', apply); keep.addEventListener('click', () => { confirmation.remove(); find('shift-title').focus(); });
      confirmation.append(replace, keep); form.before(confirmation); replace.focus();
    } else apply();
    return true;
  });
  function feedback(message, success = false) {
    const node = find('create-feedback'); node.className = success ? 'shift-created' : 'team-message'; node.setAttribute('role', success ? 'status' : 'alert'); node.textContent = message; node.hidden = false; node.focus();
  }
  let rosterLoading = false; let uncertain = false; let saving = false;
  let reviewed = false;
  const reconcile = element('button', 'logout-button', 'Check saved shifts'); reconcile.type = 'button'; reconcile.hidden = true; form.after(reconcile);
  reconcile.addEventListener('click', async () => {
    if (reviewed) { uncertain = false; find('save-shift').disabled = false; reconcile.hidden = true; reviewed = false; find('shift-title').focus(); return; }
    reconcile.disabled = true;
    try {
      if (!await onCreated()) throw new Error();
      feedback('The saved schedule below is refreshed. Compare it with your entries before trying again; the earlier save may still finish.');
      reconcile.textContent = 'I checked the schedule — allow another attempt';
      reviewed = true;
    } catch { feedback('We couldn’t check the saved schedule. Keep your entries and try checking again.'); }
    finally { reconcile.disabled = false; }
  });
  async function loadWorkers(event) {
    const restoreFocus = Boolean(event?.currentTarget);
    if (rosterLoading) return; find('ai-replace-confirmation')?.remove(); rosterLoading = true; find('retry-roster').disabled = true;
    find('retry-roster').hidden = true; find('roster-state').hidden = false; find('roster-state').textContent = 'Loading your workers…'; form.hidden = true;
    try {
      const response = await requestJSON('/api/manager/workers', { cache: 'no-store' });
      if (response.status === 401) { location.replace('/login?expired=1'); return; }
      if (!response.ok) throw new Error();
      const { workers } = response.data;
      find('shift-worker').replaceChildren(new Option('Choose a worker', ''));
      for (const worker of workers.filter(worker=>worker.status !== 'inactive')) find('shift-worker').append(new Option(`${worker.name}${worker.status === 'ready' ? '' : ' · login setup pending'}`, worker.id));
      if (!workers.some(worker=>worker.status !== 'inactive')) {
        find('roster-state').replaceChildren(element('p', 'section-note', 'Add your first worker before creating a shift.'));
        const team = element('a', 'text-link', 'Add workers →'); team.href = '/workspace/manager/team'; find('roster-state').append(team);
        find('retry-roster').hidden = false;
      } else { find('roster-state').hidden = true; form.hidden = false; }
    } catch (error) { find('roster-state').textContent = error.message || 'We couldn’t load your workers. Try again.'; find('retry-roster').hidden = false; }
    finally { if (!form.hidden) document.dispatchEvent(new Event('ai:form-ready')); rosterLoading = false; find('retry-roster').disabled = false; if (restoreFocus) (form.hidden ? find('retry-roster') : find('shift-worker')).focus(); }
  }
  form.addEventListener('submit', async event => {
    event.preventDefault(); if (saving || uncertain) return; find('create-feedback').hidden = true;
    for (const [field, id] of Object.entries(fieldIds)) { find(id).removeAttribute('aria-invalid'); find(`${field}-error`).hidden = true; }
    const values = Object.fromEntries(new FormData(form));
    values.duties=find('shift-duties').value.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
    find('duties-error').hidden=true;const submittedDraftId = aiDraftId;
    const invalid = {};
    for (const [field, id] of Object.entries(fieldIds)) {
      const input = find(id);
      if (!input.validity.valid) invalid[field] = input.validationMessage;
    }
    if(values.duties.length>10||values.duties.some(d=>d.length>160)){find('duties-error').textContent='Use up to 10 duties, 160 characters each.';find('duties-error').hidden=false;feedback('Please check the duties before saving.');return;}
    if (!values.title.trim()) invalid.title = 'Enter a shift title.';
    if (Object.keys(invalid).length) {
      for (const [field, message] of Object.entries(invalid)) { find(fieldIds[field]).setAttribute('aria-invalid', 'true'); find(`${field}-error`).textContent = message; find(`${field}-error`).hidden = false; }
      feedback('Please check the highlighted fields before saving.'); return;
    }
    find('ai-replace-confirmation')?.remove(); saving = true; const submit = find('save-shift'); submit.disabled = true; submit.textContent = 'Saving shift…';
    try {
      const response = await requestJSON('/api/manager/shifts', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken }, body: JSON.stringify(values) });
      if (response.status === 401) { location.replace('/login?expired=1'); return; }
      const result = response.data;
      if (!response.ok) {
        for (const [field, message] of Object.entries(result.fields || {})) if (fieldIds[field]) { find(fieldIds[field]).setAttribute('aria-invalid', 'true'); find(`${field}-error`).textContent = message; find(`${field}-error`).hidden = false; }
        if(result.fields?.duties){find('duties-error').textContent=result.fields.duties;find('duties-error').hidden=false;}
        feedback(result.message || 'The shift could not be saved. Please try again.'); return;
      }
      aiDraftId = null;
      document.dispatchEvent(new CustomEvent('ai:shift-created', { detail: { draftId: submittedDraftId, result } }));
      form.reset();
      feedback(result.draft?`“${result.shift.title}” is saved as a private draft. Publish its schedule before employees can see it.`:`“${result.shift.title}” is saved and assigned to ${result.shift.assignedWorker.name}. It is now available in their My shifts page.`, true);
      await onCreated();
    } catch (error) { document.dispatchEvent(new CustomEvent('ai:shift-save-uncertain', { detail: { draftId: submittedDraftId } })); uncertain = true; reviewed = false; reconcile.textContent = 'Check saved shifts'; reconcile.hidden = false; feedback('We couldn’t confirm whether the shift was saved. Your entries are kept. Check the saved schedule before trying again.'); }
    finally { saving = false; submit.disabled = uncertain; submit.textContent = submit.dataset.draftMode==='true'?'Save private draft →':'Create and assign shift →'; }
  });
  find('retry-roster').addEventListener('click', loadWorkers);
  await loadWorkers();
}
