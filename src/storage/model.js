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
  requireValue([1, 2].includes(db.schemaVersion), 'unsupported schema version');
  requireValue(Object.keys(db).every(key => key === 'schemaVersion' || collections.includes(key)), 'unknown collection');
  for (const name of collections) {
    requireValue(Array.isArray(db[name]), `${name} must be an array`);
    const seen = new Set();
    for (const record of db[name]) {
      requireValue(record && typeof record === 'object' && !Array.isArray(record) && id(record.id), `${name} has an invalid record ID`);
      const expected = name === 'users' && db.schemaVersion === 2 && Object.hasOwn(record, 'setup') ? [...fields[name], 'setup'] : fields[name];
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
    requireValue(['open', 'pending', 'approved', 'cancelled'].includes(request.status), 'invalid coverage status');
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
    if (request.status === 'approved') requireValue(request.claimantId !== null && request.reviewerId !== null, 'approved request needs a claimant and reviewer');
  }
  return db;
}
