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
    if (/^(?:what else(?: is available)?|any other (?:shifts|openings)|(?:(?:show|find|suggest)(?: me)? )?(?:eligible )?alternatives)[.!?]*$/.test(message)) return 'alternatives';
    if (/^(?:why|explain|what (?:blocked|prevented))\b/.test(message) &&
        /\b(?:match(?:ed|ing)?|conflicts?|overlap|coverage|requests?|claim(?:ed)?|pending|shifts?|openings?|approval|eligible|eligibility)\b/.test(message)) return 'explanation';
    if (availabilityRuleCommand(text) ||
        /^(?:(?:show|view|list|open|check) (?:me )?)?(?:my )?(?:saved (?:availability|rules)|availability rules)[.?!]*$/.test(message)) return 'rules';
    if (/\b(?:open shifts?|openings?|coverage shifts?)\b|\b(?:find|look for|search for|pick up)\b.*\bshifts?\b/.test(message)) return 'search';
    if (/\b(?:put|mark|set) me down as available\b|\b(?:save|draft|set|record|confirm)\b.*\bavailability\b|\bavailability (?:rule|draft)\b|\b(?:i can take|i can pick up|limit|maximum)\b.*\bshifts?\b/.test(message)) return 'availability';
    if (/^\s*(?:i (?:can work|am available|'m available)|available on)\b/.test(message) && current !== 'availability') return 'clarification';
  }
  if (/\bwhen i (?:work|am working) next\b|^(?:when|what|which|how many|how long|who|show|list|tell me|am i|do i)\b|\b(?:my|team'?s?) (?:schedule|hours|next shift)\b/.test(message)) return 'questions';
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
