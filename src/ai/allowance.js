import { mkdir, open, readFile, readdir, rmdir } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { HttpError } from '../auth/errors.js';

// Append-only reservations: reserve BEFORE calling the provider. Failed calls
// count too, since a timeout cannot prove that paid inference did not run.
// The single-server contract matches the application's JSON storage contract.
const queues = new Map();
export class AiAllowance {
  constructor(directory, { total = 500, daily = 20 } = {}) {
    if (![total, daily].every(value => Number.isInteger(value) && value >= 1 && value <= 500)) throw new Error('AI allowance must be between 1 and 500 requests.');
    this.directory = directory; this.total = total; this.daily = daily;
  }
  async reserve(managerId, now) {
    const previous = queues.get(this.directory) || Promise.resolve();
    const work = previous.catch(() => {}).then(async () => {
      await mkdir(this.directory, { recursive: true, mode: 0o700 });
      // mkdir is an atomic cross-process lock. A crash leaves it behind: fail
      // closed until an operator confirms no live writer and removes it.
      const lock = join(this.directory, '.lock');
      try { await mkdir(lock, { mode: 0o700 }); }
      catch { throw new HttpError(503, 'AI usage accounting is unavailable. Use the manual shift form.'); }
      try {
        try {
          const names = (await readdir(this.directory)).filter(name => name !== '.lock');
          if (names.some(name => !/^\d{4}\.json$/.test(name))) throw new Error('Unexpected allowance file');
          if (names.length >= this.total) throw new HttpError(429, 'The project’s AI request allowance is used up. You can still create shifts manually.');
          const day = new Date(now).toISOString().slice(0, 10);
          const actor = createHash('sha256').update(managerId).digest('hex');
          let usedToday = 0;
          for (const name of names) {
            const entry = JSON.parse(await readFile(join(this.directory, name), 'utf8'));
            if (!/^[a-f0-9]{64}$/.test(entry.actor) || !/^\d{4}-\d{2}-\d{2}$/.test(entry.day)) throw new Error('Invalid allowance entry');
            if (entry.actor === actor && entry.day === day) usedToday++;
          }
          if (usedToday >= this.daily) throw new HttpError(429, 'You’ve reached today’s AI request limit. Try tomorrow (UTC), or create the shift manually.');
          const file = await open(join(this.directory, `${String(names.length + 1).padStart(4, '0')}.json`), 'wx', 0o600);
          try { await file.writeFile(JSON.stringify({ actor, day })); await file.sync(); }
          finally { await file.close(); }
          return { remaining: this.total - names.length - 1 };
        } finally { await rmdir(lock); }
      } catch (error) {
        if (error instanceof HttpError) throw error;
        throw new HttpError(503, 'AI usage accounting is unavailable. Use the manual shift form.');
      }
    });
    queues.set(this.directory, work);
    try { return await work; }
    finally { if (queues.get(this.directory) === work) queues.delete(this.directory); }
  }
}
