import { hashPassword } from './passwords.js';
import { validateSignup } from './signup.js';

// Explicit local development utility. It never resets an existing password or
// changes a real account; only the exact two fictional seed identities qualify.
export async function enableDemoAccounts(store, password) {
  validateSignup({ name: 'Demo User', businessName: 'Demo Café', email: 'demo@example.test', password, timezone: 'America/Toronto' });
  const targets = [
    { id: 'manager_morgan', email: 'manager_morgan@example.test', role: 'manager' },
    { id: 'worker_jamie', email: 'worker_jamie@example.test', role: 'worker' },
  ];
  const matches = (user, target) => user?.id === target.id && user.email === target.email && user.role === target.role && user.businessId === 'business_demo_cafe';
  const initial = await store.read();
  if (!targets.every(target => initial.users.some(user => matches(user, target)))) throw new Error('Fictional demo users were not found. Use a dedicated demo data directory.');
  const pending = [];
  for (const target of targets) {
    if (initial.users.find(user => matches(user, target)).passwordHash === null) pending.push({ target, hash: await hashPassword(password) });
  }
  return store.transaction(db => {
    const enabled = [];
    for (const { target, hash } of pending) {
      const user = db.users.find(user => matches(user, target));
      if (!user || user.passwordHash !== null) continue;
      user.passwordHash = hash; user.updatedAt = new Date().toISOString(); enabled.push(target.email);
    }
    return enabled;
  });
}
