import { randomBytes, createHash } from 'node:crypto';
import { createRecord } from '../storage/repositories.js';
import { HttpError } from '../auth/errors.js';
import { hashPassword } from '../auth/passwords.js';
const lifetime = 24 * 60 * 60 * 1000;
const invalid = () => new HttpError(400, 'This setup link is invalid, expired, or already used. Ask your manager for a new link.');
function exact(input, keys) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length !== keys.length || !keys.every(key => Object.hasOwn(input, key))) throw new HttpError(422, 'Please submit only the requested form fields.');
}
function managerIn(db, id) {
  const user = db.users.find(user => user.id === id);
  if (!user || user.passwordHash === null) throw new HttpError(401, 'Please sign in to continue.');
  if (user.role !== 'manager') throw new HttpError(403, 'Only managers can manage workers.');
  return user;
}
const digest = token => createHash('sha256').update(token).digest('hex');
const view = (user, now) => ({ id: user.id, name: user.name, email: user.email, status: user.passwordHash !== null ? 'ready' : !user.setup ? 'needed' : Date.parse(user.setup.expiresAt) <= now ? 'expired' : 'pending', setupExpiresAt: user.setup?.expiresAt ?? null });
function issue(user, now) {
  const setupToken = randomBytes(32).toString('hex');
  user.setup = { tokenHash: digest(setupToken), expiresAt: new Date(now + lifetime).toISOString() };
  user.updatedAt = new Date(now).toISOString();
  return { worker: view(user, now), setupToken, expiresAt: user.setup.expiresAt };
}
export async function listWorkers(store, managerId, now = Date.now()) {
  const db = await store.read(); const manager = managerIn(db, managerId);
  return { workers: db.users.filter(user => user.role === 'worker' && user.businessId === manager.businessId).sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id)).map(user => view(user, now)) };
}
export async function addWorker(store, managerId, input, now = Date.now()) {
  exact(input, ['name', 'email']);
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
  const fields = {};
  if (name.length < 2 || name.length > 80) fields.name = 'Use 2–80 characters for the worker’s name.';
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fields.email = 'Enter a valid email address.';
  if (Object.keys(fields).length) throw new HttpError(422, 'Please check the name and email.', fields);
  return store.transaction(db => {
    const manager = managerIn(db, managerId);
    if (db.users.some(user => user.email === email)) throw new HttpError(409, 'This email is already registered. Use a different email.');
    const at = new Date(now).toISOString();
    const worker = createRecord({ name, email, businessId: manager.businessId, role: 'worker', passwordHash: null, createdAt: at, updatedAt: at });
    worker.createdAt = at; worker.updatedAt = at;
    db.schemaVersion = 2;
    db.users.push(worker);
    return issue(worker, now);
  });
}
export async function reissueSetup(store, managerId, workerId, input, now = Date.now()) {
  exact(input, []);
  return store.transaction(db => {
    const manager = managerIn(db, managerId);
    const worker = db.users.find(user => user.id === workerId && user.businessId === manager.businessId && user.role === 'worker');
    if (!worker) throw new HttpError(404, 'Worker not found.');
    if (worker.passwordHash !== null) throw new HttpError(409, 'This worker already has a login. Password resets are not available here.');
    db.schemaVersion = 2;
    return issue(worker, now);
  });
}
function invited(db, token, now) {
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) throw invalid();
  const hash = digest(token);
  const user = db.users.find(user => user.role === 'worker' && user.passwordHash === null && user.setup?.tokenHash === hash && Date.parse(user.setup.expiresAt) > now);
  if (!user) throw invalid();
  return user;
}
export async function setupDetails(store, input, now = Date.now()) {
  exact(input, ['token']);
  const db = await store.read(); const user = invited(db, input.token, now);
  return { name: user.name, email: user.email, businessName: db.businesses.find(b => b.id === user.businessId).name, expiresAt: user.setup.expiresAt };
}
export async function completeSetup(store, input, { clock = Date.now, hash = hashPassword } = {}) {
  exact(input, ['token', 'password']);
  invited(await store.read(), input.token, clock());
  if (typeof input.password !== 'string' || input.password.length < 15 || input.password.length > 128) throw new HttpError(422, 'Use a password or passphrase of 15–128 characters.');
  const passwordHash = await hash(input.password);
  return store.transaction(db => {
    const now = clock(); const user = invited(db, input.token, now);
    user.passwordHash = passwordHash; delete user.setup; user.updatedAt = new Date(now).toISOString();
    return { message: 'Your worker account is ready. Sign in to see your shifts.' };
  });
}
