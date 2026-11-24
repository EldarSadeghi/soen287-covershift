import {listWindows,saveWindow,withdrawWindow,teamAvailability,coworkerAvailability,coworkerUpcomingWindows} from './availability/windows.js';
import {listTimeOff,requestTimeOff,decideTimeOff} from './time-off/service.js';
import { scheduleShiftDetails } from './ai/schedule-questions.js';
import { listNotifications, markNotificationsRead } from './notifications/service.js';
import { withAvailabilityMatching } from './availability/matching.js';
import { listAvailability, confirmAvailability, changeAvailability } from './availability/rules.js';
import { searchExistingShifts } from './ai/shift-search.js';
import { removeWorker } from './manager/offboarding.js';
import { coverageHistory } from './requests/history.js';
import { reviewCoverage } from './requests/review.js';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { registerManager } from './auth/signup.js';
import { authenticate, validateLogin } from './auth/login.js';
import { HttpError } from './auth/errors.js';
import { SessionStore, requireAccount, safeAccount } from './auth/sessions.js';
import { upcomingWorkerShifts } from './shifts/upcoming.js';
import { managerDashboard } from './manager/dashboard.js';
import { listWorkers, addWorker, reissueSetup, setupDetails, completeSetup } from './manager/workers.js';
import { createShift } from './shifts/create.js';
import { manageShift } from './shifts/manage.js';
import { requestCoverage, cancelCoverage, ownRequests } from './requests/coverage.js';
import { openShiftBoard } from './requests/open.js';
import { checkClaim, claimCoverage } from './requests/claim.js';
const assets = new Map([
  ['/availability-view.js',['availability-view.js','text/javascript; charset=utf-8']],
  ['/time-off.js', ['time-off.js', 'text/javascript; charset=utf-8']],
  ['/ai-response-card.js', ['ai-response-card.js', 'text/javascript; charset=utf-8']],
  ['/ai-schedule.js', ['ai-schedule.js', 'text/javascript; charset=utf-8']],
  ['/notifications.js', ['notifications.js', 'text/javascript; charset=utf-8']],
  ['/request.js', ['request.js', 'text/javascript; charset=utf-8']],
  ['/ai-availability.js', ['ai-availability.js', 'text/javascript; charset=utf-8']],
  ['/ai-employee-request.js', ['ai-employee-request.js', 'text/javascript; charset=utf-8']],
  ['/ai-employee-state.js', ['ai-employee-state.js', 'text/javascript; charset=utf-8']],
  ['/ai-chat-state.js', ['ai-chat-state.js', 'text/javascript; charset=utf-8']],
  ['/ai-shift-draft.js', ['ai-shift-draft.js', 'text/javascript; charset=utf-8']],
  ['/remove-worker.js', ['remove-worker.js', 'text/javascript; charset=utf-8']],
  ['/accessibility.css', ['accessibility.css', 'text/css; charset=utf-8']],
  ['/manage-shift.js', ['manage-shift.js', 'text/javascript; charset=utf-8']],
  ['/create-shift.js', ['create-shift.js', 'text/javascript; charset=utf-8']],
  ['/open-shifts.js', ['open-shifts.js', 'text/javascript; charset=utf-8']],
  ['/claim-conflicts.js', ['claim-conflicts.js', 'text/javascript; charset=utf-8']],
  ['/coverage-history.js', ['coverage-history.js', 'text/javascript; charset=utf-8']],
  ['/review-claim.js', ['review-claim.js', 'text/javascript; charset=utf-8']],
  ['/claim.js', ['claim.js', 'text/javascript; charset=utf-8']],
  ['/coverage.js', ['coverage.js', 'text/javascript; charset=utf-8']],
  ['/worker-requests.js', ['worker-requests.js', 'text/javascript; charset=utf-8']],
  ['/team.js', ['team.js', 'text/javascript; charset=utf-8']],
  ['/setup', ['setup.html', 'text/html; charset=utf-8']],
  ['/setup.js', ['setup.js', 'text/javascript; charset=utf-8']],
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
  ['/worker-shifts.js', ['worker-shifts.js', 'text/javascript; charset=utf-8']],
  ['/shift-time.js', ['shift-time.js', 'text/javascript; charset=utf-8']],
  ['/shift-card.js', ['shift-card.js', 'text/javascript; charset=utf-8']],
  ['/manager-dashboard.js', ['manager-dashboard.js', 'text/javascript; charset=utf-8']],
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
const pages = { manager: ['overview', 'schedule', 'approvals', 'team', 'history', 'time-off', 'availability'], worker: ['shifts', 'open', 'requests', 'history', 'time-off', 'availability'] };

export function createAppServer({ store, signup = registerManager, login = authenticate, sessions = new SessionStore(), publicOrigin = null, limitSignup = createSignupLimiter(), limitLogin = createSignupLimiter({ limit: 10, message: 'Too many sign-in attempts. Please wait 10 minutes before trying again.' }), shiftClock = Date.now, setupClock = Date.now, setupHash, aiDraft = null, aiSearch = null, aiAvailability = null, aiSchedule = null }) {
  const availabilityWindowStore=store; // General windows do not participate in automatic claims.
  store = withAvailabilityMatching(store, shiftClock);
  const limitLoginEmail = createSignupLimiter({ limit: 10, message: 'Too many sign-in attempts. Please wait 10 minutes before trying again.' });
  const limitSetup = createSignupLimiter({ limit: 20, message: 'Too many setup requests. Please wait 10 minutes and try again.' });
  const limitTeam = createSignupLimiter({ limit: 20, message: 'Too many worker changes. Please wait 10 minutes and try again.' });
  const limitShifts = createSignupLimiter({ limit: 60, message: 'Too many shift changes. Please wait 10 minutes and try again.' });
  const limitCoverage = createSignupLimiter({ limit: 30, message: 'Too many coverage changes. Please wait 10 minutes and try again.' });
  const limitNotificationReads = createSignupLimiter({ limit: 120, message: 'Too many notification updates. Please wait and refresh.' });
  const limitAi = createSignupLimiter({ limit: 5, message: 'Too many AI drafting attempts. Wait 10 minutes or use the manual form.' });
  return createServer(async (request, response) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'same-origin');
    response.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    if (sessions.secure) response.setHeader('Strict-Transport-Security', 'max-age=31536000');
    let pathname;
    try {
      pathname = new URL(request.url, 'http://localhost').pathname;
      if(pathname==='/api/worker/coworker-windows'){
        requireMethod(request,response,'GET');const account=await requireAccount(store,sessions,request.headers.cookie,'worker');
        if(new URL(request.url,'http://localhost').search)throw new HttpError(400,'Upcoming coworker windows use 14 calendar days in your business timezone.');
        sendJson(response,200,await coworkerUpcomingWindows(availabilityWindowStore,account.user.id,shiftClock));return;
      }
      if(pathname==='/api/worker/coworker-availability'){
        requireMethod(request,response,'GET');
        const account=await requireAccount(store,sessions,request.headers.cookie,'worker'),query=new URL(request.url,'http://localhost').searchParams;
        if(query.size!==3||!['startLocal','endLocal','timezone'].every(k=>query.getAll(k).length===1))throw new HttpError(400,'Choose only a start, end and business timezone.');
        sendJson(response,200,await coworkerAvailability(availabilityWindowStore,account.user.id,Object.fromEntries(query),shiftClock));return;
      }
      const windowRoute=pathname.match(/^\/api\/(manager|worker)\/availability-windows(?:\/([a-zA-Z0-9_-]{1,80})\/withdraw)?$/);
      if(windowRoute){
        const [,role,id]=windowRoute,listing=request.method==='GET'&&!id;
        requireMethod(request,response,role==='manager'||listing?'GET':'POST');
        const account=await requireAccount(store,sessions,request.headers.cookie,role),query=new URL(request.url,'http://localhost').searchParams;
        if(role==='manager'){
          if(id||query.size!==3||!['startLocal','endLocal','timezone'].every(k=>query.getAll(k).length===1))throw new HttpError(400,'Choose only a start, end and business timezone.');
          sendJson(response,200,await teamAvailability(availabilityWindowStore,account.user.id,Object.fromEntries(query),shiftClock));return;
        }
        if(query.size)throw new HttpError(400,'Availability uses your signed-in account.');
        if(listing){sendJson(response,200,await listWindows(availabilityWindowStore,account.user.id,shiftClock));return;}
        protectMutation(request,publicOrigin);
        if(!sessions.validCsrf(account.session,request.headers['x-csrf-token']))throw new HttpError(403,'Refresh the page and try again.');
        limitCoverage(account.user.id);const input=await readJson(request);
        if(id)sendJson(response,200,await withdrawWindow(availabilityWindowStore,account.user.id,id,input,shiftClock));
        else {const result=await saveWindow(availabilityWindowStore,account.user.id,input,shiftClock);sendJson(response,result.replayed?200:201,result);}
        return;
      }
      const leaveRoute=pathname.match(/^\/api\/(manager|worker)\/time-off(?:\/([a-zA-Z0-9_-]{1,80})\/(approve|reject|cancel))?$/);
      if(leaveRoute){
        const [,role,id,action]=leaveRoute,listing=!id&&request.method==='GET';
        requireMethod(request,response,listing||!id&&role==='manager'?'GET':'POST');
        const account=await requireAccount(store,sessions,request.headers.cookie,role);
        if(new URL(request.url,'http://localhost').search)throw new HttpError(400,'Time off uses your signed-in workspace.');
        if(listing){sendJson(response,200,await listTimeOff(store,account.user.id,role,shiftClock));return;}
        protectMutation(request,publicOrigin);
        if(!sessions.validCsrf(account.session,request.headers['x-csrf-token']))throw new HttpError(403,'Refresh the page and try again.');
        limitCoverage(account.user.id);const input=await readJson(request);
        if(!id){const result=await requestTimeOff(store,account.user.id,input,shiftClock);sendJson(response,result.replayed?200:201,result);}
        else sendJson(response,200,await decideTimeOff(store,account.user.id,role,id,action,input,shiftClock));
        return;
      }
      if (/^\/api\/schedule-shifts\/[a-zA-Z0-9_-]{1,80}$/.test(pathname)) {
        requireMethod(request,response,'GET');const account=await requireAccount(store,sessions,request.headers.cookie);
        if(new URL(request.url,'http://localhost').search)throw new HttpError(400,'This view uses your signed-in schedule.');
        sendJson(response,200,await scheduleShiftDetails(store,account.user.id,pathname.split('/')[3]));return;
      }
      if (pathname === '/api/ai-schedule-question') {
        requireMethod(request,response,'POST');protectMutation(request,publicOrigin);const account=await requireAccount(store,sessions,request.headers.cookie);
        if(!sessions.validCsrf(account.session,request.headers['x-csrf-token']))throw new HttpError(403,'Refresh the page and try again.');
        if(new URL(request.url,'http://localhost').search)throw new HttpError(400,'Questions use your signed-in schedule.');
        limitAi(account.user.id);if(!aiSchedule)throw new HttpError(503,'AI schedule questions are not configured.');
        sendJson(response,200,await aiSchedule(store,account.user.id,await readJson(request),shiftClock));return;
      }
      if (pathname === '/api/notifications'  || pathname === '/api/notifications/read') {
        const reading=pathname.endsWith('/read'); requireMethod(request,response,reading?'POST':'GET');
        const account=await requireAccount(store,sessions,request.headers.cookie);
        const query=new URL(request.url,'http://localhost').searchParams;
        if (reading) {
          protectMutation(request,publicOrigin);
          if (query.size) throw new HttpError(400,'This action uses your signed-in account.');
          if (!sessions.validCsrf(account.session,request.headers['x-csrf-token'])) throw new HttpError(403,'Refresh the page and try again.');
          limitNotificationReads(account.user.id);
          sendJson(response,200,await markNotificationsRead(store,account.user.id,await readJson(request),shiftClock));
        } else {
          if ([...query.keys()].some(k=>k!=='before') || query.getAll('before').length>1 || query.has('before') && !/^[a-f0-9]{64}$/.test(query.get('before'))) throw new HttpError(400,'Invalid notification cursor.');
          sendJson(response,200,await listNotifications(store,account.user.id,query.get('before'),shiftClock()));
        }
        return;
      }
      if (pathname === '/api/signup'  || pathname === '/api/login') {
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
      if (pathname === '/api/worker-setup/details' || pathname === '/api/worker-setup/complete') {
        requireMethod(request, response, 'POST'); protectMutation(request, publicOrigin);
        limitSetup(request.socket.remoteAddress);
        const input = await readJson(request);
        sendJson(response, 200, pathname.endsWith('/details') ? await setupDetails(store, input, setupClock()) : await completeSetup(store, input, { clock: setupClock, ...(setupHash ? { hash: setupHash } : {}) })); return;
      }
      if (/^\/api\/manager\/workers\/[a-zA-Z0-9_-]{1,80}\/(delete|deactivate)$/.test(pathname)) {
        requireMethod(request,response,'POST'); protectMutation(request,publicOrigin);
        const account=await requireAccount(store,sessions,request.headers.cookie,'manager');
        if (!sessions.validCsrf(account.session,request.headers['x-csrf-token'])) throw new HttpError(403,'Refresh the page and try again.');
        if (new URL(request.url,'http://localhost').search) throw new HttpError(400,'This action uses your signed-in business.');
        limitTeam(account.user.id); const parts=pathname.split('/');
        sendJson(response,200,await removeWorker(store,account.user.id,parts[4],parts[5],await readJson(request),setupClock));return;
      }
      if (pathname === '/api/manager/workers' || /^\/api\/manager\/workers\/[^/]+\/setup$/.test(pathname)) {
        const listing = pathname === '/api/manager/workers' && ['GET', 'HEAD'].includes(request.method);
        requireMethod(request, response, listing ? 'GET' : 'POST');
        const account = await requireAccount(store, sessions, request.headers.cookie, 'manager');
        if (new URL(request.url, 'http://localhost').search) throw new HttpError(400, 'This view uses your signed-in business.');
        if (listing) { sendJson(response, 200, await listWorkers(store, account.user.id, setupClock())); return; }
        protectMutation(request, publicOrigin);
        if (!sessions.validCsrf(account.session, request.headers['x-csrf-token'])) throw new HttpError(403, 'Refresh the page and try again.');
        limitTeam(account.user.id);
        const input = await readJson(request);
        sendJson(response, pathname.endsWith('/setup') ? 200 : 201, pathname.endsWith('/setup') ? await reissueSetup(store, account.user.id, pathname.split('/')[4], input, setupClock()) : await addWorker(store, account.user.id, input, setupClock())); return;
      }
      if (pathname === '/api/logout') {
        requireMethod(request, response, 'POST'); protectMutation(request, publicOrigin);
        const account = await requireAccount(store, sessions, request.headers.cookie);
        if (!sessions.validCsrf(account.session, request.headers['x-csrf-token'])) throw new HttpError(403, 'This request could not be verified. Refresh the page and try again.');
        await readJson(request);
        response.setHeader('Set-Cookie', sessions.destroy(request.headers.cookie));
        response.writeHead(204, { 'Cache-Control': 'no-store' }); response.end(); return;
      }
      if (/^\/api\/manager\/shifts\/[a-zA-Z0-9_-]{1,80}\/(edit|delete)$/.test(pathname)) {
        requireMethod(request, response, 'POST'); protectMutation(request, publicOrigin);
        const account = await requireAccount(store, sessions, request.headers.cookie, 'manager');
        if (!sessions.validCsrf(account.session, request.headers['x-csrf-token'])) throw new HttpError(403, 'Refresh the page and try again.');
        if (new URL(request.url, 'http://localhost').search) throw new HttpError(400, 'This action uses your signed-in business.');
        limitShifts(account.user.id);
        const parts = pathname.split('/');
        sendJson(response, 200, await manageShift(store, account.user.id, parts[4], parts[5], await readJson(request), shiftClock)); return;
      }
      if (pathname === '/api/worker/availability-rules' || /^\/api\/worker\/availability-rules\/[a-zA-Z0-9_-]{1,80}\/(pause|resume|cancel)$/.test(pathname) || pathname === '/api/worker/ai-availability-draft') {
        const list = pathname === '/api/worker/availability-rules' && request.method === 'GET';
        requireMethod(request, response, list ? 'GET' : 'POST');
        const account = await requireAccount(store,sessions,request.headers.cookie,'worker');
        if (new URL(request.url,'http://localhost').search) throw new HttpError(400,'Availability uses your signed-in account.');
        if (list) { sendJson(response,200,await listAvailability(store,account.user.id,shiftClock)); return; }
        protectMutation(request,publicOrigin);
        if (!sessions.validCsrf(account.session,request.headers['x-csrf-token'])) throw new HttpError(403,'Refresh the page and try again.');
        const input=await readJson(request);
        if (pathname === '/api/worker/ai-availability-draft') {
          limitAi(account.user.id);
          if (!aiAvailability) throw new HttpError(503,'AI availability drafting is not configured.');
          sendJson(response,200,await aiAvailability(store,account.user.id,input,shiftClock));
        } else {
          limitCoverage(account.user.id);
          if (pathname === '/api/worker/availability-rules') sendJson(response,200,await confirmAvailability(store,account.user.id,input,shiftClock));
          else { const parts=pathname.split('/'); sendJson(response,200,await changeAvailability(store,account.user.id,parts[4],parts[5],input,shiftClock)); }
        }
        return;
      }
      if (['/api/worker/ai-shift-search', '/api/worker/shift-search'].includes(pathname)) {
        requireMethod(request, response, 'POST'); protectMutation(request, publicOrigin);
        const account = await requireAccount(store, sessions, request.headers.cookie, 'worker');
        if (!sessions.validCsrf(account.session, request.headers['x-csrf-token'])) throw new HttpError(403, 'Refresh the page and try again.');
        if (new URL(request.url, 'http://localhost').search) throw new HttpError(400, 'Search uses your signed-in business.');
        const input = await readJson(request);
        if (pathname === '/api/worker/ai-shift-search') {
          limitAi(account.user.id);
          if (!aiSearch) throw new HttpError(503, 'AI search is not configured. Use Open shifts.');
          sendJson(response, 200, await aiSearch(store, account.user.id, input, shiftClock));
        } else { limitCoverage(account.user.id); sendJson(response, 200, await searchExistingShifts(store, account.user.id, input, shiftClock)); }
        return;
      }
      if (pathname === '/api/manager/ai-shift-draft') {
        requireMethod(request, response, 'POST'); protectMutation(request, publicOrigin);
        const account = await requireAccount(store, sessions, request.headers.cookie, 'manager');
        if (!sessions.validCsrf(account.session, request.headers['x-csrf-token'])) throw new HttpError(403, 'Refresh the page and try again.');
        if (new URL(request.url, 'http://localhost').search) throw new HttpError(400, 'Drafting uses your signed-in business.');
        limitAi(account.user.id);
        const input = await readJson(request);
        if (!aiDraft) throw new HttpError(503, 'AI drafting is not configured. Use the manual shift form.');
        sendJson(response, 200, await aiDraft(store, account.user.id, input, shiftClock)); return;
      }
      if (pathname === '/api/manager/shifts') {
        requireMethod(request, response, 'POST'); protectMutation(request, publicOrigin);
        const account = await requireAccount(store, sessions, request.headers.cookie, 'manager');
        if (!sessions.validCsrf(account.session, request.headers['x-csrf-token'])) throw new HttpError(403, 'Refresh the page and try again.');
        if (new URL(request.url, 'http://localhost').search) throw new HttpError(400, 'This action uses your signed-in business.');
        limitShifts(account.user.id);
        sendJson(response, 201, await createShift(store, account.user.id, await readJson(request), shiftClock)); return;
      }
      if (/^\/api\/manager\/requests\/[a-zA-Z0-9_-]{1,80}\/(approve|reject)$/.test(pathname)) {
        requireMethod(request, response, 'POST'); protectMutation(request, publicOrigin);
        const account = await requireAccount(store, sessions, request.headers.cookie, 'manager');
        if (!sessions.validCsrf(account.session, request.headers['x-csrf-token'])) throw new HttpError(403, 'Refresh the page and try again.');
        if (new URL(request.url, 'http://localhost').search) throw new HttpError(400, 'This action uses your signed-in business.');
        limitCoverage(account.user.id);
        const parts = pathname.split('/');
        sendJson(response, 200, await reviewCoverage(store, account.user.id, parts[4], parts[5], await readJson(request), shiftClock)); return;
      }
      if (/^\/api\/(manager|worker)\/coverage-history$/.test(pathname)) {
        requireMethod(request, response, 'GET');
        const role = pathname.split('/')[2];
        const account = await requireAccount(store, sessions, request.headers.cookie, role);
        if (new URL(request.url, 'http://localhost').search) throw new HttpError(400, 'History uses your signed-in account; query filters are not supported.');
        sendJson(response, 200, await coverageHistory(store, account.user.id, role, shiftClock())); return;
      }
      if (pathname === '/api/manager/dashboard') {
        requireMethod(request, response, 'GET');
        const account = await requireAccount(store, sessions, request.headers.cookie, 'manager');
        if (new URL(request.url, 'http://localhost').search) throw new HttpError(400, 'This dashboard uses your signed-in business; query filters are not supported.');
        sendJson(response, 200, await managerDashboard(store, account.user.id, shiftClock())); return;
      }
      if (pathname === '/api/worker/open-shifts') {
        requireMethod(request, response, 'GET');
        const account = await requireAccount(store, sessions, request.headers.cookie, 'worker');
        if (new URL(request.url, 'http://localhost').search) throw new HttpError(400, 'This board uses your signed-in business; query filters are not supported.');
        sendJson(response, 200, await openShiftBoard(store, account.user.id, shiftClock())); return;
      }
      if (/^\/api\/worker\/requests\/[a-zA-Z0-9_-]{1,80}\/(claim-check|claim)$/.test(pathname)) {
        requireMethod(request, response, 'POST'); protectMutation(request, publicOrigin);
        const account = await requireAccount(store, sessions, request.headers.cookie, 'worker');
        if (!sessions.validCsrf(account.session, request.headers['x-csrf-token'])) throw new HttpError(403, 'Refresh the page and try again.');
        if (new URL(request.url, 'http://localhost').search) throw new HttpError(400, 'This action uses your signed-in account.');
        limitCoverage(account.user.id);
        const parts = pathname.split('/');
        sendJson(response, 200, await (parts[5] === 'claim' ? claimCoverage : checkClaim)(store, account.user.id, parts[4], await readJson(request), shiftClock)); return;
      }
      if (pathname === '/api/worker/requests') {
        requireMethod(request, response, 'GET');
        const account = await requireAccount(store, sessions, request.headers.cookie, 'worker');
        if (new URL(request.url, 'http://localhost').search) throw new HttpError(400, 'This view uses your signed-in account.');
        sendJson(response, 200, await ownRequests(store, account.user.id, shiftClock())); return;
      }
      if (/^\/api\/worker\/(shifts\/[a-zA-Z0-9_-]{1,80}\/coverage|requests\/[a-zA-Z0-9_-]{1,80}\/cancel)$/.test(pathname)) {
        requireMethod(request, response, 'POST'); protectMutation(request, publicOrigin);
        const account = await requireAccount(store, sessions, request.headers.cookie, 'worker');
        if (!sessions.validCsrf(account.session, request.headers['x-csrf-token'])) throw new HttpError(403, 'Refresh the page and try again.');
        if (new URL(request.url, 'http://localhost').search) throw new HttpError(400, 'This action uses your signed-in account.');
        limitCoverage(account.user.id);
        const parts = pathname.split('/'); const cancel = parts[3] === 'requests';
        sendJson(response, cancel ? 200 : 201, await (cancel ? cancelCoverage : requestCoverage)(store, account.user.id, parts[4], await readJson(request), shiftClock)); return;
      }
      if (pathname === '/api/worker/shifts') {
        requireMethod(request, response, 'GET');
        const account = await requireAccount(store, sessions, request.headers.cookie, 'worker');
        if (new URL(request.url, 'http://localhost').search) throw new HttpError(400, 'This view uses your signed-in account; query filters are not supported.');
        sendJson(response, 200, await upcomingWorkerShifts(store, account.user.id, shiftClock())); return;
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
