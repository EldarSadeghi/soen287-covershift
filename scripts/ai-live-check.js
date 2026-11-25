// Loads credentials from the process environment only. All application data is fictional.
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAcceptanceContext, FIXED_NOW } from './ai-acceptance/harness.js';

const manager = 'manager_morgan';
const employee = 'worker_jamie';
const schedule = '/api/ai-schedule-question';
const draft = '/api/manager/ai-shift-draft';
const search = '/api/worker/ai-shift-search';

const cases = [
  {
    id: 'employee-schedule',
    async run(ctx, turn) {
      await turn(employee, schedule, 'Could you tell me when I clock in next?', data =>
        data.kind === 'schedule_answer' && data.shifts[0]?.id === ctx.ids.assignedThursday);
      await turn(employee, schedule, 'How many hours am I actually scheduled for this week?', data =>
        data.kind === 'schedule_answer' && data.totalHours === 7 && data.pendingClaims === 1 &&
        data.query.startDate === '2030-01-07' && data.query.endDate === '2030-01-14');
    },
  },
  {
    id: 'employee-search-follow-up',
    async run(ctx, turn) {
      const first = await turn(employee, search, 'Could you look for an open shift Thursday after 2 PM?',
        data => data.kind === 'matches' && data.criteria.date === ctx.dates.thursday &&
          data.criteria.startLocal === ctx.dates.thursday + 'T14:00' &&
          data.requests.some(row => row.id === ctx.ids.manualRequest));
      if (first) await turn(employee, search, 'Actually, only after 3 PM.', data =>
        data.kind === 'matches' && data.criteria.date === ctx.dates.thursday &&
        data.criteria.startLocal === ctx.dates.thursday + 'T15:00' && data.total === 0, first.criteria);
    },
  },
  {
    id: 'manager-draft-follow-up',
    async run(ctx, turn) {
      const first = await turn(manager, draft, 'Put together a Closing service shift for Sam Rivera tomorrow from 1 PM to 6 PM.',
        data => data.kind === 'draft' && data.draft.assignedWorkerId === 'worker_sam' &&
          data.draft.title === 'Closing service' && data.draft.startLocal === '2030-01-08T13:00' &&
          data.draft.endLocal === '2030-01-08T18:00');
      if (first) await turn(manager, draft, 'Make the start 2 PM instead.', data =>
        data.kind === 'draft' && data.draft.assignedWorkerId === 'worker_sam' &&
        data.draft.title === first.draft.title && data.draft.startLocal === '2030-01-08T14:00' &&
        data.draft.endLocal === first.draft.endLocal, first.draft);
    },
  },
];

async function runLive(liveKey) {
  const ctx = await createAcceptanceContext([], { liveKey });
  const results = [];
  try {
    const before = await ctx.bytes();
    for (const probe of cases) {
      const turns = [];
      await probe.run(ctx, async (user, path, description, matches, base) => {
        let response;
        const started = performance.now();
        try {
          response = await ctx.http(user, path, { description, ...(base && { base }) });
        } catch {
          turns.push({ status: 'transport-failure', elapsedMs: Math.round(performance.now() - started) });
          return null;
        }
        const { status, data, elapsedMs } = response;
        const passed = status === 200 && matches(data);
        turns.push({ status: passed ? 'pass' : status === 200 ? 'unexpected-answer' : 'http-failure',
          httpStatus: status, elapsedMs });
        return passed ? data : null;
      });
      results.push({ id: probe.id, status: turns.length === 2 && turns.every(turn => turn.status === 'pass') ? 'pass' : 'fail', turns });
    }
    const unchanged = await ctx.bytes() === before;
    return { mode: 'live-provider', fixtureClock: new Date(FIXED_NOW).toISOString(),
      latency: 'Loopback API request through JSON receipt, independently of browser rendering.',
      passed: results.filter(result => result.status === 'pass').length, total: cases.length,
      fictionalDataUnchanged: unchanged, results };
  } finally {
    await ctx.cleanup();
  }
}

async function preview() {
  const ctx = await createAcceptanceContext([], { preview: true, port: 3061 });
  console.log(`Scripted timing preview: ${ctx.base}/login. Ask “When is my next shift?” as Jamie.`);
  await new Promise(resolve => {
    process.once('SIGINT', resolve);
    process.once('SIGTERM', resolve);
  });
  await ctx.cleanup();
}

try {
  const [mode, ...extra] = process.argv.slice(2);
  if (extra.length || !['--live', '--preview'].includes(mode)) {
    throw new Error('Use --preview for the scripted demo, or --live to explicitly enable paid provider calls.');
  }
  if (mode === '--preview') {
    await preview();
  } else {
    const liveKey = process.env.OPENAI_API_KEY?.trim();
    if (!liveKey) throw new Error('Live checks skipped. Export OPENAI_API_KEY in the environment, then opt in with --live.');
    const report = await runLive(liveKey);
    const root = fileURLToPath(new URL('../.covershift-ai-acceptance/', import.meta.url));
    await mkdir(root, { recursive: true, mode: 0o700 });
    const directory = await mkdtemp(join(root, 'live-'));
    const path = join(directory, 'results.json');
    await writeFile(path, JSON.stringify(report, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    for (const result of report.results) {
      console.log(`${result.id}: ${result.turns.map(turn => `${turn.status} (${turn.elapsedMs} ms)`).join(', ')}`);
    }
    console.log(`${report.passed}/${report.total} live cases passed. Report: ${path}`);
    if (report.passed !== report.total || !report.fictionalDataUnchanged) process.exitCode = 1;
  }
} catch (error) {
  console.error(/^(?:Use --preview|Live checks skipped)/.test(error.message) ? error.message :
    'CS-052 could not start the isolated server or write its report. Check loopback permissions and local report storage.');
  process.exitCode = 1;
}
