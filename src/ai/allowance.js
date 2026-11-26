import { mkdir, open, readFile, readdir, rmdir } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { HttpError } from '../auth/errors.js';

// Append-only reservations: reserve BEFORE every provider call. Failed calls
// count too, since a timeout cannot prove that paid inference did not run.
// `total` caps provider calls for the whole data directory. `daily` caps user
// turns: a follow-up call for a message whose intent was already classified
// passes { newTurn: false }, so it still counts toward `total` but not `daily`.
// The single-server contract matches the application's JSON storage contract.
const queues = new Map();

// Reads every reservation and counts the user's turns on the business-local day.
async function readUsage(directory, userId, now, timezone) {
  const names = (await readdir(directory)).filter(name => name !== '.lock');
  if (names.some(name => !/^\d{4}\.json$/.test(name))) throw new Error('Unexpected allowance file');
  const calendar = new Intl.DateTimeFormat('sv-SE', { timeZone: timezone, dateStyle: 'short' });
  const day = calendar.format(now);
  const legacyDay = new Date(now).toISOString().slice(0, 10);
  const actor = createHash('sha256').update(userId).digest('hex');
  let usedToday = 0;
  for (const name of names) {
    const entry = JSON.parse(await readFile(join(directory, name), 'utf8'));
    if (!/^[a-f0-9]{64}$/.test(entry.actor) || !/^\d{4}-\d{2}-\d{2}$/.test(entry.day) ||
        (Object.hasOwn(entry, 'turn') && entry.turn !== false)) throw new Error('Invalid allowance entry');
    if (entry.turn === false || entry.actor !== actor) continue; // Follow-up calls are not new turns.
    if (Number.isFinite(entry.at) ? calendar.format(entry.at) === day : entry.day === legacyDay || entry.day === day) usedToday++;
  }
  return { names, actor, day, usedToday };
}
export class AiAllowance {
  constructor(directory, { total = 500, daily = 20 } = {}) {
    if (![total, daily].every(value => Number.isInteger(value) && value >= 1 && value <= 500)) throw new Error('AI allowance must be between 1 and 500 requests.');
    this.directory = directory; this.total = total; this.daily = daily;
  }
  async reserve(userId, now, timezone = 'UTC', { newTurn = true } = {}) {
    const previous = queues.get(this.directory) || Promise.resolve();
    const work = previous.catch(() => {}).then(async () => {
      await mkdir(this.directory, { recursive: true, mode: 0o700 });
      // mkdir is an atomic cross-process lock. A crash leaves it behind: fail
      // closed until an operator confirms no live writer and removes it.
      const lock = join(this.directory, '.lock');
      try { await mkdir(lock, { mode: 0o700 }); }
      catch { throw new HttpError(503, 'AI usage accounting is unavailable. Try again later.'); }
      try {
        try {
          const { names, actor, day, usedToday } = await readUsage(this.directory, userId, now, timezone);
          if (names.length >= this.total) throw new HttpError(429, 'The project’s AI request allowance is used up. You can still use the workspace directly.');
          if (newTurn && usedToday >= this.daily) throw new HttpError(429, 'You’ve reached today’s AI request limit. Try after midnight in your business timezone.');
          const file = await open(join(this.directory, `${String(names.length + 1).padStart(4, '0')}.json`), 'wx', 0o600);
          try { await file.writeFile(JSON.stringify({ actor, day, at: now, ...(!newTurn && { turn: false }) })); await file.sync(); }
          finally { await file.close(); }
          return { remaining: this.total - names.length - 1, remainingToday: this.daily - usedToday - (newTurn ? 1 : 0) };
        } finally { await rmdir(lock); }
      } catch (error) {
        if (error instanceof HttpError) throw error;
        throw new HttpError(503, 'AI usage accounting is unavailable. Try again later.');
      }
    });
    queues.set(this.directory, work);
    try { return await work; }
    finally { if (queues.get(this.directory) === work) queues.delete(this.directory); }
  }

  // Read-only: how many AI turns the user has left today. Never reserves.
  async status(userId, now, timezone = 'UTC') {
    try {
      const { names, usedToday } = await readUsage(this.directory, userId, now, timezone);
      const totalLeft = Math.max(0, this.total - names.length);
      const dailyLeft = Math.max(0, this.daily - usedToday);
      return {
        daily: this.daily,
        remainingToday: Math.min(dailyLeft, totalLeft),
        exhausted: totalLeft === 0 ? 'lifetime' : dailyLeft === 0 ? 'daily' : null,
      };
    } catch (error) {
      if (error.code === 'ENOENT') return { daily: this.daily, remainingToday: Math.min(this.daily, this.total), exhausted: null };
      throw new HttpError(503, 'AI usage is unavailable right now.');
    }
  }
}
