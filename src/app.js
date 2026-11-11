import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { registerManager, SignupError } from './auth/signup.js';

const assets = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/signup', ['signup.html', 'text/html; charset=utf-8']],
  ['/signup.css', ['signup.css', 'text/css; charset=utf-8']],
  ['/signup.js', ['signup.js', 'text/javascript; charset=utf-8']],
]);

export function createSignupLimiter({ limit = 5, windowMs = 10 * 60 * 1000 } = {}) {
  const attempts = new Map();
  return (address, now = Date.now()) => {
    for (const [key, entry] of attempts) if (entry.reset <= now) attempts.delete(key);
    let entry = attempts.get(address);
    if (!entry) {
      if (attempts.size >= 1000) throw new SignupError(503, 'Account creation is busy. Please try again later.');
      entry = { count: 0, reset: now + windowMs };
      attempts.set(address, entry);
    }
    if (entry.count >= limit) throw new SignupError(429, 'Too many signup attempts. Please wait 10 minutes before trying again.');
    entry.count++;
  };
}

function sendJson(response, status, value) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(value));
}
async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request.iterator({ destroyOnReturn: false })) {
    size += chunk.length;
    if (size > 8192) throw new SignupError(413, 'Signup form is too large.');
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new SignupError(400, 'The signup request could not be read. Please try again.'); }
}

export function createAppServer({ store, signup = registerManager, limitSignup = createSignupLimiter() }) {
  return createServer(async (request, response) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'same-origin');
    response.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    let pathname;
    try { pathname = new URL(request.url, 'http://localhost').pathname; }
    catch { sendJson(response, 400, { message: 'Invalid request URL.' }); return; }
    if (pathname === '/api/signup') {
      if (request.method !== 'POST') {
        response.setHeader('Allow', 'POST');
        sendJson(response, 405, { message: 'Use POST to create an account.' }); return;
      }
      try {
        const expectedOrigin = `${request.socket.encrypted ? 'https' : 'http'}://${request.headers.host}`;
        if (request.headers.origin !== expectedOrigin || request.headers['sec-fetch-site'] === 'cross-site') throw new SignupError(403, 'Please submit signup from this website.');
        if ((request.headers['content-type'] || '').split(';')[0].trim().toLowerCase() !== 'application/json') throw new SignupError(415, 'Signup requires JSON form data.');
        limitSignup(request.socket.remoteAddress);
        sendJson(response, 201, await signup(store, await readJson(request)));
      } catch (error) {
        request.resume();
        if (error instanceof SignupError) {
          if (error.status === 429) response.setHeader('Retry-After', '600');
          sendJson(response, error.status, { message: error.message, fields: error.fields });
        }
        else {
          // Do not log submitted data, passwords, or stored account records.
          console.error('Signup could not be completed.');
          sendJson(response, 503, { message: 'Account creation is temporarily unavailable. Please try again shortly.' });
        }
      }
      return;
    }
    const asset = assets.get(pathname);
    if (!asset) { response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); response.end('Page not found'); return; }
    if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405, { Allow: 'GET, HEAD' }); response.end(); return; }
    try {
      const content = await readFile(new URL(`../public/${asset[0]}`, import.meta.url));
      response.writeHead(200, { 'Content-Type': asset[1], 'Cache-Control': 'no-store' });
      response.end(request.method === 'HEAD' ? undefined : content);
    } catch {
      response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Unable to load this page.');
    }
  });
}
