// Manager routes: read-only lookups, shift edits, new-shift drafts and team
// availability.
import { anyOf, normalizedMessage } from './text.js';

const statusOpener = "(?:what(?:'s| is) (?:the )?|check |show (?:me )?)?";

export const managerPatterns = {
  // Checked in this order.
  lookups: {
    // "Who's off next week?", "show pending time-off requests"
    teamTimeOff: anyOf(
      [
        /(?:who(?:'s| is)|which (?:staff|employees|workers) (?:are|is)) (?:off|on (?:leave|vacation))/,
        /(?:show|list|check) (?:me )?(?:(?:team(?:'s)?|pending|approved) )?(?:time[ -]off|leave requests?)/,
      ],
      { before: '^', after: '\\b' },
    ),
    // "Is Friday's opening covered?", "who claimed the delivery shift?"
    coverageStatus: anyOf(
      [
        `${statusOpener}(?:shift )?coverage status`,
        /(?:is|was) .+ covered/,
        /who (?:claimed|is covering|covered)\b.*/,
        /which (?:shifts|requests) (?:are|were) (?:covered|claimed)/,
      ],
      { before: '^', after: '\\b' },
    ),
    // "Is next period's schedule published?", "how many shifts are unpublished?"
    publicationStatus: anyOf(
      [
        `${statusOpener}(?:schedule )?publication status`,
        /(?:is|was|has) .*(?:schedule|period).*\bpublished/,
        /when is .*(?:schedule|publication).*due/,
        /how many shifts (?:are|remain) unpublished/,
      ],
      { before: '^', after: '\\b' },
    ),
  },
  shiftEdit: {
    relativeTimeChange:
      /^(?:could|can|would) the (?:existing|scheduled|saved) shift\b[^.!?]*\b(?:start|end)\b[^.!?]*\b(?:earlier|later)[.!?]*$/,
    command:
      /^(?:move|change|reschedule|push|rename|reassign|extend|shorten|edit)\b/,
    subject: /\bshifts?\b/,
    followUp:
      /^(?:actually|instead|make it|start|end|move it|change it|rename it|from|until|at|[0-9])\b/,
  },
  draft: {
    giveShift:
      /^give [\p{L}][\p{L}'-]*(?: [\p{L}][\p{L}'-]*){0,3} (?:a|an) (?:new )?shift(?=$|[.!?]| (?:on|for|this|next|today|tomorrow)\b)/u,
    command:
      /\b(?:draft|create|add|assign|make|set up|put together)\b.*\bshifts?\b|^(?:draft|create|assign|schedule)\b/,
  },
  teamAvailability: {
    question:
      /^(?:is|are|was|were|who(?:'s|s)?|which|whether|anyone|anybody|can you check|check|show|tell me|do we have)\b/,
    availability: /\b(?:availability|available|free)\b/,
    canWork: /^(?:who (?:can|could) work|(?:can|could) [^.!?]+ work)\b/,
    // Words that make it a schedule question or a change, not availability.
    schedule: /\b(?:scheduled|working|on the rota)\b/,
    change:
      /\b(?:approve|delete|cancel|assign|request|send|change|save|publish)\b/,
  },
};

export function managerLookupRoute(message) {
  for (const [route, pattern] of Object.entries(managerPatterns.lookups)) {
    if (pattern.test(message)) return route;
  }
  return null;
}

// Edits to existing shifts are checked before new-shift drafts.
export function managerChangeRoute(message) {
  const { shiftEdit, draft } = managerPatterns;
  if (
    shiftEdit.relativeTimeChange.test(message) ||
    (shiftEdit.command.test(message) && shiftEdit.subject.test(message))
  )
    return 'shiftEdit';
  if (requestsShiftBatch(message)) return 'draft';
  if (draft.command.test(message) || draft.giveShift.test(message))
    return 'draft';
  return null;
}

export function teamAvailabilityRoute(message) {
  const team = managerPatterns.teamAvailability;
  const asks =
    (team.question.test(message) && team.availability.test(message)) ||
    team.canWork.test(message);
  return asks && !team.schedule.test(message) && !team.change.test(message)
    ? 'teamAvailability'
    : null;
}

export function requestsShiftBatch(text) {
  const message = normalizedMessage(text);
  if (
    !/^(?:draft|create|schedule|add|assign|put together|make|help me (?:draft|create|schedule))\b/.test(
      message,
    )
  )
    return false;
  return (
    /^(?:draft|create|schedule|add|assign|put together|make) (?:these )?shifts\b/.test(
      message,
    ) ||
    /\b(?:batch|multiple|several|two|three|four|five|six|\d+)\s+(?:dated\s+)?shifts\b|\b(?:batch of|shifts for)\b/.test(
      message,
    ) ||
    /\bfor\b[\s\S]*(?:;|\band\b|\n)[\s\S]*\bfor\b/.test(message)
  );
}
