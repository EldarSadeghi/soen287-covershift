import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { HttpError } from './errors.js';
const deriveKey = promisify(scrypt);
let activeDerivations = 0;
async function derive(password, salt) {
  if (activeDerivations >= 2) throw new HttpError(503, 'Authentication is busy. Please try again shortly.');
  activeDerivations++;
  try { return await deriveKey(password, salt, 64, { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 }); }
  finally { activeDerivations--; }
}
export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  return `scrypt$131072$8$1$${salt}$${(await derive(password, salt)).toString('hex')}`;
}
// Unknown users, seed accounts without passwords, and malformed hashes still
// incur the same derivation cost. Only this supported parameter set is accepted.
const dummyHash = `scrypt$131072$8$1$${'0'.repeat(32)}$${'0'.repeat(128)}`;
export async function verifyPassword(password, storedHash) {
  const supported = typeof storedHash === 'string' && /^scrypt\$131072\$8\$1\$[a-f0-9]{32}\$[a-f0-9]{128}$/.test(storedHash);
  const parts = (supported ? storedHash : dummyHash).split('$');
  const actual = await derive(password, parts[4]);
  const matches = timingSafeEqual(actual, Buffer.from(parts[5], 'hex'));
  return supported && matches;
}
