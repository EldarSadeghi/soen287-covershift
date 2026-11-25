import assert from 'node:assert/strict';
import test from 'node:test';
import { claimOutcomeMessage, employeeSearchMessage } from '../public/ai-employee-request.js';
import {
  availabilityNeedsHours, chatClarification, clarificationReplyRoute, coworkerLookupDate,
  openingReference, routeChat,
} from '../public/ai-chat-routing.js';

const conversations = [
  ['employee', 'Could you tell me when I work next?', null, 'questions'],
  ['employee', 'When do I come in next?', null, 'questions'],
  ['employee', 'Would you show my saved availability?', 'search', 'rules'],
  ['employee', 'Can you put me down as available Friday?', null, 'availability'],
  ['employee', 'Is any of my coworkers available on December first?', 'availability', 'coworkers'],
  ['employee', 'Who’s free Friday?', null, 'coworkers'],
  ['employee', 'Could anyone cover tomorrow?', 'draft', 'coworkers'],
  ['employee', 'I can work Friday', 'search', 'clarification'],
  ['employee', 'Find an open shift Thursday after 2 PM', null, 'search'],
  ['employee', 'Only after 2 PM', 'search', 'search'],
  ['employee', 'Why did the second opening match?', 'search', 'explanation'],
  ['employee', 'What other openings?', 'search', 'alternatives'],
  ['employee', 'Why is my coverage request still pending?', null, 'explanation'],
  ['employee', 'Can you pause my Friday rule?', null, 'rules'],
  ['manager', 'Could you tell me how many hours the team works this week?', null, 'questions'],
  ['manager', 'Please draft a closing shift for Alex', null, 'draft'],
  ['manager', 'Only after 2 PM', 'draft', 'draft'],
];

for (const [role, prompt, context, expected] of conversations) {
  test(`${role} conversation: ${prompt}`, () => {
    assert.equal(routeChat(prompt, role === 'manager', context), expected);
  });
}

test('clarification preserves intent and waits for details', () => {
  const question = chatClarification('I can work Friday', false);
  assert.equal(clarificationReplyRoute('Save it', question), 'availability');
  assert.equal(clarificationReplyRoute('Find it', question), 'search');
  assert.equal(clarificationReplyRoute('Yes', question), null);
  assert.equal(availabilityNeedsHours('Can you put me down as available Friday?'), true);
  assert.equal(openingReference('Why is the second opening unavailable?', ['only-visible'], null), null);
});

test('coworker lookups resolve dates across month and year boundaries', () => {
  assert.equal(coworkerLookupDate('Who’s free Friday?', '2026-11-25'), '2026-11-27');
  assert.equal(coworkerLookupDate('Could anyone cover tomorrow?', '2026-12-31'), '2027-01-01');
  assert.equal(coworkerLookupDate('Who is available Tuesday or Friday?', '2026-11-25'), null);
  assert.equal(coworkerLookupDate('Is anyone free December first?', '2026-11-25'), '2026-12-01');
});

test('intent paraphrases reach the right role-specific workflows', () => {
  assert.equal(routeChat('Pull up the rota and show my hours', true, null), 'questions');
  assert.equal(routeChat('Put together a closing shift for Alex', true, null), 'draft');
  assert.equal(routeChat('Who could fill in tomorrow?', false, null), 'coworkers');
  assert.equal(routeChat('Any unclaimed shifts Friday?', false, null), 'search');
  assert.equal(routeChat('Give me my shifts for this week', false, null), 'questions');
  assert.equal(routeChat('Who could fill in tomorrow?', true, null), 'clarification');
});

test('distinct requests ask which workflow to handle first', () => {
  const employee = 'Find unfilled shifts Friday and show my saved availability';
  const manager = 'Pull up the team schedule; draft a closing shift for Alex';
  assert.equal(routeChat(employee, false, 'search'), 'clarification');
  assert.match(chatClarification(employee, false), /find open shifts or check saved rules/);
  assert.equal(routeChat(manager, true, 'draft'), 'clarification');
  assert.match(chatClarification(manager, true), /check the schedule or draft a shift/);
  assert.equal(routeChat('Draft a shift for Alex on Friday from 2 PM and until 6 PM', true, null), 'draft');
  assert.equal(routeChat('Pause the “Coffee and closing” rule', false, null), 'rules');
});

test('unrelated requests and negated actions do not inherit an editable workflow', () => {
  assert.equal(routeChat('What is the weather?', true, 'draft'), 'clarification');
  assert.equal(routeChat('Do not draft a shift', true, 'draft'), 'clarification');
  assert.equal(routeChat('Can you explain payroll?', false, 'search'), 'clarification');
  assert.equal(routeChat('Actually, start at 2 PM', true, 'draft'), 'draft');
});

test('opening follow-ups distinguish explicit positions, a selection, and ambiguous references', () => {
  const results = ['open-one', 'open-two'];
  assert.equal(routeChat('Why can’t I take the second one?', false, 'search'), 'explanation');
  assert.equal(routeChat('How come that one?', false, 'search'), 'explanation');
  assert.equal(openingReference('Why can’t I take the second one?', results, 'open-one'), 'open-two');
  assert.equal(openingReference('Second.', results, null), 'open-two');
  assert.equal(openingReference('Why not that one?', [], 'open-two'), 'open-two');
  assert.equal(openingReference('Why not that one?', results, null), null);
  assert.equal(openingReference('Why not the first or second one?', results, null), null);
  assert.equal(openingReference('Second.', [], 'open-one'), null);
});

test('empty and uncertain chat outcomes describe facts without prompting a duplicate claim', () => {
  const message = employeeSearchMessage({
    criteria: { date: '2026-11-27', startLocal: '', endLocal: '', title: 'coverage' },
    timezone: 'America/Toronto',
    total: 0,
    requests: [],
  });
  assert.match(message, /^No eligible openings matched/);
  assert.match(message, /coverage.*America\/Toronto/);
  assert.doesNotMatch(message, /choose an opening|confirm/i);
  assert.match(claimOutcomeMessage(true), /manager must approve/);
  assert.match(claimOutcomeMessage(false), /couldn’t confirm submission.*Check My requests before trying again/);
});
