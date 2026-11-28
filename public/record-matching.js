import { coworkerLookupDate } from './routing/dates.js';

const words = (value) => value.trim().toLowerCase().split(/\s+/);

export function matchesRecordName(name, selector) {
  if (!selector) return true;
  const wanted = words(selector);
  const actual = words(name ?? '');
  return wanted.length === 1
    ? actual.includes(wanted[0])
    : actual.join(' ') === wanted.join(' ');
}

const titleWords = (value) =>
  value
    .toLowerCase()
    .split(/[\s/\p{Pd}]+/u)
    .filter(Boolean);

export function matchesShiftTitle(title, selector) {
  if (!selector) return true;
  const wanted = titleWords(selector);
  const actual = titleWords(title);
  if (!wanted.length) return false;
  return actual.some((_, start) =>
    wanted.every((part, index) => actual[start + index]?.startsWith(part)),
  );
}

const DAY_PARTS = {
  morning: [0, 12],
  afternoon: [12, 17],
  evening: [17, 24],
  night: [17, 24],
};

export function matchesShiftDayPart(startsAt, timezone, word) {
  if (!Object.hasOwn(DAY_PARTS, word)) return false;
  const [start, end] = DAY_PARTS[word];
  const hour = Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      hourCycle: 'h23',
    }).format(new Date(startsAt)),
  );
  return hour >= start && hour < end;
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const MONTH_WORD =
  /\b(?:january|february|march|april|may|june|july|august|september|october|november|december)\b|\b20\d{2}-\d{2}-\d{2}\b/i;

// "the 24th" with no month means the next 24th, this month or next.
export function withMonth(text, today) {
  if (MONTH_WORD.test(text)) return text;
  return text.replace(
    /\b(?:the )?(\d{1,2})(?:st|nd|rd|th)\b/i,
    (whole, number) => {
      const day = Number(number);
      if (day < 1 || day > 31) return whole;
      const month =
        Number(today.slice(5, 7)) -
        1 +
        (day < Number(today.slice(8, 10)) ? 1 : 0);
      return `${MONTHS[month % 12]} ${day}`;
    },
  );
}

export function recordDate(text, today) {
  const expanded = text.replace(
    /\b(jan|feb|mar|apr|jun|jul|aug|sept?|oct|nov|dec)\.?(?=\s+\d)/gi,
    (short) =>
      MONTHS.find((month) =>
        month.toLowerCase().startsWith(short.toLowerCase().replace('.', '')),
      ),
  );
  return coworkerLookupDate(withMonth(expanded, today), today);
}

// Resolve a reply against the rows actually offered in the current card.
export function shiftChoiceIndex(text, choices, timezone) {
  const reply = text
    .trim()
    .toLowerCase()
    .replace(/[.!?]+$/, '');
  const selector = reply
    .replace(/^the\s+/, '')
    .replace(/\s+(?:one|shift)$/, '');
  const ordinals = [
    'first',
    'second',
    'third',
    'fourth',
    'fifth',
    'sixth',
    'seventh',
    'eighth',
    'ninth',
    'tenth',
  ];
  const numeric = /^(?:number |#)?(\d{1,2})(?:st|nd|rd|th)?$/.exec(selector);
  const ordinal = numeric ? Number(numeric[1]) - 1 : ordinals.indexOf(selector);
  if (selector === 'last') return choices.length ? choices.length - 1 : null;
  if (numeric || ordinal >= 0) return choices[ordinal] ? ordinal : null;
  if (!selector) return undefined;
  const matches = choices.flatMap((shift, index) =>
    matchesShiftTitle(shift.title, selector) ||
    matchesRecordName(shift.workerName, selector) ||
    (shift.startsAt && matchesShiftDayPart(shift.startsAt, timezone, selector))
      ? [index]
      : [],
  );
  if (matches.length === 1) return matches[0];
  return matches.length ||
    /^the (?:[\p{L}\p{N}'’-]+ ){1,4}(?:one|shift)$/u.test(reply)
    ? null
    : undefined;
}
