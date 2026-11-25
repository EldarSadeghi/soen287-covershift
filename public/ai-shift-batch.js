import { responseHeader, responseNote } from './ai-response-card.js';
import { requestJSON } from './request.js';
import { element } from './shift-card.js';

const endpoint = '/api/manager/shift-batches';

export function createBatchReview({ card, chat, csrfToken, notice, setBusy, onOutcome, canAct }) {
  function action(label, handler) {
    const button = element('button', 'ai-chat-review', label);
    button.type = 'button';
    button.addEventListener('click', handler);
    return button;
  }

  function show(batch, message = '') {
    card.replaceChildren();
    card.hidden = false;
    const { shifts, workers, timezone, status } = batch;
    if (status === 'saved') {
      const heading = `${shifts.length} ${batch.draft ? 'private shift drafts' : 'shifts'} saved`;
      responseHeader(card, 'Batch saved', heading, 'success');
      if (batch.draft) card.append(responseNote('Employees will see these shifts after publication.', 'neutral'));
      const link = element('a', 'ai-chat-review', 'View schedule');
      link.href = '/workspace/manager/schedule';
      card.append(link);
      return;
    }
    if (status === 'uncertain') {
      responseHeader(card, 'Save not confirmed', 'Check this batch before editing', 'uncertain');
      card.append(responseNote(message || 'The batch may have been saved. Check for its receipt or retry this exact confirmation.', 'uncertain'),
        action('Check batch receipt', () => reconcile(batch, false)),
        action('Retry same batch', () => reconcile(batch, true)));
      card.lastElementChild.classList.add('ai-response-secondary');
      return;
    }
    responseHeader(card, 'Batch draft · Not saved', `Review ${shifts.length} shifts`);
    card.append(element('p', 'ai-response-meta', `Times in ${timezone}. Confirm to save the entire batch.`));
    if (message || batch.warning) card.append(responseNote(message || batch.warning));
    const form = element('form', 'ai-batch-form');
    const table = element('table', 'ai-batch-table');
    table.setAttribute('role', 'table');
    table.setAttribute('aria-label', 'Proposed shifts');
    const columns = ['Shift title', 'Worker', 'Starts', 'Ends'];
    const keys = ['title', 'assignedWorkerId', 'startLocal', 'endLocal'];
    const header = table.createTHead();
    header.setAttribute('role', 'rowgroup');
    const head = header.insertRow();
    head.setAttribute('role', 'row');
    for (const label of columns) {
      const cell = element('th', '', label);
      cell.scope = 'col';
      cell.setAttribute('role', 'columnheader');
      head.append(cell);
    }
    const body = table.createTBody();
    body.setAttribute('role', 'rowgroup');
    for (const [index, shift] of shifts.entries()) {
      const row = body.insertRow();
      row.setAttribute('role', 'row');
      for (const [column, key] of keys.entries()) {
        const cell = row.insertCell();
        cell.setAttribute('role', 'cell');
        const label = element('label', 'ai-batch-field');
        label.append(element('span', '', columns[column]));
        const input = document.createElement(column === 1 ? 'select' : 'input');
        if (column === 1) {
          for (const worker of workers) {
            const option = element('option', '', worker.name);
            option.value = worker.id;
            input.append(option);
          }
        } else {
          input.type = column === 0 ? 'text' : 'datetime-local';
          if (column === 0) input.maxLength = 100;
        }
        input.required = true;
        input.value = shift[key];
        input.setAttribute('aria-label', `Shift ${index + 1} ${columns[column].toLowerCase()}`);
        input.addEventListener('keydown', event => {
          if (event.key === 'Enter' && input.tagName === 'INPUT') event.preventDefault();
        });
        input.addEventListener('input', () => {
          shift[key] = input.value;
          chat.save();
        });
        label.append(input);
        cell.append(label);
      }
    }
    const confirm = element('button', 'ai-chat-review', `Confirm and save ${shifts.length} shifts`);
    confirm.type = 'submit';
    form.append(table, confirm);
    form.addEventListener('submit', event => {
      event.preventDefault();
      if (canAct() && form.reportValidity()) void reconcile(batch, true);
    });
    card.append(form);
  }

  async function reconcile(batch, write) {
    if (!canAct() || chat.value.batch !== batch) return;
    const previouslyUncertain = batch.status === 'uncertain';
    if (write) {
      batch.status = 'uncertain';
      if (!chat.save()) {
        batch.status = previouslyUncertain ? 'uncertain' : 'review';
        notice('This browser could not keep the confirmation ID. Save from a tab with session storage available.');
        return;
      }
    }
    setBusy(true);
    const controls = [...card.querySelectorAll('button, input, select')];
    controls.forEach(control => { control.disabled = true; });
    notice(write ? 'Saving the batch…' : 'Checking for the batch receipt…');
    let message = '';
    try {
      const response = await requestJSON(write ? endpoint : `${endpoint}/${batch.id}`, write ? {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
        body: JSON.stringify({ batchId: batch.id, timezone: batch.timezone, shifts: batch.shifts }),
      } : {});
      if (chat.value.batch !== batch) return;
      if (response.status === 401) { location.assign('/login?expired=1'); return; }
      if (!response.ok) {
        // A missing receipt does not establish that an earlier request has finished.
        if (write && !previouslyUncertain) batch.status = 'review';
        message = response.status === 404 && !write
          ? 'No receipt yet. You can retry this exact batch without creating duplicates.'
          : response.data.message;
      } else {
        const { batchId, count, draft } = response.data;
        if (batchId !== batch.id || count !== batch.shifts.length || typeof draft !== 'boolean') throw new Error();
        batch.status = 'saved';
        batch.draft = draft;
        message = `${count} ${draft ? 'private shift drafts' : 'shifts'} saved.`;
        onOutcome(message);
      }
    } catch {
      message = 'Save not confirmed. Check the batch receipt before trying again.';
    } finally {
      setBusy(false);
      if (chat.value.batch === batch) {
        chat.save();
        show(batch, message);
        notice(message, true);
        if (card.closest('dialog')?.open) card.querySelector('button, a')?.focus();
      }
    }
  }

  return {
    show,
    open(data) {
      chat.value.batch = { id: crypto.randomUUID(), status: 'review', shifts: data.shifts,
        workers: data.workers, timezone: data.timezone, warning: data.warning };
      chat.save();
      show(chat.value.batch);
    },
  };
}
