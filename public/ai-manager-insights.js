// Manager insights in chat (CS-065): reads the period, focus and shift title
// from a question, and renders the read-only cards for team hours, coverage
// gaps and shift history.
import { coworkerLookupDate } from './ai-chat-routing.js';
import { MONTHS, WEEKDAYS } from './routing/text.js';
import { checkedMeta, localDate, responseHeader } from './ai-response-card.js';
import { element } from './shift-card.js';
import { formatShiftTime } from './shift-time.js';

export const INSIGHT_KINDS = ['teamHours', 'coverageGaps', 'shiftHistory'];

const addDays = (day, count) =>
  new Date(Date.parse(day + 'T12:00Z') + count * 86400000)
    .toISOString()
    .slice(0, 10);

// The caller supplies the business-local date, so subtract a calendar day.
const insightDate = (text, today) =>
  coworkerLookupDate(
    text.replace(/\byesterday\b/gi, addDays(today, -1)),
    today,
  );

// Does the text mention a date, readable or not ("December 32", "Dec 3",
// "next Friday", "12/5")? Used so a date the chat can't read is asked about
// instead of being replaced by the default period.
const DATE_MENTION = new RegExp(
  [
    `\\b(?:${MONTHS})\\s+\\d`,
    `\\b\\d{1,2}(?:st|nd|rd|th)?\\s+(?:of\\s+)?(?:${MONTHS})\\b`,
    '\\b(?:jan|feb|mar|apr|jun|jul|aug|sept?|oct|nov|dec)\\.?\\s+\\d',
    `\\b(?:${WEEKDAYS})\\b`,
    '\\b(?:today|tomorrow|yesterday)\\b',
    '\\b\\d{4}-\\d{1,2}-\\d{1,2}\\b',
    '\\b\\d{1,2}/\\d{1,2}\\b',
  ].join('|'),
  'i',
);

// A period from the question: "this/next/last week" (Monday–Sunday), "next two
// weeks", "December 3 through December 5", or one date. Null when the text
// names no dates; { reversed: true } for a range that ends before it starts;
// { unreadable: true } when it names a date that can't be read.
export function insightPeriod(text, today) {
  const week = /\b(this|next|last) week\b/i.exec(text)?.[1]?.toLowerCase();
  if (week) {
    const monday = addDays(
      today,
      -((new Date(today + 'T12:00Z').getUTCDay() + 6) % 7) +
        { this: 0, next: 7, last: -7 }[week],
    );
    return { from: monday, through: addDays(monday, 6) };
  }
  if (
    /\bnext (?:two|2) weeks\b|\bnext fortnight\b|\bnext 14 days\b/i.test(text)
  )
    return { from: today, through: addDays(today, 13) };
  const parts = text.split(/\s+(?:through|until|to|–|—)\s+/i);
  if (parts.length === 2) {
    const from = insightDate(parts[0], today);
    const through = insightDate(parts[1], today);
    if (from && through)
      return from <= through ? { from, through } : { reversed: true };
    // "December 3 to December 32": one side names a date that can't be read.
    if (
      (!from && DATE_MENTION.test(parts[0])) ||
      (!through && DATE_MENTION.test(parts[1]))
    )
      return { unreadable: true };
  }
  const day = insightDate(text, today);
  if (day) return { from: day, through: day };
  return DATE_MENTION.test(text) ? { unreadable: true } : null;
}

export function hoursFocus(text) {
  const under = /\b(?:under|less than|fewer than|below)\s+(\d{1,3})\b/i.exec(
    text,
  );
  if (under) return { focus: 'under', hours: under[1] };
  const over = /\b(?:over|more than|above)\s+(\d{1,3})\b/i.exec(text);
  if (over) return { focus: 'over', hours: over[1] };
  if (/\bovertime\b/i.test(text)) return { focus: 'overtime' };
  if (/\b(?:most|highest)\b/i.test(text)) return { focus: 'most' };
  if (/\b(?:fewest|least|lowest)\b/i.test(text)) return { focus: 'fewest' };
  return { focus: 'all' };
}

// The shift title word(s) in "Saturday's closing shift" or "the December 5
// opening shift", without the date words. Quoted titles are used as written.
export function historyTitle(text) {
  const quoted = text.match(/["“]([^"”]+)["”]/)?.[1];
  if (quoted) return quoted.trim();
  // Take the words after the last "the" or "'s" before "shift".
  const phrase =
    /(?:['’]s|\bthe)\s+((?:(?!\bthe\b|['’]s\b).)+?)\s+shifts?\b/i.exec(
      text,
    )?.[1] ?? '';
  const words = phrase
    .replace(
      /\b(?:today|tomorrow|yesterday|this|next|last|on|monday|tuesday|wednesday|thursday|friday|saturday|sunday|january|february|march|april|may|june|july|august|september|october|november|december|\d{1,2}(?:st|nd|rd|th)?|20\d{2}-\d{2}-\d{2})\b|['’]s\b|,/gi,
      ' ',
    )
    .trim()
    .replace(/\s+/g, ' ');
  return words || null;
}

const PERIOD_QUESTION = {
  reversed:
    'Which dates should I check? That range ends before it starts. For example, December 3 to December 5.',
  unreadable:
    'Which dates should I check? I couldn’t read a date in your question. For example, December 3 to December 5.',
};

/**
 * The lookup for a question. `dateReply` is the manager's answer to an earlier
 * "Which date…" question: its dates replace the original ones, while the focus,
 * hours and shift title still come from the original question in `text`.
 */
export function insightQuery(kind, text, today, dateReply = null) {
  const params = { kind };
  const dateText = dateReply ?? text;
  if (kind === 'shiftHistory') {
    const day = insightDate(dateText, today);
    if (!day)
      return {
        question:
          'Which date’s shift should I check? Say a day such as Saturday or December 5.',
      };
    const title = historyTitle(text);
    return {
      params: { ...params, from: day, through: day, ...(title && { title }) },
    };
  }
  // The default period (hours: this business week; gaps: the next 14 days) is
  // used only when the question names no dates. Dates that are reversed or
  // can't be read are asked about, and so is a reply without readable dates.
  const asked = insightPeriod(dateText, today);
  if (asked?.reversed) return { question: PERIOD_QUESTION.reversed };
  if (asked?.unreadable || (dateReply && !asked))
    return { question: PERIOD_QUESTION.unreadable };
  const period =
    asked ??
    (kind === 'teamHours'
      ? insightPeriod('this week', today)
      : { from: today, through: addDays(today, 13) });
  Object.assign(params, period);
  if (kind === 'teamHours') Object.assign(params, hoursFocus(text));
  return { params };
}

const names = (list) =>
  list.length <= 1
    ? list.join('')
    : `${list.slice(0, -1).join(', ')} and ${list.at(-1)}`;
const hoursLabel = (value) => `${value} ${value === 1 ? 'hour' : 'hours'}`;

function hoursReply(data) {
  const byName = new Map(data.rows.map((row) => [row.workerName, row.hours]));
  const listed = (matched) =>
    names(matched.map((name) => `${name} (${hoursLabel(byName.get(name))})`));
  if (!data.rows.length) return 'There are no active employees to compare.';
  switch (data.focus) {
    case 'most':
      return `Most scheduled hours: ${listed(data.matched)}.`;
    case 'fewest':
      return `Fewest scheduled hours: ${listed(data.matched)}.`;
    case 'under':
    case 'over': {
      const word = data.focus === 'under' ? 'under' : 'over';
      return data.matched.length
        ? `${data.matched.length} ${data.matched.length === 1 ? 'employee is' : 'employees are'} ${word} ${hoursLabel(data.threshold)}: ${listed(data.matched)}.`
        : `Nobody is ${word} ${hoursLabel(data.threshold)}.`;
    }
    case 'overtime':
      return data.matched.length
        ? `Within ${data.overtimeLine - data.overtimeFrom} hours of or over ${data.overtimeLine} hours: ${listed(data.matched)}.`
        : `Nobody is within ${data.overtimeLine - data.overtimeFrom} hours of ${data.overtimeLine} hours.`;
    default:
      return `${hoursLabel(data.teamHours)} scheduled across ${data.rows.length} ${data.rows.length === 1 ? 'employee' : 'employees'}.`;
  }
}

const gapState = {
  open: (row) => `Open for cover · given up by ${row.workerName}`,
  pending: (row) => `Claimed by ${row.claimantName} · awaiting your approval`,
  timeOff: (row) =>
    `${row.workerName} has ${row.timeOffStatus === 'approved' ? 'approved' : 'pending'} time off · no cover request yet`,
};

const actionLabel = {
  requested: 'Cover requested',
  claimed: 'Claimed',
  approved: 'Approved',
  rejected: 'Declined',
  reopened: 'Reopened',
  cancelled: 'Cancelled',
  legacy: 'Recorded',
};

function shiftTime(row, timezone) {
  const when = formatShiftTime(row, timezone);
  return `${when.date} · ${when.startTime} – ${when.endDate ? when.endDate + ' · ' : ''}${when.endTime}`;
}

function eventTime(at, timezone) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: timezone,
  }).format(Date.parse(at));
}

const views = {
  teamHours: ['Team hours', 'schedule', 'Open Schedule'],
  coverageGaps: ['Coverage gaps', 'approvals', 'Open Approvals'],
  shiftHistory: ['Shift history', 'history', 'Open History'],
};

export function renderInsight(card, data) {
  const [label, page, linkLabel] = views[data.kind];
  const period = [
    data.from,
    ...(data.through !== data.from ? [data.through] : []),
  ]
    .map(localDate)
    .join(' – ');
  card.replaceChildren();
  responseHeader(card, 'Saved records · Read only', label);
  card.append(
    element(
      'p',
      'ai-response-meta',
      [data.title || 'Entire team', period].join(' · '),
    ),
  );
  let reply;
  if (data.kind === 'teamHours') {
    reply = hoursReply(data);
    card.append(element('p', '', reply));
    if (data.overtimeLine)
      card.append(
        element(
          'p',
          'ai-response-meta',
          `CoverShift doesn’t store an overtime rule, so this uses ${data.overtimeLine} hours a week.`,
        ),
      );
    for (const row of data.rows.slice(0, 12))
      card.append(
        element(
          'p',
          '',
          `${row.workerName} · ${hoursLabel(row.hours)} · ${row.shifts} ${row.shifts === 1 ? 'shift' : 'shifts'}`,
        ),
      );
  } else if (data.kind === 'coverageGaps') {
    const { rows } = data;
    reply = rows.length
      ? `${rows.length} ${rows.length === 1 ? 'shift needs' : 'shifts need'} attention.`
      : 'No coverage gaps in this period.';
    card.append(element('p', '', reply));
    for (const row of rows)
      card.append(
        element('h4', '', row.title),
        element('p', '', gapState[row.gap](row)),
        element('p', 'ai-response-meta', shiftTime(row, data.timezone)),
      );
  } else {
    const { rows } = data;
    const total = data.total ?? rows.length;
    reply = rows.length
      ? total > rows.length
        ? `Showing ${rows.length} of ${total} shifts on ${localDate(data.from)}. Add a title word, such as “closing”, to narrow it down.`
        : `${total} ${total === 1 ? 'shift' : 'shifts'} on ${localDate(data.from)}.`
      : `No shifts${data.title ? ` matching “${data.title}”` : ''} on ${localDate(data.from)}.`;
    card.append(element('p', '', reply));
    for (const row of rows) {
      card.append(
        element('h4', '', row.title),
        element('p', 'ai-response-meta', shiftTime(row, data.timezone)),
        element('p', '', `Assigned to ${row.workerName}`),
      );
      if (!row.events.length)
        card.append(element('p', 'ai-response-meta', 'No coverage activity.'));
      for (const event of row.events)
        card.append(
          element(
            'p',
            'ai-response-meta',
            `${actionLabel[event.action] ?? event.action}${event.actorName ? ' by ' + event.actorName : ''} · ${eventTime(event.at, data.timezone)}`,
          ),
        );
    }
  }
  const link = element('a', 'ai-chat-review', linkLabel);
  link.href = '/workspace/manager/' + page;
  card.append(checkedMeta(data.asOf, data.timezone), link);
  return reply;
}
