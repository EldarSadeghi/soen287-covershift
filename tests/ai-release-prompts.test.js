import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

test('assistant routes and resolves the release audit prompts', () => {
  const script = fileURLToPath(new URL('../docs/acceptance/ai-release-audit/probes.mjs', import.meta.url));
  const run = spawnSync(process.execPath, [script], { encoding: 'utf8' });
  if (run.error) throw run.error;
  assert.equal(run.stderr, '');
  const failures = JSON.parse(run.stdout).filter(row => row.status === 'FAIL');
  assert.deepEqual(failures, []);
  assert.equal(run.status, 0);
});
