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

test('replacement selectors recognize title words separated by hyphens and slashes', () => {
  assert.equal(matchesShiftTitle('Front-counter', 'counter'), true);
  assert.equal(
    matchesShiftTitle('Front/Counter Opening', 'front-counter opening'),
    true,
  );
  assert.equal(matchesShiftTitle('Front-counter', 'back counter'), false);
});

test('duty lookups recognize conversational modifiers and preserve the rest of the title', () => {
  const business = { id: 'shop', timezone: 'America/Toronto' };
  const now = Date.parse('2026-11-27T17:00Z');
  const db = {
    users: [
      { id: 'jamie', name: 'Jamie Lee' },
      { id: 'other-jamie', name: 'Jamie Lee' },
    ],
    coverageRequests: [],
    shifts: [
      {
        id: 'opening',
        businessId: 'shop',
        assignedWorkerId: 'jamie',
        startsAt: '2026-12-03T14:00:00Z',
        endsAt: '2026-12-03T17:00:00Z',
        title: 'Opening service',
      },
    ],
  };

  for (const phrase of [
    'the morning',
    'Jamie’s early',
    'the new',
    'the usual',
    'the busy',
    'the weekend',
    'the early morning',
  ]) {
    const { params } = dutyQuery(
      `Add 'sweep' to ${phrase} opening shift on December 3`,
      '2026-11-27',
    );
    assert.equal(dutyShift(db, business, params, now).shift.id, 'opening');
  }

  const { params } = dutyQuery(
    "Add 'sweep' to Jamie’s early front counter opening shift on December 3",
    '2026-11-27',
  );
  assert.equal(dutyShift(db, business, params, now).status, 'none');

  for (const title of [
    'evening opening',
    'early evening opening',
    'morning evening opening',
  ]) {
    assert.equal(
      dutyShift(db, business, { ...params, title }, now).status,
      'none',
    );
  }

  db.shifts.push({
    ...db.shifts[0],
    id: 'second',
    assignedWorkerId: 'other-jamie',
  });
  const ambiguous = { ...params, title: 'early opening' };
  assert.equal(dutyShift(db, business, ambiguous, now).status, 'choose');

  db.shifts[1].title = 'Early opening';
  assert.equal(dutyShift(db, business, ambiguous, now).shift.id, 'second');
});

test('duty dates use the local start day across an overnight DST shift and keep past shifts locked', () => {
  const business = { id: 'shop', timezone: 'America/Toronto' };
  const shift = {
    id: 'overnight',
    businessId: business.id,
    title: 'Closing service',
    startsAt: '2026-11-01T03:00:00Z',
    endsAt: '2026-11-01T09:00:00Z',
  };
  const db = { shifts: [shift], users: [], coverageRequests: [] };
  const now = Date.parse('2026-11-02T15:00Z');
  const query = { from: '2026-10-31', title: 'evening closing' };

  const result = dutyShift(db, business, query, now);
  assert.equal(result.shift.id, 'overnight');
  assert.ok(result.shift.locked);
  assert.equal(
    dutyShift(db, business, { ...query, from: '2026-11-01' }, now).status,
    'none',
  );
  assert.equal(
    dutyShift(db, business, { ...query, title: 'morning closing' }, now).status,
    'none',
  );
});
