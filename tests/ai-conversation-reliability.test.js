import assert from 'node:assert/strict';
import test from 'node:test';
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
