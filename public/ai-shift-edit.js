import {
  localClock,
  localDate,
  localShiftFields,
  responseMeta,
  responseHeader,
  responseNote,
} from './ai-response-card.js';
import { element } from './shift-card.js';

const handoffKey = 'covershift.ai.shift-edit';
const owner = ({ user, business }) => JSON.stringify([user.id, business.id]);

export function sendEditToSchedule(account, edit) {
  try {
    sessionStorage.setItem(
      handoffKey,
      JSON.stringify({
        owner: owner(account),
        at: Date.now(),
        id: edit.id,
        revision: edit.revision,
        draft: edit.draft,
        timezone: edit.timezone,
      }),
    );
    location.assign('/workspace/manager/schedule?review=shift-edit');
    return true;
  } catch {
    return false;
  }
}

export function takeShiftEditHandoff(account) {
  try {
    const raw = sessionStorage.getItem(handoffKey);
    sessionStorage.removeItem(handoffKey);
    history.replaceState(null, '', '/workspace/manager/schedule');
    const value = JSON.parse(raw);
    if (
      value?.owner === owner(account) &&
      Date.now() - value.at < 10 * 60 * 1000 &&
      value.timezone === account.business.timezone &&
      /^[a-zA-Z0-9_-]{1,80}$/.test(value.id) &&
      /^[a-f0-9]{64}$/.test(value.revision) &&
      value.draft &&
      ['title', 'assignedWorkerId', 'startLocal', 'endLocal'].every(
        (key) => typeof value.draft[key] === 'string',
      ) &&
      // A duty prepared in chat (CS-068) arrives as the shift's full list.
      (value.draft.duties === undefined ||
        (Array.isArray(value.draft.duties) &&
          value.draft.duties.length <= 10 &&
          value.draft.duties.every(
            (duty) => typeof duty === 'string' && duty.length <= 160,
          )))
    )
      return value;
  } catch {
    /* Schedule can still be used manually. */
  }
  return null;
}

export function showShiftEdit(card, data, review, choose) {
  card.replaceChildren();
  card.hidden = data.kind === 'editBlocked';
  if (card.hidden) return data.message;
  if (data.kind === 'editChoices') {
    responseHeader(card, 'Saved shifts', 'Which shift do you mean?');
    for (const choice of data.choices) {
      card.append(localShiftFields(choice, choice.workerName, data.timezone));
      if (choice.lockReason) {
        card.append(responseNote(choice.lockReason));
      } else {
        const button = element(
          'button',
          'ai-chat-review',
          `Choose ${choice.title}`,
        );
        button.type = 'button';
        button.addEventListener('click', () => choose(choice));
        card.append(button);
      }
    }
    return 'Which shift do you mean? Select a shift below or tell me its title and time.';
  }
  responseHeader(card, 'Proposed change', data.before.title);
  const timeRange = ({ startLocal, endLocal }) => {
    const startsOn = localDate(startLocal);
    const endsOn = localDate(endLocal);
    return `${startsOn} · ${localClock(startLocal)} – ${startsOn === endsOn ? '' : endsOn + ' · '}${localClock(endLocal)}`;
  };
  const renamed = data.draft.title !== data.before.title;
  card.append(
    element('h4', '', 'Before'),
    element('p', '', `${data.before.workerName} · ${timeRange(data.before)}`),
    element('h4', '', 'After'),
    element(
      'p',
      '',
      `${renamed ? data.draft.title + ' · ' : ''}${data.workerName} · ${timeRange(data.draft)}`,
    ),
    responseMeta(data.timezone),
    responseNote(
      data.publication
        ? 'This will be saved as a draft. Publish the schedule to update employees.'
        : 'Review and save the change in Schedule.',
    ),
  );
  const button = element('button', 'ai-chat-review', 'Review change');
  button.type = 'button';
  button.addEventListener('click', review);
  card.append(button);
  return 'I prepared the shift change. You can correct it here or select Review change to open Schedule.';
}
