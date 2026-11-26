// `npm run ai:routing-report` summarises the private routing log in
// DATA_DIRECTORY/ai-routing. The log holds no message text or user IDs.
import { dirname, join } from 'node:path';
import { store } from '../src/storage/index.js';
import { summarizeRoutingLog } from '../src/ai/routing-log.js';

const directory = join(dirname(store.filename), 'ai-routing');
const summary = await summarizeRoutingLog(directory);
if (!summary.total) {
  console.log(`No routed chat messages recorded yet in ${directory}.`);
} else {
  const percent = count => `${((count / summary.total) * 100).toFixed(1)}%`;
  const table = (title, group) => {
    console.log(`\n${title}`);
    for (const [key, count] of Object.entries(group).sort((a, b) => b[1] - a[1])) console.log(`  ${key.padEnd(22)} ${String(count).padStart(6)}  ${percent(count)}`);
  };
  console.log(`CoverShift routing log: ${summary.total} messages (${summary.months.join(', ')})`);
  console.log(`Clarification replies: ${summary.clarifications} (${percent(summary.clarifications)})`);
  table('By role', summary.byRole);
  table('Decided by', summary.byDecider);
  table('By route', summary.byRoute);
}
