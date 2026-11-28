import {
  copyWeekReply,
  copyWeeks,
  dutyQuery,
} from '../public/ai-manager-drafts.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveChatTarget, routeChat } from '../public/ai-chat-routing.js';
import { shiftChoiceIndex } from '../public/record-matching.js';
import { replacementSuggestions } from '../src/ai/replacements.js';

function followUp(text, topic, question, manager = true) {
  return resolveChatTarget({
    text,
    manager,
    routed: routeChat(text, manager, topic === 'shiftDuties' ? 'draft' : topic),
    previous: { role: 'assistant', topic, text: question },
  }).target;
}

test('short dates and periods continue the question, while fresh and blocked commands take precedence', () => {
  const duty = 'Which date’s shift should I add it to?';
  assert.equal(followUp('Friday', 'shiftDuties', duty), 'shiftDuties');
  assert.equal(
    followUp('delete that shift', 'shiftDuties', duty),
    'clarification',
  );
  assert.equal(
    followUp('Show the team schedule Friday', 'shiftDuties', duty),
    'questions',
  );
  assert.equal(
    followUp(
      'December 7 to December 14',
      'copyWeek',
      'Which week should I copy?',
    ),
    'copyWeek',
  );
  assert.equal(
    followUp('Friday', 'coworkers', 'Which date should I check?', false),
    'coworkers',
  );
  assert.equal(
    followUp('next week', 'summary', 'Which summary should I show?', false),
    'summary',
  );
});

test('short choices use displayed order and reject ambiguous titles and invalid positions', () => {
  const rows = [
    {
      title: 'Front Counter Opening',
      startsAt: '2026-12-03T14:00:00Z',
      workerName: 'Jamie Lee',
    },
    {
      title: 'Back Counter Opening',
      startsAt: '2026-12-03T22:00:00Z',
      workerName: 'Alex Morgan',
    },
  ];
  const select = (reply) => shiftChoiceIndex(reply, rows, 'America/Toronto');
  assert.equal(select('the second'), 1);
  assert.equal(select('the front counter one'), 0);
  assert.equal(select('the evening one'), 1);
  assert.equal(select('Alex'), 1);
  assert.equal(select('the opening one'), null);
  assert.equal(select('number 3'), null);
});

test('a selected replacement shift cannot bypass the original business, day or title', () => {
  const business = { id: 'shop', timezone: 'America/Toronto' };
  const shift = {
    id: 'one',
    businessId: 'shop',
    title: 'Opening',
    startsAt: '2026-12-03T14:00:00Z',
    endsAt: '2026-12-03T17:00:00Z',
  };
  const db = {
    shifts: [shift, { ...shift, id: 'other', businessId: 'foreign' }],
    users: [],
    coverageRequests: [],
  };
  const select = (shiftId, from, title) =>
    replacementSuggestions(
      db,
      business,
      { shiftId, from, title },
      Date.parse('2026-12-04T12:00:00Z'),
    );
  assert.equal(select('one', '2026-12-03').shift.id, 'one');
  assert.equal(select('other', '2026-12-03').status, 'none');
  assert.equal(select('one', '2026-12-04').status, 'none');
  assert.equal(select('one', '2026-12-03', 'Closing').status, 'none');
});

test('unrelated manager requests stay unclaimed when a shift list is visible', () => {
  const rows = [
    {
      title: 'Front Counter Opening',
      startsAt: '2026-12-03T14:00:00Z',
      workerName: 'Jamie Lee',
    },
  ];
  const select = (reply) => shiftChoiceIndex(reply, rows, 'America/Toronto');
  for (const reply of [
    'Has anybody booked a day away from work on December 9?',
    'Can employees see the upcoming rota yet?',
    'who opens on monday',
    'never mind',
    'thanks',
    'none of them',
  ])
    assert.equal(select(reply), undefined, reply);
  assert.equal(select('#1'), 0);
  assert.equal(select('the last one'), 0);
  assert.equal(select('#2'), null);
  assert.equal(select('the closing one'), null);
});

test('date shorthand and partial copy-week replies retain the prior details', () => {
  const duty = 'Which date’s shift should I add it to?';
  for (const reply of ['the 5th', 'Dec 5', 'Dec. 5th']) {
    assert.equal(followUp(reply, 'shiftDuties', duty), 'shiftDuties');
    assert.equal(
      dutyQuery(`Add "sweep" to the opening shift ${reply}`, '2026-11-27')
        .params.from,
      '2026-12-05',
    );
  }
  for (const reply of [
    'to next week',
    'next week',
    'the week after',
    'December 7 to the 14th',
  ]) {
    assert.equal(
      followUp(reply, 'copyWeek', 'Which week should I copy?'),
      'copyWeek',
    );
  }
  const week = (original, reply) =>
    copyWeeks(copyWeekReply(original, reply), '2026-12-01');
  assert.deepEqual(week('copy this week to', 'to next week'), {
    source: '2026-11-30',
    target: '2026-12-07',
  });
  assert.deepEqual(week('copy this week to', 'the week after'), {
    source: '2026-11-30',
    target: '2026-12-07',
  });
  assert.deepEqual(week('copy a week', 'December 7 to the 14th'), {
    source: '2026-12-07',
    target: '2026-12-14',
  });
  const partial = copyWeekReply('copy a week', 'to next week');
  assert.equal(copyWeeks(partial, '2026-12-01'), null);
  assert.deepEqual(week(partial, 'this week'), {
    source: '2026-11-30',
    target: '2026-12-07',
  });
});
