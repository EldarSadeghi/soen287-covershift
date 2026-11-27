import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { buildSnapshot } from '../scripts/routing-snapshot.mjs';

// Guards refactors of the chat routing: any change in what the routing
// functions return fails here. Rewrite the fixture only for deliberate routing
// changes with `node scripts/routing-snapshot.mjs --write`, and review the diff.
test('chat routing matches the recorded snapshot', async () => {
  const saved = JSON.parse(
    await readFile(
      new URL('./fixtures/routing-snapshot.json', import.meta.url),
      'utf8',
    ),
  );
  const current = await buildSnapshot();
  assert.deepEqual(
    Object.keys(current.single).sort(),
    Object.keys(saved.single).sort(),
    'the snapshot corpus changed',
  );
  for (const [text, expected] of Object.entries(saved.single)) {
    assert.deepEqual(
      current.single[text],
      expected,
      `single message: ${JSON.stringify(text)}`,
    );
  }
  assert.deepEqual(current.topical, saved.topical);
  assert.deepEqual(current.followUps, saved.followUps);
  assert.deepEqual(current.suggestions, saved.suggestions);
});
