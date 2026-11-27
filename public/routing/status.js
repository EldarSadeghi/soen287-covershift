// Employee status lookups: their own claims, cover requests and time off.
import { normalizedMessage } from './text.js';

// Each status lookup needs a question opener, a subject that is the employee's
// own request, and a word about its outcome ("approved", "pending", ...).
export const statusPatterns = {
  timeOffStatus: {
    lead: /^(?:did|has|was|is|what|check|show)\b/,
    subject: /\bmy\b[^.!?]*\b(?:time[ -]off|leave request)\b/,
    decision:
      /\b(?:approv(?:e|ed|al)|declin(?:e|ed)|reject(?:ed)?|cancelled|canceled|pending|status|decision|go through)\b/,
  },
  coverStatus: {
    lead: /^(?:did|has|was|is|what|check|show)\b/,
    subject:
      /\b(?:my (?:cover (?:requests?|invitations?)|requests? (?:for|to) cover)|(?:cover (?:requests?|invitations?)) i sent)\b/,
    decision:
      /\b(?:accept(?:ed)?|approv(?:e|ed|al)|declin(?:e|ed)|reject(?:ed)?|cancelled|canceled|pending|expired|status|respond(?:ed)?|decision|what happened)\b/,
  },
  claimStatus: {
    lead: /^(?:did|has|was|is|what(?:'s| is)|check|show)\b/,
    subject: /\bmy\b[^.!?]*\bclaim\b/,
    decision:
      /\b(?:approved|approval|declined|rejected|cancelled|canceled|pending|status|decision|go through)\b/,
  },
};

// Checked in this order: time off, cover requests, then claims.
export function statusRoute(message) {
  for (const [route, { lead, subject, decision }] of Object.entries(
    statusPatterns,
  )) {
    if (lead.test(message) && subject.test(message) && decision.test(message))
      return route;
  }
  return null;
}

export const requestStatusTopics = new Set([
  'claimStatus',
  'coverStatus',
  'timeOffStatus',
]);

// A short date reply such as "what about Friday?" or "and December 3rd".
export const followUpPrefix = '(?:(?:what|how) about |and )?(?:on |for )?';
const followUpWeekday =
  '(?:this )?(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)';
export const followUpMonth =
  '(?:january|february|march|april|may|june|july|august|september|october|november|december)';
const followUpMonthDay =
  '(?:[0-9]{1,2}(?:st|nd|rd|th)?|first|second|third)(?:,? 20[0-9]{2})?';
const statusFollowUpDate = new RegExp(
  `^${followUpPrefix}(?:today|tomorrow|${followUpWeekday}|20[0-9]{2}-[0-9]{2}-[0-9]{2}|${followUpMonth} ${followUpMonthDay})[.!?]*$`,
);

export function isStatusDateFollowUp(text) {
  return statusFollowUpDate.test(normalizedMessage(text));
}
