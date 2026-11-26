import assert from 'node:assert/strict';
import test from 'node:test';
import { matchingClaims, outgoingCoverInvitations } from '../public/ai-claim-status.js';

test('claim lookup narrows by business-local weekday, exact date or quoted title', () => {
  const friday = { id: 'friday', shift: { title: 'Closing', startsAt: '2026-11-28T01:00:00Z' } };
  const saturday = { id: 'saturday', shift: { title: 'Opening', startsAt: '2026-11-28T15:00:00Z' } };
  const data = { claims: [friday, saturday], timezone: 'America/Toronto', asOf: '2026-11-26T12:00:00Z' };
  assert.deepEqual(matchingClaims(data, 'Did my claim get approved?'), data.claims);
  assert.deepEqual(matchingClaims(data, 'Did my Friday claim get approved?'), [friday]);
  assert.deepEqual(matchingClaims(data, 'Did my 2026-11-28 claim get approved?'), [saturday]);
  assert.deepEqual(matchingClaims(data, 'Did my "Closing" claim get approved?'), [friday]);
  assert.deepEqual(matchingClaims(data, 'Did my "Unknown" claim get approved?'), []);
  assert.equal(matchingClaims(data, 'Did my Friday or Saturday claim get approved?'), null);
});

test('cover lookup lists outgoing invitations only', () => {
  const sent = { id: 'outgoing', senderId: 'employee', recipientId: 'coworker' };
  const received = { id: 'incoming', senderId: 'coworker', recipientId: 'employee' };
  assert.deepEqual(outgoingCoverInvitations({ invitations: [received, sent] }, 'employee'), [sent]);
});
