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
  return coworkerLookupDate(withMonth(text, today), today);
}
