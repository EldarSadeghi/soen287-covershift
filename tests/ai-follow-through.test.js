import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createAppServer } from '../src/app.js';
import { SessionStore } from '../src/auth/sessions.js';
import { saveWindow } from '../src/availability/windows.js';
import { coverOptions, sendCoverInvitation } from '../src/cover/service.js';
import { buildDemoFixtures } from '../src/demo/fixtures.js';
import { JsonStore } from '../src/storage/json-store.js';
import { requestTimeOff } from '../src/time-off/service.js';
import { ROUTES } from '../src/ai/routing-log.js';
import { WRITE_CAPABLE } from '../scripts/ai-eval/evaluate.js';
import {
  requestsUnsupportedAction,
  resolveChatTarget,
  routeChat,
} from '../public/ai-chat-routing.js';
import { invitationAnswer } from '../public/routing/employee.js';
import {
  createCancelCover,
  createCancelTimeOff,
  createInviteAnswer,
  namedCoworker,
  withMonth,
} from '../public/ai-follow-through.js';
import { openRequestedAction } from '../public/requested-action.js';

const clock = () => Date.parse('2026-11-27T02:00:00Z'); // Thursday Nov 26 in Toronto
const timezone = 'America/Toronto';
const FOLLOW_THROUGH = ['answerInvite', 'cancelCover', 'cancelTimeOff'];

test('employee follow-through routes, with blocked commands and existing routes unchanged', () => {
  const employee = (text) => routeChat(text, false, null);
  for (const [text, route] of [
    ['Alex asked me to cover Saturday, accept it', 'answerInvite'],
    ['Alex asked me to cover Saturday; decline it', 'answerInvite'],
    ['decline Jamie’s invite for Friday', 'answerInvite'],
    ['accept the cover invitation', 'answerInvite'],
    ['I want to accept Alex’s invite', 'answerInvite'],
    ['reject the cover request from Taylor', 'answerInvite'],
    ['cancel my claim for Friday', 'cancelCover'],
    ['cancel my cover request for the Saturday shift', 'cancelCover'],
    ['withdraw the invitation I sent to Sam', 'cancelCover'],
    ['withdraw my time-off request for the 24th', 'cancelTimeOff'],
    ['cancel my time off request for the shift on Friday', 'cancelTimeOff'],
    // Existing routes keep their answers.
    ['pause my Saturday rule', 'rules'],
    ['cancel my Saturday availability rule', 'rules'],
    ['did alex accept my cover request', 'coverStatus'],
    ['was my time off for the 24th rejected', 'timeOffStatus'],
    ['how do I cancel a claim', 'help'],
  ])
    assert.equal(employee(text), route, text);
  // Still blocked: the shift itself, other commands, someone else's claim,
  // and a follow-through joined to a blocked command.
  for (const text of [
    'cancel my shift',
    'cancel my shift since I have time off',
    'cancel my shift as my leave was approved',
    'decline Sam’s claim',
    'decline the invite, delete my shift',
    'decline Alex’s invite and approve Sam’s claim',
  ]) {
    assert.equal(requestsUnsupportedAction(text, false), true, text);
    assert.equal(employee(text), 'clarification', text);
  }
  // Managers keep the blocked or generic replies.
  for (const text of [
    'decline Jamie’s invite for Friday',
    'cancel my claim for Friday',
    'withdraw my time-off request for the 24th',
  ])
    assert.ok(!FOLLOW_THROUGH.includes(routeChat(text, true, null)), text);
  for (const route of FOLLOW_THROUGH) {
    assert.ok(ROUTES.has(route), route);
    assert.ok(WRITE_CAPABLE.has(route), route);
  }
  // A picker reply continues the same lookup.
  const previous = { topic: 'cancelCover', text: 'Which request do you mean?' };
  assert.deepEqual(
    resolveChatTarget({
      text: 'the second one',
      manager: false,
      routed: employee('the second one'),
      previous,
      statusTopics: FOLLOW_THROUGH,
      choiceReply: () => 'picked',
    }),
    { target: 'cancelCover', statusLookup: true, choice: 'picked' },
  );
});

test('reads the answer, the coworker and a bare day of the month', () => {
  assert.equal(
    invitationAnswer('Alex asked me to cover Saturday, accept it'),
    'accept',
  );
  assert.equal(invitationAnswer('turn it down'), 'decline');
  assert.equal(invitationAnswer('say no to Jamie’s invite'), 'decline');
  assert.equal(invitationAnswer('open the invitation'), null);
  assert.equal(
    namedCoworker('Alex asked me to cover Saturday, accept it'),
    'Alex',
  );
  assert.equal(
    namedCoworker('decline jamie lee’s invite for Friday'),
    'jamie lee',
  );
  assert.equal(
    namedCoworker('accept the cover invitation from sam rivera'),
    'sam rivera',
  );
  assert.equal(
    namedCoworker('withdraw the invitation I sent to Taylor'),
    'Taylor',
  );
  assert.equal(namedCoworker('accept the cover invitation for Friday'), null);
  assert.equal(namedCoworker('cancel my claim for Friday'), null);
  assert.equal(
    withMonth('my time off for the 24th', '2026-11-26'),
    'my time off for December 24',
  );
  assert.equal(
    withMonth('my time off on the 28th', '2026-11-26'),
    'my time off on November 28',
  );
  assert.equal(
    withMonth('December 3rd leave', '2026-11-26'),
    'December 3rd leave',
  );
});

// A minimal DOM for rendering the chat card in Node.
function node(tag) {
  const listeners = {};
  return {
    tag,
    children: [],
    hidden: false,
    isConnected: true,
    dataset: {},
    classList: { add() {} },
    setAttribute() {},
    append(...values) {
      this.children.push(...values);
    },
    replaceChildren() {
      this.children = [];
    },
    addEventListener(type, handler) {
      listeners[type] = handler;
    },
    click() {
      listeners.click?.();
    },
    closest() {
      return null;
    },
  };
}
const texts = (item) =>
  [item.textContent, ...item.children.flatMap(texts)].filter(Boolean);
const links = (item) => [
  ...(item.tag === 'a' ? [item] : []),
  ...item.children.flatMap(links),
];
const buttons = (item) => [
  ...(item.tag === 'button' ? [item] : []),
  ...item.children.flatMap(buttons),
];

test('chat finds only the employee’s own items and links to their confirmations', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'covershift-cs067-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const store = new JsonStore(join(root, 'db.json'));
  await buildDemoFixtures(store, {
    now: clock(),
    timezone,
    hash: async () => 'fictional-hash',
  });
  let db = await store.read();
  const shiftOf = (title) => db.shifts.find((shift) => shift.title === title);
  await saveWindow(
    store,
    'worker_sam',
    {
      window: {
        startLocal: '2026-12-03T07:00',
        endLocal: '2026-12-03T23:00',
        timezone,
      },
      submissionId: randomUUID(),
    },
    clock,
  );
  const invite = async (from, title) => {
    const option = (
      await coverOptions(store, from, 'worker_sam', clock)
    ).shifts.find((shift) => shift.id === shiftOf(title).id);
    return (
      await sendCoverInvitation(
        store,
        from,
        {
          recipientId: 'worker_sam',
          shiftId: option.id,
          revision: option.revision,
          submissionId: randomUUID(),
          note: 'PRIVATE CANARY',
        },
        clock,
      )
    ).invitation;
  };
  const fromJamie = await invite('worker_jamie', 'Opening service');
  const fromAlex = await invite('worker_alex', 'Afternoon coverage');
  const leave = (
    await requestTimeOff(
      store,
      'worker_sam',
      {
        startLocal: '2026-12-24T00:00',
        endLocal: '2026-12-25T00:00',
        allDay: true,
        timezone,
        note: 'PRIVATE CANARY',
        submissionId: randomUUID(),
      },
      clock,
    )
  ).request;
  db = await store.read();
  const before = JSON.stringify(db);

  const sessions = new SessionStore();
  const server = createAppServer({ store, sessions, shiftClock: clock });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const realFetch = globalThis.fetch;
  const originalDocument = globalThis.document;
  let cookie = '';
  globalThis.fetch = (url, init = {}) =>
    realFetch(base + url, {
      ...init,
      headers: { ...init.headers, Cookie: cookie },
    });
  globalThis.document = { createElement: node };
  t.after(() => {
    globalThis.fetch = realFetch;
    globalThis.document = originalDocument;
    return new Promise((resolve) => server.close(resolve));
  });

  async function ask(user, create, text) {
    cookie = sessions.create(user).cookie.split(';')[0];
    const outcomes = [];
    const view = {
      card: node('div'),
      chat: { clear() {} },
      notice() {},
      setBusy() {},
      onOutcome: (message) => outcomes.push(message),
    };
    const lookup = create(view, user);
    await lookup.load(text);
    const answer = () => ({
      message: outcomes.at(-1),
      text: texts(view.card).join(' | '),
      hrefs: links(view.card).map((link) => link.href),
      buttons: buttons(view.card),
    });
    return { ...answer(), lookup, answer };
  }

  // Answer an invitation: narrowed by the sender's name, never another's.
  let reply = await ask(
    'worker_sam',
    createInviteAnswer,
    'Alex asked me to cover Thursday, accept it',
  );
  assert.match(
    reply.message,
    /^Ready to accept Afternoon coverage .* From Alex Morgan\. Confirm it on Cover requests\.$/,
  );
  assert.deepEqual(reply.hrefs, [
    `/workspace/worker/cover?invitation=${fromAlex.id}&action=accept`,
  ]);
  assert.match(reply.text, /You aren’t assigned until they approve/);
  reply = await ask('worker_sam', createInviteAnswer, 'decline jamie’s invite');
  assert.deepEqual(reply.hrefs, [
    `/workspace/worker/cover?invitation=${fromJamie.id}&action=decline`,
  ]);
  assert.equal(
    (await ask('worker_sam', createInviteAnswer, 'accept Taylor’s invite'))
      .message,
    'No matching invitation found.',
  );
  // Several: a list to choose from, and "the second one" picks one.
  reply = await ask(
    'worker_sam',
    createInviteAnswer,
    'accept the cover invitation',
  );
  assert.equal(reply.message, 'Which invitation do you mean?');
  assert.equal(reply.buttons.length, 2);
  const picked = reply.lookup.choiceReply('the second one');
  assert.equal(picked, fromAlex.id);
  await reply.lookup.loadChoice(picked);
  assert.deepEqual(reply.answer().hrefs, [
    `/workspace/worker/cover?invitation=${fromAlex.id}&action=accept`,
  ]);
  // The sender sees nothing to answer.
  assert.equal(
    (
      await ask(
        'worker_jamie',
        createInviteAnswer,
        'accept the cover invitation',
      )
    ).message,
    'You have no cover invitations waiting for your answer.',
  );

  // Cancel: the invitation Alex sent, or a cover request Alex created.
  reply = await ask(
    'worker_alex',
    createCancelCover,
    'withdraw the invitation I sent to Sam',
  );
  assert.deepEqual(reply.hrefs, [
    `/workspace/worker/cover?invitation=${fromAlex.id}&action=cancel`,
  ]);
  const morning = db.coverageRequests.find(
    (request) => request.shiftId === shiftOf('Morning coverage').id,
  );
  reply = await ask(
    'worker_alex',
    createCancelCover,
    'cancel my cover request for Friday',
  );
  assert.deepEqual(reply.hrefs, [
    `/workspace/worker/requests?request=${morning.id}&action=cancel`,
  ]);
  assert.match(
    reply.text,
    /Claimed by Jamie Lee, waiting for manager approval\./,
  );
  // A claim on a coworker's shift can't be withdrawn: an honest answer.
  reply = await ask(
    'worker_jamie',
    createCancelCover,
    'cancel my claim for Friday',
  );
  assert.match(reply.message, /can’t be withdrawn in CoverShift/);
  assert.deepEqual(reply.hrefs, ['/workspace/worker/requests']);
  assert.equal(
    (await ask('worker_taylor', createCancelCover, 'cancel my cover request'))
      .message,
    'You have no pending cover requests or invitations to cancel.',
  );

  // Cancel time off, read as December 24.
  reply = await ask(
    'worker_sam',
    createCancelTimeOff,
    'withdraw my time-off request for the 24th',
  );
  assert.deepEqual(reply.hrefs, [
    `/workspace/worker/time-off?request=${leave.id}&action=cancel`,
  ]);
  assert.match(
    reply.message,
    /^Ready to cancel your time off for Dec 24, 2026 · Full day \(pending manager approval\)\. Confirm it on Time off\.$/,
  );
  assert.match(
    (await ask('worker_alex', createCancelTimeOff, 'cancel my leave')).message,
    /^You have no upcoming time-off requests to cancel\./,
  );

  // Private notes never appear, and nothing was saved by the lookups.
  for (const user of ['worker_sam', 'worker_alex'])
    for (const create of [
      createInviteAnswer,
      createCancelCover,
      createCancelTimeOff,
    ])
      assert.doesNotMatch(
        (await ask(user, create, 'cancel it')).text,
        /PRIVATE CANARY/,
      );
  assert.equal(JSON.stringify(await store.read()), before);
});

test('a chat link opens the page’s own confirmation once, or says why it can’t', () => {
  const saved = {
    location: globalThis.location,
    history: globalThis.history,
    CSS: globalThis.CSS,
  };
  const replaced = [];
  globalThis.history = {
    state: null,
    replaceState: (_state, _title, url) => replaced.push(url),
  };
  globalThis.CSS = { escape: (value) => value };
  try {
    const open = (search, items) => {
      globalThis.location = {
        search,
        pathname: '/workspace/worker/cover',
        hash: '',
      };
      const clicked = [];
      const feedback = { textContent: '', hidden: true, focus() {} };
      const main = {
        querySelector: (selector) =>
          items[selector] && {
            querySelectorAll: () =>
              items[selector].map((action) => ({
                dataset: { coverAction: action },
                click: () => clicked.push(action),
              })),
          },
      };
      openRequestedAction(
        main,
        'invitation',
        'cover-',
        ['accept', 'decline', 'cancel'],
        feedback,
      );
      return { clicked, feedback };
    };
    let result = open('?invitation=a1&action=decline', {
      '#cover-a1': ['accept', 'decline'],
    });
    assert.deepEqual(result.clicked, ['decline']);
    assert.equal(replaced.at(-1), '/workspace/worker/cover?invitation=a1');
    result = open('?invitation=a1&action=accept', { '#cover-a1': [] });
    assert.deepEqual(result.clicked, []);
    assert.match(result.feedback.textContent, /can no longer be accepted/);
    result = open('?invitation=a1&action=delete', { '#cover-a1': ['accept'] });
    assert.deepEqual(result.clicked, []);
    assert.equal(result.feedback.hidden, true);
    result = open('?invitation=a1', { '#cover-a1': ['accept'] });
    assert.deepEqual(result.clicked, []);
  } finally {
    Object.assign(globalThis, saved);
  }
});
