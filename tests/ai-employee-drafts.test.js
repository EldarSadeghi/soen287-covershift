import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AiAllowance } from '../src/ai/allowance.js';
import { createEmployeeDrafter } from '../src/ai/employee-drafts.js';
import { resolveChatTarget, routeChat } from '../public/ai-chat-routing.js';
import { ROUTES } from '../src/ai/routing-log.js';

const now = () => Date.parse('2026-11-26T17:00:00Z');
const date = '2026-12-04';
const friday = {
  startLocal: date + 'T00:00',
  endLocal: '2026-12-05T00:00',
  allDay: true,
};

test('employee draft routes preserve lookups and block unsupported commands first', () => {
  const cases = [
    ['I need next Friday off', 'timeOffDraft'],
    ['Can I take December 22 to 26 off?', 'timeOffDraft'],
    ['I need Saturday afternoon off from 1 to 5', 'timeOffDraft'],
    ['Ask Alex to cover my Saturday shift', 'coverDraft'],
    ['Can Jamie take my Friday opening?', 'coverDraft'],
    ['Swap my shift with Alex', 'coverDraft'],
    ['Was my time off approved?', 'timeOffStatus'],
    ['Who’s free on Friday?', 'coworkers'],
    ['Did Alex accept my cover request?', 'coverStatus'],
    ['Request time off on Friday and delete my shift', 'clarification'],
  ];
  for (const [message, route] of cases)
    assert.equal(routeChat(message, false, null), route, message);
  for (const route of ['timeOffDraft', 'coverDraft'])
    assert.ok(ROUTES.has(route));
  const followUp = (text, previous) =>
    resolveChatTarget({
      text,
      manager: false,
      routed: routeChat(text, false, null),
      previous,
    }).target;
  const previous = {
    topic: 'timeOffDraft',
    text: 'Which date or dates should I use?',
  };
  assert.equal(followUp('December 4', previous), 'timeOffDraft');
  assert.equal(followUp('Delete my shift', previous), 'clarification');
  assert.equal(
    followUp('1 PM to 5 PM', {
      ...previous,
      text: 'Full day, or which hours?',
    }),
    'timeOffDraft',
  );
  assert.equal(
    routeChat('Actually make it Thursday too', false, 'timeOffDraft'),
    'timeOffDraft',
  );
});

test('time-off preview uses the existing date validator and merges only explicit revisions', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'employee-drafts-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const user = {
    id: 'jamie',
    role: 'worker',
    businessId: 'demo',
    passwordHash: 'fixture',
  };
  const business = { id: 'demo', timezone: 'America/Toronto' };
  const db = {
    users: [user],
    businesses: [business],
    shifts: [],
    coverageRequests: [],
  };
  let reply, seen;
  const draft = createEmployeeDrafter('timeOffDraft', {
    apiKey: 'fictional',
    allowance: new AiAllowance(dir),
    fetchImpl: async (_, init) => {
      seen = JSON.parse(JSON.parse(init.body).input);
      return Response.json({
        status: 'completed',
        output: [
          {
            type: 'message',
            content: [{ type: 'output_text', text: JSON.stringify(reply) }],
          },
        ],
      });
    },
  });
  const preview = (fields, base) => {
    reply = { kind: 'draft', question: '', ...fields };
    return draft(
      { read: async () => db },
      user.id,
      { description: 'Please update my time off', ...(base ? { base } : {}) },
      now,
    );
  };
  const invalid = [
    { ...friday, startLocal: '2026-11-20T00:00' },
    { ...friday, startLocal: '2028-01-04T00:00', endLocal: '2028-01-05T00:00' },
    { ...friday, endLocal: friday.startLocal },
    { ...friday, startLocal: date + 'T01:00' },
    {
      startLocal: '2027-03-14T02:15',
      endLocal: '2027-03-14T04:00',
      allDay: false,
    },
  ];
  for (const fields of invalid)
    await assert.rejects(preview(fields), { status: 422 });
  const dst = await preview({
    startLocal: '2027-03-14T00:00',
    endLocal: '2027-03-15T00:00',
    allDay: true,
  });
  assert.equal(
    Date.parse(dst.endsAt) - Date.parse(dst.startsAt),
    23 * 3600_000,
  );
  const revised = await preview(
    { startLocal: '2026-12-03T00:00', endLocal: null, allDay: null },
    friday,
  );
  assert.deepEqual(seen.pendingDraft, friday);
  assert.deepEqual(revised.selection, {
    ...friday,
    startLocal: '2026-12-03T00:00',
  });
  assert.equal(Object.hasOwn(revised, 'note'), false);
});

test('cover previews ask for an exact active coworker within the signed-in business', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'cover-drafts-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const user = {
    id: 'jamie',
    role: 'worker',
    businessId: 'demo',
    passwordHash: 'fixture',
  };
  const peer = (id, name, extra = {}) => ({ ...user, id, name, ...extra });
  const db = {
    users: [
      user,
      peer('alex', 'Alex Morgan'),
      peer('alex2', 'Alex Rivera'),
      peer('foreign', 'Foreign Worker', { businessId: 'elsewhere' }),
      peer('inactive', 'Former Coworker', { deactivation: {} }),
    ],
    businesses: [{ id: 'demo', timezone: 'America/Toronto' }],
    shifts: [],
  };
  let coworker;
  const draft = createEmployeeDrafter('coverDraft', {
    apiKey: 'fictional',
    allowance: new AiAllowance(dir),
    fetchImpl: async () => {
      const reply = {
        kind: 'draft',
        question: '',
        coworker,
        date,
        title: '',
        time: '',
      };
      return Response.json({
        status: 'completed',
        output: [
          {
            type: 'message',
            content: [{ type: 'output_text', text: JSON.stringify(reply) }],
          },
        ],
      });
    },
  });
  for (coworker of ['Alex', 'Foreign Worker', 'Former Coworker']) {
    const result = await draft(
      { read: async () => db },
      user.id,
      { description: 'Ask ' + coworker + ' to cover my Friday shift' },
      now,
    );
    assert.equal(result.kind, 'clarification');
    assert.match(result.question, /^Which coworker/);
  }
});
