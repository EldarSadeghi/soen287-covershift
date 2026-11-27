// Manager drafts in chat (CS-068): add an employee, copy a week, add a duty to
// a shift. The chat only prepares each one. The manager reviews and saves it
// on Team, in the batch review or in the Schedule edit form, which keep their
// own checks. No paid AI call is made.
import { coworkerLookupDate } from './ai-chat-routing.js';
import { sendEditToSchedule } from './ai-shift-edit.js';
import {
  checkedMeta,
  responseFields,
  responseHeader,
  responseNote,
} from './ai-response-card.js';
import { element } from './shift-card.js';
import { formatShiftTime } from './shift-time.js';

export const DUTY_DATE_QUESTION =
  'Which date’s shift should I add it to? Say a day such as Friday or December 5.';
export const DUTY_TEXT_QUESTION =
  'What duty should I add? Put it in quotes, such as “restock the fridge”.';
const MAX_DUTY = 160;

// ---- Add an employee ------------------------------------------------------

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const NAME = /^\p{L}[\p{L}'’ .-]{0,78}\p{L}\.?$/u;

/** The new employee's name and email, as far as the message gives them. */
export function newEmployee(text) {
  const email = EMAIL.exec(text)?.[0] ?? '';
  const rest = text.replace(email, ' ').replace(/\s+/g, ' ').trim();
  const end =
    '(?=\\s*(?:,|\\bwith\\b|\\bemail\\b|\\bat\\b|\\bas\\b|\\bto\\b|\\bfor\\b|\\bon\\b|[.!?]*$))';
  const called = new RegExp(`\\b(?:called|named)\\s+(.+?)${end}`, 'i').exec(
    rest,
  )?.[1];
  const direct = new RegExp(
    `^(?:please\\s+)?(?:add|onboard|hire|set up)\\s+(?!(?:an?|new|the|employee|worker)\\b)(.+?)${end}`,
    'i',
  ).exec(rest)?.[1];
  const name = (called ?? direct ?? '').trim().replace(/[.,;:!?]+$/, '');
  return {
    name: NAME.test(name) && name.split(/\s+/).length <= 4 ? name : '',
    email,
  };
}

const ADD_KEY = 'covershift.ai.add-employee';
const owner = ({ user, business }) => JSON.stringify([user.id, business.id]);

// Name and email go through this tab's session, never the address bar.
export function sendNewEmployeeToTeam(
  account,
  draft,
  storage = sessionStorage,
) {
  try {
    storage.setItem(
      ADD_KEY,
      JSON.stringify({ owner: owner(account), at: Date.now(), ...draft }),
    );
    location.assign('/workspace/manager/team?review=add-employee');
    return true;
  } catch {
    return false;
  }
}

export function takeNewEmployee(account, storage = sessionStorage) {
  try {
    const raw = storage.getItem(ADD_KEY);
    storage.removeItem(ADD_KEY);
    const value = JSON.parse(raw);
    if (
      value?.owner === owner(account) &&
      Date.now() - value.at < 10 * 60 * 1000 &&
      typeof value.name === 'string' &&
      value.name.length <= 80 &&
      typeof value.email === 'string' &&
      value.email.length <= 254
    )
      return { name: value.name, email: value.email };
  } catch {
    /* The Team form can still be filled in by hand. */
  }
  return null;
}

export function renderNewEmployee(card, draft, review) {
  card.replaceChildren();
  responseHeader(
    card,
    'Ready to add · Not saved',
    draft.name || 'New employee',
  );
  card.append(
    responseFields([
      ['Name', draft.name || 'Add it on Team'],
      ['Email', draft.email || 'Add it on Team'],
    ]),
    responseNote(
      'Adding them creates a one-time setup link to share privately. No email is sent, and nothing is saved until you choose Add worker.',
      'neutral',
    ),
  );
  const button = element('button', 'ai-chat-review', 'Review on Team');
  button.type = 'button';
  button.addEventListener('click', () => review(draft));
  card.append(button);
  return draft.name
    ? `Ready to add ${draft.name}${draft.email ? ` (${draft.email})` : ''}. Review it on Team, then choose Add worker.`
    : 'Ready to add a new employee. Add their name and email on Team, then choose Add worker.';
}

// ---- Copy a week ----------------------------------------------------------

const WEEK_REF =
  /\b(?:(last|previous|this|current|next) week|the week after(?: (next))?)\b/gi;

const monday = (day) => {
  const date = new Date(day + 'T12:00Z');
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
};
const plusDays = (day, count) =>
  new Date(Date.parse(day + 'T12:00Z') + count * 86400000)
    .toISOString()
    .slice(0, 10);

/** The Monday of the week to copy and of the week to copy it to. */
export function copyWeeks(text, today) {
  const base = monday(today);
  const refs = [...text.matchAll(WEEK_REF)];
  if (!refs.length || refs.length > 2) return null;
  const weekOf = (match, previous) => {
    const word = match[1]?.toLowerCase();
    if (word)
      return plusDays(
        base,
        { last: -7, previous: -7, this: 0, current: 0, next: 7 }[word],
      );
    // "the week after" follows the week just named; "the week after next" is +14.
    return plusDays(match[2] ? base : (previous ?? base), match[2] ? 14 : 7);
  };
  const source = weekOf(refs[0], null);
  const target = refs[1] ? weekOf(refs[1], source) : plusDays(source, 7);
  return target > source ? { source, target } : null;
}

const weekLabel = (day) =>
  new Intl.DateTimeFormat(undefined, {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
  }).format(new Date(day + 'T12:00Z'));

/** The batch review input for a copied week, or a message when nothing can be copied. */
export function copyWeekBatch(data) {
  const from = `the week of ${weekLabel(data.source)}`;
  const to = `the week of ${weekLabel(data.target)}`;
  const skipped = data.skipped.map(
    (row) => `${row.title} (${row.workerName}): ${row.reason}`,
  );
  if (!data.shifts.length)
    return {
      message: data.total
        ? `None of the ${data.total} shifts in ${from} can be copied to ${to}. ${skipped.join('; ')}.`
        : `There are no shifts in ${from} to copy.`,
    };
  const notes = [
    `Copies of ${data.shifts.length} of ${data.total} shifts from ${from} to ${to}. Edit any row, then confirm to save them all together.`,
    data.withDuties
      ? `${data.withDuties} ${data.withDuties === 1 ? 'copy keeps its' : 'copies keep their'} duties.`
      : '',
    skipped.length ? `Not copied: ${skipped.join('; ')}.` : '',
  ].filter(Boolean);
  return {
    batch: {
      copy: true,
      shifts: data.shifts,
      workers: data.workers,
      timezone: data.timezone,
      warning: notes.join(' '),
    },
    message: `Copies of ${data.shifts.length} shifts from ${from} are ready to review. Nothing is saved until you confirm.`,
  };
}

// ---- Add a duty to a shift ------------------------------------------------

const DATE_WORD =
  /^(?:today|tomorrow|tonight|next|this|(?:mon|tues|wednes|thurs|fri|satur|sun)day|january|february|march|april|may|june|july|august|september|october|november|december|\d+(?:st|nd|rd|th)?)$/i;
const STOP_WORD = /^(?:to|on|for|onto|the|my|a|an|of|in|at)$/i;

/** The duty text and the rest of the message, which describes the shift. */
export function dutyText(text) {
  const quoted =
    /["“]([^"”]{1,400})["”]/.exec(text) ||
    /(?:^|\s)['‘]([^'’]{1,400})['’](?=[\s.,!?:;]|$)/.exec(text);
  if (quoted)
    return { duty: quoted[1].trim(), rest: text.replace(quoted[0], ' ') };
  const colon = /\bshifts?\b[^:]*:\s*(.+)$/i.exec(text);
  if (colon)
    return {
      duty: colon[1].trim().replace(/[.!?]+$/, ''),
      rest: text.slice(0, colon.index) + ' shift',
    };
  const phrase =
    /\b(?:duty|task|to-?do)\b(?:\s+(?:of|to|:))?\s*(.+?)\s+(?:on|to|for|onto)\s+(?=(?:the |my |\S+['’]s |\S+ )*?\S*\s*shifts?\b)/iu.exec(
      text,
    );
  if (phrase)
    return {
      duty: phrase[1].trim(),
      rest: text.slice(phrase.index + phrase[0].length),
    };
  return { duty: '', rest: text };
}

/** Title word and employee from "Friday's opening shift", "Jamie Lee's Friday shift". */
export function dutyShiftWords(rest) {
  const match = /((?:[\p{L}'’-]+\s+){1,4})shifts?\b/iu.exec(rest);
  if (!match) return { title: null, worker: null };
  let words = [];
  let worker = null;
  for (const raw of match[1].trim().split(/\s+/)) {
    const owner = /['’]s$/i.test(raw);
    const word = raw.replace(/['’]s$/i, '');
    if (STOP_WORD.test(word)) {
      words = [];
      continue;
    }
    if (owner && !DATE_WORD.test(word)) {
      worker = [...words, word].join(' ');
      words = [];
      continue;
    }
    if (!DATE_WORD.test(word)) words.push(word);
  }
  return { title: words.at(-1)?.toLowerCase() ?? null, worker };
}

/** The lookup to run for a duty request, or the question to ask instead. */
export function dutyQuery(text, today) {
  const { duty, rest } = dutyText(text);
  if (!duty) return { question: DUTY_TEXT_QUESTION };
  if (duty.length > MAX_DUTY)
    return { question: `Shorten the duty to ${MAX_DUTY} characters or fewer.` };
  const from = coworkerLookupDate(rest, today);
  if (!from) return { question: DUTY_DATE_QUESTION, duty };
  const { title, worker } = dutyShiftWords(rest);
  return {
    duty,
    params: {
      kind: 'shiftDuties',
      from,
      ...(title && { title }),
      ...(worker && { worker }),
    },
  };
}

function shiftLine(shift, timezone) {
  const time = formatShiftTime(shift, timezone);
  return `${shift.title} · ${shift.workerName} · ${time.date}, ${time.startTime} – ${time.endTime}`;
}

// Why the duty can't be added to this shift from chat, or null.
function dutyBlocker(shift, duty) {
  if (shift.locked) return shift.locked;
  if (shift.full)
    return 'This shift already has 10 duties. Remove one on Schedule first.';
  if (shift.duties.some((saved) => saved.toLowerCase() === duty.toLowerCase()))
    return 'This duty is already on the shift.';
  return null;
}

export function renderDutyShift(card, data, duty, review) {
  card.replaceChildren();
  const schedule = () => {
    const link = element(
      'a',
      'ai-chat-review ai-response-secondary',
      'Open Schedule',
    );
    link.href = '/workspace/manager/schedule';
    return link;
  };
  if (data.status === 'none') {
    responseHeader(card, 'No matching shift', 'Nothing to add it to');
    card.append(checkedMeta(data.asOf, data.timezone), schedule());
    return 'No shift on that date matches. Check the day, shift title or employee.';
  }
  if (data.status === 'choose') {
    responseHeader(card, 'Choose a shift', `Which shift gets “${duty}”?`);
    for (const shift of data.shifts) {
      const button = element(
        'button',
        'ai-chat-review ai-response-secondary',
        shiftLine(shift, data.timezone),
      );
      button.type = 'button';
      button.addEventListener('click', () => {
        if (button.isConnected)
          renderDutyShift(
            card,
            { ...data, status: 'ready', shift },
            duty,
            review,
          );
      });
      card.append(button);
    }
    if (data.total > data.shifts.length)
      card.append(
        responseNote(
          `Showing ${data.shifts.length} of ${data.total} shifts. Add the shift title or employee to narrow it.`,
          'neutral',
        ),
      );
    card.append(checkedMeta(data.asOf, data.timezone));
    return `${data.total} shifts match. Which one gets “${duty}”? Choose it from the list, or add its title or employee.`;
  }
  const { shift } = data;
  const blocker = dutyBlocker(shift, duty);
  responseHeader(
    card,
    blocker ? 'Can’t add this duty' : 'Ready to add a duty · Not saved',
    shift.title,
  );
  card.append(
    responseFields([
      ['Shift', shiftLine(shift, data.timezone)],
      ['New duty', duty],
      ['Duties now', shift.duties.length ? shift.duties.join('; ') : 'None'],
    ]),
  );
  if (blocker) {
    card.append(
      responseNote(blocker, 'pending'),
      checkedMeta(data.asOf, data.timezone),
      schedule(),
    );
    return `I can’t add “${duty}” to ${shift.title}: ${blocker}`;
  }
  card.append(
    responseNote(
      'Opens this shift’s edit form with the duty added. Nothing is saved until you choose Save changes.',
      'neutral',
    ),
    checkedMeta(data.asOf, data.timezone),
  );
  const button = element('button', 'ai-chat-review', 'Review on Schedule');
  button.type = 'button';
  button.addEventListener('click', () =>
    review({
      id: shift.id,
      revision: shift.revision,
      timezone: data.timezone,
      draft: { ...shift.draft, duties: [...shift.duties, duty] },
    }),
  );
  card.append(button);
  return `Ready to add “${duty}” to ${shift.title} (${shift.workerName}). Review it on Schedule, then choose Save changes.`;
}

export function sendDutyToSchedule(account, edit) {
  return sendEditToSchedule(account, edit);
}
