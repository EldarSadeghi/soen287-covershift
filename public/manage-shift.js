import { requestJSON } from './request.js';
import { element, shiftCard } from './shift-card.js';
import { formatShiftTime } from './shift-time.js';
export function businessLocal(instant, timezone) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(instant)).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}
export function managedShiftCard(shift, timezone, csrfToken, onChanged) {
  const wrapper = element('div', 'managed-shift');
  wrapper.append(shiftCard(shift, timezone, { workerName: shift.assignedWorker.name }));
  if(shift.draft)wrapper.prepend(element('p','draft-label','Private draft · unpublished'));
  if (shift.lockReason) {
    wrapper.append(element('p', 'shift-lock', shift.lockReason)); return wrapper;
  }
  const actions = element('div', 'shift-management-actions');
  const editButton = element('button', 'logout-button', 'Edit shift'); editButton.type = 'button'; editButton.setAttribute('aria-label', `Edit ${shift.title}`);
  const deleteButton = element('button', 'logout-button delete-action', 'Delete shift'); deleteButton.type = 'button'; deleteButton.setAttribute('aria-label', `Delete ${shift.title}`);
  actions.append(editButton, deleteButton); wrapper.append(actions);
  const editor = element('section', 'shift-editor'); editor.hidden = true; wrapper.append(editor);
  editor.setAttribute('role', 'group'); editor.setAttribute('aria-label', `Manage shift ${shift.title}`);
  let busy = false; let uncertain = false; let trigger;
  editor.addEventListener('keydown', event => { if (event.key === 'Escape' && !busy) { event.preventDefault(); reset(); } });
  const reset = () => { editor.replaceChildren(); editor.hidden = true; editButton.disabled = uncertain; deleteButton.disabled = uncertain; (uncertain ? document.querySelector('#refresh-dashboard') : trigger)?.focus(); };
  function message(text) { const error = editor.querySelector('.manage-error'); error.textContent = text; error.hidden = false; error.focus(); }
  function start(button) {
    if (busy || uncertain) return false; trigger = button;
    editor.replaceChildren(); editor.hidden = false; editButton.disabled = true; deleteButton.disabled = true; return true;
  }
  function errorBox() { const error = element('p', 'team-message manage-error'); error.setAttribute('role', 'alert'); error.tabIndex = -1; error.hidden = true; editor.append(error); }
  function cancelButton() { const button = element('button', 'logout-button', 'Cancel'); button.type = 'button'; button.addEventListener('click', () => { if (!busy) reset(); }); return button; }
  async function mutate(action, values, submit, cancel, markErrors = () => {}) {
    busy = true; submit.disabled = true; cancel.disabled = true; submit.textContent = action === 'edit' ? 'Saving changes…' : 'Deleting…';
    try {
      const response = await requestJSON(`/api/manager/shifts/${encodeURIComponent(shift.id)}/${action}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken }, body: JSON.stringify({ ...values, revision: shift.revision }) });
      if (response.status === 401) { location.replace('/login?expired=1'); return; }
      const result = response.data;
      if (!response.ok) { markErrors(result.fields || {}); message(result.message || 'The change could not be saved. Try again.'); return; }
      await onChanged(result.draft?'Private draft saved. Publish the schedule to update employees.':action === 'edit' ? `“${result.shift.title}” was updated and assigned to ${result.shift.assignedWorker.name}.` : `“${shift.title}” was deleted.`);
    } catch { uncertain = true; message('We couldn’t confirm the result. Your entries are kept. Cancel and refresh the schedule to check the saved shift before trying again.'); }
    finally { busy = false; submit.disabled = uncertain; cancel.disabled = false; submit.textContent = action === 'edit' ? 'Save changes' : 'Delete this shift'; }
  }
  editButton.addEventListener('click', async () => {
    if (!start(editButton)) return;
    editor.append(element('h3', '', 'Edit shift'), element('p', 'section-note', `All times are in ${timezone}. For an overnight shift, use the next day as the end date.`)); errorBox();
    const state = element('p', 'section-note', 'Loading your workers…'); state.setAttribute('role', 'status'); editor.append(state);
    const cancel = cancelButton(); editor.append(cancel); cancel.focus();
    try {
      const response = await requestJSON('/api/manager/workers', { cache: 'no-store' });
      if (response.status === 401) { location.replace('/login?expired=1'); return; }
      if (!response.ok) throw new Error();
      const { workers } = response.data;
      // Cancel may have closed/reopened the editor while this read was pending.
      if (!state.isConnected) return;
      state.remove(); cancel.remove();
      const form = element('form'); form.noValidate = true;
      const grid = element('div', 'create-fields');
      const inputs = {};
      for (const [key, label, type, value] of [['title', 'Shift title', 'text', shift.title], ['assignedWorkerId', 'Assign to worker', 'select', shift.assignedWorker.id], ['startLocal', 'Start date and time', 'datetime-local', businessLocal(shift.startsAt, timezone)], ['endLocal', 'End date and time', 'datetime-local', businessLocal(shift.endsAt, timezone)]]) {
        const field = element('div', 'team-field'); const caption = element('label', '', label);
        const input = element(type === 'select' ? 'select' : 'input'); input.id = `edit-${shift.id}-${key}`; input.name = key; input.required = true; caption.htmlFor = input.id;
        if (type === 'select') { input.append(new Option('Choose a worker', '')); for (const worker of workers.filter(worker=>worker.status !== 'inactive')) input.append(new Option(worker.name, worker.id)); }
        else { input.type = type; if (type === 'text') input.maxLength = 100; else { input.min = '2000-01-01T00:00'; input.max = '2099-12-31T23:59'; } }
        input.value = value; inputs[key] = input; const error = element('p', 'field-error'); error.id = `${input.id}-error`; error.hidden = true; input.setAttribute('aria-describedby', error.id); field.append(caption, input, error); grid.append(field);
      }
      function markErrors(errors) {
        for (const [key, input] of Object.entries(inputs)) {
          const error = document.getElementById(`${input.id}-error`);
          input.removeAttribute('aria-invalid'); error.hidden = true;
          if (errors[key]) { input.setAttribute('aria-invalid', 'true'); error.textContent = errors[key]; error.hidden = false; }
        }
      }
      const dutyField=element('div','team-field duty-field'),dutyLabel=element('label','','Shift duties (optional)'),duties=element('textarea');duties.id='edit-'+shift.id+'-duties';duties.rows=4;duties.maxLength=1700;duties.value=(shift.duties||[]).join('\n');dutyLabel.htmlFor=duties.id;const dutyHelp=element('p','section-note','One duty per line. Up to 10 duties, 160 characters each.');dutyField.append(dutyLabel,duties,dutyHelp);
      const buttons = element('div', 'create-actions'); const submit = element('button', 'solid-link', 'Save changes'); submit.type = 'submit'; buttons.append(submit, cancel);
      form.append(grid,dutyField,buttons); form.addEventListener('submit', event => {
        event.preventDefault(); if (busy) return;
        editor.querySelector('.manage-error').hidden = true;
        const errors = {};
        for (const [key, input] of Object.entries(inputs)) if (!input.validity.valid) errors[key] = input.validationMessage;
        if (!inputs.title.value.trim()) errors.title = 'Enter a shift title.';
        markErrors(errors);
        if (Object.keys(errors).length) { message('Please check the highlighted fields before saving.'); return; }
        const values=Object.fromEntries(new FormData(form));values.duties=duties.value.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);if(values.duties.length>10||values.duties.some(d=>d.length>160)){message('Use up to 10 duties, 160 characters each.');return;}mutate('edit', values, submit, cancel, markErrors);
      });
      editor.append(form); inputs.title.focus();
    } catch { if (state.isConnected) { state.textContent = 'We couldn’t load the workers. Cancel and choose Edit shift to retry.'; message('Your shift has not changed. Please retry.'); } }
  });
  deleteButton.addEventListener('click', () => {
    if (!start(deleteButton)) return;
    const title = element('h3', '', 'Delete this shift?'); editor.append(title); errorBox();
    const time = formatShiftTime(shift, timezone);
    editor.append(element('p', '', `“${shift.title}” · ${shift.assignedWorker.name}`), element('p', 'section-note', `${time.date} · ${time.startTime} – ${time.endDate ? time.endDate + ' · ' : ''}${time.endTime} (${timezone})`), element('p', 'section-note', 'This permanently removes the shift from the schedule and the worker’s My shifts page. It cannot be undone.'));
    const buttons = element('div', 'create-actions'); const submit = element('button', 'solid-link delete-confirm', 'Delete this shift'); submit.type = 'button'; const cancel = cancelButton();
    submit.addEventListener('click', () => { if (!busy) mutate('delete', {}, submit, cancel); }); buttons.append(cancel, submit); editor.append(buttons); cancel.focus();
  });
  return wrapper;
}
