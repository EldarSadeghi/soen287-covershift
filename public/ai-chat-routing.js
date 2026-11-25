export const CHAT_ENDPOINTS = {
  draft: '/api/manager/ai-shift-draft',
  search: '/api/worker/ai-shift-search',
  availability: '/api/worker/ai-availability-draft',
  questions: '/api/ai-schedule-question',
};

export function routeChat(text, manager, current) {
  const message = text.toLowerCase().replace(/[’‘]/g, "'");
  if (manager && /\b(?:draft|create|add|assign|make)\b.*\bshift\b|^(?:draft|create|assign|schedule)\b/.test(message)) return 'draft';
  if (!manager) {
    if (availabilityRuleCommand(text) ||
        /^(?:(?:show|view|list|open|check) (?:me )?)?(?:my )?(?:saved (?:availability|rules)|availability rules)[.?!]*$/.test(message)) return 'rules';
    if (/\b(?:open shifts?|openings?|coverage shifts?)\b|\b(?:find|look for|search for|pick up)\b.*\bshifts?\b/.test(message)) return 'search';
    if (/\b(?:save|draft|set|record|confirm)\b.*\bavailability\b|\bavailability (?:rule|draft)\b|\b(?:i can take|i can pick up|limit|maximum)\b.*\bshifts?\b/.test(message)) return 'availability';
    if (/^\s*(?:i (?:can work|am available|'m available)|available on)\b/.test(message) && current !== 'availability') return 'clarification';
  }
  if (/^(?:when|what|which|how many|how long|who|show|list|tell me|am i|do i)\b|\b(?:my|team'?s?) (?:schedule|hours|next shift)\b/.test(message)) return 'questions';
  return current && current !== 'clarification' && current !== 'rules' ? current : 'clarification';
}

export function availabilityRuleCommand(text) {
  const match = /^(?:please\s+)?(pause|resume|cancel)\s+(.+?)[.!?]*$/i.exec(text.trim());
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
