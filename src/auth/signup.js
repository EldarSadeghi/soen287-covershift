import { createRecord } from '../storage/repositories.js';
import { HttpError as SignupError } from './errors.js';
import { hashPassword } from './passwords.js';
export { HttpError as SignupError } from './errors.js';
export { hashPassword } from './passwords.js';

export function validateSignup(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new SignupError(422, 'Please submit the signup form.');
  const allowed = ['name', 'email', 'password', 'businessName', 'timezone'];
  if (Object.keys(input).some(key => !allowed.includes(key))) throw new SignupError(422, 'Unexpected signup fields. Use the form to create a new manager account.');
  const fields = {};
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
  const businessName = typeof input.businessName === 'string' ? input.businessName.trim() : '';
  const timezone = typeof input.timezone === 'string' ? input.timezone.trim() : '';
  const password = input.password;
  if (name.length < 2 || name.length > 80) fields.name = 'Enter your name using 2–80 characters.';
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fields.email = 'Enter a valid email address.';
  if (businessName.length < 2 || businessName.length > 100) fields.businessName = 'Enter a business name using 2–100 characters.';
  if (typeof password !== 'string' || password.length < 15 || password.length > 128) fields.password = 'Use a password or passphrase of 15–128 characters.';
  try {
    if (!timezone || timezone.length > 80) throw new Error();
    new Intl.DateTimeFormat('en', { timeZone: timezone });
  } catch { fields.timezone = 'Choose a valid business timezone.'; }
  if (Object.keys(fields).length) throw new SignupError(422, 'Please check the highlighted fields.', fields);
  return { name, email, password, businessName, timezone };
}

const duplicateEmail = () => new SignupError(409, 'An account with this email already exists.', { email: 'This email is already registered. Use a different email.' });
export async function registerManager(store, input, { hash = hashPassword } = {}) {
  const values = validateSignup(input);
  // Avoid expensive work for obvious duplicates; repeat inside the transaction
  // so simultaneous requests cannot create duplicate accounts or orphan businesses.
  if ((await store.read()).users.some(user => user.email === values.email)) throw duplicateEmail();
  const passwordHash = await hash(values.password);
  return store.transaction(db => {
    if (db.users.some(user => user.email === values.email)) throw duplicateEmail();
    const business = createRecord({ name: values.businessName, timezone: values.timezone });
    const manager = createRecord({ businessId: business.id, name: values.name, email: values.email, role: 'manager', passwordHash });
    db.businesses.push(business);
    db.users.push(manager);
    // Never send email, password hashes, or raw input back to the browser.
    return { business: { id: business.id, name: business.name }, manager: { id: manager.id, name: manager.name, role: manager.role } };
  });
}
