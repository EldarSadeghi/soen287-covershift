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

// Words that never start or continue a name: articles, pronouns, date and
// time words, and shift words ("cover Friday's shift", "the opening shift").
const NOT_NAME =
  /^(?:the|a|an|my|this|that|our|their|his|her|its|someone|somebody|anyone|anybody|any ?one|me|us|them|today|tomorrow|tonight|yesterday|next|last|on|at|in|for|from|to|by|with|and|or|shifts?|open(?:ing)?|clos(?:e|ing)|morning|afternoon|evening|night|overnight|brunch|lunch|dinner|delivery|inventory|front|back|kitchen|bar|counter|(?:mon|tues|wednes|thurs|fri|satur|sun)day|january|february|march|april|may|june|july|august|september|october|november|december|\d+(?:st|nd|rd|th)?)$/i;
const NAME_WORD = /^[\p{L}][\p{L}'’-]*$/u;
// Verbs whose object is a person ("replace Sam"), not a shift ("take the close").
const PERSON_VERB =
  /\b(?:replace|fill in for|sub(?:stitute)? for|stand in for|step in for|instead of|cover for|take over for)\s+(.+)$/i;
const ANY_VERB =
  /\b(?:cover|replace|take over|take|fill in for|sub(?:stitute)? for|stand in for|step in for|instead of|cover for)\s+(.+)$/i;

// Words that may follow a person's name when "cover" or "take" has a person
// as its object: "cover Alex tomorrow", "take alex on Friday".
const AFTER_NAME =
  /^(?:on|at|this|next|tomorrow|today|tonight|(?:mon|tues|wednes|thurs|fri|satur|sun)day|january|february|march|april|may|june|july|august|september|october|november|december)$/i;

// Up to two name words from the start of `rest`. Modes: 'possessive' needs
// the last word to end in 's ("jamie lee's Friday shift"); 'person' follows a
// verb that takes a person ("replace sam rivera"); 'object' follows "cover"
// or "take" and needs a date or time next ("cover alex tomorrow").
export function nameAt(rest, mode) {
  const words = rest.trim().split(/\s+/);
  const name = [];
  for (const raw of words.slice(0, 2)) {
    const word = raw.replace(/[?!.,;:]+$/, '');
    const owner = /['’]s$/i.test(word);
    const bare = word.replace(/['’]s$/i, '');
    if (!NAME_WORD.test(bare) || NOT_NAME.test(bare)) break;
    name.push(bare);
    if (owner) return name.join(' ');
    if (word !== raw) break; // punctuation ends the name
  }
  if (mode === 'possessive' || !name.length) return null;
  if (mode === 'person') return name.join(' ');
  const next = words[name.length]?.replace(/[?!.,;:]+$/, '');
  return next === undefined || AFTER_NAME.test(next) ? name.join(' ') : null;
}

// The assigned employee named in "cover jamie's Friday shift", "replace Sam
// Rivera on Saturday", "fill in for taylor tomorrow" or "cover Alex
// tomorrow". Case doesn't matter; full names are kept so the server can
// match them exactly.
export function replacementWorker(text) {
  const person = PERSON_VERB.exec(text)?.[1];
  const any = ANY_VERB.exec(text)?.[1];
  return (
    (any && nameAt(any, 'possessive')) ||
    (person && nameAt(person, 'person')) ||
    (any && nameAt(any, 'object')) ||
    null
  );
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

// Walk the pending clarification chain to recover the original question
// and the last date reply. Stop at the previous completed lookup or topic.
export function replacementContext(messages) {
  let index = messages.length - 2;
  let dateReply = null;
  while (index >= 2) {
    const prompt = messages[index - 1];
    const answer = messages[index];
    if (prompt.topic !== 'replacements' || answer.topic !== 'replacements')
      break;
    if (prompt.text.startsWith(DATE_QUESTION)) dateReply ??= answer.text;
    else if (!prompt.text.startsWith(SHIFT_QUESTION)) break;
    index -= 2;
  }
  return { question: messages[index]?.text, dateReply };
}

/**
 * The lookup for a question. `reply` answers an earlier "Which date…" or
 * "Which shift…" question: a date replaces the date, other words name the
 * shift. The employee and title otherwise come from the question in `text`.
 */
export function replacementQuery(text, today, reply = null, priorDate = null) {
  const replyDate = reply && coworkerLookupDate(reply, today);
  const day = replyDate || coworkerLookupDate(priorDate ?? text, today);
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
