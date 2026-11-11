import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { HttpError } from './errors.js';
const token = () => randomBytes(32).toString('hex');
const digest = value => createHash('sha256').update(value).digest('hex');
export class SessionStore {
  #sessions = new Map();
  constructor({ now = Date.now, idleMs = 30 * 60 * 1000, absoluteMs = 8 * 60 * 60 * 1000, maxSessions = 2000, secure = false } = {}) {
    Object.assign(this, { now, idleMs, absoluteMs, maxSessions, secure });
    this.cookieName = secure ? '__Host-covershift' : 'covershift_session';
  }
  cookieToken(header = '') {
    const cookies = header.split(';').map(part => part.trim()).filter(part => part.startsWith(`${this.cookieName}=`));
    if (cookies.length !== 1) return null;
    const value = cookies[0].slice(this.cookieName.length + 1);
    return /^[a-f0-9]{64}$/.test(value) ? value : null;
  }
  #prune() {
    const now = this.now();
    for (const [key, session] of this.#sessions) if (now >= session.expiresAt || now - session.lastSeen >= this.idleMs) this.#sessions.delete(key);
  }
  get(header) {
    this.#prune();
    const value = this.cookieToken(header);
    const session = value ? this.#sessions.get(digest(value)) : null;
    if (!session) return null;
    session.lastSeen = this.now();
    return { ...session };
  }
  create(userId, oldCookie) {
    this.#prune();
    // An authenticated login always replaces its presented session ID.
    const oldToken = this.cookieToken(oldCookie);
    if (this.#sessions.size >= this.maxSessions && !(oldToken && this.#sessions.has(digest(oldToken)))) throw new HttpError(503, 'Sign-in is busy. Please try again shortly.');
    const value = token();
    const session = { userId, csrfToken: token(), lastSeen: this.now(), expiresAt: this.now() + this.absoluteMs };
    if (oldToken) this.#sessions.delete(digest(oldToken));
    this.#sessions.set(digest(value), session);
    return { cookie: this.#cookie(value, Math.floor(this.absoluteMs / 1000)) };
  }
  destroy(header) {
    const value = this.cookieToken(header);
    if (value) this.#sessions.delete(digest(value));
    return this.#cookie('', 0);
  }
  validCsrf(session, candidate) {
    return typeof candidate === 'string' && /^[a-f0-9]{64}$/.test(candidate) && timingSafeEqual(Buffer.from(session.csrfToken, 'hex'), Buffer.from(candidate, 'hex'));
  }
  #cookie(value, maxAge) {
    return `${this.cookieName}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${this.secure ? '; Secure' : ''}`;
  }
}

export async function requireAccount(store, sessions, cookie, role = null) {
  const session = sessions.get(cookie);
  if (!session) throw new HttpError(401, 'Please sign in to continue.');
  const db = await store.read();
  const user = db.users.find(record => record.id === session.userId);
  const business = db.businesses.find(record => record.id === user?.businessId);
  if (!user || !business || user.passwordHash === null) {
    sessions.destroy(cookie);
    throw new HttpError(401, 'Please sign in to continue.');
  }
  if (role && user.role !== role) throw new HttpError(403, 'This page is not available for your account role.');
  return { session, user, business };
}
export const safeAccount = ({ user, business }) => ({
  user: { id: user.id, name: user.name, role: user.role, businessId: user.businessId },
  business: { id: business.id, name: business.name, timezone: business.timezone },
});
