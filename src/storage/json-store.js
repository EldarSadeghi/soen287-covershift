import { mkdir, open, readFile, rename, unlink } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { emptyDatabase, validateDatabase } from './model.js';

// One queue per resolved file, shared by all store instances in this process.
const queues = new Map();

export class JsonStore {
  constructor(filename) { this.filename = resolve(filename); }

  async read() {
    // Read errors and invalid JSON propagate; never replace a damaged database.
    return validateDatabase(JSON.parse(await readFile(this.filename, 'utf8')));
  }

  async initialize() {
    return this.#exclusive(async () => {
      try { await this.read(); }
      catch (error) {
        if (error.code !== 'ENOENT') throw error;
        await this.#write(emptyDatabase());
      }
    });
  }

  async transaction(change) {
    return this.#exclusive(async () => {
      const draft = await this.read();
      const result = structuredClone(await change(draft));
      validateDatabase(draft);
      await this.#write(draft);
      return result;
    });
  }

  async #exclusive(operation) {
    const previous = queues.get(this.filename) || Promise.resolve();
    const current = previous.catch(() => {}).then(async () => {
      await mkdir(dirname(this.filename), { recursive: true, mode: 0o700 });
      const lockPath = `${this.filename}.lock`;
      let lock;
      try { lock = await open(lockPath, 'wx', 0o600); }
      catch (error) {
        if (error.code === 'EEXIST') throw new Error('Storage is busy: another writer or a stale lock exists. See docs/data-model.md.');
        throw error;
      }
      try { return await operation(); }
      finally { await lock.close(); await unlink(lockPath); }
    });
    queues.set(this.filename, current);
    try { return await current; }
    finally { if (queues.get(this.filename) === current) queues.delete(this.filename); }
  }

  async #write(database) {
    // Finish serializing before opening a temporary file. Rename keeps readers
    // from observing partial writes and commits all collections together.
    const content = `${JSON.stringify(database, null, 2)}\n`;
    const temporary = `${this.filename}.${randomUUID()}.tmp`;
    let handle;
    try {
      handle = await open(temporary, 'wx', 0o600);
      await handle.writeFile(content, 'utf8');
      await handle.sync();
      await handle.close();
      handle = undefined;
      await rename(temporary, this.filename);
    } finally {
      if (handle) await handle.close();
      await unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error; });
    }
  }
}
