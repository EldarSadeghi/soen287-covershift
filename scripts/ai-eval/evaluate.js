// Routing evaluation shared by `npm run ai:eval` and its tests. It reproduces
// the chat's first-message routing: the local rules first, then the intent
// classifier only when the chat would otherwise ask its generic question.
import { GENERIC_CLARIFICATION_PREFIX, chatClarification, needsIntentFallback, routeChat } from '../../public/ai-chat-routing.js';
import { allowedIntents } from '../../src/ai/intent.js';

// Routes the browser reaches without the classifier (local rules only).
const LOCAL_ONLY = { employee: ['explanation', 'rules', 'alternatives'], manager: [] };
// A wrong route into one of these can lead to a saved change after confirmation.
export const WRITE_CAPABLE = new Set(['draft', 'shiftEdit', 'availability', 'search', 'timeOffDraft', 'coverDraft', 'answerInvite', 'cancelCover', 'cancelTimeOff']);
// CS-055: the generic target counts only unhelpful generic replies (the label
// was a real route). A generic question is the right answer to "hello".
export const TARGETS = { accuracy: 0.95, unhelpfulGenericRate: 0.05, writeCapableWrong: 0 };
export const MIN_MESSAGES = 150;
export const MIN_PER_LABEL = 3;

export function labelsFor(role) {
  const appRole = role === 'manager' ? 'manager' : 'worker';
  return new Set([...allowedIntents(appRole), ...LOCAL_ONLY[role]]);
}

// Returns a list of problems; an empty list means the file is usable.
export function validateMessages(data) {
  const problems = [];
  if (!data || data.version !== 1 || !Array.isArray(data.messages)) return ['Expected { version: 1, messages: [...] }.'];
  const ids = new Set();
  const counts = new Map();
  for (const row of data.messages) {
    const where = row?.id || JSON.stringify(row);
    if (!row || typeof row.id !== 'string' || ids.has(row.id)) problems.push(`Missing or duplicate id: ${where}`);
    ids.add(row?.id);
    if (!['employee', 'manager'].includes(row?.role)) { problems.push(`Unknown role: ${where}`); continue; }
    if (!labelsFor(row.role).has(row.expected)) problems.push(`Label ${row.expected} is not a ${row.role} route: ${where}`);
    if (typeof row.message !== 'string' || !row.message.trim() || row.message.length > 1500) problems.push(`Invalid message text: ${where}`);
    if (/@|\b\d{3}[-. ]\d{3}[-. ]\d{4}\b/.test(row.message || '')) problems.push(`Message looks like personal contact data: ${where}`);
    if (Object.hasOwn(row, 'history') && !(Array.isArray(row.history) && row.history.length && row.history.length <= 4 &&
        row.history.every((turn, index) => turn?.role === (index % 2 ? 'assistant' : 'user') && typeof turn.text === 'string' && turn.text.trim()) &&
        row.history.length % 2 === 0 && typeof row.currentTopic === 'string')) problems.push(`Invalid follow-up history: ${where}`);
    const key = `${row.role}:${row.expected}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  if (data.messages.length < MIN_MESSAGES) problems.push(`Only ${data.messages.length} messages; need at least ${MIN_MESSAGES}.`);
  for (const role of ['employee', 'manager']) {
    for (const label of labelsFor(role)) {
      const count = counts.get(`${role}:${label}`) || 0;
      if (count < MIN_PER_LABEL) problems.push(`${role} ${label}: ${count} messages; need at least ${MIN_PER_LABEL}.`);
    }
  }
  return problems;
}

/**
 * Routes every message. `classify(row)` is called only for fallback messages
 * and must resolve to an intent string; it is omitted for offline runs.
 * At most `maxCalls` classifier calls are made.
 */
export async function evaluate(messages, { classify = null, maxCalls = 0 } = {}) {
  let calls = 0;
  const results = [];
  for (const row of messages) {
    const manager = row.role === 'manager';
    // Follow-ups pass the chat's current topic, as the composer does.
    const local = routeChat(row.message, manager, row.currentTopic ?? null);
    const fallback = local === 'clarification' && needsIntentFallback(row.message, manager);
    let route = local;
    let source = local === 'clarification' ? 'local-clarification' : 'local';
    if (fallback) {
      route = 'clarification';
      if (!classify) source = 'not-run';
      else if (calls >= maxCalls) source = 'cap-reached';
      else {
        calls++;
        try {
          const intent = await classify(row);
          route = intent === 'clarification' || labelsFor(row.role).has(intent) ? intent : 'clarification';
          source = 'classifier';
        } catch {
          source = 'classifier-error';
        }
      }
    }
    // A clarification route shows chatClarification() in the chat, whether or
    // not the classifier ran (negated requests never reach it), so count the
    // reply the user actually sees.
    const generic = route === 'clarification' &&
      chatClarification(row.message, manager).startsWith(GENERIC_CLARIFICATION_PREFIX);
    const correct = route === row.expected;
    results.push({
      id: row.id, role: row.role, message: row.message, expected: row.expected, route, source, generic, correct,
      writeCapableWrong: !correct && WRITE_CAPABLE.has(route),
    });
  }
  return { results, summary: summarize(results, calls) };
}

export function summarize(results, providerCalls) {
  const total = results.length;
  const count = predicate => results.filter(predicate).length;
  const breakdown = key => {
    const groups = {};
    for (const row of results) {
      const name = key(row);
      groups[name] ??= { total: 0, correct: 0 };
      groups[name].total++;
      if (row.correct) groups[name].correct++;
    }
    return groups;
  };
  const correct = count(row => row.correct);
  const generic = count(row => row.generic);
  // Generic replies to messages whose correct answer was a real route.
  const unhelpfulGeneric = count(row => row.generic && row.expected !== 'clarification');
  const writeCapableWrong = count(row => row.writeCapableWrong);
  const notRun = count(row => ['not-run', 'cap-reached'].includes(row.source));
  const classifierErrors = count(row => row.source === 'classifier-error');
  const accuracy = total ? correct / total : 0;
  const genericRate = total ? generic / total : 0;
  return {
    total, correct, accuracy, generic, genericRate, unhelpfulGeneric, unhelpfulGenericRate: total ? unhelpfulGeneric / total : 0,
    writeCapableWrong, providerCalls, notRun, classifierErrors,
    fallbackMessages: count(row => row.source !== 'local' && row.source !== 'local-clarification'),
    byRole: breakdown(row => row.role),
    byLabel: breakdown(row => `${row.role}:${row.expected}`),
    targets: {
      accuracy: { target: TARGETS.accuracy, met: accuracy >= TARGETS.accuracy },
      unhelpfulGenericRate: { target: TARGETS.unhelpfulGenericRate, met: (total ? unhelpfulGeneric / total : 0) <= TARGETS.unhelpfulGenericRate },
      writeCapableWrong: { target: TARGETS.writeCapableWrong, met: writeCapableWrong <= TARGETS.writeCapableWrong },
    },
    // Accuracy and generic-rate targets only mean something once every
    // fallback message was actually classified.
    complete: notRun === 0,
  };
}

const percent = value => `${(value * 100).toFixed(1)}%`;

export function formatReport({ results, summary }, { mode }) {
  const lines = [
    `# CoverShift AI routing evaluation (${mode})`,
    '',
    `- Messages: ${summary.total} (${summary.fallbackMessages} needed the classifier)`,
    `- Routed correctly: ${summary.correct} / ${summary.total} (${percent(summary.accuracy)}), target at least ${percent(TARGETS.accuracy)}`,
    `- Unhelpful generic clarification: ${summary.unhelpfulGeneric} (${percent(summary.unhelpfulGenericRate)}), target at most ${percent(TARGETS.unhelpfulGenericRate)}`,
    `  - all generic clarifications, including correct ones: ${summary.generic} (${percent(summary.genericRate)})`,
    `- Write-capable wrong routes: ${summary.writeCapableWrong}, target ${TARGETS.writeCapableWrong}`,
    `- Provider calls: ${summary.providerCalls}; classifier errors: ${summary.classifierErrors}; not classified: ${summary.notRun}`,
    '',
  ];
  if (!summary.complete) {
    lines.push(`Not every fallback message was classified, so accuracy and the unhelpful generic rate describe the local rules only. Run with --live for complete results.`, '');
  }
  lines.push('## By label', '', '| Role:label | Correct | Total |', '| --- | --- | --- |');
  for (const [name, group] of Object.entries(summary.byLabel)) lines.push(`| ${name} | ${group.correct} | ${group.total} |`);
  const misses = results.filter(row => !row.correct);
  lines.push('', `## Misses (${misses.length})`, '');
  if (!misses.length) lines.push('None.');
  else {
    lines.push('| ID | Message | Expected | Got | Source |', '| --- | --- | --- | --- | --- |');
    for (const row of misses) {
      const got = row.writeCapableWrong ? `**${row.route}** (write-capable)` : row.route;
      lines.push(`| ${row.id} | ${row.message.replaceAll('|', '\\|')} | ${row.expected} | ${got} | ${row.source} |`);
    }
  }
  return `${lines.join('\n')}\n`;
}

// Offline runs fail only on deterministic local write-capable wrong routes.
// Live runs fail when any target is missed.
export function exitCode(summary, { live }) {
  if (!summary.targets.writeCapableWrong.met) return 1;
  if (!live) return 0;
  return summary.complete && summary.targets.accuracy.met && summary.targets.unhelpfulGenericRate.met ? 0 : 1;
}
