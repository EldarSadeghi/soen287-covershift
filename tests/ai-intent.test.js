import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AiAllowance } from '../src/ai/allowance.js';
import { createAiIntentClassifier } from '../src/ai/intent.js';
import { routeChat } from '../public/ai-chat-routing.js';

const account = { user: { id: 'employee', role: 'worker' }, business: { timezone: 'America/Toronto' } };
const clock = () => Date.parse('2026-11-01T03:59:00Z');
const reply = result => Response.json({
  status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(result) }] }],
});

test('classifier accepts configured models and returns only role-allowed intent values', async () => {
  const description = 'Could you pull up when I punch in?';
  assert.equal(routeChat(description, false, null), 'clarification');
  const allowance = { reserve: async (...args) => assert.deepEqual(args, ['employee', clock(), 'America/Toronto']) };
  const make = result => createAiIntentClassifier({
    apiKey: 'test', model: 'configured-model', allowance,
    fetchImpl: async (_, { body }) => {
      const payload = JSON.parse(body);
      assert.equal(payload.model, 'configured-model');
      assert.equal(payload.input, description);
      assert.equal(payload.store, false);
      assert.equal(payload.reasoning, undefined);
      return reply(result);
    },
  });
  assert.deepEqual(await make({ intent: 'questions' })(account, { description }, clock), { intent: 'questions' });
  for (const result of [{ intent: 'draft' }, { intent: 'questions', action: 'save' }, { intent: 'clarification' }]) {
    assert.deepEqual(await make(result)(account, { description }, clock), { intent: 'clarification' });
  }
});

test('configured-model errors are clear and do not disclose provider details', async () => {
  const classifier = createAiIntentClassifier({
    apiKey: 'test', model: 'missing-model', allowance: { reserve() {} },
    fetchImpl: async () => Response.json({ error: { code: 'model_not_found', message: 'provider-private' } }, { status: 400 }),
  });
  await assert.rejects(classifier(account, { description: 'Check my schedule' }, clock), error =>
    error.status === 503 && /OPENAI_MODEL/.test(error.message) && !error.message.includes('provider-private'));
});

test('daily allowance resets at Toronto midnight and spans the DST transition', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'covershift-allowance-test-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const allowance = new AiAllowance(dir, { daily: 1 });
  const reserve = timestamp => allowance.reserve('employee', Date.parse(timestamp), 'America/Toronto');
  await reserve('2026-10-31T23:55:00Z');
  await assert.rejects(reserve('2026-11-01T00:01:00Z'), { status: 429 });
  await reserve('2026-11-01T04:00:00Z');
  await assert.rejects(reserve('2026-11-02T04:59:00Z'), { status: 429 });
  await reserve('2026-11-02T05:00:00Z');
});
