export const CHAT_ENDPOINTS = {
  draft: '/api/manager/ai-shift-draft',
  search: '/api/worker/ai-shift-search',
  availability: '/api/worker/ai-availability-draft',
  questions: '/api/ai-schedule-question',
};

const normalizedMessage = (text) =>
  text
    .trim()
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/^(?:(?:please[,\s]+)|(?:(?:could|would|can) you\s+))+/, '');

export const MIXED_INTENT_QUESTION = 'Which should I handle first:';

const taskLabels = {
  draft: 'draft a shift',
  search: 'find open shifts',
  availability: 'draft availability',
  questions: 'check the schedule',
  summary: 'show a working-week summary',
  coworkers: 'check coworker availability',
  claimStatus: 'check a claim status',
  coverStatus: 'check a cover request',
  timeOffStatus: 'check a time-off request',
  alternatives: 'find alternatives',
  explanation: 'explain a match or request',
  rules: 'check saved rules',
};

const patterns = {
  negation: {
    command: /^(?:do not|don't|never)\b/,
  },
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
  summary: {
    lead: /^(?:show|list|summari[sz]e|give me|what|which|do i|did my|is anyone|pending approvals|how many|check|(?:my |team )?(?:working week|attention summary|weekly summary))\b/,
    manager:
      /\b(?:attention summary|what needs (?:my )?attention|weekly summary|pending approvals|claims awaiting approval|waiting for my approval|needs? cover|unresolved coverage|open (?:coverage|requests for cover))\b/,
    employee:
      /\b(?:working week|weekly summary|upcoming work|my coverage (?:decisions|requests|status)|my pending (?:coverage )?(?:requests|claims)|coverage decisions)\b/,
  },
  draft: {
    command:
      /\b(?:draft|create|add|assign|make|set up|put together)\b.*\bshifts?\b|^(?:draft|create|assign|schedule)\b/,
  },
  coworkers: {
    people: /\b(?:co[ -]?workers?|colleagues?|teammates?)\b/,
    availability:
      /\b(?:available|availability|availbility|free|can work|could work)\b/,
    question:
      /(?:^who(?:'s| is)|^is (?:anyone|anybody|someone|somebody)) (?:free|available)\b|^who (?:can|could) (?:cover|fill in)\b|^(?:can|could) (?:anyone|somebody|someone|any (?:co[ -]?worker|teammate)) cover\b/,
  },
  alternatives: {
    question:
      /^(?:what else(?: is available)?|(?:any|what) other (?:shifts|openings)|(?:(?:show|find|suggest)(?: me)? )?(?:eligible )?alternatives)[.!?]*$/,
  },
  explanation: {
    referenceLead: /^(?:why|how come|explain)\b/,
    reasonLead: /^(?:why|how come|explain|what (?:blocked|prevented))\b/,
    subject:
      /\b(?:match(?:ed|ing)?|conflicts?|overlap|coverage|requests?|claim(?:ed)?|pending|shifts?|openings?|approval|eligible|eligibility)\b/,
  },
  rules: {
    view: /^(?:(?:show|view|list|open|check) (?:me )?)?(?:my )?(?:saved (?:availability(?: rules?)?|rules)|availability rules)[.?!]*$/,
  },
  availability: {
    statement: /^i can (?:take|pick up)\b.*\bshifts?\b/,
    request:
      /\b(?:put|mark|set) me down as available\b|\b(?:save|draft|set|record|confirm)\b.*\bavailability\b|\bavailability (?:rule|draft)\b|\b(?:i can take|i can pick up|limit|maximum)\b.*\bshifts?\b/,
  },
  search: {
    request:
      /^anything (?:i can|to) pick up\b|\b(?:open shifts?|openings?|unfilled shifts?|unclaimed shifts?|coverage shifts?)\b|\b(?:find|look for|search for|pick up)\b.*\bshifts?\b/,
  },
  questions: {
    employeeLead:
      /^(?:when am i on next|what time do i start (?:today|tomorrow))\b/,
    lead: /^(?:when|what|which|how many|how long|who|show|list|tell me|am i|do i|give me|pull up|check|remind me)\b/,
    subject:
      /\b(?:schedules?|roster|rota|shifts?|hours|working|work|come in|clock in|on duty|on the rota)\b/,
    possessive: /\b(?:my|team'?s?) (?:schedule|hours|next shift)\b/,
  },
};

function explicitRoute(text, manager) {
  const message = normalizedMessage(text);
  if (patterns.negation.command.test(message)) return null;
  if (
    !manager &&
    patterns.timeOffStatus.lead.test(message) &&
    patterns.timeOffStatus.subject.test(message) &&
    patterns.timeOffStatus.decision.test(message)
  )
    return 'timeOffStatus';
  if (
    !manager &&
    patterns.coverStatus.lead.test(message) &&
    patterns.coverStatus.subject.test(message) &&
    patterns.coverStatus.decision.test(message)
  )
    return 'coverStatus';
  if (
    !manager &&
    patterns.claimStatus.lead.test(message) &&
    patterns.claimStatus.subject.test(message) &&
    patterns.claimStatus.decision.test(message)
  )
    return 'claimStatus';
  if (patterns.summary.lead.test(message)) {
    const summary = manager
      ? patterns.summary.manager
      : patterns.summary.employee;
    if (summary.test(message)) return 'summary';
  }
  if (manager && requestsShiftBatch(message)) return 'draft';
  if (manager && patterns.draft.command.test(message)) return 'draft';
  if (!manager) {
    if (
      (patterns.coworkers.people.test(message) &&
        patterns.coworkers.availability.test(message)) ||
      patterns.coworkers.question.test(message)
    )
      return 'coworkers';
    if (patterns.alternatives.question.test(message)) return 'alternatives';
    if (
      patterns.explanation.referenceLead.test(message) &&
      openingReference(message, [], null) === null
    )
      return 'explanation';
    if (
      patterns.explanation.reasonLead.test(message) &&
      patterns.explanation.subject.test(message)
    )
      return 'explanation';
    if (availabilityRuleCommand(text) || patterns.rules.view.test(message))
      return 'rules';
    // "I can pick up up to 2 shifts on Saturday" states availability, even though
    // it also contains the search phrase "pick up ... shifts".
    if (patterns.availability.statement.test(message)) return 'availability';
    if (patterns.search.request.test(message)) return 'search';
    if (patterns.availability.request.test(message)) return 'availability';
  }
  if (!manager && patterns.questions.employeeLead.test(message))
    return 'questions';
  if (
    (patterns.questions.lead.test(message) &&
      patterns.questions.subject.test(message)) ||
    patterns.questions.possessive.test(message)
  )
    return 'questions';
  return null;
}

// Splits a message into the separate requests it contains.
function chatRequests(text) {
  // Keep quoted shift or rule names intact, even if they contain a conjunction.
  const clauses = text.split(
    /("[^"]*"|“[^”]*”|[!?;]+|\n+|\.(?=\s+[a-z])(?<![ap]\.m\.)|\band(?: then| also)?\b|\bthen\b)/i,
  );
  const requests = [''];
  for (const part of clauses) {
    if (/^(?:[.!?;]+|\n+|and(?: then| also)?|then)$/i.test(part))
      requests.push('');
    else requests[requests.length - 1] += part;
  }
  return requests
    .map((request) => request.trim().replace(/^also\s+/i, ''))
    .filter(Boolean);
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

// Commands the chat cannot carry out: approvals, deletions, account changes,
// instruction overrides. A message containing one is never routed to a task,
// even if another part of it would be ("create a shift and approve Sam's claim").
const UNSUPPORTED_ACTION =
  /^(?:ignore\b.*\b(?:instructions?|rules|prompt)\b|(?:approve|reject|decline|delete|fire|publish|send|swap)\b|assign me\b|clock me (?:in|out)\b|cancel my shift\b|request (?:time[ -]off|leave)\b|make \w+ (?:a |an )?(?:manager|admin)\b|give me admin\b)/;

export const UNSUPPORTED_ACTION_MESSAGE =
  'I can’t approve, assign, delete, send or change records from chat. Use the workspace pages for that, or ask me to check the schedule, find open shifts or prepare a draft for you to review.';

export function requestsUnsupportedAction(text) {
  return chatRequests(text).some((request) =>
    UNSUPPORTED_ACTION.test(normalizedMessage(request)),
  );
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

const requestStatusTopics = new Set([
  'claimStatus',
  'coverStatus',
  'timeOffStatus',
]);
const followUpPrefix = '(?:(?:what|how) about |and )?(?:on |for )?';
const followUpWeekday =
  '(?:this )?(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)';
const followUpMonth =
  '(?:january|february|march|april|may|june|july|august|september|october|november|december)';
const followUpMonthDay =
  '(?:[0-9]{1,2}(?:st|nd|rd|th)?|first|second|third)(?:,? 20[0-9]{2})?';
const statusFollowUpDate = new RegExp(
  `^${followUpPrefix}(?:today|tomorrow|${followUpWeekday}|20[0-9]{2}-[0-9]{2}-[0-9]{2}|${followUpMonth} ${followUpMonthDay})[.!?]*$`,
);

export function isStatusDateFollowUp(text) {
  return statusFollowUpDate.test(normalizedMessage(text));
}

export function routeChat(text, manager, current) {
  if (requestsUnsupportedAction(text) || mixedRoutes(text, manager).length > 1)
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
  const editable = manager
    ? current === 'draft'
    : ['search', 'availability'].includes(current);
  if (
    editable &&
    /^(?:only|just|instead|actually|move|change|make it|rename|remove|leave it|extend|shorten|start|end|from|until|after|before|all day|noon|midnight|today|tomorrow|(?:mon|tues|wednes|thurs|fri|satur|sun)day|\d+)/i.test(
      message,
    )
  )
    return current;
  return 'clarification';
}

export function workingSummaryWeek(text) {
  const message = normalizedMessage(text);
  const weeks = [...message.matchAll(/\b(this|next) week\b/g)].map(
    (match) => match[1],
  );
  if (
    new Set(weeks).size > 1 ||
    /\b(?:today|tomorrow|yesterday|weekend|(?:last|previous) week|(?:this|next|last) month|monday|tuesday|wednesday|thursday|friday|saturday|sunday|january|february|march|april|may|june|july|august|september|october|november|december)\b|\d{1,4}[-/]\d|\b(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|several) (?:days?|weeks?|months?)\b/.test(
      message,
    )
  )
    return null;
  return weeks[0] || 'this';
}

export function chatClarification(text, manager) {
  if (requestsUnsupportedAction(text)) return UNSUPPORTED_ACTION_MESSAGE;
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
    ? 'What would you like me to check: a shift draft or your team’s schedule?'
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
  const blocked = requestsUnsupportedAction(text);
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
  const answerRoute =
    !manager &&
    previousTopic === 'clarification' &&
    clarificationReplyRoute(text, previous.text);

  const target =
    (batchReply && 'draft') ||
    (explanationReply && 'explanation') ||
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

export function clarificationReplyRoute(text, question) {
  const answer = normalizedMessage(text).replace(/[.?!]+$/, '');
  if (question?.startsWith('Should I find an open shift')) {
    if (
      /^(?:find|search)(?: it| for me| for (?:an? )?open shifts?)?$/.test(
        answer,
      )
    )
      return 'search';
    if (/^(?:save|draft|set)(?: it| (?:my )?availability)?$/.test(answer))
      return 'availability';
  }
  if (
    question?.startsWith('What date and exact time') &&
    /\b(?:today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|20\d{2}-\d{2}-\d{2})\b/.test(
      answer,
    ) &&
    /\b(?:\d{1,2}:\d{2}|\d{1,2}\s*[ap]m|noon|midnight)\b/.test(answer)
  )
    return 'search';
  return null;
}

export function availabilityNeedsHours(text) {
  return (
    /\b(?:put|mark|set) me down as available\b/i.test(text) &&
    !/\b(?:all day|midnight|noon|\d{1,2}:\d{2}|\d{1,2}\s*[ap]\.?m\.?)\b/i.test(
      text,
    )
  );
}

export const OPENING_CLARIFICATION = 'Which opening do you mean?';

export function openingReference(text, visibleIds, selectedId) {
  if (/["“][^"”]+["”]/.test(text)) return undefined;
  const positions = [
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
  const positionPattern = positions.join('|');
  const ordinals = [
    ...text.matchAll(
      new RegExp(
        `\\b(${positionPattern})(?=\\s+(?:shift|opening|one|result|or|and)\\b|[.!?]*$)`,
        'gi',
      ),
    ),
  ];
  const indices = new Set(
    ordinals.map((match) => positions.indexOf(match[1].toLowerCase())),
  );
  if (indices.size > 1) return null;
  if (indices.size === 1) return visibleIds[[...indices][0]] || null;
  if (/\b(?:this|that) (?:shift|opening|one|result|request)\b/i.test(text))
    return selectedId || (visibleIds.length === 1 ? visibleIds[0] : null);
  return undefined;
}

export function availabilityRuleCommand(text) {
  const command = text
    .trim()
    .replace(/^(?:(?:please[,\s]+)|(?:(?:could|would|can) you\s+))+/i, '');
  const match = /^(pause|resume|cancel)\s+(.+?)[.!?]*$/i.exec(command);
  if (!match) return null;
  const [, action, target] = match;
  if (!/\b(?:rule|availability)\b/i.test(target)) return null;
  const selector = target
    .replace(
      /^(?:(?:the|my|saved|availability|rule|for|on|titled|named)\b\s*)+/i,
      '',
    )
    .replace(
      /\s+(?:saved availability(?: rule)?|availability(?: rule)?|rule)\s*$/i,
      '',
    )
    .trim()
    .replace(/^["“](.*)["”]$/, '$1');
  return { action: action.toLowerCase(), selector };
}

export function matchingAvailabilityRules(rules, selector) {
  const requested = selector.toLocaleLowerCase();
  return rules.filter((rule) => {
    if (!['active', 'paused'].includes(rule.status)) return false;
    if (!requested) return true;
    const date = new Intl.DateTimeFormat('en-CA', {
      timeZone: rule.timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date(rule.startsAt));
    const isoDate = ['year', 'month', 'day']
      .map((field) => date.find((part) => part.type === field).value)
      .join('-');
    const weekday = new Intl.DateTimeFormat('en-US', {
      timeZone: rule.timezone,
      weekday: 'long',
    })
      .format(new Date(rule.startsAt))
      .toLowerCase();
    return (
      requested === isoDate ||
      requested === weekday ||
      requested === rule.title.toLocaleLowerCase()
    );
  });
}

export function coworkerLookupDate(text, today) {
  if (
    /\b(?:this|next|last) week\b|\b(?:next|last) (?:sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i.test(
      text,
    )
  )
    return null;
  const tokens = [
    ...text.matchAll(
      /\b(?:(20\d{2}-\d{2}-\d{2})|(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2}(?:st|nd|rd|th)?|first|second|third)(?:,?\s+(20\d{2}))?|(today|tomorrow)|(this\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday))\b/gi,
    ),
  ];
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

export function coworkersFreeOnDate(data, date) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: data.timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const dayAt = (instant) => {
    const parts = formatter.formatToParts(instant);
    return ['year', 'month', 'day']
      .map((key) => parts.find((part) => part.type === key).value)
      .join('-');
  };
  return data.workers
    .map(({ name, windows }) => ({
      name,
      windows: windows.filter(
        (window) =>
          dayAt(Date.parse(window.startsAt)) <= date &&
          dayAt(Date.parse(window.endsAt) - 1) >= date,
      ),
    }))
    .filter((worker) => worker.windows.length > 0);
}
