import { explainAvailability } from './availability/explanations.js';
import {getSchedulePeriod,prepareSchedule,publishSchedule,discardDraft} from './schedules/publication.js';
import {coverOptions,listCoverInvitations,sendCoverInvitation,decideCoverInvitation} from './cover/service.js';
import {listWindows,saveWindow,withdrawWindow,teamAvailability,coworkerAvailability,coworkerUpcomingWindows} from './availability/windows.js';
import {listTimeOff,requestTimeOff,decideTimeOff} from './time-off/service.js';
import { workingSummary } from './ai/working-summary.js';
import { createIntentPasses, takeIntentPass } from './ai/intent-pass.js';
import { validRoutingEntry } from './ai/routing-log.js';
import { scheduleShiftDetails } from './ai/schedule-questions.js';
import { listNotifications, markNotificationsRead } from './notifications/service.js';
import { withAvailabilityMatching } from './availability/matching.js';
import { listAvailability, confirmAvailability, changeAvailability } from './availability/rules.js';
import { searchAlternativeShifts, searchExistingShifts } from './ai/shift-search.js';
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
import { getShiftBatchReceipt, saveShiftBatch } from './shifts/batch.js';
import { createShift } from './shifts/create.js';
import { manageShift } from './shifts/manage.js';
import { requestCoverage, cancelCoverage, ownRequests } from './requests/coverage.js';
import { openShiftBoard } from './requests/open.js';
import { checkClaim, claimCoverage } from './requests/claim.js';
const assets = new Map([
  ['/week-planner.js',['week-planner.js','text/javascript; charset=utf-8']],
  ['/schedule-publication.js',['schedule-publication.js','text/javascript; charset=utf-8']],
  ['/cover-ui.js',['cover-ui.js','text/javascript; charset=utf-8']],
  ['/availability-view.js',['availability-view.js','text/javascript; charset=utf-8']],
  ['/time-off.js', ['time-off.js', 'text/javascript; charset=utf-8']],
  ['/ai-response-card.js', ['ai-response-card.js', 'text/javascript; charset=utf-8']],
  ['/ai-claim-status.js', ['ai-claim-status.js', 'text/javascript; charset=utf-8']],
  ['/ai-working-summary.js', ['ai-working-summary.js', 'text/javascript; charset=utf-8']],
  ['/ai-schedule.js', ['ai-schedule.js', 'text/javascript; charset=utf-8']],
  ['/notifications.js', ['notifications.js', 'text/javascript; charset=utf-8']],
  ['/request.js', ['request.js', 'text/javascript; charset=utf-8']],
  ['/ai-availability.js', ['ai-availability.js', 'text/javascript; charset=utf-8']],
  ['/ai-employee-request.js', ['ai-employee-request.js', 'text/javascript; charset=utf-8']],
  ['/ai-employee-state.js', ['ai-employee-state.js', 'text/javascript; charset=utf-8']],
  ['/ai-availability-explanation.js', ['ai-availability-explanation.js', 'text/javascript; charset=utf-8']],
  ['/ai-chat-routing.js', ['ai-chat-routing.js', 'text/javascript; charset=utf-8']],
  ['/ai-chat-state.js', ['ai-chat-state.js', 'text/javascript; charset=utf-8']],
  ['/ai-shift-batch.js', ['ai-shift-batch.js', 'text/javascript; charset=utf-8']],
  ['/ai-chat-view.js', ['ai-chat-view.js', 'text/javascript; charset=utf-8']],
  ['/ai-chat-provider.js', ['ai-chat-provider.js', 'text/javascript; charset=utf-8']],
  ['/ai-chat-send.js', ['ai-chat-send.js', 'text/javascript; charset=utf-8']],
  ['/ai-team-availability.js', ['ai-team-availability.js', 'text/javascript; charset=utf-8']],
  ['/ai-chat-cards.js', ['ai-chat-cards.js', 'text/javascript; charset=utf-8']],
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
  ['/notification-view.js', ['notification-view.js', 'text/javascript; charset=utf-8']],
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
    if (entry.count >= limit) throw new HttpError(429, typeof message === 'function' ? message(Math.ceil((entry.reset - now) / 1000)) : message);
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
const pages = { manager: ['overview', 'schedule', 'approvals', 'team', 'history', 'time-off', 'availability', 'cover'], worker: ['shifts', 'open', 'requests', 'history', 'time-off', 'availability', 'cover'] };

export function createAppServer({ store, signup = registerManager, login = authenticate, sessions = new SessionStore(), publicOrigin = null, limitSignup = createSignupLimiter(), limitLogin = createSignupLimiter({ limit: 10, message: 'Too many sign-in attempts. Please wait 10 minutes before trying again.' }), shiftClock = Date.now, setupClock = Date.now, setupHash, aiDraft = null, aiSearch = null, aiAvailability = null, aiSchedule = null, aiIntent = null, intentPasses = createIntentPasses(), aiAllowance = null, routingLog = null }) {
  const availabilityWindowStore=store; // General windows do not participate in automatic claims.
  store = withAvailabilityMatching(store, shiftClock);
  const limitLoginEmail = createSignupLimiter({ limit: 10, message: 'Too many sign-in attempts. Please wait 10 minutes before trying again.' });
  const limitSetup = createSignupLimiter({ limit: 20, message: 'Too many setup requests. Please wait 10 minutes and try again.' });
  const limitTeam = createSignupLimiter({ limit: 20, message: 'Too many worker changes. Please wait 10 minutes and try again.' });
  const limitShifts = createSignupLimiter({ limit: 60, message: 'Too many shift changes. Please wait 10 minutes and try again.' });
  const limitCoverage = createSignupLimiter({ limit: 30, message: 'Too many coverage changes. Please wait 10 minutes and try again.' });
  const limitNotificationReads = createSignupLimiter({ limit: 120, message: 'Too many notification updates. Please wait and refresh.' });
  const limitRoutingLog = createSignupLimiter({ limit: 120, message: 'Too many routing records. Please wait.' });
  const limitAi = createSignupLimiter({ limit: 20, windowMs: 120000, message: seconds => `Too many AI requests. Try again in ${seconds} seconds.` });
  const chatText = input => (typeof input?.description === 'string' ? input.description.trim() : '');
  // Reads an AI chat body and applies the per-turn chat limits. A valid intent
  // pass means /api/ai-intent already counted this user turn (short-term limit
  // and daily allowance). The provider call is still reserved against the total
  // cap by the handler, so every paid call is counted.
  async function readAiChat(request, userId, intent) {
    const { input, token } = takeIntentPass(await readJson(request));
    const turnCounted = intentPasses.redeem(token, userId, intent, chatText(input), shiftClock());
    if (!turnCounted) limitAi(userId);
    return { input, options: { turnCounted } };
  }
  return createServer(async (request, response) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'same-origin');
    response.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    if (sessions.secure) response.setHeader('Strict-Transport-Security', 'max-age=31536000');
    let pathname;
    try {
      pathname = new URL(request.url, 'http://localhost').pathname;
      if(pathname==='/api/worker/cover-options'){
        requireMethod(request,response,'GET');const account=await requireAccount(store,sessions,request.headers.cookie,'worker'),query=new URL(request.url,'http://localhost').searchParams;
        if(query.size!==1||query.getAll('recipientId').length!==1)throw new HttpError(400,'Select one coworker.');
        sendJson(response,200,await coverOptions(store,account.user.id,query.get('recipientId'),shiftClock));return;
      }
      const coverRoute=pathname.match(/^\/api\/(worker|manager)\/cover-invitations(?:\/([a-zA-Z0-9_-]{1,80})\/(accept|decline|cancel))?$/);
      if(coverRoute){
        const [,role,id,action]=coverRoute,listing=!id&&request.method==='GET';
        requireMethod(request,response,role==='manager'||listing?'GET':'POST');const account=await requireAccount(store,sessions,request.headers.cookie,role);
        if(new URL(request.url,'http://localhost').search)throw new HttpError(400,'Cover invitations use your signed-in account.');
        if(listing){sendJson(response,200,await listCoverInvitations(store,account.user.id,shiftClock));return;}
        if(role!=='worker')throw new HttpError(403,'Only employees can send or respond to invitations.');
        protectMutation(request,publicOrigin);if(!sessions.validCsrf(account.session,request.headers['x-csrf-token']))throw new HttpError(403,'Refresh the page and try again.');
        limitCoverage(account.user.id);const input=await readJson(request);
        if(id)sendJson(response,200,await decideCoverInvitation(store,account.user.id,id,action,input,shiftClock));
        else{const result=await sendCoverInvitation(store,account.user.id,input,shiftClock);sendJson(response,result.replayed?200:201,result);}return;
      }
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
          const period = query.size === 3 && ['startLocal','endLocal','timezone'].every(k => query.getAll(k).length === 1);
          const day = query.size === 1 && query.has('date');
          if(id || (query.size && !period && !day))throw new HttpError(400,'Choose only a start, end and business timezone.');
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
      if (pathname === '/api/worker/availability-explanation') {
        requireMethod(request, response, 'POST'); protectMutation(request, publicOrigin);
        const account = await requireAccount(store, sessions, request.headers.cookie, 'worker');
        if (!sessions.validCsrf(account.session, request.headers['x-csrf-token'])) throw new HttpError(403, 'Refresh the page and try again.');
        if (new URL(request.url, 'http://localhost').search) throw new HttpError(400, 'Explanations use your signed-in workspace.');
        limitCoverage(account.user.id);
        sendJson(response, 200, await explainAvailability(store, account.user.id, await readJson(request), shiftClock));
        return;
      }
      if (pathname === '/api/ai-working-summary') {
        requireMethod(request, response, 'GET');
        const account = await requireAccount(store, sessions, request.headers.cookie);
        const query = new URL(request.url, 'http://localhost').searchParams;
        if (query.size !== 1 || !query.has('week')) throw new HttpError(422, 'Choose this week or next week.');
        sendJson(response, 200, await workingSummary(store, account.user.id, query.get('week'), shiftClock));
        return;
      }
      if (pathname === '/api/ai-routing-log') {
        requireMethod(request, response, 'POST');
        protectMutation(request, publicOrigin);
        const account = await requireAccount(store, sessions, request.headers.cookie);
        if (!sessions.validCsrf(account.session, request.headers['x-csrf-token'])) {
          throw new HttpError(403, 'Refresh the page and try again.');
        }
        if (new URL(request.url, 'http://localhost').search) throw new HttpError(400, 'Routing records use your signed-in account.');
        const input = await readJson(request);
        limitRoutingLog(account.user.id);
        // Only the role is taken from the account: never its ID or name.
        if (routingLog) await routingLog.append(account.user.role, input, shiftClock(), account.business.timezone);
        else validRoutingEntry(input);
        response.writeHead(204, { 'Cache-Control': 'no-store' });
        response.end();
        return;
      }
      if (pathname === '/api/ai-usage') {
        requireMethod(request, response, 'GET');
        const account = await requireAccount(store, sessions, request.headers.cookie);
        if (new URL(request.url, 'http://localhost').search) throw new HttpError(400, 'Usage is for your signed-in account.');
        if (!aiAllowance) throw new HttpError(503, 'AI is not configured.');
        sendJson(response, 200, await aiAllowance.status(account.user.id, shiftClock(), account.business.timezone));
        return;
      }
      if (pathname === '/api/ai-intent' || pathname === '/api/ai-schedule-question') {
        requireMethod(request, response, 'POST');
        protectMutation(request, publicOrigin);
        const account = await requireAccount(store, sessions, request.headers.cookie);
        if (!sessions.validCsrf(account.session, request.headers['x-csrf-token'])) {
          throw new HttpError(403, 'Refresh the page and try again.');
        }
        const classifying = pathname === '/api/ai-intent';
        if (new URL(request.url, 'http://localhost').search) {
          throw new HttpError(400, classifying ? 'Intent recognition uses your signed-in workspace.' : 'Questions use your signed-in schedule.');
        }
        const handler = classifying ? aiIntent : aiSchedule;
        if (!handler) {
          throw new HttpError(503, classifying ? 'AI intent recognition is not configured.' : 'AI schedule questions are not configured.');
        }
        if (classifying) {
          const input = await readJson(request);
          limitAi(account.user.id);
          const { intent } = await handler(account, input, shiftClock);
          const pass = intentPasses.issue(account.user.id, intent, chatText(input), shiftClock());
          sendJson(response, 200, { intent, ...(pass && { pass }) });
          return;
        }
        const { input, options } = await readAiChat(request, account.user.id, 'questions');
        sendJson(response, 200, await handler(store, account.user.id, input, shiftClock, options));
        return;
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
      if(pathname==='/api/manager/schedule-period'||pathname==='/api/manager/schedule-prepare'||pathname==='/api/manager/schedule-publish'||/^\/api\/manager\/schedule-drafts\/[a-zA-Z0-9_-]{1,80}\/discard$/.test(pathname)){
        const reading=pathname==='/api/manager/schedule-period';requireMethod(request,response,reading?'GET':'POST');
        const account=await requireAccount(store,sessions,request.headers.cookie,'manager');
        const url=new URL(request.url,'http://localhost');
        if(reading){if([...url.searchParams.keys()].some(k=>k!=='startsOn'))throw new HttpError(400,'Choose only a schedule start date.');sendJson(response,200,await getSchedulePeriod(store,account.user.id,url.searchParams.get('startsOn'),shiftClock()));return;}
        protectMutation(request,publicOrigin);if(url.search)throw new HttpError(400,'Use your signed-in business.');
        if(!sessions.validCsrf(account.session,request.headers['x-csrf-token']))throw new HttpError(403,'Refresh the page and try again.');
        const input=await readJson(request);limitShifts(account.user.id);
        const result=pathname.endsWith('prepare')?await prepareSchedule(store,account.user.id,input,shiftClock):pathname.endsWith('publish')?await publishSchedule(store,account.user.id,input,shiftClock):await discardDraft(store,account.user.id,pathname.split('/')[4],input);
        sendJson(response,200,result);return;
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
      const ruleChange = /^\/api\/worker\/availability-rules\/[a-zA-Z0-9_-]{1,80}\/(pause|resume|cancel)$/.test(pathname);
      if (pathname === '/api/worker/availability-rules' || ruleChange || pathname === '/api/worker/ai-availability-draft') {
        const list = pathname === '/api/worker/availability-rules' && request.method === 'GET';
        requireMethod(request, response, list ? 'GET' : 'POST');
        const account = await requireAccount(store, sessions, request.headers.cookie, 'worker');
        if (new URL(request.url, 'http://localhost').search) {
          throw new HttpError(400, 'Availability uses your signed-in account.');
        }
        if (list) {
          sendJson(response, 200, await listAvailability(store, account.user.id, shiftClock));
          return;
        }
        protectMutation(request, publicOrigin);
        if (!sessions.validCsrf(account.session, request.headers['x-csrf-token'])) {
          throw new HttpError(403, 'Refresh the page and try again.');
        }
        if (pathname === '/api/worker/ai-availability-draft') {
          const { input, options } = await readAiChat(request, account.user.id, 'availability');
          if (!aiAvailability) throw new HttpError(503, 'AI availability drafting is not configured.');
          sendJson(response, 200, await aiAvailability(store, account.user.id, input, shiftClock, options));
          return;
        }
        const input = await readJson(request);
        limitCoverage(account.user.id);
        if (ruleChange) {
          // /api/worker/availability-rules/:ruleId/:action
          const parts = pathname.split('/');
          const ruleId = parts[4];
          const action = parts[5];
          sendJson(response, 200, await changeAvailability(store, account.user.id, ruleId, action, input, shiftClock));
        } else {
          sendJson(response, 200, await confirmAvailability(store, account.user.id, input, shiftClock));
        }
        return;
      }
      if (['/api/worker/ai-shift-search', '/api/worker/shift-search', '/api/worker/shift-alternatives'].includes(pathname)) {
        requireMethod(request, response, 'POST');
        protectMutation(request, publicOrigin);
        const account = await requireAccount(store, sessions, request.headers.cookie, 'worker');
        if (!sessions.validCsrf(account.session, request.headers['x-csrf-token'])) {
          throw new HttpError(403, 'Refresh the page and try again.');
        }
        if (new URL(request.url, 'http://localhost').search) {
          throw new HttpError(400, 'Search uses your signed-in business.');
        }
        if (pathname === '/api/worker/ai-shift-search') {
          const { input, options } = await readAiChat(request, account.user.id, 'search');
          if (!aiSearch) throw new HttpError(503, 'AI search is not configured. Use Open shifts.');
          sendJson(response, 200, await aiSearch(store, account.user.id, input, shiftClock, options));
        } else {
          const input = await readJson(request);
          limitCoverage(account.user.id);
          const search = pathname.endsWith('/shift-alternatives') ? searchAlternativeShifts : searchExistingShifts;
          sendJson(response, 200, await search(store, account.user.id, input, shiftClock));
        }
        return;
      }
      if (pathname === '/api/manager/ai-shift-draft') {
        requireMethod(request, response, 'POST');
        protectMutation(request, publicOrigin);
        const account = await requireAccount(store, sessions, request.headers.cookie, 'manager');
        if (!sessions.validCsrf(account.session, request.headers['x-csrf-token'])) {
          throw new HttpError(403, 'Refresh the page and try again.');
        }
        if (new URL(request.url, 'http://localhost').search) {
          throw new HttpError(400, 'Drafting uses your signed-in business.');
        }
        const { input, options } = await readAiChat(request, account.user.id, 'draft');
        if (!aiDraft) throw new HttpError(503, 'AI drafting is not configured. Use the manual shift form.');
        sendJson(response, 200, await aiDraft(store, account.user.id, input, shiftClock, options));
        return;
      }
      if (pathname === '/api/manager/shift-batches') {
        requireMethod(request, response, 'POST'); protectMutation(request, publicOrigin);
        const account = await requireAccount(store, sessions, request.headers.cookie, 'manager');
        if (!sessions.validCsrf(account.session, request.headers['x-csrf-token'])) throw new HttpError(403, 'Refresh the page and try again.');
        if (new URL(request.url, 'http://localhost').search) throw new HttpError(400, 'This action uses your signed-in business.');
        limitShifts(account.user.id);
        sendJson(response, 201, await saveShiftBatch(store, account.user.id, await readJson(request), shiftClock)); return;
      }
      if (/^\/api\/manager\/shift-batches\/[a-f0-9-]{36}$/.test(pathname)) {
        requireMethod(request, response, 'GET');
        const account = await requireAccount(store, sessions, request.headers.cookie, 'manager');
        sendJson(response, 200, await getShiftBatchReceipt(store, account.user.id, pathname.split('/').at(-1))); return;
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
