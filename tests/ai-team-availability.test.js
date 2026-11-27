import assert from 'node:assert/strict';
import test from 'node:test';
import { allowedIntents } from '../src/ai/intent.js';
import { resolveChatTarget, routeChat } from '../public/ai-chat-routing.js';
import {
  teamAvailabilityQuery,
  selectAvailabilityWorkers,
  renderTeamAvailability,
} from '../public/ai-team-availability.js';

const date = '2026-12-03';
const timezone = 'America/Toronto';
const roster = [
  {
    name: 'Alex Morgan',
    status: 'available',
    reasons: ['Confirmed free time'],
  },
  { name: 'Jamie Lee', status: 'unknown', reasons: ['No confirmed free time'] },
];

test('manager availability is role-scoped and a clarification accepts a date reply', () => {
  assert.ok(allowedIntents('manager').includes('teamAvailability'));
  assert.ok(!allowedIntents('worker').includes('teamAvailability'));
  assert.notEqual(
    routeChat('Is Alex available on December 3?', false, null),
    'teamAvailability',
  );
  assert.equal(
    resolveChatTarget({
      text: 'December 3',
      manager: true,
      routed: 'clarification',
      previous: {
        topic: 'teamAvailability',
        text: 'Which date should I check?',
      },
      statusTopics: [],
    }).target,
    'teamAvailability',
  );
});

test('parses business-local dates, dayparts and exact ranges', () => {
  const query = (text) => teamAvailabilityQuery(text, '2026-12-02', timezone);
  assert.deepEqual(query('Is Alex free on December 3?'), {
    date,
    params: { date },
  });
  assert.deepEqual(query('Who is free on 2026-12-03?'), {
    date,
    params: { date },
  });
  assert.deepEqual(query('Who is free tomorrow afternoon?').params, {
    startLocal: date + 'T12:00',
    endLocal: date + 'T17:00',
    timezone,
  });
  assert.equal(
    query('Who is free Thursday from 1 PM to 4 PM?').params.endLocal,
    date + 'T16:00',
  );
  assert.match(query('Is Alex free?').question, /^Which date/);
  assert.match(
    query('Who is free tomorrow after lunch?').question,
    /^Which hours/,
  );
});

test('a named question narrows results and an unknown name never falls back to the roster', () => {
  assert.deepEqual(
    selectAvailabilityWorkers(roster, 'Is Alex Morgan available?').workers,
    [roster[0]],
  );
  assert.deepEqual(
    selectAvailabilityWorkers(roster, 'Who is free?').workers,
    roster,
  );
  assert.ok(
    selectAvailabilityWorkers(roster, 'Is Unknown Person free?').question,
  );
  assert.ok(
    selectAvailabilityWorkers(
      [...roster, { name: 'Alex Smith' }],
      'Is Alex free?',
    ).question,
  );
});

test('availability card shows the selected statuses, reasons and read-only link', () => {
  const node = () => ({
    children: [],
    classList: { add() {} },
    setAttribute() {},
    append(...children) {
      this.children.push(...children);
    },
    replaceChildren() {
      this.children = [];
    },
  });
  const original = globalThis.document;
  globalThis.document = { createElement: node };
  try {
    const card = node();
    const reply = renderTeamAvailability(card, { timezone }, date, roster);
    assert.match(reply, /Alex Morgan/);
    assert.ok(
      card.children.some(
        (child) => child.textContent === 'Unknown · No confirmed free time',
      ),
    );
    assert.equal(card.children.at(-1).href, '/workspace/manager/availability');
    renderTeamAvailability(card, { timezone }, date, [roster[0]]);
    assert.ok(
      !card.children.some((child) => child.textContent === 'Jamie Lee'),
    );
  } finally {
    globalThis.document = original;
  }
});
