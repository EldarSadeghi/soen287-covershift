import { store } from './storage/index.js';
import { createAppServer } from './app.js';

const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT || 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be an integer between 1 and 65535.');

// Startup validates records or creates empty storage; demo seeding is explicit.
await store.initialize();
createAppServer({ store }).listen(port, host, () => {
  console.log(`CoverShift is running at http://${host}:${port}`);
});
