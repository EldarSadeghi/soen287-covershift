// Date readers for chat follow-ups: one day ("December 3", "Friday",
// "tomorrow") and history periods ("last month", "February 2026").
import { anyOf, MONTHS } from './text.js';

// One date mention. The capture groups, in order, are read below:
// ISO date | month name, day, optional year | today/tomorrow | "this", weekday.
const dateToken = anyOf(
  [
    /(20\d{2}-\d{2}-\d{2})/,
    `(${MONTHS})\\s+(\\d{1,2}(?:st|nd|rd|th)?|first|second|third)(?:,?\\s+(20\\d{2}))?`,
    /(today|tomorrow)/,
    /(this\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)/,
  ],
  { before: '\\b', after: '\\b', flags: 'gi' },
);

export function dateMentionCount(text) {
  return [...text.matchAll(dateToken)].length;
}

export function coworkerLookupDate(text, today) {
  if (
    /\b(?:this|next|last) week\b|\b(?:next|last) (?:sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i.test(
      text,
    )
  )
    return null;
  const tokens = [...text.matchAll(dateToken)];
  if (tokens.length !== 1) return null;
  const [
    ,
    iso,
    monthName,
    dayNumber,
    explicitYear,
    relative,
    thisWeek,
    weekday,
  ] = tokens[0];
  const anchor = new Date(`${today}T12:00:00Z`);
  let date = iso;
  if (monthName) {
    const month = new Date(`${monthName} 1, 2000 UTC`).getUTCMonth() + 1;
    const day =
      { first: 1, second: 2, third: 3 }[dayNumber.toLowerCase()] ||
      Number.parseInt(dayNumber, 10);
    const suffix = `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const year = Number(today.slice(0, 4));
    date = `${explicitYear || year + Number(suffix < today.slice(5))}-${suffix}`;
  } else if (relative) {
    anchor.setUTCDate(
      anchor.getUTCDate() + Number(relative.toLowerCase() === 'tomorrow'),
    );
    date = anchor.toISOString().slice(0, 10);
  } else if (weekday) {
    const weekdays = [
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday',
      'sunday',
    ];
    const difference =
      weekdays.indexOf(weekday.toLowerCase()) - ((anchor.getUTCDay() + 6) % 7);
    const offset = thisWeek ? difference : (difference + 7) % 7 || 7;
    anchor.setUTCDate(anchor.getUTCDate() + offset);
    date = anchor.toISOString().slice(0, 10);
  }
  const instant = new Date(`${date}T00:00:00Z`);
  return Number.isFinite(instant.getTime()) &&
    instant.toISOString().slice(0, 10) === date
    ? date
    : null;
}

const monthNames =
  'january february march april may june july august september october november december'.split(
    ' ',
  );
const month = new RegExp(
  `\\b(${monthNames.join('|')})(?:\\s+(20\\d{2}))?\\b`,
  'gi',
);

export function historyPeriod(text, today) {
  const exactDay = today && coworkerLookupDate(text, today);
  const named = [...text.matchAll(month)];
  const relative = [
    ...text.matchAll(/\b(?:last month|this year|last 30 days)\b/gi),
  ];
  if (
    relative.length + named.length > 1 ||
    /\b(?:between|since|through|until)\b/i.test(text)
  )
    return null;
  if (relative.length) return relative[0][0].toLowerCase().replaceAll(' ', '-');
  if (exactDay) return exactDay;
  if (named.length) {
    const [, name, year] = named[0];
    // An invalid specific date is not interpreted as the whole month.
    if (/^\s+\d/.test(text.slice(named[0].index + named[0][0].length)))
      return null;
    const number = String(monthNames.indexOf(name.toLowerCase()) + 1).padStart(
      2,
      '0',
    );
    return year ? year + '-' + number : 'month-' + number;
  }
  if (
    /\b(?:last|next|this|past|previous)\s+(?:\d+\s+)?(?:days?|weeks?|months?|years?)\b|\b(?:between|since|through|until)\b|\b20\d{2}(?:-\d{2}-\d{2})?\b/i.test(
      text,
    )
  )
    return null;
  return 'last-30-days';
}
