// Routes both roles share: working-week / attention summaries and schedule
// questions, plus the "this week / next week" reader for summaries.
import { anyOf, normalizedMessage, MONTHS, WEEKDAYS } from './text.js';

// "schedule" and common misspellings ("whats my shedule this week").
const SCHEDULE = '(?:schedule|shedule|schedual|scedule|schdule)';

export const sharedPatterns = {
  negation: /^(?:do not|don't|never)\b/,
  summary: {
    lead: /^(?:show|list|summari[sz]e|give me|what|which|do i|did my|is anyone|pending approvals|how many|check|(?:my |team )?(?:working week|attention summary|weekly summary))\b/,
    // What needs the manager's attention.
    manager: anyOf(
      [
        'attention summary',
        'what needs (?:my )?attention',
        'weekly summary',
        'pending approvals',
        'claims awaiting approval',
        'waiting for my approval',
        'needs? cover',
        'unresolved coverage',
        'open (?:coverage|requests for cover)',
      ],
      { before: '\\b', after: '\\b' },
    ),
    employee:
      /\b(?:working week|weekly summary|upcoming work|my coverage (?:decisions|requests|status)|my pending (?:coverage )?(?:requests|claims)|coverage decisions)\b/,
  },
  questions: {
    employeeLead:
      /^(?:when am i on next|what time do i start (?:today|tomorrow))\b/,
    lead: /^(?:when|what|which|how many|how long|who|show|list|tell me|am i|do i|give me|pull up|check|remind me)\b/,
    subject: anyOf(
      [
        `${SCHEDULE}s?`,
        'roster',
        'rota',
        'shifts?',
        'hours',
        'working',
        'work',
        'come in',
        'clock in',
        'on duty',
        'on the rota',
      ],
      { before: '\\b', after: '\\b' },
    ),
    possessive: anyOf([SCHEDULE, 'hours', 'next shift'], {
      before: "\\b(?:my|team'?s?) ",
      after: '\\b',
    }),
  },
};

export function summaryRoute(message, manager) {
  const { lead, manager: forManager, employee } = sharedPatterns.summary;
  if (!lead.test(message)) return null;
  return (manager ? forManager : employee).test(message) ? 'summary' : null;
}

export function questionsRoute(message, manager) {
  const { employeeLead, lead, subject, possessive } = sharedPatterns.questions;
  if (!manager && employeeLead.test(message)) return 'questions';
  if ((lead.test(message) && subject.test(message)) || possessive.test(message))
    return 'questions';
  return null;
}

// Any date word other than "this week" / "next week" means the summary
// cannot answer for that period.
const otherPeriod = anyOf([
  `\\b(?:today|tomorrow|yesterday|weekend|(?:last|previous) week|(?:this|next|last) month|${WEEKDAYS}|${MONTHS})\\b`,
  /\d{1,4}[-/]\d/,
  /\b(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|several) (?:days?|weeks?|months?)\b/,
]);

export function workingSummaryWeek(text) {
  const message = normalizedMessage(text);
  const weeks = [...message.matchAll(/\b(this|next) week\b/g)].map(
    (match) => match[1],
  );
  if (new Set(weeks).size > 1 || otherPeriod.test(message)) return null;
  return weeks[0] || 'this';
}
