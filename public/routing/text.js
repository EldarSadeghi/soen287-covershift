// Shared text helpers for chat routing.

// Lower-cases a message, normalises curly apostrophes and removes polite
// openers ("please", "could you") so patterns can match the request itself.
export const normalizedMessage = (text) =>
  text
    .trim()
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/^(?:(?:please[,\s]+)|(?:(?:could|would|can) you\s+))+/, '');

/**
 * Builds one regular expression from named alternatives, so a long pattern can
 * be written as short, commented parts. Equivalent to
 * `${before}(?:part1|part2|...)${after}` with the given flags.
 */
export function anyOf(parts, { before = '', after = '', flags = '' } = {}) {
  const sources = parts.map((part) =>
    part instanceof RegExp ? part.source : part,
  );
  return new RegExp(`${before}(?:${sources.join('|')})${after}`, flags);
}

// Splits a message into the separate requests it contains.
export function chatRequests(text) {
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

export const WEEKDAYS =
  'monday|tuesday|wednesday|thursday|friday|saturday|sunday';
export const MONTHS =
  'january|february|march|april|may|june|july|august|september|october|november|december';
