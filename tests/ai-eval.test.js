import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { chatClarification, needsIntentFallback, routeChat } from '../public/ai-chat-routing.js';
import { evaluate, exitCode, formatReport, labelsFor, validateMessages } from '../scripts/ai-eval/evaluate.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const run = promisify(execFile);
const data = JSON.parse(await readFile(new URL('../scripts/ai-eval/messages.json', import.meta.url), 'utf8'));
const row = (role, expected, message, id = `${role}-${expected}-${message}`) => ({ id, role, expected, message });

test('the labelled message set is valid and covers every route for both roles', () => {
  assert.deepEqual(validateMessages(data), []);
  assert.ok(data.messages.length >= 150);
  for (const role of ['employee', 'manager']) {
    for (const label of labelsFor(role)) {
      assert.ok(data.messages.filter(m => m.role === role && m.expected === label).length >= 3, `${role} ${label}`);
    }
  }
});

test('validation rejects duplicates, wrong-role labels, contact data and thin coverage', () => {
  const problems = validateMessages({ version: 1, messages: [
    row('employee', 'questions', 'When is my next shift?', 'x'),
    row('employee', 'questions', 'again', 'x'),
    row('manager', 'search', 'find open shifts', 'y'),
    row('employee', 'clarification', 'email me at someone@example.test', 'z'),
  ] });
  for (const pattern of [/duplicate id: x/, /Label search is not a manager route/, /personal contact data: z/, /need at least 150/, /manager draft: 0 messages/]) {
    assert.ok(problems.some(problem => pattern.test(problem)), pattern.source);
  }
  assert.deepEqual(validateMessages({ messages: [] }), ['Expected { version: 1, messages: [...] }.']);
});

test('the fallback rule matches the chat: generic question only, never negations or symbols', () => {
  const unmatched = 'Could you pull up when I punch in?';
  assert.equal(routeChat(unmatched, false, null), 'clarification');
  assert.equal(needsIntentFallback(unmatched, false), true);
  assert.ok(chatClarification(unmatched, false).startsWith('What would you like me to check'));
  // A specific local clarification is not sent to the classifier.
  assert.equal(needsIntentFallback("I'm available", false), false);
  assert.equal(needsIntentFallback('do not find any shifts', false), false);
  assert.equal(needsIntentFallback('?', false), false);
  assert.equal(needsIntentFallback('who opens on monday', true), true);
});

test('offline evaluation makes no classifier calls and marks the result incomplete', async () => {
  const messages = [row('employee', 'questions', 'When is my next shift?'), row('employee', 'questions', 'Could you pull up when I punch in?')];
  const { results, summary } = await evaluate(messages);
  assert.deepEqual(results.map(r => [r.route, r.source, r.generic]), [['questions', 'local', false], ['clarification', 'not-run', true]]);
  assert.deepEqual([summary.providerCalls, summary.notRun, summary.complete, summary.accuracy], [0, 1, false, 0.5]);
  assert.equal(exitCode(summary, { live: false }), 0, 'offline runs do not fail on classifier-dependent targets');
});

test('live evaluation classifies only fallback messages, respects the call cap and contains errors', async () => {
  const messages = [
    row('employee', 'questions', 'When is my next shift?'),
    row('employee', 'questions', 'Could you pull up when I punch in?'),
    row('manager', 'questions', 'who opens on monday'),
    row('manager', 'summary', 'anything waiting on me?'),
    row('employee', 'search', 'looking for more shifts next week'),
  ];
  const asked = [];
  const answers = { 'Could you pull up when I punch in?': 'questions', 'who opens on monday': 'search', 'anything waiting on me?': 'boom' };
  const classify = async message => {
    asked.push(message.message);
    if (answers[message.message] === 'boom') throw new Error('provider-private failure');
    return answers[message.message];
  };
  const { results, summary } = await evaluate(messages, { classify, maxCalls: 3 });
  assert.deepEqual(asked, ['Could you pull up when I punch in?', 'who opens on monday', 'anything waiting on me?']);
  assert.deepEqual(results.map(r => [r.route, r.source]), [
    ['questions', 'local'],
    ['questions', 'classifier'],
    ['clarification', 'classifier'], // an employee-only intent is not a manager route
    ['clarification', 'classifier-error'],
    ['clarification', 'cap-reached'],
  ]);
  assert.deepEqual([summary.providerCalls, summary.classifierErrors, summary.notRun, summary.complete], [3, 1, 1, false]);
  assert.equal(exitCode(summary, { live: true }), 1, 'an incomplete live run fails');
});

test('generic replies are counted from what the user sees, even when the classifier never runs', async () => {
  const messages = [
    row('manager', 'clarification', 'Never draft a shift'), // negated: no fallback, but the generic question
    row('employee', 'clarification', "I'm available"), // a specific local question, not generic
    row('employee', 'questions', 'When is my next shift?'), // routed, no clarification
  ];
  assert.equal(needsIntentFallback('Never draft a shift', true), false);
  assert.ok(chatClarification('Never draft a shift', true).startsWith('What would you like me to check'));
  const { results, summary } = await evaluate(messages);
  assert.deepEqual(results.map(r => [r.id.split('-')[0], r.source, r.generic]), [
    ['manager', 'local-clarification', true],
    ['employee', 'local-clarification', false],
    ['employee', 'local', false],
  ]);
  assert.deepEqual([summary.generic, summary.unhelpfulGeneric], [1, 0]);
});

test('write-capable wrong routes are flagged and fail every run', async () => {
  // Deliberately mislabelled: the local rules route this to search.
  const messages = [row('employee', 'availability', 'show open shifts')];
  const { results, summary } = await evaluate(messages);
  assert.equal(results[0].route, 'search');
  assert.equal(results[0].writeCapableWrong, true);
  assert.equal(summary.targets.writeCapableWrong.met, false);
  assert.equal(exitCode(summary, { live: false }), 1);
  const report = formatReport({ results, summary }, { mode: 'test' });
  assert.match(report, /\*\*search\*\* \(write-capable\)/);
  assert.match(report, /Write-capable wrong routes: 1, target 0/);
});

test('a complete live run passes only when every target is met', async () => {
  const messages = [row('employee', 'questions', 'When is my next shift?'), row('employee', 'questions', 'Could you pull up when I punch in?')];
  const passing = await evaluate(messages, { classify: async () => 'questions', maxCalls: 5 });
  assert.equal(passing.summary.accuracy, 1);
  assert.equal(exitCode(passing.summary, { live: true }), 0);
  const generic = await evaluate(messages, { classify: async () => 'clarification', maxCalls: 5 });
  assert.equal(generic.summary.genericRate, 0.5);
  assert.equal(generic.summary.unhelpfulGeneric, 1, 'a generic reply to a real request is unhelpful');
  const fine = await evaluate([row('employee', 'clarification', 'write me a poem about coffee')], { classify: async () => 'clarification', maxCalls: 1 });
  assert.deepEqual([fine.summary.generic, fine.summary.unhelpfulGeneric], [1, 0]);
  assert.equal(exitCode(generic.summary, { live: true }), 1);
});

test('the CLI rejects bad options and refuses a live run without a key, writing nothing', async () => {
  const env = { ...process.env, OPENAI_API_KEY: '' };
  for (const args of [['--max-calls', '0'], ['--max-calls', '501'], ['--verbose'], ['--live']]) {
    const result = await run(process.execPath, ['scripts/ai-eval.js', ...args], { cwd: root, env }).catch(error => error);
    assert.equal(result.code, 2, args.join(' '));
    assert.doesNotMatch(result.stdout, /Report:/);
  }
});
