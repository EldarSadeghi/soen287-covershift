import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { JsonStore } from '../src/storage/json-store.js';
import { createAppServer } from '../src/app.js';

// The server serves public files from an explicit list. A module that is
// imported but not listed works in Node tests yet fails in the browser, so this
// follows every static and dynamic import from each page's entry script.
const ENTRY_SCRIPTS = [
  '/app.js',
  '/login.js',
  '/setup.js',
  '/signup.js',
  '/workspace.js',
];
const IMPORT =
  /(?:\bimport\s*(?:[\w*{}\s,]+\s*from\s*)?|\bexport\s*[\w*{}\s,]+\s*from\s*|\bimport\s*\()\s*['"](\.{1,2}\/[^'"]+)['"]/g;

test('every module imported by a page script is served', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'covershift-served-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const server = createAppServer({
    store: new JsonStore(join(dir, 'covershift.json')),
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;

  const seen = new Set();
  const queue = [...ENTRY_SCRIPTS];
  while (queue.length) {
    const path = queue.shift();
    if (seen.has(path)) continue;
    seen.add(path);
    const response = await fetch(base + path);
    assert.equal(response.status, 200, `${path} is imported but not served`);
    assert.match(response.headers.get('content-type'), /javascript/);
    const source = await response.text();
    for (const [, specifier] of source.matchAll(IMPORT)) {
      queue.push(new URL(specifier, base + path).pathname);
    }
  }
  for (const module of [
    '/ai-chat-routing.js',
    '/routing/text.js',
    '/routing/dates.js',
  ]) {
    assert.ok(seen.has(module), `${module} should be reachable from a page`);
  }
});
