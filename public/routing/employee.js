// Employee routes: drafts, lookups, coworkers, explanations, saved rules,
// availability and open-shift search, plus the helpers their follow-ups use.
import { anyOf, normalizedMessage, WEEKDAYS } from './text.js';

const pickedUpOrGivenAway = '(?:pick(?:ed)? up|giv(?:e|en) away)';

export const employeePatterns = {
  lookups: {
    // "Which shifts did I pick up…", "show my coverage history", ...
    history: anyOf(
      [
        `which shifts (?:did|have) i ${pickedUpOrGivenAway}`,
        `how many (?:shifts|claims) (?:did|have) i ${pickedUpOrGivenAway}`,
        /(?:show|list|check) (?:me )?(?:my )?coverage history/,
        // Only with a period, so "what happened with my coverage requests?"
        // without one stays a cover-status question.
        /what happened (?:with|to) my coverage requests?(?=.*\b(?:last|this|in|during|between)\b)/,
      ],
      { before: '^', after: '\\b' },
    ),
    updates:
      /^(?:(?:any|show (?:me )?(?:my )?|check (?:my )?)\s*(?:new |recent )?updates(?: for me)?|what(?:'s| is) new(?: for me)?|did anything change(?: for me)?)[.!?]*$/,
    // "What are my duties today?", "what do I have to do on Friday's shift?"
    duties: anyOf(
      [
        /(?:what(?:'s| are| is)|show|list|tell me)\b.*\b(?:my|shift) (?:duties|tasks)\b/,
        // "what do I have to do" / "what tasks do I have", plus a shift or day.
        `(?:what (?:do i have|am i supposed|do i need) to do|what (?:tasks|duties) (?:do i have|are assigned to me))\\b.*\\b(?:shift|today|tomorrow|${WEEKDAYS})\\b`,
      ],
      { before: '^' },
    ),
  },
  drafts: {
    timeOffDraft:
      /^(?:request (?:time[ -]off|leave)\b|(?:i (?:need|want|would like)(?: to take)?|can i take|could i take|i'd like)\b[^.!?]*\boff\b)/,
    coverDraft:
      /^(?:swap my shift\b|request cover (?:for|on) my\b|ask .+ to cover my\b|(?:can|could|would) .+ (?:take|cover) my\b)/,
    // Short corrections to a pending draft ("actually Thursday", "3 pm").
    correction:
      /^(?:actually|instead|make it|add .* too|full day|all day|from|until|\d{1,2}(?::\d{2})?\s*[ap]m)\b/,
  },
  coworkers: {
    people: /\b(?:co[ -]?workers?|colleagues?|teammates?)\b/,
    availability:
      /\b(?:available|availability|availbility|free|can work|could work)\b/,
    question: anyOf([
      /(?:^who(?:'s| is)|^is (?:anyone|anybody|someone|somebody)) (?:free|available)\b/,
      /^who (?:can|could) (?:cover|fill in)\b/,
      /^(?:can|could) (?:anyone|somebody|someone|any (?:co[ -]?worker|teammate)) cover\b/,
    ]),
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
    // "I can pick up up to 2 shifts on Saturday" states availability, even
    // though it also contains the search phrase "pick up ... shifts".
    statement: /^i can (?:take|pick up)\b.*\bshifts?\b/,
    request:
      /\b(?:put|mark|set) me down as available\b|\b(?:save|draft|set|record|confirm)\b.*\bavailability\b|\bavailability (?:rule|draft)\b|\b(?:i can take|i can pick up|limit|maximum)\b.*\bshifts?\b/,
  },
  search: {
    request:
      /^anything (?:i can|to) pick up\b|\b(?:open shifts?|openings?|unfilled shifts?|unclaimed shifts?|coverage shifts?)\b|\b(?:find|look for|search for|pick up)\b.*\bshifts?\b/,
  },
};

export function isDutiesQuestion(text) {
  return employeePatterns.lookups.duties.test(normalizedMessage(text));
}

// Requests checked before summaries: drafts, history, updates and duties.
export function employeeRequestRoute(message, text) {
  const { drafts, lookups } = employeePatterns;
  if (drafts.timeOffDraft.test(message)) return 'timeOffDraft';
  if (drafts.coverDraft.test(message)) return 'coverDraft';
  if (lookups.history.test(message)) return 'history';
  if (lookups.updates.test(message)) return 'updates';
  if (isDutiesQuestion(text)) return 'questions';
  return null;
}

// Tasks checked after manager-only routes, in this order.
export function employeeTaskRoute(message, text) {
  const { coworkers, alternatives, explanation, rules, availability, search } =
    employeePatterns;
  if (
    (coworkers.people.test(message) && coworkers.availability.test(message)) ||
    coworkers.question.test(message)
  )
    return 'coworkers';
  if (alternatives.question.test(message)) return 'alternatives';
  if (
    explanation.referenceLead.test(message) &&
    openingReference(message, [], null) === null
  )
    return 'explanation';
  if (explanation.reasonLead.test(message) && explanation.subject.test(message))
    return 'explanation';
  if (availabilityRuleCommand(text) || rules.view.test(message)) return 'rules';
  if (availability.statement.test(message)) return 'availability';
  if (search.request.test(message)) return 'search';
  if (availability.request.test(message)) return 'availability';
  return null;
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
