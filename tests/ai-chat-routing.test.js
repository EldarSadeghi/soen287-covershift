import assert from 'node:assert/strict';
import test from 'node:test';
import { routeChat } from '../public/ai-chat-routing.js';

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
