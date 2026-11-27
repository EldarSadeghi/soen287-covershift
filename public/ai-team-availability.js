import { coworkerLookupDate } from './ai-chat-routing.js';
import { localDate, responseHeader, checkedMeta } from './ai-response-card.js';
import { element } from './shift-card.js';
import { formatShiftTime } from './shift-time.js';

const dayparts = {
  morning: ['06:00', '12:00'],
  afternoon: ['12:00', '17:00'],
  evening: ['17:00', '22:00'],
};

function clockTime(hour, minute, period) {
  const value = Number(hour);
  if (value < 1 || value > 12 || Number(minute) > 59) return null;
  const hours = (value % 12) + (period.toLowerCase() === 'pm' ? 12 : 0);
  return String(hours).padStart(2, '0') + ':' + (minute || '00');
}

export function teamAvailabilityQuery(text, today, timezone) {
  const date = coworkerLookupDate(text, today);
  if (!date)
    return {
      question: 'Which date should I check? Give one date, such as December 3.',
    };
  const range = text.match(
    /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\s*(?:to|until|[-–])\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i,
  );
  const parts = [...text.matchAll(/\b(morning|afternoon|evening)\b/gi)];
  const timesOnly = text.replace(/\b20\d{2}-\d{2}-\d{2}\b/g, '');
  const hasHours =
    /\b(?:\d{1,2}:\d{2}|\d{1,2}\s*[ap]m|\d{1,2}\s*(?:[-–]|to)\s*\d{1,2}|noon|midnight|night|before|after|overnight|late|early|lunch|closing|opening)\b/i.test(
      timesOnly,
    );
  if (!range && !parts.length && !hasHours && !/\ball day\b/i.test(text))
    return { date, params: { date } };
  if (/\ball day\b/i.test(text) && !range && !parts.length && !hasHours) {
    const next = new Date(date + 'T00:00Z');
    next.setUTCDate(next.getUTCDate() + 1);
    return {
      date,
      params: {
        startLocal: date + 'T00:00',
        endLocal: next.toISOString().slice(0, 10) + 'T00:00',
        timezone,
      },
    };
  }
  const [start, end] = range
    ? [clockTime(...range.slice(1, 4)), clockTime(...range.slice(4, 7))]
    : parts.length === 1 && !hasHours
      ? dayparts[parts[0][1].toLowerCase()]
      : [];
  if (!start || !end || end <= start) {
    return {
      question:
        'Which hours should I check? Ask again with the date and a same-day range, such as 1 PM to 4 PM.',
    };
  }
  return {
    date,
    params: {
      startLocal: date + 'T' + start,
      endLocal: date + 'T' + end,
      timezone,
    },
  };
}

const normalizeName = (value) =>
  value
    .toLowerCase()
    .match(/[\p{L}\p{N}]+/gu)
    ?.join(' ') || '';

export function selectAvailabilityWorkers(workers, question) {
  const subject = question.match(
    /^(?:is|are|can|could|would)\s+(.+?)\s+(?:available|free|work|be free|be available)\b/i,
  )?.[1];
  const text = ' ' + normalizeName(subject || question) + ' ';
  const team =
    /\b(?:anyone|anybody|someone|everyone|the team|any employees?|any staff|any workers?|my team)\b/i;
  if (subject && team.test(subject)) return { workers };

  const matchesName = (name) => text.includes(' ' + name + ' ');
  const exact = workers.filter((worker) =>
    matchesName(normalizeName(worker.name)),
  );
  const matches = exact.length
    ? exact
    : workers.filter((worker) =>
        matchesName(normalizeName(worker.name).split(' ')[0]),
      );
  if (matches.length === 1) return { workers: matches };
  if (matches.length > 1)
    return { question: 'Which employee should I check? Give their full name.' };
  if (
    subject ||
    !/^(?:who|which)\b|\b(?:who['’]?s|whos|anyone|anybody|who (?:can|could) work|team availability|staff availability|employee availability|my team|the team)\b/i.test(
      question,
    )
  ) {
    return {
      question:
        'Whose availability should I check? Give an employee’s name or ask who is free.',
    };
  }
  return { workers };
}

export function renderTeamAvailability(card, data, date, workers) {
  const exactPeriod = data.startsAt && data.endsAt;
  const time = exactPeriod && formatShiftTime(data, data.timezone);
  const period = time
    ? `${time.date} · ${time.startTime} – ${time.endDate ? time.endDate + ' · ' : ''}${time.endTime}`
    : localDate(date);
  const available = workers.filter((worker) => worker.status === 'available');
  const reply = !workers.length
    ? 'There are no active employees to check.'
    : workers.length === 1
      ? `${workers[0].name} · ${workers[0].reasons.join(' · ')}.`
      : available.length
        ? `${available.map((worker) => worker.name).join(', ')} ${available.length === 1 ? 'has' : 'have'} confirmed availability.`
        : 'Nobody has confirmed availability for this period.';
  card.replaceChildren();
  responseHeader(card, 'Team availability', period);
  for (const worker of workers) {
    card.append(
      element('h4', '', worker.name),
      element(
        'p',
        '',
        `${worker.status === 'unknown' ? 'Unknown' : worker.status === 'available' ? 'Available' : 'Unavailable'} · ${worker.reasons.join(' · ')}`,
      ),
    );
    for (const window of worker.windows || []) {
      const times = formatShiftTime(window, data.timezone);
      card.append(
        element(
          'p',
          '',
          `${times.startTime} – ${times.endDate ? times.endDate + ' · ' : ''}${times.endTime}`,
        ),
      );
    }
  }
  const link = element('a', 'ai-chat-review', 'Open Availability');
  link.href = '/workspace/manager/availability';
  card.append(checkedMeta(data.checkedAt, data.timezone), link);
  return reply;
}
