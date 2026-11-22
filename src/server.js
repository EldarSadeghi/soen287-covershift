import { createAiShiftSearcher } from './ai/shift-search.js';
import { store } from './storage/index.js';
import { createAppServer } from './app.js';
import { SessionStore } from './auth/sessions.js';
import { AiAllowance } from './ai/allowance.js';
import { createAiShiftDrafter } from './ai/shift-draft.js';
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
const aiSearch = createAiShiftSearcher(aiOptions);
const aiDraft = createAiShiftDrafter(aiOptions);
createAppServer({ store, sessions, publicOrigin, aiDraft, aiSearch }).listen(port, host, () => {
  console.log(`CoverShift is running at http://${host}:${port}`);
});
