import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { registerManager } from './auth/signup.js';
import { authenticate, validateLogin } from './auth/login.js';
import { HttpError } from './auth/errors.js';
import { SessionStore, requireAccount, safeAccount } from './auth/sessions.js';
const assets = new Map([
  ['/demo', ['index.html', 'text/html; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/signup', ['signup.html', 'text/html; charset=utf-8']],
  ['/signup.css', ['signup.css', 'text/css; charset=utf-8']],
  ['/signup.js', ['signup.js', 'text/javascript; charset=utf-8']],
  ['/login', ['login.html', 'text/html; charset=utf-8']],
  ['/login.js', ['login.js', 'text/javascript; charset=utf-8']],
  ['/workspace.js', ['workspace.js', 'text/javascript; charset=utf-8']],
  ['/workspace.css', ['workspace.css', 'text/css; charset=utf-8']],
]);
export function createSignupLimiter({ limit = 5, windowMs = 10 * 60 * 1000, message = 'Too many signup attempts. Please wait 10 minutes before trying again.' } = {}) {
  const attempts = new Map();
  return (address, now = Date.now()) => {
    for (const [key, entry] of attempts) if (entry.reset <= now) attempts.delete(key);
    let entry = attempts.get(address);
    if (!entry) {
      if (attempts.size >= 1000) throw new HttpError(503, 'Please try again later.');
      entry = { count: 0, reset: now + windowMs }; attempts.set(address, entry);
    }
    if (entry.count >= limit) throw new HttpError(429, message);
    entry.count++;
  };
}
function sendJson(response, status, value) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(value));
}
function redirect(response, location) { response.writeHead(303, { Location: location, 'Cache-Control': 'no-store' }); response.end(); }
function requireMethod(request, response, method) {
  if (request.method === method || (method === 'GET' && request.method === 'HEAD')) return;
  response.setHeader('Allow', method === 'GET' ? 'GET, HEAD' : method);
  throw new HttpError(405, `Use ${method} for this request.`);
}
function protectMutation(request, publicOrigin) {
  const expectedOrigin = publicOrigin || `${request.socket.encrypted ? 'https' : 'http'}://${request.headers.host}`;
  if (request.headers.origin !== expectedOrigin || request.headers['sec-fetch-site'] === 'cross-site') throw new HttpError(403, 'Please submit this request from this website.');
  if ((request.headers['content-type'] || '').split(';')[0].trim().toLowerCase() !== 'application/json') throw new HttpError(415, 'This request requires JSON form data.');
}
async function readJson(request) {
  const chunks = []; let size = 0;
  for await (const chunk of request.iterator({ destroyOnReturn: false })) {
    size += chunk.length;
    if (size > 8192) throw new HttpError(413, 'Form is too large.');
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new HttpError(400, 'This request could not be read. Please try again.'); }
}
const home = role => `/workspace/${role}/${role === 'manager' ? 'overview' : 'shifts'}`;
const pages = { manager: ['overview', 'schedule', 'approvals', 'team'], worker: ['shifts', 'open', 'requests'] };

export function createAppServer({ store, signup = registerManager, login = authenticate, sessions = new SessionStore(), publicOrigin = null, limitSignup = createSignupLimiter(), limitLogin = createSignupLimiter({ limit: 10, message: 'Too many sign-in attempts. Please wait 10 minutes before trying again.' }) }) {
  const limitLoginEmail = createSignupLimiter({ limit: 10, message: 'Too many sign-in attempts. Please wait 10 minutes before trying again.' });
  return createServer(async (request, response) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'same-origin');
    response.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    if (sessions.secure) response.setHeader('Strict-Transport-Security', 'max-age=31536000');
    let pathname;
    try {
      pathname = new URL(request.url, 'http://localhost').pathname;
      if (pathname === '/api/signup' || pathname === '/api/login') {
        requireMethod(request, response, 'POST'); protectMutation(request, publicOrigin);
        if (pathname === '/api/signup') {
          limitSignup(request.socket.remoteAddress);
          sendJson(response, 201, await signup(store, await readJson(request)));
        } else {
          limitLogin(request.socket.remoteAddress);
          const input = validateLogin(await readJson(request));
          limitLoginEmail(input.email);
          const userId = await login(store, input);
          // Confirm account still exists before issuing any session.
          const user = (await store.read()).users.find(user => user.id === userId);
          if (!user || user.passwordHash === null) throw new HttpError(401, 'Email or password is incorrect.');
          response.setHeader('Set-Cookie', sessions.create(user.id, request.headers.cookie).cookie);
          sendJson(response, 200, { redirectTo: home(user.role) });
        }
        return;
      }
      if (pathname === '/api/logout') {
        requireMethod(request, response, 'POST'); protectMutation(request, publicOrigin);
        const account = await requireAccount(store, sessions, request.headers.cookie);
        if (!sessions.validCsrf(account.session, request.headers['x-csrf-token'])) throw new HttpError(403, 'This request could not be verified. Refresh the page and try again.');
        await readJson(request);
        response.setHeader('Set-Cookie', sessions.destroy(request.headers.cookie));
        response.writeHead(204, { 'Cache-Control': 'no-store' }); response.end(); return;
      }
      if (pathname === '/api/session' || pathname === '/api/manager/context' || pathname === '/api/worker/context' || /^\/api\/businesses\/[^/]+\/context$/.test(pathname)) {
        requireMethod(request, response, 'GET');
        const role = pathname === '/api/manager/context' ? 'manager' : pathname === '/api/worker/context' ? 'worker' : null;
        const account = await requireAccount(store, sessions, request.headers.cookie, role);
        if (pathname.startsWith('/api/businesses/') && pathname.split('/')[3] !== account.business.id) throw new HttpError(404, 'Business not found.');
        sendJson(response, 200, { ...safeAccount(account), ...(pathname === '/api/session' ? { csrfToken: account.session.csrfToken } : {}) }); return;
      }
      if (pathname === '/' || pathname === '/workspace') {
        requireMethod(request, response, 'GET');
        try { const account = await requireAccount(store, sessions, request.headers.cookie); redirect(response, home(account.user.role)); }
        catch (error) { if (error.status === 401) redirect(response, '/login'); else throw error; }
        return;
      }
      let asset = assets.get(pathname);
      if (pathname.startsWith('/workspace/')) {
        requireMethod(request, response, 'GET');
        const [, , role, page, extra] = pathname.split('/');
        if (!pages[role]?.includes(page) || extra !== undefined) throw new HttpError(404, 'Page not found.');
        await requireAccount(store, sessions, request.headers.cookie, role);
        asset = ['workspace.html', 'text/html; charset=utf-8'];
      }
      if (!asset) throw new HttpError(404, 'Page not found.');
      requireMethod(request, response, 'GET');
      const content = await readFile(new URL(`../public/${asset[0]}`, import.meta.url));
      response.writeHead(200, { 'Content-Type': asset[1], 'Cache-Control': 'no-store' });
      response.end(request.method === 'HEAD' ? undefined : content);
    } catch (error) {
      request.resume();
      if (error instanceof HttpError) {
        if (error.status === 401 && pathname?.startsWith('/workspace/')) { redirect(response, '/login?expired=1'); return; }
        if (error.status === 429) response.setHeader('Retry-After', '600');
        if (error.status === 401) response.setHeader('Set-Cookie', sessions.destroy(request.headers.cookie));
        sendJson(response, error.status, { message: error.message, fields: error.fields });
      } else {
        console.error('A request could not be completed.');
        sendJson(response, 503, { message: 'This service is temporarily unavailable. Please try again shortly.' });
      }
    }
  });
}
