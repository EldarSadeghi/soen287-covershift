// Manager routes: read-only lookups, shift edits, new-shift drafts and team
// availability.
import { anyOf, normalizedMessage } from './text.js';

const statusOpener = "(?:what(?:'s| is) (?:the )?|check |show (?:me )?)?";

export const managerPatterns = {
  // Checked in this order.
  lookups: {
    // "Who can cover Jamie's Friday shift?", "find a replacement for Sam"
    // (CS-066). Checked first: these ask who could take a specific shift.
    replacements: anyOf(
      [
        /who(?:'s| is)? (?:can|could|would|might|is able to|is available to|is free to|(?:free|available) to|should) (?:cover|replace|take over|take|fill in for|sub(?:stitute)? for|stand in for|step in for|work instead of)\s+(?!me\b|it\b|that\b|for me\b)\S/,
        /(?:is there )?(?:any ?one|anybody|someone|somebody) (?:who |that )?(?:can|could|would be able to|is (?:free|available) to) (?:cover|replace|take over|take|fill in for|sub for)\s+(?!me\b|it\b|that\b|for me\b)\S/,
        /(?:can|could) (?:any ?one|anybody|someone|somebody) (?:cover|replace|take over|take|fill in for|sub for)\s+(?!me\b|it\b|that\b|for me\b)\S/,
        /(?:find|suggest|recommend|get|need|show|list) (?:me )?(?:a |an |some |possible )?(?:replacements?|cover|subs?|substitutes?|stand-?ins?|someone to (?:cover|take|replace)|people who (?:can|could) (?:cover|take))\b/,
        /(?:replacements?|subs?|substitutes?|cover) (?:options|suggestions|candidates)\b/,
        /who (?:can|could) (?:i )?(?:get|ask|use) to (?:cover|take|replace|fill in for)\b/,
      ],
      { before: '^', after: '' },
    ),
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
    // CS-065. "Who has the most hours?", "who's under 20 hours?", "who's close
    // to overtime?". A total for the team or one person stays a schedule question.
    teamHours: anyOf(
      [
        "who(?:'s| is| has| works| is working)? (?:got )?(?:the )?(?:most|fewest|least|lowest|highest) (?:scheduled )?hours",
        "who(?:'s| is| has)? (?:got )?(?:scheduled )?(?:under|over|more than|less than|fewer than|below|above) \\d+ (?:scheduled )?hours",
        '(?:which|what) (?:staff|employees|workers|people) (?:are|is|have|has) (?:under|over|more than|less than|fewer than|below|above) \\d+ hours',
        "(?:who(?:'s| is)?|is any(?:one|body)) (?:close to|near|nearing|approaching|at|over) overtime",
        "(?:show|list|compare|check|give me) (?:me )?(?:the )?(?:team(?:'s)? |staff )?hours (?:by|per|for each) (?:employee|person|worker|staff member)",
        'hours (?:by|per) (?:employee|person|worker)',
        // "Who is getting too many shifts?", "who's given too few hours?"
        "who(?:'s| is)? (?:being )?(?:given|getting|assigned|scheduled for) too (?:few|many|little|much) (?:shifts|hours)",
      ],
      { before: '^', after: '\\b' },
    ),
    // "Any coverage gaps next week?", "uncovered shifts", "shifts affected by
    // time off". "Which shifts (still) need cover?" stays the attention summary,
    // as the release audit expects.
    coverageGaps: anyOf([
      /^(?:(?:any|are there any|show|list|check|find|what are|where are)\b.*)?\b(?:coverage gaps?|gaps in (?:the )?(?:schedule|coverage)|uncovered shifts?|unfilled shifts?|shifts? (?:still )?without cover(?:age)?)\b/,
      /^(?:which|what) shifts? (?:are|is) (?:affected by|clashing with|blocked by) time[ -]off\b/,
    ]),
    // "What happened with Saturday's closing shift?"
    shiftHistory:
      /^(?:what happened (?:with|to)|(?:show|give me|check|what(?:'s| is)) (?:me )?(?:the )?history (?:of|for)|history (?:of|for))\b.*\bshifts?\b/,
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

// CS-068: changes the chat prepares for review on an existing page. Checked
// before shift edits and new-shift drafts.
export const managerDraftPatterns = {
  // "Add 'restock fridge' to Friday's opening shift", "add a duty to restock
  // the fridge on Jamie's Friday shift", "put cleaning on the closing shift's task list"
  shiftDuties: anyOf([
    /^(?:add|put|include)\s+(?:a |an |the |another |new )*(?:duty|duties|task|tasks|to-?do)\b.*\bshifts?\b/,
    /^(?:add|put|include)\s+["“'‘][^"”'’]+["”'’]\s+(?:as (?:a |an )?(?:duty|task) )?(?:to|on|for|onto)\b.*\bshifts?\b/,
    /^(?:add|put|include)\b.*\b(?:to|on|onto) (?:the )?(?:[\p{L}'’ ]+ )?shift(?:'s)? (?:duties|duty list|tasks|task list|to-?do list)\b/u,
  ]),
  // "Copy this week's schedule to next week", "duplicate last week into this week"
  copyWeek:
    /^(?:copy|duplicate|repeat|clone|roll over|carry over|reuse)\b.*\b(?:this|last|next|previous|current) week\b(?:.*\b(?:to|into|onto|for|as)\b.*\bweek\b)?/,
  // "Add Sam Rivera as an employee", "onboard Dana Kim", "add a new worker
  // called Priya Shah". Never a shift: "add Sam to the Friday shift" is a draft.
  addEmployee: anyOf(
    [
      /(?:add|onboard|hire|set up|create)\s+(?:an? )?new (?:employee|worker|team member|staff member|hire|starter)\b/,
      /(?:add|onboard|hire|create)\s+(?:an? )?(?:employee|worker|team member|staff member) (?:called|named)\b/,
      /(?:add|onboard|hire|set up)\s+\p{L}[\p{L}'’-]*(?: \p{L}[\p{L}'’-]*){0,2}\s+(?:as (?:an? )?(?:new )?(?:employee|worker|team member|staff member|hire|starter)|to (?:the|my|our) (?:team|roster|staff))\b/,
      /onboard\s+\p{L}/,
    ],
    { before: '^(?!.*\\b(?:shifts?|schedules?|rotas?)\\b)', flags: 'u' },
  ),
};

export function managerDraftRoute(message) {
  for (const [route, pattern] of Object.entries(managerDraftPatterns))
    if (pattern.test(message)) return route;
  return null;
}

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
