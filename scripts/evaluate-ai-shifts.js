// Optional PAID provider evaluation using fictional data only. Not part of tests.
// Run with Node --env-file=/path/to/private/.env scripts/evaluate-ai-shifts.js
import assert from 'node:assert/strict';
import { join, dirname } from 'node:path';
import { store as configuredStore } from '../src/storage/index.js';
import { demoDatabase } from '../src/storage/seed.js';
import { AiAllowance } from '../src/ai/allowance.js';
import { createAiShiftDrafter } from '../src/ai/shift-draft.js';

const db = demoDatabase(); db.users[0].passwordHash = 'fictional evaluation account';
// No access to actual business records. Share the normal configured allowance.
const store = { read: async () => structuredClone(db) };
const ai = createAiShiftDrafter({ apiKey: process.env.OPENAI_API_KEY, model: process.env.OPENAI_MODEL || 'gpt-6-luna', allowance: new AiAllowance(join(dirname(configuredStore.filename), 'ai-usage')) });
const now = Date.parse('2026-11-20T22:00:00Z');
const cases = [
 { name: 'complete explicit shift', description: 'Opening service for Jamie Lee on December 3, 2026 from 9 AM to 3 PM.', expected: 'draft', start: '2026-12-03T09:00', end: '2026-12-03T15:00' },
 { name: 'next weekday with explicit hours', description: 'Opening service for Jamie Lee next Thursday from 9 AM to 3 PM.', expected: 'draft', start: '2026-11-26T09:00', end: '2026-11-26T15:00' },
 { name: 'overnight explicit next-day end', description: 'Night service for Jamie Lee on December 4, 2026 from 10 PM until December 5, 2026 at 6 AM.', expected: 'draft', start: '2026-12-04T22:00', end: '2026-12-05T06:00' },
 { name: 'ambiguous hours and missing title', description: 'Give Jamie a shift next Thursday from 9 to 3.', expected: 'clarification' },
 { name: 'worker not in roster', description: 'Opening service for Pat Unknown on December 3, 2026 from 9 AM to 3 PM.', expected: 'clarification' },
 { name: 'employee availability is not an assignment', description: 'Jamie is available next Thursday from 9 AM to 3 PM.', expected: 'clarification' },
];
let failed = 0;
for (const example of cases) {
 try {
  const result = await ai(store, 'manager_morgan', { description: example.description }, () => now);
  assert.equal(result.kind, example.expected);
  if (example.start) {
   assert.equal(result.draft.assignedWorkerId, 'worker_jamie');
   assert.equal(result.draft.startLocal, example.start); assert.equal(result.draft.endLocal, example.end);
  }
  console.log(`PASS: ${example.name}`);
 } catch { failed++; console.error(`FAIL: ${example.name} (no provider payload or secrets logged)`); }
}
if (failed) process.exitCode = 1;
