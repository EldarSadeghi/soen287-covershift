export const collections = ['businesses', 'users', 'shifts', 'coverageRequests'];
export const emptyDatabase = () => ({ schemaVersion: 1, businesses: [], users: [], shifts: [], coverageRequests: [] });
const fields = {
  businesses: ['id', 'name', 'timezone', 'createdAt', 'updatedAt'],
  users: ['id', 'businessId', 'name', 'role', 'email', 'passwordHash', 'createdAt', 'updatedAt'],
  shifts: ['id', 'businessId', 'assignedWorkerId', 'title', 'startsAt', 'endsAt', 'createdAt', 'updatedAt'],
  coverageRequests: ['id', 'businessId', 'shiftId', 'originalWorkerId', 'claimantId', 'reviewerId', 'status', 'createdAt', 'updatedAt'],
};

function requireValue(condition, message) {
  if (!condition) throw new Error(`Invalid database: ${message}`);
}
const text = value => typeof value === 'string' && value.trim().length > 0;
const id = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(value);
const timestamp = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;

export function validateDatabase(db) {
  requireValue(db && typeof db === 'object' && !Array.isArray(db), 'expected an object');
  requireValue([1, 2, 3, 4, 5, 6, 7, 8, 9].includes(db.schemaVersion), 'unsupported schema version');
  requireValue(Object.keys(db).every(key => key === 'schemaVersion' || collections.includes(key) || db.schemaVersion >= 6 && key === 'availabilityRules' || db.schemaVersion >= 7 && key === 'availabilityMatches' || db.schemaVersion >= 8 && key === 'notifications' || db.schemaVersion >= 9 && key === 'timeOffRequests'), 'unknown collection');
  for (const name of collections) {
    requireValue(Array.isArray(db[name]), `${name} must be an array`);
    const seen = new Set();
    for (const record of db[name]) {
      requireValue(record && typeof record === 'object' && !Array.isArray(record) && id(record.id), `${name} has an invalid record ID`);
      const baseFields = name === 'coverageRequests' && db.schemaVersion >= 4 && Object.hasOwn(record, 'history') ? [...fields[name], 'history'] : fields[name];
      const userFields = name === 'users' && db.schemaVersion >= 5 && Object.hasOwn(record, 'deactivation') ? [...baseFields, 'deactivation'] : baseFields;
      const expected = name === 'users' && db.schemaVersion >= 2 && Object.hasOwn(record, 'setup') ? [...userFields, 'setup'] : userFields;
      requireValue(Object.keys(record).length === expected.length && expected.every(key => Object.hasOwn(record, key)), `${name} fields do not match the schema`);
      requireValue(!seen.has(record.id), `${name} has a duplicate ID`);
      seen.add(record.id);
      requireValue(timestamp(record.createdAt) && timestamp(record.updatedAt), `${name} timestamps must be canonical UTC ISO strings`);
      requireValue(record.updatedAt >= record.createdAt, `${name} updatedAt precedes createdAt`);
    }
  }
  const businesses = new Map(db.businesses.map(record => [record.id, record]));
  const users = new Map(db.users.map(record => [record.id, record]));
  const shifts = new Map(db.shifts.map(record => [record.id, record]));
  for (const business of db.businesses) {
    requireValue(text(business.name) && text(business.timezone), 'business name and timezone are required');
    try { new Intl.DateTimeFormat('en', { timeZone: business.timezone }); }
    catch { throw new Error('Invalid database: unknown business timezone'); }
  }
  const emails = new Set();
  for (const user of db.users) {
    requireValue(businesses.has(user.businessId), 'user business does not exist');
    requireValue(['manager', 'worker'].includes(user.role) && text(user.name), 'user role or name is invalid');
    requireValue(typeof user.email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.email) && user.email === user.email.trim().toLowerCase(), 'email must be normalized');
    requireValue(!emails.has(user.email), 'duplicate email');
    emails.add(user.email);
    requireValue(user.passwordHash === null || text(user.passwordHash), 'passwordHash must be a hash string or null for an account without login');
    if (Object.hasOwn(user, 'deactivation')) {
      const info = user.deactivation; const manager = users.get(info?.managerId);
      requireValue(user.role === 'worker' && user.passwordHash === null && !Object.hasOwn(user,'setup') && info && typeof info === 'object' && !Array.isArray(info) && Object.keys(info).length === 2 && timestamp(info.at) && info.at >= user.createdAt && info.at <= user.updatedAt && manager?.role === 'manager' && manager.businessId === user.businessId, 'invalid employee deactivation');
    }
    if (Object.hasOwn(user, 'setup')) {
      const setup = user.setup;
      requireValue(user.role === 'worker' && user.passwordHash === null && setup && typeof setup === 'object' && !Array.isArray(setup) && Object.keys(setup).length === 2 && /^[a-f0-9]{64}$/.test(setup.tokenHash) && timestamp(setup.expiresAt), 'invalid worker setup metadata');
    }
    requireValue(!Object.hasOwn(user, 'password'), 'plaintext passwords must never be stored');
  }
  for (const shift of db.shifts) {
    const worker = users.get(shift.assignedWorkerId);
    requireValue(businesses.has(shift.businessId) && worker?.businessId === shift.businessId && worker.role === 'worker', 'shift must reference a worker in its business');
    requireValue(text(shift.title) && timestamp(shift.startsAt) && timestamp(shift.endsAt) && shift.startsAt < shift.endsAt, 'shift title or time range is invalid');
  }
  const activeShifts = new Set();
  for (const request of db.coverageRequests) {
    const shift = shifts.get(request.shiftId);
    const original = users.get(request.originalWorkerId);
    requireValue(shift?.businessId === request.businessId && businesses.has(request.businessId), 'request shift must belong to its business');
    requireValue(original?.businessId === request.businessId && original.role === 'worker', 'original worker must belong to the request business');
    requireValue((request.status === 'rejected' ? db.schemaVersion >= 3 : ['open', 'pending', 'approved', 'cancelled'].includes(request.status)), 'invalid coverage status');
    if (Object.hasOwn(request, 'history')) {
      requireValue(Array.isArray(request.history) && request.history.length > 0, 'coverage history must contain events');
      let previousAt = request.createdAt;
      const outcomes = { requested: 'open', claimed: 'pending', approved: 'approved', rejected: 'rejected', reopened: 'open', cancelled: 'cancelled' };
      for (const event of request.history) {
        requireValue(event && typeof event === 'object' && !Array.isArray(event) && Object.keys(event).length === 4 && ['action','actorId','at','status'].every(k => Object.hasOwn(event,k)), 'invalid coverage event fields');
        requireValue(timestamp(event.at) && event.at >= previousAt && event.at <= request.updatedAt, 'coverage events must be chronological');
        previousAt = event.at;
        if (event.action === 'legacy') requireValue(event === request.history[0] && event.actorId === null && ['open','pending','approved','rejected','cancelled'].includes(event.status), 'invalid legacy coverage snapshot');
        else {
          const actor = users.get(event.actorId);
          requireValue(Object.hasOwn(outcomes,event.action) && outcomes[event.action] === event.status && actor?.businessId === request.businessId, 'invalid coverage event action or actor');
          requireValue(['approved','rejected','reopened'].includes(event.action) ? actor.role === 'manager' : actor.role === 'worker', 'invalid coverage actor role');
          if (['requested','cancelled'].includes(event.action)) requireValue(actor.id === request.originalWorkerId, 'coverage event must belong to original worker');
          if (event.action === 'claimed') requireValue(actor.id === request.claimantId, 'claim event must belong to claimant');
        }
      }
    }
    if (request.claimantId !== null) {
      const claimant = users.get(request.claimantId);
      requireValue(claimant?.businessId === request.businessId && claimant.role === 'worker' && claimant.id !== original.id, 'claimant must be another worker in the same business');
    }
    if (request.reviewerId !== null) {
      const reviewer = users.get(request.reviewerId);
      requireValue(reviewer?.businessId === request.businessId && reviewer.role === 'manager', 'reviewer must be a manager in the same business');
    }
    if (request.status === 'open' || request.status === 'pending') {
      requireValue(!activeShifts.has(request.shiftId), 'multiple active requests for a shift');
      activeShifts.add(request.shiftId);
      requireValue(shift.assignedWorkerId === request.originalWorkerId && request.reviewerId === null, 'active coverage must retain the original assignment and have no reviewer');
    }
    if (request.status === 'open') requireValue(request.claimantId === null, 'open request cannot have a claimant');
    if (request.status === 'pending') requireValue(request.claimantId !== null, 'pending request needs a claimant');
    if (['approved', 'rejected'].includes(request.status)) requireValue(request.claimantId !== null && request.reviewerId !== null, 'reviewed request needs a claimant and reviewer');
  }
  if (db.schemaVersion >= 6) {
    requireValue(Array.isArray(db.availabilityRules), 'availabilityRules must be an array');
    const seen = new Set(); const confirmations = new Set(); const orders = new Set();
    const ruleFields = ['id','businessId','workerId','startsAt','endsAt','timezone','title','maxClaims','confirmationId','status','confirmedAt','createdAt','updatedAt'];
    for (const rule of db.availabilityRules) {
      requireValue(rule && !Array.isArray(rule) && Object.keys(rule).length === ruleFields.length && ruleFields.every(k => Object.hasOwn(rule,k)), 'invalid availability fields');
      const worker = users.get(rule.workerId);
      requireValue(id(rule.id) && !seen.has(rule.id) && businesses.has(rule.businessId) && worker?.businessId === rule.businessId && worker.role === 'worker', 'invalid availability identity or scope');
      seen.add(rule.id);
      requireValue(typeof rule.confirmationId === 'string' && /^[a-f0-9-]{36}$/.test(rule.confirmationId) && !confirmations.has(rule.workerId + ':' + rule.confirmationId), 'duplicate or invalid availability confirmation');
      confirmations.add(rule.workerId + ':' + rule.confirmationId);
      requireValue(timestamp(rule.startsAt) && timestamp(rule.endsAt) && rule.endsAt > rule.startsAt && Date.parse(rule.endsAt)-Date.parse(rule.startsAt)<=25*3600000, 'invalid availability window');
      requireValue(timestamp(rule.confirmedAt) && rule.confirmedAt === rule.createdAt && timestamp(rule.updatedAt) && rule.updatedAt >= rule.createdAt && !orders.has(rule.confirmedAt), 'invalid availability confirmation order');
      orders.add(rule.confirmedAt);
      try { new Intl.DateTimeFormat('en', {timeZone:rule.timezone}); } catch { throw new Error('Invalid database: availability timezone'); }
      requireValue(text(rule.timezone) && typeof rule.title === 'string' && rule.title === rule.title.trim() && rule.title.length <= 100 && !/[\x00-\x1f]/.test(rule.title) && Number.isInteger(rule.maxClaims) && rule.maxClaims >= 1 && rule.maxClaims <= 5 && ['active','paused','cancelled'].includes(rule.status), 'invalid availability limits or status');
      requireValue(!worker.deactivation || rule.status === 'cancelled', 'inactive employee has actionable availability');
    }
  }
  if (db.schemaVersion >= 7) {
    requireValue(Array.isArray(db.availabilityMatches), 'availabilityMatches must be an array');
    const rules = new Map(db.availabilityRules.map(r => [r.id,r]));
    const requests = new Map(db.coverageRequests.map(r => [r.id,r]));
    const seen = new Set(), pairs = new Set(), requestIds = new Set(), counts = new Map();
    for (const match of db.availabilityMatches) {
      const expected = ['id','businessId','ruleId','workerId','shiftId','requestId','createdAt','updatedAt'];
      requireValue(match && !Array.isArray(match) && Object.keys(match).length === expected.length && expected.every(k => Object.hasOwn(match,k)), 'invalid availability match fields');
      const rule = rules.get(match.ruleId), request = requests.get(match.requestId), shift = shifts.get(match.shiftId);
      requireValue(id(match.id) && !seen.has(match.id) && !pairs.has(match.workerId+':'+match.shiftId) && !requestIds.has(match.requestId), 'duplicate availability match');
      seen.add(match.id);pairs.add(match.workerId+':'+match.shiftId);requestIds.add(match.requestId);
      requireValue(rule && rule.businessId === match.businessId && rule.workerId === match.workerId && shift?.businessId === match.businessId && request?.businessId === match.businessId && request.shiftId === match.shiftId && request.claimantId === match.workerId && request.status !== 'open', 'invalid availability match references');
      requireValue(timestamp(match.createdAt) && match.updatedAt === match.createdAt && match.createdAt >= rule.confirmedAt && match.createdAt <= request.updatedAt, 'invalid availability match timestamps');
      counts.set(rule.id,(counts.get(rule.id)||0)+1);
      requireValue(counts.get(rule.id) <= rule.maxClaims, 'availability match limit exceeded');
    }
  }
  if (db.schemaVersion >= 8) {
    requireValue(Array.isArray(db.notifications), 'notifications must be an array');
    const seen=new Set(), events=new Set();
    for (const n of db.notifications) {
      const expected=['id','businessId','userId','requestId','action','createdAt','readAt'];
      requireValue(n && !Array.isArray(n) && Object.keys(n).length===expected.length && expected.every(k=>Object.hasOwn(n,k)), 'invalid notification fields');
      const user=users.get(n.userId),r=db.coverageRequests.find(r=>r.id===n.requestId);
      requireValue(typeof n.id==='string' && /^[a-f0-9]{64}$/.test(n.id) && !seen.has(n.id), 'duplicate or invalid notification ID');seen.add(n.id);
      requireValue(user && r && r.businessId===n.businessId && user.businessId===n.businessId, 'invalid notification scope');
      requireValue(['claimed','approved','rejected','cancelled'].includes(n.action) && r.claimantId && r.history?.some(e=>e.action===n.action && e.at===n.createdAt), 'invalid notification event');
      requireValue(user.role==='manager' ? ['claimed','cancelled'].includes(n.action) : user.id===r.claimantId || ['approved','rejected'].includes(n.action) && user.id===r.originalWorkerId, 'invalid notification recipient');
      requireValue(timestamp(n.createdAt) && (n.readAt===null || timestamp(n.readAt) && n.readAt>=n.createdAt), 'invalid notification timestamps');
      const key=[n.requestId,n.action,n.createdAt,n.userId].join(':');requireValue(!events.has(key),'duplicate notification event');events.add(key);
    }
  }
  if (db.schemaVersion >= 9) {
    requireValue(Array.isArray(db.timeOffRequests), 'timeOffRequests must be an array');
    const seen=new Set(), submissions=new Set(), active=[];
    const expected=['id','businessId','workerId','startsAt','endsAt','timezone','allDay','note','submissionId','status','reviewerId','createdAt','updatedAt','history'];
    for(const r of db.timeOffRequests){
      requireValue(r&&typeof r==='object'&&!Array.isArray(r)&&Object.keys(r).length===expected.length&&expected.every(k=>Object.hasOwn(r,k)), 'invalid time-off fields');
      const worker=users.get(r.workerId),reviewer=users.get(r.reviewerId);
      requireValue(id(r.id)&&!seen.has(r.id)&&businesses.has(r.businessId)&&worker?.businessId===r.businessId&&worker.role==='worker', 'invalid time-off identity or scope');seen.add(r.id);
      requireValue(typeof r.submissionId==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(r.submissionId)&&!submissions.has(r.workerId+':'+r.submissionId), 'invalid or duplicate time-off submission');submissions.add(r.workerId+':'+r.submissionId);
      requireValue(timestamp(r.startsAt)&&timestamp(r.endsAt)&&r.endsAt>r.startsAt&&Date.parse(r.endsAt)-Date.parse(r.startsAt)<=367*86400000&&timestamp(r.createdAt)&&timestamp(r.updatedAt)&&r.updatedAt>=r.createdAt, 'invalid time-off dates');
      requireValue(text(r.timezone)&&typeof r.allDay==='boolean'&&typeof r.note==='string'&&r.note===r.note.trim()&&r.note.length<=500&&!/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(r.note), 'invalid time-off details');
      let formatter;try{formatter=new Intl.DateTimeFormat('en-CA',{timeZone:r.timezone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'});}catch{throw new Error('Invalid database: time-off timezone');}
      if(r.allDay)requireValue([r.startsAt,r.endsAt].every(t=>formatter.format(new Date(t))==='00:00'), 'full-day leave must use local midnight');
      requireValue(['pending','approved','rejected','cancelled'].includes(r.status)&&(r.reviewerId===null||reviewer?.businessId===r.businessId&&reviewer.role==='manager'), 'invalid time-off decision');
      requireValue(r.status==='pending'?r.reviewerId===null:['approved','rejected'].includes(r.status)?r.reviewerId!==null:true, 'invalid time-off reviewer');
      requireValue(Array.isArray(r.history)&&r.history.length>0, 'time-off history is required');let previousAt=r.createdAt,previousStatus=null;
      for(const [index,e] of r.history.entries()){
        requireValue(e&&typeof e==='object'&&!Array.isArray(e)&&Object.keys(e).length===4&&['action','actorId','at','status'].every(k=>Object.hasOwn(e,k)), 'invalid time-off event fields');
        const actor=users.get(e.actorId),states={requested:'pending',approve:'approved',reject:'rejected',cancel:'cancelled',cancel_inactive:'cancelled'};
        requireValue(timestamp(e.at)&&e.at>=previousAt&&e.at<=r.updatedAt&&actor?.businessId===r.businessId&&Object.hasOwn(states,e.action)&&states[e.action]===e.status, 'invalid time-off event');
        requireValue(index===0?e.action==='requested'&&e.at===r.createdAt:previousStatus==='pending'?['approve','reject','cancel','cancel_inactive'].includes(e.action):previousStatus==='approved'?['cancel','cancel_inactive'].includes(e.action):false, 'invalid time-off transition');
        requireValue(['requested','cancel'].includes(e.action)?actor.id===r.workerId:actor.role==='manager', 'invalid time-off actor');
        if(e.action==='cancel_inactive')requireValue(worker.deactivation?.managerId===actor.id&&e.at>=worker.deactivation.at, 'invalid inactive time-off cancellation');
        if(['approve','reject'].includes(e.action))requireValue(actor.id===r.reviewerId, 'time-off reviewer does not match decision');
        previousAt=e.at;previousStatus=e.status;
      }
      requireValue(previousStatus===r.status&&previousAt===r.updatedAt, 'time-off outcome must match history');
      requireValue(!worker.deactivation||r.status!=='pending'&&(r.status!=='approved'||r.endsAt<=worker.deactivation.at), 'inactive employee has actionable time off');
      if(['pending','approved'].includes(r.status)){requireValue(!active.some(x=>x.workerId===r.workerId&&x.startsAt<r.endsAt&&r.startsAt<x.endsAt), 'overlapping active time-off requests');active.push(r);}
    }
  }
  return db;
}
