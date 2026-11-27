import { appendFile, mkdir, readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { HttpError } from '../auth/errors.js';

// Private routing log: one line per routed chat message, in
// DATA_DIRECTORY/ai-routing/YYYY-MM.jsonl (business-local month). It records
// only the date, role and how the message was routed: never message text,
// user IDs or names. Each month is capped, so the log cannot grow without bound.
export const ROUTES = new Set([
  'questions', 'search', 'availability', 'coworkers', 'history', 'updates', 'timeOffDraft', 'coverDraft', 'teamAvailability', 'teamTimeOff', 'coverageStatus', 'publicationStatus', 'teamHours', 'coverageGaps', 'shiftHistory', 'summary', 'claimStatus', 'coverStatus', 'timeOffStatus',
  'explanation', 'rules', 'alternatives', 'draft', 'shiftEdit', 'clarification',
]);
export const DECIDERS = new Set(['local', 'follow-up', 'classifier', 'unsupported', 'local-clarification']);
const MAX_PER_MONTH = 20000;

export function validRoutingEntry(input) {
  const keys = ['route', 'decidedBy', 'clarification'];
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
      Object.keys(input).length !== keys.length || !keys.every(key => Object.hasOwn(input, key)) ||
      !ROUTES.has(input.route) || !DECIDERS.has(input.decidedBy) || typeof input.clarification !== 'boolean' ||
      input.clarification !== (input.route === 'clarification')) {
    throw new HttpError(422, 'Invalid routing record.');
  }
  return { route: input.route, decidedBy: input.decidedBy, clarification: input.clarification };
}

export class RoutingLog {
  constructor(directory, { maxPerMonth = MAX_PER_MONTH } = {}) {
    this.directory = directory;
    this.maxPerMonth = maxPerMonth;
    this.counts = new Map();
    this.queue = Promise.resolve();
  }

  // Appends one record; returns false when this month's cap is reached.
  append(role, entry, now, timezone) {
    const record = validRoutingEntry(entry);
    const day = new Intl.DateTimeFormat('sv-SE', { timeZone: timezone, dateStyle: 'short' }).format(now);
    const file = join(this.directory, `${day.slice(0, 7)}.jsonl`);
    const line = `${JSON.stringify({ day, role: role === 'manager' ? 'manager' : 'employee', ...record })}\n`;
    const work = this.queue.catch(() => {}).then(async () => {
      await mkdir(this.directory, { recursive: true, mode: 0o700 });
      if (!this.counts.has(file)) {
        const existing = await readFile(file, 'utf8').catch(error => (error.code === 'ENOENT' ? '' : Promise.reject(error)));
        this.counts.set(file, existing.split('\n').filter(Boolean).length);
      }
      if (this.counts.get(file) >= this.maxPerMonth) return false;
      await appendFile(file, line, { mode: 0o600 });
      this.counts.set(file, this.counts.get(file) + 1);
      return true;
    });
    this.queue = work;
    return work;
  }
}

// Summarises every month in the log directory (for npm run ai:routing-report).
export async function summarizeRoutingLog(directory) {
  const names = (await readdir(directory).catch(() => [])).filter(name => /^\d{4}-\d{2}\.jsonl$/.test(name)).sort();
  const summary = { months: names.map(name => name.slice(0, 7)), total: 0, byRole: {}, byRoute: {}, byDecider: {}, clarifications: 0 };
  const bump = (group, key) => { group[key] = (group[key] || 0) + 1; };
  for (const name of names) {
    for (const line of (await readFile(join(directory, name), 'utf8')).split('\n').filter(Boolean)) {
      let row;
      try { row = JSON.parse(line); } catch { continue; }
      summary.total++;
      bump(summary.byRole, row.role);
      bump(summary.byRoute, row.route);
      bump(summary.byDecider, row.decidedBy);
      if (row.clarification) summary.clarifications++;
    }
  }
  return summary;
}
