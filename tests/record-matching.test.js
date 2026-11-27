import assert from 'node:assert/strict';
import test from 'node:test';
import {
  matchesRecordName,
  matchesShiftTitle,
  recordDate,
} from '../public/record-matching.js';
import { dutyQuery } from '../public/ai-manager-drafts.js';
import { dutyShift } from '../src/ai/manager-drafts.js';
import { replacementSuggestions } from '../src/ai/replacements.js';

test('record selectors preserve each explicit part of a name, title and date', () => {
  assert.equal(matchesRecordName('Jamie   Lee', 'jamie lee'), true);
  assert.equal(matchesRecordName('Jamie Rivera', 'jamie lee'), false);
  assert.equal(
    matchesShiftTitle('Front Counter Opening', 'counter opening'),
    true,
  );
  assert.equal(
    matchesShiftTitle('Back Counter Opening', 'front counter opening'),
    false,
  );
  assert.equal(recordDate('February 30', '2026-11-26'), null);
  assert.equal(recordDate('the 24th', '2026-11-26'), '2026-12-24');
});

test('a long duty selector stays intact and both lookups return no match for the wrong shift', () => {
  const business = { id: 'shop', timezone: 'America/Toronto' };
  const user = { id: 'jamie', name: 'Jamie Lee' };
  const now = Date.parse('2026-11-26T17:00Z');
  const shift = {
    id: 'closing',
    businessId: business.id,
    assignedWorkerId: user.id,
    startsAt: '2026-11-27T14:00:00Z',
    endsAt: '2026-11-27T17:00:00Z',
    title: 'Back Counter Opening',
  };
  const db = { shifts: [shift], users: [user], coverageRequests: [] };
  const result = dutyQuery(
    "Add 'sweep' to Jamie Lee’s Friday front counter opening shift",
    '2026-11-26',
  );
  assert.deepEqual(result.params, {
    kind: 'shiftDuties',
    from: '2026-11-27',
    title: 'front counter opening',
    worker: 'Jamie Lee',
  });
  assert.equal(dutyShift(db, business, result.params, now).status, 'none');
  assert.equal(
    replacementSuggestions(db, business, result.params, now).status,
    'none',
  );
  const duplicate = { ...shift, id: 'other' };
  const ambiguous = { ...result.params, title: 'opening' };
  db.shifts.push(duplicate);
  for (const lookup of [dutyShift, replacementSuggestions]) {
    const result = lookup(db, business, ambiguous, now);
    assert.equal(result.status, 'choose');
    assert.equal(result.total, 2);
  }
});
