import assert from 'node:assert/strict';
import test from 'node:test';
import { routeChat } from '../public/ai-chat-routing.js';

const examples = [
  ['timeOffStatus', 'Was my Friday time off approved?'],
  ['coverStatus', 'Did anyone accept my request to cover Friday?'],
  ['claimStatus', 'Did my claim get approved?'],
  ['summary', 'Show my working week'],
  ['summary', 'Show the attention summary for this week', true],
  ['teamAvailability', 'Is Alex Morgan available on December 3?', true],
  ['teamAvailability', 'Who is free on Friday?', true],
  ['teamAvailability', 'Is anyone available tomorrow afternoon?', true],
  ['teamAvailability', 'Is Alex free?', true],
  ['draft', 'Create a shift for Alex', true],
  ['draft', 'give jamie a shift on saturday', true],
  ['draft', 'Could you give Jamie Lee a new shift tomorrow?', true],
  ['coworkers', 'Are my coworkers free Friday?'],
  ['alternatives', 'Suggest eligible alternatives'],
  ['explanation', 'Why did my shift claim conflict?'],
  ['rules', 'Show my saved availability rules'],
  ['availability', 'I can pick up two shifts on Saturday'],
  ['search', 'Find an open shift Saturday'],
  ['questions', 'What time do I start tomorrow?'],
  ['questions', 'Who is working Friday?', true],
];

for (const [intent, text, manager = false] of examples) {
  test(`local ${intent} intent routes "${text}"`, () => {
    assert.equal(routeChat(text, manager, null), intent);
  });
}

test('give-a-shift rule stays manager-only and keeps unsupported actions blocked', () => {
  assert.notEqual(routeChat('Give Jamie a shift on Saturday', false), 'draft');
  assert.notEqual(routeChat('Give Jamie a shift status update', true), 'draft');
  assert.equal(
    routeChat('Give Jamie a shift on Saturday and publish the schedule', true),
    'clarification',
  );
});
