// Replacement suggestions in chat (CS-066): reads the shift from a manager's
// question and shows who could take it. Read-only: nothing is sent or saved.
import { coworkerLookupDate } from './ai-chat-routing.js';
import { historyTitle } from './ai-manager-insights.js';
import { checkedMeta, localDate, responseHeader } from './ai-response-card.js';
import { element } from './shift-card.js';
import { formatShiftTime } from './shift-time.js';

export const DATE_QUESTION =
  'Which date’s shift needs cover? Say a day such as Friday or December 5.';
export const SHIFT_QUESTION = 'Which shift should I check?';

const NOT_NAMES = new Set([
  'the',
  'a',
  'an',
  'my',
  'this',
  'that',
  'our',
  'their',
  'someone',
  'somebody',
  'anyone',
  'anybody',
  'me',
  'today',
  'tomorrow',
  'tonight',
]);

// Day and month names look like names ("cover Friday's shift").
const DATE_WORD =
  /^(?:mon|tues|wednes|thurs|fri|satur|sun)day$|^(?:january|february|march|april|may|june|july|august|september|october|november|december)$/i;

// The assigned employee named in "cover Jamie's Friday shift", "replace Sam
// on Saturday" or "fill in for Alex tomorrow". Names start with a capital.
export function replacementWorker(text) {
  const match =
    /\b(?:cover|replace|take over|take|fill in for|sub(?:stitute)? for|stand in for|step in for|instead of|for)\s+([A-Z][\p{L}'-]+)(?:['’]s\b)?/u.exec(
      text,
    );
  const name = match?.[1].replace(/['’]s$/, '');
  return name && !NOT_NAMES.has(name.toLowerCase()) && !DATE_WORD.test(name)
    ? name
    : null;
}

// A short reply naming the shift: "the opening one", "Opening service".
function replyTitle(reply) {
  const words = reply
    .toLowerCase()
    .replace(/[“”"'’.!?]/g, ' ')
    .replace(/\b(?:the|one|shift|please|that|this|it'?s|its)\b/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
  return words || null;
}

/**
 * The lookup for a question. `reply` answers an earlier "Which date…" or
 * "Which shift…" question: a date replaces the date, other words name the
 * shift. The employee and title otherwise come from the question in `text`.
 */
export function replacementQuery(text, today, reply = null) {
  const replyDate = reply && coworkerLookupDate(reply, today);
  const day = replyDate || coworkerLookupDate(text, today);
  if (!day) return { question: DATE_QUESTION };
  const title =
    reply && !replyDate ? replyTitle(reply) : historyTitle(text) || null;
  const worker = replacementWorker(text);
  return {
    params: {
      kind: 'replacements',
      from: day,
      through: day,
      ...(title && { title }),
      ...(worker && { worker }),
    },
  };
}

const hoursLabel = (value) => `${value} ${value === 1 ? 'hour' : 'hours'}`;

function shiftTime(row, timezone) {
  const when = formatShiftTime(row, timezone);
  return `${when.date} · ${when.startTime} – ${when.endDate ? when.endDate + ' · ' : ''}${when.endTime}`;
}

function names(list) {
  return list.length <= 1
    ? list.join('')
    : `${list.slice(0, -1).join(', ')} and ${list.at(-1)}`;
}

export function renderReplacements(card, data) {
  card.replaceChildren();
  responseHeader(card, 'Saved records · Read only', 'Replacement suggestions');
  const date = localDate(data.from);
  let reply;
  if (data.status === 'none') {
    const filters = [data.title && `“${data.title}”`, data.worker]
      .filter(Boolean)
      .join(' for ');
    reply = `No shifts${filters ? ` matching ${filters}` : ''} on ${date}.`;
    card.append(element('p', '', reply));
  } else if (data.status === 'choose') {
    reply = `${SHIFT_QUESTION} There are ${data.total} on ${date}. Reply with its title, such as “${data.shifts[0].title}”.`;
    card.append(element('p', '', reply));
    for (const row of data.shifts)
      card.append(
        element('h4', '', row.title),
        element('p', 'ai-response-meta', shiftTime(row, data.timezone)),
        element('p', '', `Assigned to ${row.workerName}`),
      );
    if (data.total > data.shifts.length)
      card.append(
        element(
          'p',
          'ai-response-meta',
          `Showing ${data.shifts.length} of ${data.total} shifts.`,
        ),
      );
  } else {
    const { shift } = data;
    card.append(
      element('h4', '', shift.title),
      element('p', 'ai-response-meta', shiftTime(shift, data.timezone)),
      element('p', '', `Assigned to ${shift.workerName}`),
    );
    if (data.status === 'started') {
      reply = 'That shift has already started, so it can’t be covered now.';
      card.append(element('p', '', reply));
    } else if (!data.suggestions.length) {
      reply =
        'Nobody is confirmed available for the full shift. Check Availability, or change the shift on Schedule.';
      card.append(element('p', '', reply));
    } else {
      const top = data.suggestions
        .slice(0, 3)
        .map(
          (row) => `${row.workerName} (${hoursLabel(row.weekHours)} this week)`,
        );
      reply = `${data.suggestions.length} ${data.suggestions.length === 1 ? 'employee is' : 'employees are'} available for all of ${shift.title}: ${names(top)}.`;
      card.append(element('p', '', reply));
      for (const row of data.suggestions)
        card.append(
          element(
            'p',
            '',
            `${row.workerName} · ${hoursLabel(row.weekHours)} this week · Available for the full shift · ${row.invitation}`,
          ),
        );
      card.append(
        element(
          'p',
          'ai-response-meta',
          'Ranked by fewest scheduled hours this week. Nothing is sent. You can change the assignment on Schedule; the employee whose shift it is can invite anyone marked “Can be invited now” from My shifts.',
        ),
      );
    }
    if (data.excluded?.length) {
      card.append(element('h4', '', 'Not available for this shift'));
      for (const row of data.excluded)
        card.append(
          element('p', 'ai-response-meta', `${row.workerName} · ${row.reason}`),
        );
    }
  }
  const link = element('a', 'ai-chat-review', 'Open Schedule');
  link.href = '/workspace/manager/schedule';
  card.append(checkedMeta(data.asOf, data.timezone), link);
  return reply;
}
