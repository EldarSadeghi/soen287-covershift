import { createEmployeeDrafter } from './ai/employee-drafts.js';
import { createAiShiftEditor } from './ai/shift-edit.js';
import { createAiIntentClassifier } from './ai/intent.js';
import { createAiScheduleAnswerer } from './ai/schedule-questions.js';
import { reconcileAvailability, startAvailabilityMatching } from './availability/matching.js';
import { createAiAvailabilityDrafter } from './ai/availability-draft.js';
import { createAiShiftSearcher } from './ai/shift-search.js';
import { store } from './storage/index.js';
import { createAppServer } from './app.js';
import { SessionStore } from './auth/sessions.js';
import { AiAllowance } from './ai/allowance.js';
import { createAiShiftDrafter } from './ai/shift-draft.js';
import { aiStartupWarnings } from './ai/startup-check.js';
import { RoutingLog } from './ai/routing-log.js';
import { dirname, join } from 'node:path';

const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT || 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be an integer between 1 and 65535.');
const publicOrigin = process.env.PUBLIC_ORIGIN || null;
if (publicOrigin && new URL(publicOrigin).origin !== publicOrigin) throw new Error('PUBLIC_ORIGIN must be an exact origin without a path or trailing slash.');
if (publicOrigin && !['http:', 'https:'].includes(new URL(publicOrigin).protocol)) throw new Error('PUBLIC_ORIGIN must use HTTP or HTTPS.');
if (process.env.NODE_ENV === 'production' && !publicOrigin?.startsWith('https://')) throw new Error('Production requires an HTTPS PUBLIC_ORIGIN.');
const sessions = new SessionStore({ secure: publicOrigin?.startsWith('https://') || false });

// Startup validates records or creates empty storage; demo seeding is explicit.
await store.initialize();
const allowance = new AiAllowance(join(dirname(store.filename), 'ai-usage'));
const aiOptions = { apiKey: process.env.OPENAI_API_KEY, model: process.env.OPENAI_MODEL || 'gpt-6-luna', allowance };
for (const warning of await aiStartupWarnings({ apiKey: process.env.OPENAI_API_KEY, model: process.env.OPENAI_MODEL, usageDirectory: allowance.directory })) {
  console.warn(`AI configuration: ${warning}`);
}
const routingLog = new RoutingLog(join(dirname(store.filename), 'ai-routing'));
const aiAvailability = createAiAvailabilityDrafter(aiOptions);
const aiSearch = createAiShiftSearcher(aiOptions);
const aiSchedule = createAiScheduleAnswerer(aiOptions);
const aiDraft = createAiShiftDrafter(aiOptions);
await reconcileAvailability(store);
const matching = startAvailabilityMatching(store);
const server = createAppServer({ store, sessions, publicOrigin, aiDraft, aiEdit: createAiShiftEditor(aiOptions), aiTimeOff: createEmployeeDrafter('timeOffDraft', aiOptions), aiCover: createEmployeeDrafter('coverDraft', aiOptions), aiSearch, aiAvailability, aiSchedule, aiIntent: createAiIntentClassifier(aiOptions), aiAllowance: allowance, routingLog }).listen(port, host, () => {
  console.log(`CoverShift is running at http://${host}:${port}`);
});

server.on('close', () => matching.stop());
