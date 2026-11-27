import { localDate, responseHeader, responseNote } from './ai-response-card.js';
import { element } from './shift-card.js';

const storageKey = 'covershift.ai.employee-request';
const ownerKey = ({ user, business }) => JSON.stringify([user.id, business.id]);
const pages = { timeOffDraft: 'time-off', coverDraft: 'cover' };

export function reviewEmployeeDraft(account, data) {
  try {
    const { kind, timezone } = data;
    const draft =
      kind === 'timeOffDraft'
        ? { selection: data.selection }
        : { recipient: data.recipient, shift: data.shift };
    sessionStorage.setItem(
      storageKey,
      JSON.stringify({
        kind,
        timezone,
        owner: ownerKey(account),
        at: Date.now(),
        ...draft,
      }),
    );
    location.assign('/workspace/worker/' + pages[kind] + '?review=ai-request');
    return true;
  } catch {
    return false;
  }
}

export function takeEmployeeDraft(account, kind) {
  if (new URLSearchParams(location.search).get('review') !== 'ai-request')
    return null;
  try {
    const raw = sessionStorage.getItem(storageKey);
    sessionStorage.removeItem(storageKey);
    history.replaceState(null, '', '/workspace/worker/' + pages[kind]);
    const draft = JSON.parse(raw);
    const age = Date.now() - draft?.at;
    if (
      draft?.kind !== kind ||
      draft.owner !== ownerKey(account) ||
      draft.timezone !== account.business.timezone ||
      !(age >= 0 && age < 600000)
    )
      return null;
    if (kind === 'timeOffDraft') {
      const values = draft.selection;
      const time = /^20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}$/;
      return values &&
        time.test(values.startLocal) &&
        time.test(values.endLocal) &&
        typeof values.allDay === 'boolean'
        ? draft
        : null;
    }
    const id = /^[a-zA-Z0-9_-]{1,80}$/;
    if (
      id.test(draft.recipient?.id) &&
      typeof draft.recipient.name === 'string' &&
      id.test(draft.shift?.id) &&
      /^[a-f0-9]{64}$/.test(draft.shift.revision) &&
      Number.isFinite(Date.parse(draft.shift.startsAt)) &&
      Number.isFinite(Date.parse(draft.shift.endsAt))
    )
      return draft;
  } catch {
    /* The normal workspace form remains available. */
  }
  return null;
}

export function showEmployeeDraft(card, data, review) {
  card.replaceChildren();
  card.hidden = data.kind === 'draftBlocked';
  if (card.hidden) return data.message;
  const time = new Intl.DateTimeFormat(undefined, {
    timeZone: data.timezone,
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  const range = ({ startsAt, endsAt }) =>
    time.formatRange(new Date(startsAt), new Date(endsAt));
  if (data.kind === 'timeOffDraft') {
    responseHeader(card, 'Draft for review', 'Time-off request');
    const beforeEnd = new Date(
      Date.parse(data.selection.endLocal + 'Z') - 1,
    ).toISOString();
    const dates = [localDate(data.selection.startLocal), localDate(beforeEnd)];
    card.append(
      element(
        'p',
        '',
        data.allDay
          ? [...new Set(dates)].join(' – ') + ' · Full day'
          : range(data),
      ),
    );
    if (data.blockers.length) {
      card.append(
        responseNote(
          'Your manager must resolve overlapping shifts or pending claims before approving this request.',
        ),
      );
      const list = element('ul', 'time-off-blockers');
      for (const shift of data.blockers)
        list.append(element('li', '', shift.title + ' · ' + range(shift)));
      card.append(list);
    }
  } else {
    responseHeader(card, 'Draft for review', 'Cover request');
    card.append(
      element(
        'p',
        '',
        'Ask ' + data.recipient.name + ' to cover ' + data.shift.title,
      ),
      element('p', '', range(data.shift)),
    );
  }
  card.append(element('p', 'ai-response-meta', data.timezone));
  const button = element('button', 'ai-chat-review', 'Review request');
  button.type = 'button';
  button.addEventListener('click', review);
  card.append(button);
  return 'Your draft is ready. Open Review request to check the details and submit it.';
}
