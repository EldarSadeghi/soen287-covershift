import { store } from './storage/index.js';
import { createAppServer } from './app.js';
import { SessionStore } from './auth/sessions.js';

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
createAppServer({ store, sessions, publicOrigin }).listen(port, host, () => {
  console.log(`CoverShift is running at http://${host}:${port}`);
});
