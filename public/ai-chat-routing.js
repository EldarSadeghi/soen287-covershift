export const CHAT_ENDPOINTS = {
  draft: '/api/manager/ai-shift-draft',
  search: '/api/worker/ai-shift-search',
  availability: '/api/worker/ai-availability-draft',
  questions: '/api/ai-schedule-question',
};

const normalizedMessage = text => text.trim().toLowerCase().replace(/[’‘]/g, "'")
  .replace(/^(?:(?:please[,\s]+)|(?:(?:could|would|can) you\s+))+/, '');

export function routeChat(text, manager, current) {
  const message = normalizedMessage(text);
  if (manager && /\b(?:draft|create|add|assign|make)\b.*\bshift\b|^(?:draft|create|assign|schedule)\b/.test(message)) return 'draft';
  if (!manager) {
    if (/\b(?:co[ -]?workers?|colleagues?|teammates?)\b/.test(message) &&
        /\b(?:available|availability|free|can work|could work)\b/.test(message) ||
        /^who(?:'s| is) (?:free|available)\b|^who (?:can|could) cover\b|^(?:can|could) (?:anyone|somebody|someone|any (?:co[ -]?worker|teammate)) cover\b/.test(message)) return 'coworkers';
    if (/^(?:what else(?: is available)?|(?:any|what) other (?:shifts|openings)|(?:(?:show|find|suggest)(?: me)? )?(?:eligible )?alternatives)[.!?]*$/.test(message)) return 'alternatives';
    if (/^(?:why|explain|what (?:blocked|prevented))\b/.test(message) &&
        /\b(?:match(?:ed|ing)?|conflicts?|overlap|coverage|requests?|claim(?:ed)?|pending|shifts?|openings?|approval|eligible|eligibility)\b/.test(message)) return 'explanation';
    if (availabilityRuleCommand(text) ||
        /^(?:(?:show|view|list|open|check) (?:me )?)?(?:my )?(?:saved (?:availability|rules)|availability rules)[.?!]*$/.test(message)) return 'rules';
    if (/\b(?:open shifts?|openings?|coverage shifts?)\b|\b(?:find|look for|search for|pick up)\b.*\bshifts?\b/.test(message)) return 'search';
    if (/\b(?:put|mark|set) me down as available\b|\b(?:save|draft|set|record|confirm)\b.*\bavailability\b|\bavailability (?:rule|draft)\b|\b(?:i can take|i can pick up|limit|maximum)\b.*\bshifts?\b/.test(message)) return 'availability';
    if (/^\s*(?:i (?:can work|am available|'m available)|available on)\b/.test(message) && current !== 'availability') return 'clarification';
  }
  if (/\bwhen i (?:work|am working) next|^when'?s my next (?:shift|day at work)|^when do i (?:work|come in) next\b|^(?:when|what|which|how many|how long|who|show|list|tell me|am i|do i)\b|\b(?:my|team'?s?) (?:schedule|hours|next shift)\b/.test(message)) return 'questions';
  return current && current !== 'clarification' && current !== 'rules' ? current : 'clarification';
}

export function chatClarification(text, manager) {
  if (!manager && /\b(?:can work|am available|['’]m available|available on)\b/i.test(text)) {
    return 'Should I find an open shift for that time, or draft availability for automatic coverage requests?';
  }
  if (!manager && /\b(?:after|before) lunch\b/i.test(text)) {
    return 'What date and exact time should I use to look for open shifts?';
  }
  return manager ? 'What would you like me to check: a shift draft or your team’s schedule?' :
    'What would you like me to check: your schedule, an open shift, or a saved availability rule?';
}

export function clarificationReplyRoute(text, question) {
  const answer = normalizedMessage(text).replace(/[.?!]+$/, '');
  if (question?.startsWith('Should I find an open shift')) {
    if (/^(?:find|search)(?: it| for me)?$/.test(answer)) return 'search';
    if (/^(?:save|draft|set)(?: it| availability)?$/.test(answer)) return 'availability';
  }
  if (question?.startsWith('What date and exact time') &&
      /\b(?:today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|20\d{2}-\d{2}-\d{2})\b/.test(answer) &&
      /\b(?:\d{1,2}:\d{2}|\d{1,2}\s*[ap]m|noon|midnight)\b/.test(answer)) return 'search';
  return null;
}

export function availabilityNeedsHours(text) {
  return /\b(?:put|mark|set) me down as available\b/i.test(text) &&
    !/\b(?:all day|midnight|noon|\d{1,2}:\d{2}|\d{1,2}\s*[ap]\.?m\.?)\b/i.test(text);
}

export function openingReference(text, visibleIds, selectedId) {
  if (/["“][^"”]+["”]/.test(text)) return undefined;
  const ordinal = /\b(?:the )?(first|second|third|fourth|fifth) (?:shift|opening|one|result)\b/i.exec(text);
  if (ordinal) return visibleIds[['first', 'second', 'third', 'fourth', 'fifth'].indexOf(ordinal[1].toLowerCase())] || null;
  if (/\b(?:this|that) (?:shift|opening|one|result|request)\b/i.test(text)) return selectedId || (visibleIds.length === 1 ? visibleIds[0] : null);
  return undefined;
}

export function availabilityRuleCommand(text) {
  const command = text.trim().replace(/^(?:(?:please[,\s]+)|(?:(?:could|would|can) you\s+))+/i, '');
  const match = /^(pause|resume|cancel)\s+(.+?)[.!?]*$/i.exec(command);
  if (!match) return null;
  const [, action, target] = match;
  if (!/\b(?:rule|availability)\b/i.test(target)) return null;
  const selector = target.replace(/^(?:(?:the|my|saved|availability|rule|for|on|titled|named)\b\s*)+/i, '')
    .replace(/\s+(?:saved availability(?: rule)?|availability(?: rule)?|rule)\s*$/i, '')
    .trim().replace(/^["“](.*)["”]$/, '$1');
  return { action: action.toLowerCase(), selector };
}

export function matchingAvailabilityRules(rules, selector) {
  const requested = selector.toLocaleLowerCase();
  return rules.filter(rule => {
    if (!['active', 'paused'].includes(rule.status)) return false;
    if (!requested) return true;
    const date = new Intl.DateTimeFormat('en-CA', {
      timeZone: rule.timezone, year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(new Date(rule.startsAt));
    const isoDate = ['year', 'month', 'day'].map(field => date.find(part => part.type === field).value).join('-');
    const weekday = new Intl.DateTimeFormat('en-US', {
      timeZone: rule.timezone, weekday: 'long',
    }).format(new Date(rule.startsAt)).toLowerCase();
    return requested === isoDate || requested === weekday || requested === rule.title.toLocaleLowerCase();
  });
}

export function coworkerLookupDate(text, today) {
  const iso = /\b(20\d{2}-\d{2}-\d{2})\b/.exec(text);
  const named = /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2}(?:st|nd|rd|th)?|first|second|third)(?:,?\s+(20\d{2}))?\b/i.exec(text);
  let date = iso?.[1];
  if (!date && named) {
    const month = new Date(`${named[1]} 1, 2000 UTC`).getUTCMonth() + 1;
    const day = { first: 1, second: 2, third: 3 }[named[2].toLowerCase()] || Number.parseInt(named[2], 10);
    const suffix = `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const year = Number(today.slice(0, 4));
    date = named[3] ? `${named[3]}-${suffix}` : `${year + Number(suffix < today.slice(5))}-${suffix}`;
  }
  if (!date && /\btoday\b/i.test(text)) date = today;
  if (!date && /\btomorrow\b/i.test(text)) {
    const following = new Date(`${today}T12:00:00Z`);
    following.setUTCDate(following.getUTCDate() + 1);
    date = following.toISOString().slice(0, 10);
  }
  if (!date) {
    const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const tokens = text.toLowerCase().match(/\b(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/g) || [];
    if (tokens.length !== 1 || /\b(?:this|next) week\b/i.test(text)) return null;
    const following = new Date(`${today}T12:00:00Z`);
    const offset = (weekdays.indexOf(tokens[0]) - following.getUTCDay() + 7) % 7 || 7;
    following.setUTCDate(following.getUTCDate() + offset);
    date = following.toISOString().slice(0, 10);
  }
  const instant = new Date(`${date}T00:00:00Z`);
  return Number.isFinite(instant.getTime()) && instant.toISOString().slice(0, 10) === date ? date : null;
}

export function coworkersFreeOnDate(data, date) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: data.timezone, year: 'numeric', month: '2-digit', day: '2-digit',
  });
  const dayAt = instant => {
    const parts = formatter.formatToParts(instant);
    return ['year', 'month', 'day'].map(key => parts.find(part => part.type === key).value).join('-');
  };
  return data.workers.map(({ name, windows }) => ({
    name,
    windows: windows.filter(window => dayAt(Date.parse(window.startsAt)) <= date &&
      dayAt(Date.parse(window.endsAt) - 1) >= date),
  })).filter(worker => worker.windows.length > 0);
}
