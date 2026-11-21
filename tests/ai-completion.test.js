import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createChatState, CHAT_KEY } from '../public/ai-chat-state.js';
import { JsonStore } from '../src/storage/json-store.js';
import { seedDemo } from '../src/storage/seed.js';
import { SessionStore } from '../src/auth/sessions.js';
import { createAppServer } from '../src/app.js';

const time = Date.parse('2026-11-21T16:00:00Z');
const storage = () => { const map = new Map(); return { getItem: key => map.get(key), setItem: (key, value) => map.set(key, value), removeItem: key => map.delete(key) }; };
const proposal = () => ({ id: 'draft-a', kind: 'draft', draft: { title: 'Opening service', assignedWorkerId: 'worker_jamie', startLocal: '2026-12-09T09:00', endLocal: '2026-12-09T15:00' }, workerName: 'Jamie Lee', timezone: 'America/Toronto' });
const saved = () => ({ shift: { id: 'shift_confirmed', title: 'Reviewed evening service', assignedWorker: { id: 'worker_sam', name: 'Sam Rivera' }, startsAt: '2026-12-09T20:00:00.000Z', endsAt: '2026-12-10T02:00:00.000Z' }, timezone: 'America/Toronto' });
function fixture() {
 const memory = storage(); const chat = createChatState(memory, 'business:manager', () => time);
 chat.value.messages = [{ role: 'user', text: 'Create an opening shift.' }, { role: 'assistant', text: 'Proposed shift. Nothing has been saved.' }];
 chat.value.suggestion = proposal(); chat.save(); return { chat, memory };
}

test('confirmed HTTP creation completes only matching reviewed draft using final edited server fields; survives reload', async t => {
 const dir = await mkdtemp(join(tmpdir(), 'covershift-ai-completion-')); t.after(() => rm(dir, { recursive: true, force: true }));
 const store = new JsonStore(join(dir, 'covershift.json')); await seedDemo(store);
 await store.transaction(db => { db.users[0].passwordHash = 'fictional test hash'; });
 const sessions = new SessionStore(); const server = createAppServer({ store, sessions, shiftClock: () => time });
 await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
 const origin = `http://127.0.0.1:${server.address().port}`; const cookie = sessions.create('manager_morgan').cookie.split(';')[0];
 const session = await (await fetch(origin + '/api/session', { headers: { Cookie: cookie } })).json();
 const { chat, memory } = fixture();
 const reviewed = { ...proposal().draft, title: 'Reviewed evening service', assignedWorkerId: 'worker_sam', startLocal: '2026-12-09T15:00', endLocal: '2026-12-09T21:00' };
 const response = await fetch(origin + '/api/manager/shifts', { method: 'POST', headers: { Cookie: cookie, Origin: origin, 'Content-Type': 'application/json', 'X-CSRF-Token': session.csrfToken }, body: JSON.stringify(reviewed) });
 assert.equal(response.status, 201); const result = await response.json();
 assert.equal(chat.markCreated('draft-a', result), true);
 assert.equal(chat.value.completion.shift.title, reviewed.title); assert.equal(chat.value.completion.shift.assignedWorker.name, 'Sam Rivera');
 assert.equal(chat.value.completion.shift.startsAt, '2026-12-09T20:00:00.000Z');
 assert.equal(chat.value.completion.shift.endsAt, '2026-12-10T02:00:00.000Z');
 assert.equal(chat.value.pending, null); assert.equal(chat.value.messages.length, 2);
 assert.match(chat.value.messages[1].text, /Shift created:.*Reviewed evening service.*Sam Rivera/);
 assert.doesNotMatch(chat.value.messages[1].text, /Nothing has been saved/);
 const reopened = createChatState(memory, 'business:manager', () => time + 1000);
 assert.deepEqual(reopened.value.completion, chat.value.completion);
 assert.deepEqual(reopened.value.messages, chat.value.messages);
 assert.equal((await store.read()).shifts.filter(shift => shift.id === result.shift.id).length, 1);
});

test('unrelated manual save, declined handoff and older draft IDs cannot complete the current suggestion', () => {
 const { chat } = fixture(); const before = structuredClone(chat.value);
 for (const id of [null, undefined, '', 'draft-other']) assert.equal(chat.markCreated(id, saved()), false);
 assert.deepEqual(chat.value, before);
 chat.value.suggestion = { ...proposal(), id: 'draft-b' };
 assert.equal(chat.markCreated('draft-a', saved()), false); assert.equal(chat.value.completion, null);
 assert.equal(chat.markUncertain('draft-a'), false); assert.equal(chat.value.uncertainDraftId, null);
});

test('New chat, logout and account changes isolate late completion and uncertainty events', () => {
 const { chat, memory } = fixture(); chat.reset();
 assert.equal(chat.markCreated('draft-a', saved()), false); assert.equal(chat.markUncertain('draft-a'), false);
 assert.equal(chat.value.completion, null);
 chat.value.suggestion = proposal(); assert.equal(chat.markCreated('draft-a', saved()), true);
 const other = createChatState(memory, 'different-business:manager', () => time);
 assert.equal(other.value.completion, null); assert.equal(other.value.suggestion, null);
 chat.clear(); assert.equal(chat.markCreated('draft-a', saved()), false); assert.equal(memory.getItem(CHAT_KEY), undefined);
});

test('duplicate/late responses are idempotent and cannot downgrade a confirmed save to uncertain', () => {
 const { chat } = fixture(); assert.equal(chat.markCreated('draft-a', saved()), true);
 const confirmed = structuredClone(chat.value);
 assert.equal(chat.markCreated('draft-a', { ...saved(), shift: { ...saved().shift, title: 'Wrong later response' } }), false);
 assert.equal(chat.markUncertain('draft-a'), false); assert.deepEqual(chat.value, confirmed);
});

test('uncertain save is explicitly unconfirmed across reload; only matching later confirmed response can promote it', () => {
 const { chat, memory } = fixture();
 assert.equal(chat.markUncertain('draft-a'), true); assert.equal(chat.value.completion, null);
 assert.equal(chat.value.uncertainDraftId, 'draft-a'); assert.match(chat.value.messages[1].text, /Save not confirmed/);
 assert.doesNotMatch(chat.value.messages[1].text, /Shift created|Nothing has been saved/);
 const reopened = createChatState(memory, 'business:manager', () => time + 1000);
 assert.equal(reopened.value.uncertainDraftId, 'draft-a'); assert.equal(reopened.value.completion, null);
 assert.equal(reopened.markCreated('draft-other', saved()), false);
 assert.equal(reopened.markCreated('draft-a', saved()), true); assert.equal(reopened.value.uncertainDraftId, null);
});

test('invalid or incomplete success payload never fabricates a completion receipt', () => {
 const { chat } = fixture();
 for (const result of [null, {}, { ...saved(), timezone: 'Invalid/Zone' }, { ...saved(), shift: { ...saved().shift, startsAt: 'not-a-date' } }, { ...saved(), shift: { ...saved().shift, endsAt: '2026-12-08T00:00:00.000Z' } }, { ...saved(), shift: { ...saved().shift, id: undefined } }]) assert.equal(chat.markCreated('draft-a', result), false);
 assert.equal(chat.value.completion, null); assert.match(chat.value.messages[1].text, /Nothing has been saved/);
});

test('legacy cached suggestion receives a stable identity and matching pending handoff is migrated', () => {
 const memory = storage(); const suggestion = proposal(); delete suggestion.id;
 memory.setItem(CHAT_KEY, JSON.stringify({ owner: 'b:m', messages: [], updatedAt: time, suggestion, pending: { draft: suggestion.draft, timezone: suggestion.timezone, createdAt: time } }));
 const chat = createChatState(memory, 'b:m', () => time);
 assert.ok(chat.value.suggestion.id); assert.equal(chat.value.pending.id, chat.value.suggestion.id);
 assert.equal(createChatState(memory, 'b:m', () => time + 1).value.suggestion.id, chat.value.suggestion.id);
 assert.equal(chat.markCreated(chat.value.pending.id, saved()), true);
});

test('corrupt/mismatched cached receipts are ignored and completed state expires with existing chat TTL', () => {
 const { chat, memory } = fixture(); chat.markCreated('draft-a', saved());
 const cached = JSON.parse(memory.getItem(CHAT_KEY)); cached.completion.draftId = 'draft-other'; memory.setItem(CHAT_KEY, JSON.stringify(cached));
 assert.equal(createChatState(memory, 'business:manager', () => time + 1).value.completion, null);
 chat.save(); assert.equal(createChatState(memory, 'business:manager', () => time + 9 * 3600000).value.completion, null);
});
