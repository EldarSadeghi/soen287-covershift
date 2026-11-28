import assert from 'node:assert/strict';
import test from 'node:test';
import { classifiedManagerLookup } from '../public/ai-manager-lookups.js';
import { validatedIntentDetails } from '../src/ai/intent.js';

const today = '2026-11-27';

test('validated fallback completes a replacement query using literal person and title', () => {
  const text =
    'Can somebody sit in for Jamie Lee at Counter Opening on the 3rd?';
  const details = validatedIntentDetails(
    'replacements',
    {
      date: 'the 3rd',
      title: 'Counter Opening',
      person: 'Jamie Lee',
    },
    text,
    today,
  );
  assert.deepEqual(
    classifiedManagerLookup('replacements', text, today, details),
    {
      params: {
        kind: 'replacements',
        from: '2026-12-03',
        through: '2026-12-03',
        title: 'Counter Opening',
        worker: 'Jamie Lee',
      },
    },
  );
});

test('fallback rejects invented fields, unintended actions, and conflicting dates', () => {
  const validate = (route, details, text) =>
    validatedIntentDetails(route, details, text, today);
  assert.equal(
    validate('shiftEdit', { title: 'Opening' }, 'Move Opening'),
    null,
  );
  assert.equal(
    validate('replacements', { shiftId: '1' }, 'Find someone'),
    null,
  );
  assert.equal(
    validate('teamAvailability', { person: 'Sam' }, 'Is Samantha free?'),
    null,
  );
  assert.equal(
    validate(
      'teamAvailability',
      { date: 'February 30' },
      'Who is free February 30?',
    ),
    null,
  );
  assert.equal(
    validate(
      'teamAvailability',
      { date: 'Friday' },
      'Friday or Saturday or Sunday?',
    ),
    null,
  );
  assert.equal(
    validate(
      'teamTimeOff',
      { date: 'December 7', through: 'December 5' },
      'December 7 through December 5',
    ),
    null,
  );
  assert.equal(
    validate(
      'teamTimeOff',
      { date: 'December 5', through: 'December 9' },
      'December 5 onward',
    ),
    null,
  );
  const text = 'Who has leave from December 5 until December 9?';
  const data = validate(
    'teamTimeOff',
    { date: 'December 5', through: 'December 9' },
    text,
  );
  assert.deepEqual(
    classifiedManagerLookup('teamTimeOff', text, today, data).params,
    {
      kind: 'teamTimeOff',
      from: '2026-12-05',
      through: '2026-12-09',
    },
  );
});
