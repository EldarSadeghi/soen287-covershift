// Chat routing coordinator. Patterns live in ./routing/ by topic; this file
// decides the order they are checked in and how follow-up replies continue an
// earlier question. Every function other modules import is exported here, so
// importers never depend on the internal layout. Behaviour is locked by
// tests/routing-snapshot.test.js.
import { anyOf, chatRequests, normalizedMessage } from './routing/text.js';
import {
  followUpMonth,
  followUpPrefix,
  isStatusDateFollowUp,
  requestStatusTopics,
  statusRoute,
} from './routing/status.js';
import {
  employeePatterns,
  employeeRequestRoute,
  employeeTaskRoute,
  clarificationReplyRoute,
  OPENING_CLARIFICATION,
} from './routing/employee.js';
import {
  managerChangeRoute,
  managerLookupRoute,
  managerPatterns,
  teamAvailabilityRoute,
} from './routing/manager.js';
import {
  questionsRoute,
  sharedPatterns,
  summaryRoute,
} from './routing/shared.js';
import {
  requestsUnsupportedAction,
  UNSUPPORTED_ACTION_MESSAGE,
} from './routing/unsupported.js';
import { blockedActionHelp, helpRoute } from './routing/help.js';

export { isStatusDateFollowUp } from './routing/status.js';
export {
  availabilityNeedsHours,
  availabilityRuleCommand,
  clarificationReplyRoute,
  coworkersFreeOnDate,
  isDutiesQuestion,
  matchingAvailabilityRules,
  OPENING_CLARIFICATION,
  openingReference,
} from './routing/employee.js';
export { requestsShiftBatch } from './routing/manager.js';
export { workingSummaryWeek } from './routing/shared.js';
export {
  requestsUnsupportedAction,
  UNSUPPORTED_ACTION_MESSAGE,
} from './routing/unsupported.js';
export { coworkerLookupDate, historyPeriod } from './routing/dates.js';
export { HELP_PAGES, helpTopic } from './routing/help.js';

export const CHAT_ENDPOINTS = {
  timeOffDraft: '/api/worker/ai-time-off-draft',
  coverDraft: '/api/worker/ai-cover-draft',
  shiftEdit: '/api/manager/ai-shift-edit',
  draft: '/api/manager/ai-shift-draft',
  search: '/api/worker/ai-shift-search',
  availability: '/api/worker/ai-availability-draft',
  questions: '/api/ai-schedule-question',
};

export const MIXED_INTENT_QUESTION = 'Which should I handle first:';

export const MANAGER_LOOKUPS = [
  'teamAvailability',
  'teamTimeOff',
  'coverageStatus',
  'publicationStatus',
  'teamHours',
  'coverageGaps',
  'shiftHistory',
  'replacements',
];

export const EMPLOYEE_DRAFTS = ['timeOffDraft', 'coverDraft'];

export const EMPLOYEE_LOOKUPS = ['history', 'updates'];

const taskLabels = {
  draft: 'draft a shift',
  shiftEdit: 'prepare a change to an existing shift',
  search: 'find open shifts',
  availability: 'draft availability',
  questions: 'check the schedule',
  summary: 'show a working-week summary',
  teamAvailability: 'check team availability',
  teamTimeOff: 'check team time off',
  coverageStatus: 'check shift coverage',
  publicationStatus: 'check schedule publication',
  teamHours: 'compare team hours',
  coverageGaps: 'find coverage gaps',
  shiftHistory: 'show a shift\u2019s history',
  history: 'check coverage history',
  updates: 'check recent updates',
  coworkers: 'check coworker availability',
  claimStatus: 'check a claim status',
  timeOffDraft: 'prepare a time-off request',
  coverDraft: 'prepare a cover request',
  coverStatus: 'check a cover request',
  timeOffStatus: 'check a time-off request',
  alternatives: 'find alternatives',
  explanation: 'explain a match or request',
  rules: 'check saved rules',
  help: 'answer a question about using CoverShift',
  replacements: 'suggest who could cover a shift',
};

// The route for one request on its own, or null. The order matters where
// wordings overlap, so it is spelled out here step by step.
function explicitRoute(text, manager) {
  const message = normalizedMessage(text);
  if (sharedPatterns.negation.test(message)) return null;
  return (
    // 1. Employee status lookups ("did my claim get approved?").
    (!manager && statusRoute(message)) ||
    // 2. Manager lookups (team time off, coverage, publication).
    (manager && managerLookupRoute(message)) ||
    // 3. Employee drafts, history, updates and duties.
    (!manager && employeeRequestRoute(message, text)) ||
    // 4. Working-week or attention summaries.
    summaryRoute(message, manager) ||
    // 5. Manager edits to existing shifts, then new-shift drafts.
    (manager && managerChangeRoute(message)) ||
    // 6. Manager team availability.
    (manager && teamAvailabilityRoute(message)) ||
    // 7. Employee coworkers, explanations, rules, availability and search.
    (!manager && employeeTaskRoute(message, text)) ||
    // 8. Schedule questions, last of the tasks because their wording is broadest.
    questionsRoute(message, manager) ||
    // 9. Help about CoverShift itself, only for what no task claimed.
    helpRoute(message, manager) ||
    null
  );
}

function mixedRoutes(text, manager) {
  return [
    ...new Set(
      chatRequests(text)
        .map((request) => explicitRoute(request, manager))
        .filter(Boolean),
    ),
  ];
}

// A short reply that edits the draft or search in progress.
const draftEdit = anyOf(
  [
    'only',
    'just',
    'instead',
    'actually',
    'move',
    'change',
    'make it',
    'rename',
    'remove',
    'leave it',
    'extend',
    'shorten',
    'start',
    'end',
    'from',
    'until',
    'after',
    'before',
    'all day',
    'noon',
    'midnight',
    'today',
    'tomorrow',
    '(?:mon|tues|wednes|thurs|fri|satur|sun)day',
    '\\d+',
  ],
  { before: '^', flags: 'i' },
);

export function routeChat(text, manager, current) {
  if (
    requestsUnsupportedAction(text, manager) ||
    mixedRoutes(text, manager).length > 1
  )
    return 'clarification';
  const route = explicitRoute(text, manager);
  if (route) return route;
  const message = normalizedMessage(text);
  if (
    !manager &&
    /^(?:i (?:can work|am available|'m available)|available on)\b/.test(message)
  ) {
    return current === 'availability' ? current : 'clarification';
  }
  if (
    !manager &&
    requestStatusTopics.has(current) &&
    isStatusDateFollowUp(message)
  )
    return current;
  if (
    current === 'summary' &&
    /^(?:(?:what|how) about )?(?:this|next) week[.!?]*$/.test(message)
  )
    return 'summary';
  if (
    manager &&
    current === 'shiftEdit' &&
    managerPatterns.shiftEdit.followUp.test(message)
  )
    return current;
  if (
    !manager &&
    EMPLOYEE_DRAFTS.includes(current) &&
    employeePatterns.drafts.correction.test(message)
  )
    return current;
  const editable = manager
    ? current === 'draft'
    : ['search', 'availability'].includes(current);
  if (editable && draftEdit.test(message)) return current;
  return 'clarification';
}

// Managers have no open-shift search; point them to coverage and availability.
const managerOpenShifts =
  /^(?:find|show|list|search for|look for|any|are there any)\b[^.!?]*\b(?:open shifts?|openings?)\b/;
export const MANAGER_OPEN_SHIFTS_MESSAGE =
  'Open-shift search is for employees. I can show which shifts still need cover (“which shifts need cover this week?”) or check team availability for a date.';

/**
 * For a message with a command chat never carries out: the specific reply and
 * page to use instead ({ message, page }), or null if none fits (instruction
 * overrides, role changes); the generic unsupported message is used then.
 */
export function blockedActionAnswer(text, manager) {
  const request = chatRequests(text).find((part) =>
    requestsUnsupportedAction(part, manager),
  );
  return request ? blockedActionHelp(request, manager) : null;
}

export function chatClarification(text, manager) {
  if (requestsUnsupportedAction(text, manager))
    return (
      blockedActionAnswer(text, manager)?.message ?? UNSUPPORTED_ACTION_MESSAGE
    );
  if (manager && managerOpenShifts.test(normalizedMessage(text)))
    return MANAGER_OPEN_SHIFTS_MESSAGE;
  const routes = mixedRoutes(text, manager);
  if (routes.length > 1) {
    const choices = routes.map((route) => taskLabels[route]).join(' or ');
    return `${MIXED_INTENT_QUESTION} ${choices}? Send that request on its own with the details you want me to use.`;
  }
  if (
    !manager &&
    /\b(?:can work|am available|['’]m available|available on)\b/i.test(text)
  ) {
    return 'Should I find an open shift for that time, or draft availability for automatic coverage requests?';
  }
  if (!manager && /\b(?:after|before) lunch\b/i.test(text)) {
    return 'What date and exact time should I use to look for open shifts?';
  }
  return manager
    ? 'What would you like me to check: a shift draft, your team’s schedule, or team availability?'
    : 'What would you like me to check: your schedule, an open shift, or a saved availability rule?';
}

/**
 * Decides where a chat message goes, given the router's answer and what the
 * assistant asked last (a pending batch, a coworker date, an opening, a status
 * choice or the availability question). An unsupported command is checked
 * first: it never continues a follow-up, so it can never reach a task.
 * Returns { target, statusLookup, choice } for the chat composer.
 */
export function resolveChatTarget({
  text,
  manager,
  routed,
  previous = null,
  batchClarifying = false,
  hasSelectedOpening = () => false,
  statusTopics = [],
  choiceReply = null,
}) {
  const previousTopic = previous?.topic;
  const blocked = requestsUnsupportedAction(text, manager);
  // A plain reply is neither an unsupported command nor a mixed request.
  const plainReply = (isManager) =>
    !blocked &&
    !chatClarification(text, isManager).startsWith(MIXED_INTENT_QUESTION);
  const unroutedForEmployee = routeChat(text, false, null) === 'clarification';

  const choice =
    choiceReply && unroutedForEmployee && plainReply(false)
      ? choiceReply(text)
      : undefined;
  if (choice !== undefined)
    return { target: previousTopic, statusLookup: true, choice };
  if (statusTopics.includes(routed))
    return { target: routed, statusLookup: true, choice };
  if (blocked) return { target: 'clarification', statusLookup: false, choice };

  const unrouted = routed === 'clarification';
  const batchReply = manager && batchClarifying && unrouted && plainReply(true);
  const explanationReply =
    !manager &&
    previousTopic === 'explanation' &&
    unrouted &&
    ((previous.text.startsWith(OPENING_CLARIFICATION) && plainReply(false)) ||
      (/^why not[.!?]*$/i.test(text) && hasSelectedOpening()));
  const coworkerDateReply =
    !manager &&
    previousTopic === 'coworkers' &&
    /^Which date/.test(previous.text) &&
    unroutedForEmployee &&
    plainReply(false);
  const employeeDraftReply =
    !manager &&
    EMPLOYEE_DRAFTS.includes(previousTopic) &&
    unroutedForEmployee &&
    /^(?:Which|What|Full day)\b/.test(previous.text) &&
    plainReply(false) &&
    (isStatusDateFollowUp(text) ||
      (/^Full day/i.test(previous.text) &&
        employeePatterns.drafts.correction.test(normalizedMessage(text))) ||
      (/^(?:Which shift|What time)/i.test(previous.text) &&
        /^[\p{L}\p{N}][\p{L}\p{N} :'-]{0,79}[.!?]?$/u.test(text.trim())) ||
      (/^Which coworker/i.test(previous.text) &&
        /^[\p{L}][\p{L}'-]*(?: [\p{L}][\p{L}'-]*){0,3}$/u.test(text.trim())));
  const historyPeriodReply = new RegExp(
    `^${followUpPrefix}(?:last month|last 30 days|this year|${followUpMonth}(?: 20[0-9]{2})?)[.!?]*$`,
  );
  const historyReply =
    !manager &&
    previousTopic === 'history' &&
    unroutedForEmployee &&
    previous.text.startsWith('Which period') &&
    plainReply(false) &&
    (historyPeriodReply.test(normalizedMessage(text)) ||
      isStatusDateFollowUp(text));
  const editReply =
    manager &&
    previousTopic === 'shiftEdit' &&
    unrouted &&
    /^(?:Which|What)\b/.test(previous.text) &&
    plainReply(true) &&
    (/^[\p{L}][\p{L}'-]*(?: [\p{L}][\p{L}'-]*){0,3}[.!?]*$/u.test(
      normalizedMessage(text),
    ) ||
      isStatusDateFollowUp(text));
  const teamDateReply =
    manager &&
    MANAGER_LOOKUPS.includes(previousTopic) &&
    /^Which date/.test(previous.text) &&
    unrouted &&
    plainReply(true) &&
    text
      .split(/\s+(?:through|to|until)\s+/i)
      .every(
        (part) =>
          (['teamHours', 'coverageGaps', 'shiftHistory'].includes(
            previousTopic,
          ) &&
            /^yesterday[.!?]*$/i.test(part.trim())) ||
          isStatusDateFollowUp(
            part.replace(/\s+(morning|afternoon|evening)(?=[.!?]*$)/i, ''),
          ),
      );
  // "Which shift should I check?" after several shifts matched (CS-066): a
  // short reply naming the shift continues the same lookup.
  const shiftChoiceReply =
    manager &&
    previousTopic === 'replacements' &&
    /^Which shift/.test(previous.text) &&
    unrouted &&
    plainReply(true) &&
    /^[\p{L}\p{N}][\p{L}\p{N} '’.-]{0,59}[.!?]?$/u.test(text.trim());
  const answerRoute =
    !manager &&
    previousTopic === 'clarification' &&
    clarificationReplyRoute(text, previous.text);

  const target =
    (batchReply && 'draft') ||
    (explanationReply && 'explanation') ||
    (employeeDraftReply && previousTopic) ||
    (historyReply && 'history') ||
    (editReply && 'shiftEdit') ||
    (teamDateReply && previousTopic) ||
    (shiftChoiceReply && previousTopic) ||
    (coworkerDateReply && 'coworkers') ||
    answerRoute ||
    routed;
  return { target, statusLookup: false, choice };
}

export const GENERIC_CLARIFICATION_PREFIX = 'What would you like me to check';

// One-click suggestions shown under the generic question. Each one is routed
// by the local rules (no classifier call) and only prepares a reply or draft:
// nothing is saved without the existing review and confirmation.
export function clarificationSuggestions(manager) {
  return manager
    ? [
        ['Team schedule', 'Show the entire team’s schedule this week.'],
        ['Create a shift', 'Help me create a shift.'],
        ['Attention summary', 'Show the attention summary for this week.'],
      ]
    : [
        ['My next shift', 'When is my next shift?'],
        ['Find openings', 'Show open shifts this week.'],
        [
          'Save availability',
          'I can take one shift Thursday between 2 PM and 6 PM.',
        ],
      ];
}

// True when the local rules would answer with the generic "What would you like
// me to check" question, so the server-side intent classifier should be asked.
// Specific clarifications, negated requests and text without words stay local.
// Shared by the chat and `npm run ai:eval` so the evaluation measures real routing.
export function needsIntentFallback(text, manager) {
  return (
    chatClarification(text, manager).startsWith(GENERIC_CLARIFICATION_PREFIX) &&
    !/^(?:do not|don't|never)\b/i.test(text.trim()) &&
    /[a-z]{2}/i.test(text)
  );
}
