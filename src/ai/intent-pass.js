import { createHash, randomBytes } from 'node:crypto';

// A classified chat message has already used one AI allowance reservation.
// The pass lets the very next paid request for the same message skip a second
// reservation. It is single-use, short-lived and bound to the user, the paid
// intent and the exact message text, so it cannot be replayed or reused.
export const PAID_INTENTS = new Set(['draft', 'search', 'availability', 'questions']);

const PASS_LIFETIME_MS = 60_000;
const MAX_PASSES = 1000;
const digest = text => createHash('sha256').update(text).digest('hex');

export function createIntentPasses({ lifetimeMs = PASS_LIFETIME_MS, maxPasses = MAX_PASSES } = {}) {
  const passes = new Map();

  function prune(now) {
    for (const [token, pass] of passes) {
      if (pass.expires <= now) passes.delete(token);
    }
  }

  return {
    issue(userId, intent, description, now) {
      if (!PAID_INTENTS.has(intent)) return null;
      prune(now);
      // One outstanding pass per user: a new classification replaces the old one.
      for (const [token, pass] of passes) {
        if (pass.userId === userId) passes.delete(token);
      }
      if (passes.size >= maxPasses) return null;
      const token = randomBytes(24).toString('base64url');
      passes.set(token, { userId, intent, message: digest(description), expires: now + lifetimeMs });
      return token;
    },

    redeem(token, userId, intent, description, now) {
      if (typeof token !== 'string' || !passes.has(token)) return false;
      const pass = passes.get(token);
      passes.delete(token); // Single use, even when it does not match.
      return pass.expires > now && pass.userId === userId && pass.intent === intent &&
        pass.message === digest(description);
    },
  };
}

// Removes the optional pass from a chat body before strict input validation.
export function takeIntentPass(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || !Object.hasOwn(input, 'intentPass')) {
    return { input, token: null };
  }
  const { intentPass, ...rest } = input;
  return { input: rest, token: intentPass };
}
