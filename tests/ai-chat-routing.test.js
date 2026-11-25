import assert from 'node:assert/strict';
import test from 'node:test';
import { routeChat, availabilityRuleCommand, matchingAvailabilityRules, chatClarification, clarificationReplyRoute, availabilityNeedsHours, openingReference } from '../public/ai-chat-routing.js';

test('employees can switch topics, refine the last topic, and disambiguate availability', () => {
  assert.equal(routeChat('When’s my next shift?', false, null), 'questions');
  assert.equal(routeChat('Find me an opening Thursday', false, 'questions'), 'search');
  assert.equal(routeChat('Only after 2 PM', false, 'search'), 'search');
  assert.equal(routeChat('I can work Thursday', false, 'search'), 'clarification');
  assert.equal(routeChat('Save availability', false, null), 'availability');
  assert.equal(routeChat('Just one shift', false, 'availability'), 'availability');
  assert.equal(routeChat('Show my saved availability', false, 'search'), 'rules');
});

test('manager routes scheduling questions and draft refinements without exposing employee modes', () => {
  assert.equal(routeChat('Draft a shift for Alex', true, null), 'draft');
  assert.equal(routeChat('2 PM', true, 'draft'), 'draft');
  assert.equal(routeChat('Show the team schedule for its remaining shifts', true, 'draft'), 'questions');
  assert.equal(routeChat('Find an opening', true, null), 'clarification');
});

test('saved availability commands use a distinct employee route and require explicit rule wording', () => {
  assert.equal(routeChat('Pause my Thursday rule', false, 'search'), 'rules');
  assert.equal(routeChat('Show my availability rules', false, null), 'rules');
  assert.notEqual(routeChat('Cancel my coverage request', false, null), 'rules');
  assert.notEqual(routeChat('Pause my Thursday rule', true, null), 'rules');
  assert.deepEqual(availabilityRuleCommand('Please resume my rule on 2026-11-28.'), { action: 'resume', selector: '2026-11-28' });
  assert.deepEqual(availabilityRuleCommand('Cancel the "Weekend service" rule'), { action: 'cancel', selector: 'Weekend service' });
});

test('rule selection uses the business-local start date and preserves ambiguity', () => {
  const base = { timezone: 'America/Toronto', startsAt: '2026-11-29T02:00:00Z', status: 'active' };
  const first = { ...base, title: 'Weekend service' };
  const second = { ...base, title: 'Saturday backup', status: 'paused' };
  const ended = { ...base, title: 'Old rule', status: 'cancelled' };
  const rules = [first, second, ended];
  assert.deepEqual(matchingAvailabilityRules(rules, 'Saturday'), [first, second]);
  assert.deepEqual(matchingAvailabilityRules(rules, '2026-11-28'), [first, second]);
  assert.deepEqual(matchingAvailabilityRules(rules, '2026-11-29'), []);
  assert.deepEqual(matchingAvailabilityRules(rules, 'weekend service'), [first]);
});

test('the three audited paraphrases select the right workflow', () => {
  assert.equal(routeChat('Could you tell me when I work next?', false, null), 'questions');
  assert.equal(routeChat('Can you put me down as available Friday?', false, null), 'availability');
  assert.equal(routeChat('Would you show my saved availability?', false, null), 'rules');
  assert.equal(routeChat('Please, could you find me an open shift Thursday?', false, null), 'search');
  assert.equal(routeChat('Could you pause my Thursday rule?', false, null), 'rules');
});

test('focused prompts preserve the original availability or search intent', () => {
  const availabilityQuestion = chatClarification('I can work Thursday', false);
  assert.match(availabilityQuestion, /find an open shift.*draft availability/i);
  assert.equal(clarificationReplyRoute('Save it.', availabilityQuestion), 'availability');
  assert.equal(clarificationReplyRoute('Find it.', availabilityQuestion), 'search');
  const lunchQuestion = chatClarification('Do you have anything after lunch?', false);
  assert.match(lunchQuestion, /date and exact time/i);
  assert.equal(clarificationReplyRoute('Thursday after 2 PM', lunchQuestion), 'search');
  assert.equal(clarificationReplyRoute('Thursday', lunchQuestion), null);
  assert.equal(availabilityNeedsHours('Can you put me down as available Friday?'), true);
  assert.equal(availabilityNeedsHours('Can you put me down as available Friday 2 PM to 6 PM?'), false);
  assert.equal(availabilityNeedsHours('Put me down as available all day Friday'), false);
});

test('opening references only resolve visible positions or an explicit prior selection', () => {
  assert.equal(openingReference('Why did the second one not match?', ['open1', 'open2'], 'open1'), 'open2');
  assert.equal(openingReference('Why can’t I claim this shift?', ['open1', 'open2'], 'open2'), 'open2');
  assert.equal(openingReference('Why can’t I claim this shift?', ['open1', 'open2'], null), null);
  assert.equal(openingReference('Explain the fifth opening', ['open1'], null), null);
  assert.equal(openingReference('Why did Closing service not match?', ['open1'], null), undefined);
  assert.equal(openingReference('Why did this shift called "Closing service" not match?', ['open1'], 'open1'), undefined);
  assert.equal(routeChat('What else is available?', false, 'search'), 'alternatives');
});
