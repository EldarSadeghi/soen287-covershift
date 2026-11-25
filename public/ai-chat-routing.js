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
    if (/^(?:show|view|list|open|check) (?:me )?(?:my )?saved (?:availability|rules)\b/.test(message)) return 'rules';
    if (/\b(?:open shifts?|openings?|coverage shifts?)\b|\b(?:find|look for|search for|pick up)\b.*\bshifts?\b/.test(message)) return 'search';
    if (/\b(?:save|draft|set|record|confirm)\b.*\bavailability\b|\bavailability (?:rule|draft)\b|\b(?:i can take|i can pick up|limit|maximum)\b.*\bshifts?\b/.test(message)) return 'availability';
    if (/^\s*(?:i (?:can work|am available|'m available)|available on)\b/.test(message) && current !== 'availability') return 'clarification';
  }
  if (/^(?:when|what|which|how many|how long|who|show|list|tell me|am i|do i)\b|\b(?:my|team'?s?) (?:schedule|hours|next shift)\b/.test(message)) return 'questions';
  return current && current !== 'clarification' && current !== 'rules' ? current : 'clarification';
}
