import { HttpError } from './errors.js';
import { verifyPassword } from './passwords.js';
export function validateLogin(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(key => !['email', 'password'].includes(key))) throw new HttpError(422, 'Enter your email and password using the login form.');
  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || typeof input.password !== 'string' || input.password.length < 1 || input.password.length > 128) throw new HttpError(422, 'Enter a valid email and password.');
  return { email, password: input.password };
}
export async function authenticate(store, input, { verify = verifyPassword } = {}) {
  const { email, password } = validateLogin(input);
  const database = await store.read();
  const user = database.users.find(record => record.email === email);
  const valid = await verify(password, user?.passwordHash ?? null);
  if (!user || !valid) throw new HttpError(401, 'Email or password is incorrect.');
  // Re-read current account state after the expensive derivation.
  const current = (await store.read()).users.find(record => record.id === user.id);
  if (!current || current.passwordHash !== user.passwordHash) throw new HttpError(401, 'Email or password is incorrect.');
  return current.id;
}
