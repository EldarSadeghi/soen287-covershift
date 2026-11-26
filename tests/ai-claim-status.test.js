import assert from 'node:assert/strict';
import test from 'node:test';
import { matchingClaims, matchingTimeOff, outgoingCoverInvitations, typedStatusChoice } from '../public/ai-claim-status.js';

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

test('time-off date lookup includes every local date covered and excludes the end midnight', () => {
  const timezone = 'America/Toronto';
  const approved = { id: 'approved', status: 'approved', timezone, startsAt: '2026-12-03T05:00:00Z', endsAt: '2026-12-05T05:00:00Z' };
  const pending = { id: 'pending', status: 'pending', timezone, startsAt: '2026-12-04T23:00:00Z', endsAt: '2026-12-05T04:00:00Z' };
  const rejected = { id: 'rejected', status: 'rejected', timezone, startsAt: '2026-12-06T05:00:00Z', endsAt: '2026-12-07T05:00:00Z' };
  const data = { requests: [approved, pending, rejected], timezone, asOf: '2026-12-03T12:00:00Z' };
  assert.deepEqual(matchingTimeOff(data, 'Was my Friday time off approved?'), [approved, pending]);
  assert.deepEqual(matchingTimeOff(data, 'What is my 2026-12-04 leave request status?'), [approved, pending]);
  assert.deepEqual(matchingTimeOff(data, 'Was my Sunday time off declined?'), [rejected]);
  assert.deepEqual(matchingTimeOff(data, 'Was my Saturday time off approved?'), []);
  assert.deepEqual(matchingTimeOff(data, 'Was my time off approved?'), data.requests);
});

test('typed selection uses visible order and unique date and time details', () => {
  const timezone = 'America/Toronto';
  const choices = [
    { id: 'morning', timezone, startsAt: '2026-12-04T14:00:00Z', endsAt: '2026-12-04T16:00:00Z' },
    { id: 'evening', timezone, startsAt: '2026-12-04T23:00:00Z', endsAt: '2026-12-05T02:00:00Z' },
  ];
  const data = { timezone, asOf: '2026-11-26T12:00:00Z' };
  for (const reply of ['the second one', '2', 'the Friday evening one']) {
    assert.equal(typedStatusChoice(reply, choices, data, matchingTimeOff), 'evening');
  }
  for (const reply of ['Friday', 'the third one', 'first or second', 'cancel Friday', 'Friday or Saturday']) {
    assert.equal(typedStatusChoice(reply, choices, data, matchingTimeOff), null);
  }
  assert.equal(typedStatusChoice('second', choices.slice(0, 1), data, matchingTimeOff), null);
});
