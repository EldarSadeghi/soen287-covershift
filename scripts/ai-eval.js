// `npm run ai:eval` measures chat routing against scripts/ai-eval/messages.json.
//   npm run ai:eval                      offline: local rules only, no network
//   npm run ai:eval -- --live            also asks the real intent classifier
//   npm run ai:eval -- --live --max-calls 50
// Live runs need OPENAI_API_KEY (read from the environment or .env, never
// printed) and use their own usage ledger in .covershift-ai-eval/usage, so they
// never consume the application's grading allowance.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { AiAllowance } from '../src/ai/allowance.js';
import { createAiIntentClassifier } from '../src/ai/intent.js';
import { evaluate, exitCode, formatReport, validateMessages } from './ai-eval/evaluate.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const MAX_CALLS_LIMIT = 500;

function options(argv) {
  const live = argv.includes('--live');
  const index = argv.indexOf('--max-calls');
  const maxCalls = index === -1 ? 200 : Number(argv[index + 1]);
  const known = new Set(['--live', '--max-calls', ...(index === -1 ? [] : [argv[index + 1]])]);
  const unknown = argv.filter(arg => !known.has(arg));
  if (unknown.length) throw new Error(`Unknown option: ${unknown[0]}. Use --live and --max-calls <n>.`);
  if (!Number.isInteger(maxCalls) || maxCalls < 1 || maxCalls > MAX_CALLS_LIMIT) {
    throw new Error(`--max-calls must be an integer from 1 to ${MAX_CALLS_LIMIT}.`);
  }
  return { live, maxCalls };
}

function liveClassifier(maxCalls) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('Live evaluation needs OPENAI_API_KEY in the environment or .env.');
  // A separate ledger: the eval's own lifetime cap, never the app's allowance.
  const allowance = new AiAllowance(join(root, '.covershift-ai-eval', 'usage'), { total: MAX_CALLS_LIMIT, daily: MAX_CALLS_LIMIT });
  const classifier = createAiIntentClassifier({ apiKey, model: process.env.OPENAI_MODEL || 'gpt-6-luna', allowance });
  const accounts = {
    employee: { user: { id: 'ai-eval-employee', role: 'worker' }, business: { timezone: 'America/Toronto' } },
    manager: { user: { id: 'ai-eval-manager', role: 'manager' }, business: { timezone: 'America/Toronto' } },
  };
  return { maxCalls, classify: async row => (await classifier(accounts[row.role], { description: row.message }, Date.now)).intent };
}

try {
  const { live, maxCalls } = options(process.argv.slice(2));
  const data = JSON.parse(await readFile(join(root, 'scripts', 'ai-eval', 'messages.json'), 'utf8'));
  const problems = validateMessages(data);
  if (problems.length) throw new Error(`messages.json is invalid:\n- ${problems.join('\n- ')}`);
  const run = await evaluate(data.messages, live ? liveClassifier(maxCalls) : {});
  const mode = live ? 'live classifier' : 'offline, local rules only';
  const report = formatReport(run, { mode });
  const directory = join(root, '.covershift-ai-eval', `run-${new Date().toISOString().replace(/[:.]/g, '-')}`);
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, 'results.json'), `${JSON.stringify({ mode, generatedAt: new Date().toISOString(), ...run }, null, 2)}\n`);
  await writeFile(join(directory, 'summary.md'), report);
  console.log(report);
  console.log(`Report: ${join(directory, 'summary.md')}`);
  process.exitCode = exitCode(run.summary, { live });
} catch (error) {
  // Never print provider responses or keys; messages here are our own.
  console.error(error instanceof Error ? error.message : 'AI evaluation failed.');
  process.exitCode = 2;
}
